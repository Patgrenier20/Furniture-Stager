import { Router, type IRouter } from "express";
import { db, projectsTable, editedImagesTable, adsTable } from "@workspace/db";
import { eq, and, desc } from "drizzle-orm";
import { requireAuth } from "../middlewares/requireAuth";
import { checkAndIncrementUsage, refundUsage } from "../lib/usage";
import {
  resolveProviderForUser,
  MissingProviderKeyError,
  PROVIDER_LABELS,
  stripJsonCodeFence,
} from "../lib/ai-providers";

const router: IRouter = Router();

router.get("/projects/:id/ads", requireAuth, async (req, res): Promise<void> => {
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

  const ads = await db
    .select()
    .from(adsTable)
    .where(eq(adsTable.projectId, projectId))
    .orderBy(desc(adsTable.createdAt));

  res.json(
    ads.map((ad) => ({
      id: ad.id,
      projectId: ad.projectId,
      title: ad.title,
      description: ad.description,
      price: ad.price ? Number(ad.price) : null,
      condition: ad.condition ?? null,
      location: ad.location ?? null,
      imageUrl: ad.imageUrl ?? null,
      createdAt: ad.createdAt.toISOString(),
    })),
  );
});

router.post("/projects/:id/ads", requireAuth, async (req, res): Promise<void> => {
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

  const { price, condition, location, additionalContext, imageId } = req.body;

  req.log.info({ projectId }, "Generating ad");

  // Determine which image to feature
  let featuredImageUrl: string | null = null;
  if (imageId) {
    const [img] = await db
      .select()
      .from(editedImagesTable)
      .where(and(eq(editedImagesTable.id, imageId), eq(editedImagesTable.projectId, projectId)));
    if (img) featuredImageUrl = img.imageUrl;
  }
  if (!featuredImageUrl) {
    featuredImageUrl = project.originalImageUrl;
  }

  const conditionLabels: Record<string, string> = {
    like_new: "like new",
    good: "good condition",
    fair: "fair condition",
    poor: "poor/as-is",
  };

  const conditionText = condition ? conditionLabels[condition] ?? condition : "good condition";
  const priceText = price ? `$${price}` : "price negotiable";
  const locationText = location ? `Located in ${location}.` : "";
  const contextText = additionalContext ? `Additional details: ${additionalContext}.` : "";

  const systemPrompt = `You are an expert at writing compelling Facebook Marketplace listings for furniture. 
Write listings that are honest, engaging, and help sellers get top dollar. 
Use a friendly, conversational tone. Highlight the piece's character and condition.
Keep titles under 80 characters and descriptions between 150-300 words.
Do not use excessive exclamation marks or ALL CAPS.
Return valid JSON only with fields: title (string), description (string).`;

  const userPrompt = `Write a Facebook Marketplace listing for this furniture piece:
- Item name: ${project.name}
- Condition: ${conditionText}
- Asking price: ${priceText}
- ${locationText}
- ${contextText}
${project.description ? `- Description from seller: ${project.description}` : ""}

Write an authentic, appealing listing that would attract serious buyers.`;

  try {
    const { adapter, textModel } = await resolveProviderForUser(userId);

    const content = await adapter.generateText({
      systemPrompt,
      userPrompt,
      model: textModel,
      maxTokens: 600,
      jsonResponse: true,
    });

    const parsed = JSON.parse(stripJsonCodeFence(content)) as { title: string; description: string };

    const [ad] = await db
      .insert(adsTable)
      .values({
        projectId,
        title: parsed.title,
        description: parsed.description,
        price: price ? String(price) : null,
        condition: condition ?? null,
        location: location ?? null,
        imageUrl: featuredImageUrl,
      })
      .returning();

    res.status(201).json({
      id: ad.id,
      projectId: ad.projectId,
      title: ad.title,
      description: ad.description,
      price: ad.price ? Number(ad.price) : null,
      condition: ad.condition ?? null,
      location: ad.location ?? null,
      imageUrl: ad.imageUrl ?? null,
      createdAt: ad.createdAt.toISOString(),
    });
  } catch (err) {
    // The trial credit was already spent by checkAndIncrementUsage above,
    // before any of this ran. No ad was produced, so refund it -- a
    // missing key or a failed call shouldn't cost the user one of their
    // limited free generations.
    await refundUsage(userId);

    if (err instanceof MissingProviderKeyError) {
      res.status(400).json({
        error: `Add your ${PROVIDER_LABELS[err.provider]} API key in Account & AI before generating ads.`,
      });
      return;
    }
    req.log.error({ err }, "Ad generation failed");
    res.status(500).json({ error: "Ad generation failed. Please try again." });
  }
});

export default router;
