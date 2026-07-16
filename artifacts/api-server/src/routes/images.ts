import { Router, type IRouter } from "express";
import { db, projectsTable, editedImagesTable, usersTable } from "@workspace/db";
import { eq, and, desc } from "drizzle-orm";
import { requireAuth } from "../middlewares/requireAuth";
import { checkAndIncrementUsage } from "../lib/usage";
import { openai } from "../lib/openai";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { randomUUID } from "crypto";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const uploadsDir = path.join(__dirname, "..", "..", "uploads");

const router: IRouter = Router();

function getImageUrl(req: { protocol: string; get: (h: string) => string | undefined }, filename: string): string {
  const host = req.get("host") ?? "localhost";
  return `${req.protocol}://${host}/api/uploads/${filename}`;
}

async function downloadImageToBuffer(imageUrl: string): Promise<Buffer> {
  // If it's a local file (starts with /api/uploads/ or similar), read from disk
  const uploadsPrefix = "/api/uploads/";
  if (imageUrl.includes(uploadsPrefix)) {
    const filename = imageUrl.split(uploadsPrefix).pop()!;
    const filePath = path.join(uploadsDir, filename);
    return fs.readFileSync(filePath);
  }
  // Otherwise fetch remotely
  const res = await fetch(imageUrl);
  const buf = Buffer.from(await res.arrayBuffer());
  return buf;
}

async function saveBase64Image(base64Data: string, ext = ".png"): Promise<string> {
  const filename = `${randomUUID()}${ext}`;
  const filePath = path.join(uploadsDir, filename);
  const buffer = Buffer.from(base64Data, "base64");
  fs.writeFileSync(filePath, buffer);
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
    // Download the original image
    const imageBuffer = await downloadImageToBuffer(project.originalImageUrl);
    const imageFile = new File([new Uint8Array(imageBuffer)], "image.png", { type: "image/png" });

    const result = await openai.images.edit({
      model: "gpt-image-1",
      image: imageFile,
      prompt:
        "Remove the background from this furniture image. Make the background completely transparent. Keep only the furniture piece, preserving all detail and edges cleanly.",
      size: "1024x1024",
    });

    const b64 = result.data?.[0]?.b64_json;
    if (!b64) {
      throw new Error("No image data returned from OpenAI");
    }

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
    const imageFile = new File([new Uint8Array(imageBuffer)], "furniture.png", { type: "image/png" });

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

    const result = await openai.images.edit({
      model: "gpt-image-1",
      image: imageFile,
      prompt,
      size: "1536x1024",
    });

    const b64 = result.data?.[0]?.b64_json;
    if (!b64) {
      throw new Error("No image data returned from OpenAI");
    }

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
