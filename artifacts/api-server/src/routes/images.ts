import { Router, type IRouter } from "express";
import { db, projectsTable, editedImagesTable } from "@workspace/db";
import { eq, and, desc } from "drizzle-orm";
import { requireAuth } from "../middlewares/requireAuth";
import { checkAndIncrementUsage, refundUsage } from "../lib/usage";
import {
  resolveProviderForUser,
  MissingProviderKeyError,
  ProviderCapabilityError,
  PROVIDER_LABELS,
} from "../lib/ai-providers";
import { readFile, writeFile } from "node:fs/promises";
import path from "path";
import { randomUUID } from "crypto";

const uploadsDir = path.join(process.cwd(), "uploads");

const router: IRouter = Router();

function getImageUrl(_req: unknown, filename: string): string {
  return `/api/uploads/${filename}`;
}

function getImageMimeType(imageUrl: string): string {
  switch (path.extname(imageUrl).toLowerCase()) {
    case ".jpg":
    case ".jpeg":
      return "image/jpeg";
    case ".webp":
      return "image/webp";
    case ".png":
    default:
      return "image/png";
  }
}

async function downloadImageToBuffer(imageUrl: string): Promise<Buffer> {
  const uploadsPrefix = "/api/uploads/";
  if (!imageUrl.startsWith(uploadsPrefix)) {
    throw new Error("Unsupported image URL");
  }

  const filename = imageUrl.slice(uploadsPrefix.length);
  if (!filename || path.basename(filename) !== filename) {
    throw new Error("Invalid image filename");
  }

  return readFile(path.join(uploadsDir, filename));
}

async function saveBase64Image(base64Data: string, ext = ".png"): Promise<string> {
  const filename = `${randomUUID()}${ext}`;
  const filePath = path.join(uploadsDir, filename);
  const buffer = Buffer.from(base64Data, "base64");
  await writeFile(filePath, buffer);
  return filename;
}

router.post("/projects/:id/remove-background", requireAuth, async (req, res): Promise<void> => {
  const userId = req.session.userId!;
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const projectId = parseInt(raw, 10);

  if (isNaN(projectId)) {
    res.status(400).json({ error: "Invalid project ID" });
    return;
  }

  const [project] = await db
    .select()
    .from(projectsTable)
    .where(and(eq(projectsTable.id, projectId), eq(projectsTable.userId, userId)));

  if (!project) {
    res.status(404).json({ error: "Project not found" });
    return;
  }

  const usageCheck = await checkAndIncrementUsage(userId);
  if (!usageCheck.allowed) {
    res.status(402).json({ error: usageCheck.message ?? "Usage limit reached" });
    return;
  }

  req.log.info({ projectId }, "Removing background");

  try {
    const { adapter, imageModel } = await resolveProviderForUser(userId, { requireImageEditing: true });

    // Download the original image
    const imageBuffer = await downloadImageToBuffer(project.originalImageUrl);

    const { base64: b64 } = await adapter.editImage({
      image: imageBuffer,
      mimeType: getImageMimeType(project.originalImageUrl),
      model: imageModel,
      prompt:
        "Remove the background from this furniture image. Make the background completely transparent. Keep only the furniture piece, preserving all detail and edges cleanly.",
      size: "1024x1024",
    });

    const filename = await saveBase64Image(b64, ".png");
    const imageUrl = getImageUrl(req, filename);

    const [editedImage] = await db
      .insert(editedImagesTable)
      .values({ projectId, type: "background_removed", imageUrl })
      .returning();

    res.json({
      id: editedImage.id,
      projectId: editedImage.projectId,
      type: editedImage.type,
      imageUrl: editedImage.imageUrl,
      roomStyle: editedImage.roomStyle ?? null,
      createdAt: editedImage.createdAt.toISOString(),
    });
  } catch (err) {
    // The trial credit was already spent by checkAndIncrementUsage above,
    // before any of this ran. No image was produced, so refund it -- a
    // missing key, an unsupported provider, or a failed call shouldn't
    // cost the user one of their limited free generations.
    await refundUsage(userId);

    if (err instanceof MissingProviderKeyError) {
      res.status(400).json({
        error: `Add your ${PROVIDER_LABELS[err.provider]} API key in Account & AI before using image editing.`,
      });
      return;
    }
    if (err instanceof ProviderCapabilityError) {
      res.status(400).json({
        error: `${PROVIDER_LABELS[err.provider]} doesn't support image editing yet. Switch to OpenAI or Google in Account & AI settings, or use ${PROVIDER_LABELS[err.provider]} for ad copy only.`,
      });
      return;
    }
    req.log.error({ err }, "Background removal failed");
    res.status(500).json({ error: "Image processing failed. Please try again." });
  }
});

router.post("/projects/:id/stage", requireAuth, async (req, res): Promise<void> => {
  const userId = req.session.userId!;
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const projectId = parseInt(raw, 10);

  if (isNaN(projectId)) {
    res.status(400).json({ error: "Invalid project ID" });
    return;
  }

  const [project] = await db
    .select()
    .from(projectsTable)
    .where(and(eq(projectsTable.id, projectId), eq(projectsTable.userId, userId)));

  if (!project) {
    res.status(404).json({ error: "Project not found" });
    return;
  }

  const { roomStyle, additionalPrompt, sourceImageId } = req.body;

  if (!roomStyle) {
    res.status(400).json({ error: "roomStyle is required" });
    return;
  }

  const usageCheck = await checkAndIncrementUsage(userId);
  if (!usageCheck.allowed) {
    res.status(402).json({ error: usageCheck.message ?? "Usage limit reached" });
    return;
  }

  req.log.info({ projectId, roomStyle }, "Staging room");

  try {
    const { adapter, imageModel } = await resolveProviderForUser(userId, { requireImageEditing: true });

    // Use source edited image if provided, else use original
    let sourceImageUrl = project.originalImageUrl;
    if (sourceImageId) {
      const [sourceImg] = await db
        .select()
        .from(editedImagesTable)
        .where(and(eq(editedImagesTable.id, sourceImageId), eq(editedImagesTable.projectId, projectId)));
      if (sourceImg) sourceImageUrl = sourceImg.imageUrl;
    }

    const imageBuffer = await downloadImageToBuffer(sourceImageUrl);
    const imageMimeType = getImageMimeType(sourceImageUrl);

    const styleDescriptions: Record<string, string> = {
      modern: "a modern, contemporary room with clean lines, neutral colors, and minimalist decor",
      rustic: "a rustic farmhouse room with warm wood tones, exposed beams, and cozy textures",
      bohemian: "a boho-chic room with colorful textiles, plants, woven baskets, and eclectic decor",
      minimalist: "a minimalist room with white walls, simple furniture, and abundant negative space",
      industrial: "an industrial loft space with exposed brick, metal accents, and concrete floors",
      traditional: "a traditional elegant room with classic furniture, rich colors, and refined details",
      coastal: "a coastal beach house room with light blues, whites, natural textures, and airy feel",
      mid_century: "a mid-century modern room with clean lines, organic shapes, and retro-inspired decor",
    };

    const styleDesc = styleDescriptions[roomStyle] ?? roomStyle;
    const extraPrompt = additionalPrompt ? ` ${additionalPrompt}` : "";

    const prompt = `Place this furniture piece in ${styleDesc}. The furniture should be naturally staged as if it belongs in the room. Professional interior photography style, well-lit, realistic.${extraPrompt}`;

    const { base64: b64 } = await adapter.editImage({
      image: imageBuffer,
      mimeType: imageMimeType,
      model: imageModel,
      prompt,
      size: "1536x1024",
    });

    const filename = await saveBase64Image(b64, ".png");
    const imageUrl = getImageUrl(req, filename);

    const [editedImage] = await db
      .insert(editedImagesTable)
      .values({ projectId, type: "staged", imageUrl, roomStyle })
      .returning();

    res.json({
      id: editedImage.id,
      projectId: editedImage.projectId,
      type: editedImage.type,
      imageUrl: editedImage.imageUrl,
      roomStyle: editedImage.roomStyle ?? null,
      createdAt: editedImage.createdAt.toISOString(),
    });
  } catch (err) {
    // Same reasoning as remove-background above: the trial credit was
    // already spent before this ran, and no image was produced.
    await refundUsage(userId);

    if (err instanceof MissingProviderKeyError) {
      res.status(400).json({
        error: `Add your ${PROVIDER_LABELS[err.provider]} API key in Account & AI before using image editing.`,
      });
      return;
    }
    if (err instanceof ProviderCapabilityError) {
      res.status(400).json({
        error: `${PROVIDER_LABELS[err.provider]} doesn't support image editing yet. Switch to OpenAI or Google in Account & AI settings, or use ${PROVIDER_LABELS[err.provider]} for ad copy only.`,
      });
      return;
    }
    req.log.error({ err }, "Room staging failed");
    res.status(500).json({ error: "Image processing failed. Please try again." });
  }
});

router.get("/projects/:id/images", requireAuth, async (req, res): Promise<void> => {
  const userId = req.session.userId!;
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const projectId = parseInt(raw, 10);

  if (isNaN(projectId)) {
    res.status(400).json({ error: "Invalid project ID" });
    return;
  }

  const [project] = await db
    .select()
    .from(projectsTable)
    .where(and(eq(projectsTable.id, projectId), eq(projectsTable.userId, userId)));

  if (!project) {
    res.status(404).json({ error: "Project not found" });
    return;
  }

  const images = await db
    .select()
    .from(editedImagesTable)
    .where(eq(editedImagesTable.projectId, projectId))
    .orderBy(desc(editedImagesTable.createdAt));

  res.json(
    images.map((img) => ({
      id: img.id,
      projectId: img.projectId,
      type: img.type,
      imageUrl: img.imageUrl,
      roomStyle: img.roomStyle ?? null,
      createdAt: img.createdAt.toISOString(),
    })),
  );
});

export default router;
