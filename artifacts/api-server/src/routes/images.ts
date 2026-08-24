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
import { readFile, unlink, writeFile } from "node:fs/promises";
import path from "path";
import { randomUUID } from "crypto";
import sharp from "sharp";
import { assertFurnitureIdentityPreserved, FurnitureIdentityError } from "../lib/image-structure";

const uploadsDir = path.join(process.cwd(), "uploads");

const router: IRouter = Router();

function getImageUrl(_req: unknown, filename: string): string {
  return `/api/uploads/${filename}`;
}

async function downloadImage(imageUrl: string): Promise<{ buffer: Buffer; mimeType: string }> {
  const uploadsPrefix = "/api/uploads/";
  if (!imageUrl.startsWith(uploadsPrefix)) {
    throw new Error("Unsupported image URL");
  }

  const filename = imageUrl.slice(uploadsPrefix.length);
  if (!filename || path.basename(filename) !== filename) {
    throw new Error("Invalid image filename");
  }

  const extension = path.extname(filename).toLowerCase();
  const mimeType = extension === ".jpg" || extension === ".jpeg"
    ? "image/jpeg"
    : extension === ".webp"
      ? "image/webp"
      : "image/png";

  return {
    buffer: await readFile(path.join(uploadsDir, filename)),
    mimeType,
  };
}

async function saveBase64Image(base64Data: string, ext = ".png"): Promise<string> {
  const filename = `${randomUUID()}${ext}`;
  const filePath = path.join(uploadsDir, filename);
  const buffer = Buffer.from(base64Data, "base64");
  await writeFile(filePath, buffer);
  return filename;
}

/**
 * GPT Image 2 supports arbitrary canvases when each edge is divisible by 16.
 * Keeping the source aspect ratio is critical: forcing a portrait dresser
 * into a landscape canvas causes the model to recompose it into a new piece.
 */
async function getSourcePreservingSize(image: Buffer): Promise<string> {
  const dimensions = await sharp(image).metadata();
  if (!dimensions.width || !dimensions.height) return "auto";

  const sourceRatio = dimensions.width / dimensions.height;
  if (sourceRatio > 3 || sourceRatio < 1 / 3) return "auto";

  const minimumPixels = 655_360;
  const maximumPixels = 8_294_400;
  const maximumEdge = 3_840;
  const sourcePixels = dimensions.width * dimensions.height;
  let scale = Math.min(1, maximumEdge / Math.max(dimensions.width, dimensions.height));

  if (sourcePixels * scale * scale > maximumPixels) {
    scale = Math.sqrt(maximumPixels / sourcePixels);
  } else if (sourcePixels * scale * scale < minimumPixels) {
    scale = Math.sqrt(minimumPixels / sourcePixels);
  }

  const width = Math.max(16, Math.round((dimensions.width * scale) / 16) * 16);
  const height = Math.max(16, Math.round((dimensions.height * scale) / 16) * 16);
  return `${width}x${height}`;
}

async function getStandardSizeForOrientation(
  image: Buffer,
): Promise<"1024x1024" | "1536x1024" | "1024x1536"> {
  const dimensions = await sharp(image).metadata();
  if (!dimensions.width || !dimensions.height) return "1024x1024";
  if (dimensions.height > dimensions.width * 1.1) return "1024x1536";
  if (dimensions.width > dimensions.height * 1.1) return "1536x1024";
  return "1024x1024";
}

async function assertAspectRatioPreserved(source: Buffer, output: Buffer): Promise<void> {
  const [sourceDimensions, outputDimensions] = await Promise.all([
    sharp(source).metadata(),
    sharp(output).metadata(),
  ]);
  if (!sourceDimensions.width || !sourceDimensions.height || !outputDimensions.width || !outputDimensions.height) {
    throw new Error("Could not verify generated image dimensions");
  }

  const sourceRatio = sourceDimensions.width / sourceDimensions.height;
  const outputRatio = outputDimensions.width / outputDimensions.height;
  const ratioDrift = Math.abs(outputRatio - sourceRatio) / sourceRatio;
  if (ratioDrift > 0.02) {
    throw new Error(`Generated image changed source aspect ratio by ${(ratioDrift * 100).toFixed(1)}%`);
  }
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

  const startedAt = Date.now();
  req.log.info({ projectId }, "Removing background");

  try {
    const { adapter, imageModel } = await resolveProviderForUser(userId, { requireImageEditing: true });

    // Download the original image
    const sourceImage = await downloadImage(project.originalImageUrl);
    const backgroundRemovalModel = adapter.name === "openai" ? "gpt-image-1" : imageModel;

    const { base64: b64 } = await adapter.editImage({
      image: sourceImage.buffer,
      mimeType: sourceImage.mimeType,
      model: backgroundRemovalModel,
      prompt:
        "Remove the background from this furniture image. Make the background completely transparent. Keep only the furniture piece, preserving all detail and edges cleanly.",
      size: await getStandardSizeForOrientation(sourceImage.buffer),
      // Background removal needs clean masking, not the expensive detail pass
      // used by makeover renders. Medium is substantially faster while high
      // input fidelity still protects the furniture's silhouette and details.
      quality: "medium",
      inputFidelity: "high",
      background: "transparent",
    });

    const filename = await saveBase64Image(b64, ".png");
    const imageUrl = getImageUrl(req, filename);

    const [editedImage] = await db
      .insert(editedImagesTable)
      .values({ projectId, type: "background_removed", imageUrl })
      .returning();

    req.log.info(
      { projectId, durationMs: Date.now() - startedAt, imageId: editedImage.id },
      "Background removal completed",
    );

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

  if (!Number.isInteger(sourceImageId)) {
    res.status(400).json({ error: "Select one of the generated makeover ideas before staging." });
    return;
  }

  // Enforce the workflow on the server as well as in the UI. This prevents a
  // stale client from staging the original upload or an unrelated edited image.
  const [sourceTransformation] = await db
    .select()
    .from(editedImagesTable)
    .where(and(
      eq(editedImagesTable.id, sourceImageId),
      eq(editedImagesTable.projectId, projectId),
      eq(editedImagesTable.type, "transformation"),
    ));

  if (!sourceTransformation) {
    res.status(400).json({ error: "The staging source must be a makeover idea from this project." });
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
    const stagingModel = adapter.name === "openai" ? "gpt-image-2" : imageModel;

    const sourceImage = await downloadImage(sourceTransformation.imageUrl);

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

    const prompt = [
      `Place this exact furniture piece in ${styleDesc}.`,
      "NON-NEGOTIABLE PRODUCT LOCK: Treat the supplied furniture as an immutable product reference.",
      "Do not change its shape, physical dimensions, width-to-height-to-depth proportions, silhouette, construction, top, sides, base, legs, drawer or door count, drawer or door positions, openings, trim, or hardware placement.",
      "Do not redesign, resize, widen, narrow, lengthen, shorten, simplify, add, or remove any part of the furniture.",
      "Change only the surrounding environment. Preserve the selected makeover finish and keep the entire furniture piece clearly visible and unobstructed.",
      `The furniture should be naturally staged as if it belongs in the room. Professional interior photography, realistic materials, and natural lighting.${extraPrompt}`,
    ].join(" ");

    const { base64: b64 } = await adapter.editImage({
      image: sourceImage.buffer,
      mimeType: sourceImage.mimeType,
      model: stagingModel,
      prompt,
      size: "1536x1024",
      quality: "high",
      inputFidelity: "high",
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

const TRANSFORMATION_CONCEPTS = [
  {
    slug: "heritage_walnut",
    label: "Heritage Walnut",
    treatment: "restore the wood in a rich warm walnut tone, add a subtle satin protective finish, and use restrained aged-brass hardware",
    modernBaseCandidate: false,
  },
  {
    slug: "olive_two_tone",
    label: "Olive & Natural",
    treatment: "paint the outer body a deep muted olive green while preserving natural wood drawer fronts, finished with simple warm-brass hardware",
    modernBaseCandidate: true,
  },
  {
    slug: "light_natural",
    label: "Light Natural",
    treatment: "refinish the piece in a pale natural-oak tone with a matte clear coat and minimal brushed-brass hardware",
    modernBaseCandidate: false,
  },
] as const;

router.post("/projects/:id/transformations", requireAuth, async (req, res): Promise<void> => {
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

  const includeModernBase = req.body?.includeModernBase === true;

  const usageCheck = await checkAndIncrementUsage(userId);
  if (!usageCheck.allowed) {
    res.status(402).json({ error: usageCheck.message ?? "Usage limit reached" });
    return;
  }

  req.log.info({ projectId, conceptCount: TRANSFORMATION_CONCEPTS.length }, "Generating transformation concepts");

  try {
    const { adapter, imageModel } = await resolveProviderForUser(userId, { requireImageEditing: true });
    const sourceImage = await downloadImage(project.originalImageUrl);
    // GPT Image 2 is the production path for OpenAI transformations: it uses
    // high-fidelity image inputs automatically and supports the source photo's
    // own aspect ratio. Other providers retain the user's configured model.
    const transformationModel = adapter.name === "openai" ? "gpt-image-2" : imageModel;
    const outputSize = adapter.name === "openai"
      ? await getSourcePreservingSize(sourceImage.buffer)
      : undefined;
    req.log.info(
      { projectId, provider: adapter.name, model: transformationModel, outputSize, includeModernBase },
      "Resolved high-fidelity transformation configuration",
    );

    const settled = await Promise.allSettled(
      TRANSFORMATION_CONCEPTS.map(async (concept) => {
        const allowModernBase = includeModernBase && concept.modernBaseCandidate;
        const baseConstraint = allowModernBase
          ? "CONTROLLED EXCEPTION FOR THIS CONCEPT ONLY: The existing bottom base or legs may be cut off and replaced with a simple, buildable modern recessed plinth or slim modern furniture legs. Do not change the cabinet body above the base, its dimensions, or any drawer or door."
          : "Preserve the existing base and legs exactly; do not cut off, replace, shorten, or redesign them.";
        const prompt = [
          "Create a photorealistic surface-refinishing concept from this source photo.",
          `Transformation direction: ${concept.treatment}.`,
          "NON-NEGOTIABLE GEOMETRY LOCK: This must remain the exact same physical piece of furniture as the uploaded image.",
          "Do not change its shape, physical dimensions, width-to-height-to-depth proportions, silhouette, cabinet construction, top, sides, drawer or door count, drawer or door sizes, drawer or door positions, openings, trim, or hardware placement.",
          "Do not redesign, resize, widen, narrow, lengthen, shorten, simplify, add, remove, replace, or rearrange any structural part unless the single controlled base exception below explicitly permits it.",
          baseConstraint,
          "Preserve the original perspective, camera angle, crop, lighting, shadows, floor, walls, and every surrounding background element.",
          "Edit only the surface finish, paint treatment, wood color, and hardware material/color. The outer furniture boundary and all internal construction lines should align with the source image.",
          "The result must look like a skilled refinisher treated the uploaded piece—not like a similar or newly designed piece of furniture.",
        ].join(" ");

        const { base64 } = await adapter.editImage({
          image: sourceImage.buffer,
          mimeType: sourceImage.mimeType,
          model: transformationModel,
          prompt,
          size: outputSize,
          quality: "high",
          inputFidelity: "high",
        });

        const outputBuffer = Buffer.from(base64, "base64");
        await assertAspectRatioPreserved(sourceImage.buffer, outputBuffer);
        const structuralSimilarity = await assertFurnitureIdentityPreserved(sourceImage.buffer, outputBuffer);
        req.log.info(
          { projectId, concept: concept.slug, structuralSimilarity },
          "Accepted transformation identity check",
        );
        const filename = await saveBase64Image(base64, ".png");
        const roomStyle = allowModernBase ? `${concept.slug}_modern_base` : concept.slug;
        return { concept, roomStyle, filename, imageUrl: getImageUrl(req, filename) };
      }),
    );

    const completed = settled.flatMap((result) => result.status === "fulfilled" ? [result.value] : []);
    const failed = settled.find((result) => result.status === "rejected");

    if (failed) {
      await Promise.allSettled(completed.map(({ filename }) => unlink(path.join(uploadsDir, filename))));
      throw failed.reason;
    }

    try {
      const inserted = await db
        .insert(editedImagesTable)
        .values(completed.map(({ roomStyle, imageUrl }) => ({
          projectId,
          type: "transformation",
          imageUrl,
          roomStyle,
        })))
        .returning();

      res.status(201).json(inserted.map((image) => ({
        id: image.id,
        projectId: image.projectId,
        type: image.type,
        imageUrl: image.imageUrl,
        roomStyle: image.roomStyle ?? null,
        createdAt: image.createdAt.toISOString(),
      })));
    } catch (error) {
      await Promise.allSettled(completed.map(({ filename }) => unlink(path.join(uploadsDir, filename))));
      throw error;
    }
  } catch (err) {
    await refundUsage(userId);

    if (err instanceof FurnitureIdentityError) {
      req.log.warn({ projectId, similarity: err.similarity }, "Rejected transformation that changed furniture identity");
      res.status(422).json({
        error: "The AI changed the furniture's structure, so FurniFlip rejected the results and restored your FurniFlip usage credit. Your AI provider may still charge for completed image requests. Please try again.",
      });
      return;
    }

    if (err instanceof MissingProviderKeyError) {
      res.status(400).json({
        error: `Add your ${PROVIDER_LABELS[err.provider]} API key in Account & AI before generating transformations.`,
      });
      return;
    }
    if (err instanceof ProviderCapabilityError) {
      res.status(400).json({
        error: `${PROVIDER_LABELS[err.provider]} doesn't support image transformations yet. Switch to OpenAI or Google in Account & AI.`,
      });
      return;
    }
    req.log.error({ err }, "Transformation generation failed");
    res.status(500).json({ error: "Transformation generation failed. Please try again." });
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
