import { Router, type IRouter } from "express";
import { db, projectsTable, editedImagesTable, adsTable } from "@workspace/db";
import { eq, and, desc, sql } from "drizzle-orm";
import { requireAuth } from "../middlewares/requireAuth";
import { upload } from "../lib/multer";
import { unlink } from "node:fs/promises";
import path from "node:path";

const uploadsDir = path.join(process.cwd(), "uploads");

const router: IRouter = Router();

function getImageUrl(_req: unknown, filename: string): string {
  return `/api/uploads/${filename}`;
}

async function deleteUploadedImage(imageUrl: string | null): Promise<void> {
  const uploadsPrefix = "/api/uploads/";
  if (!imageUrl?.startsWith(uploadsPrefix)) return;

  const filename = imageUrl.slice(uploadsPrefix.length);
  if (!filename || path.basename(filename) !== filename) return;

  try {
    await unlink(path.join(uploadsDir, filename));
  } catch (error) {
    if (!(error instanceof Error && "code" in error && error.code === "ENOENT")) {
      throw error;
    }
  }
}

router.get("/projects", requireAuth, async (req, res): Promise<void> => {
  const userId = req.session.userId!;

  // A single grouped join replaces what used to be 1 + 2N queries (one
  // query for the project list, then two COUNT queries per project). This
  // returns the same shape in one round trip to Postgres regardless of how
  // many projects the user has. Counting DISTINCT ids is required because
  // the left joins otherwise multiply rows (a project with 3 images and 2
  // ads would produce 6 joined rows, one per image/ad combination).
  const projectsWithCounts = await db
    .select({
      id: projectsTable.id,
      userId: projectsTable.userId,
      name: projectsTable.name,
      description: projectsTable.description,
      originalImageUrl: projectsTable.originalImageUrl,
      createdAt: projectsTable.createdAt,
      imageCount: sql<number>`count(distinct ${editedImagesTable.id})`,
      adCount: sql<number>`count(distinct ${adsTable.id})`,
    })
    .from(projectsTable)
    .leftJoin(editedImagesTable, eq(editedImagesTable.projectId, projectsTable.id))
    .leftJoin(adsTable, eq(adsTable.projectId, projectsTable.id))
    .where(eq(projectsTable.userId, userId))
    .groupBy(projectsTable.id)
    .orderBy(desc(projectsTable.createdAt));

  res.json(
    projectsWithCounts.map((p) => ({
      id: p.id,
      userId: p.userId,
      name: p.name,
      description: p.description ?? null,
      originalImageUrl: p.originalImageUrl,
      imageCount: Number(p.imageCount ?? 0),
      adCount: Number(p.adCount ?? 0),
      createdAt: p.createdAt.toISOString(),
    })),
  );
});

router.post("/projects", requireAuth, upload.single("image"), async (req, res): Promise<void> => {
  const userId = req.session.userId!;
  const { name, description } = req.body;

  if (!name) {
    await deleteUploadedImage(req.file ? getImageUrl(req, req.file.filename) : null);
    res.status(400).json({ error: "Project name is required" });
    return;
  }

  if (!req.file) {
    res.status(400).json({ error: "Image file is required" });
    return;
  }

  const originalImageUrl = getImageUrl(req, req.file.filename);

  const [project] = await db
    .insert(projectsTable)
    .values({ userId, name, description: description || null, originalImageUrl })
    .returning();

  res.status(201).json({
    id: project.id,
    userId: project.userId,
    name: project.name,
    description: project.description ?? null,
    originalImageUrl: project.originalImageUrl,
    imageCount: 0,
    adCount: 0,
    createdAt: project.createdAt.toISOString(),
  });
});

router.get("/projects/stats", requireAuth, async (req, res): Promise<void> => {
  const userId = req.session.userId!;

  // Same grouped-join technique as GET /projects, reused here so a
  // dashboard load costs 2 queries total (totals + the 5 most recent, each
  // already carrying their own counts) instead of the previous 1 + 4N.
  const projectsWithCounts = await db
    .select({
      id: projectsTable.id,
      userId: projectsTable.userId,
      name: projectsTable.name,
      description: projectsTable.description,
      originalImageUrl: projectsTable.originalImageUrl,
      createdAt: projectsTable.createdAt,
      imageCount: sql<number>`count(distinct ${editedImagesTable.id})`,
      adCount: sql<number>`count(distinct ${adsTable.id})`,
    })
    .from(projectsTable)
    .leftJoin(editedImagesTable, eq(editedImagesTable.projectId, projectsTable.id))
    .leftJoin(adsTable, eq(adsTable.projectId, projectsTable.id))
    .where(eq(projectsTable.userId, userId))
    .groupBy(projectsTable.id)
    .orderBy(desc(projectsTable.createdAt));

  const totalImages = projectsWithCounts.reduce((sum, p) => sum + Number(p.imageCount ?? 0), 0);
  const totalAds = projectsWithCounts.reduce((sum, p) => sum + Number(p.adCount ?? 0), 0);

  const recentProjects = projectsWithCounts.slice(0, 5).map((p) => ({
    id: p.id,
    userId: p.userId,
    name: p.name,
    description: p.description ?? null,
    originalImageUrl: p.originalImageUrl,
    imageCount: Number(p.imageCount ?? 0),
    adCount: Number(p.adCount ?? 0),
    createdAt: p.createdAt.toISOString(),
  }));

  res.json({
    totalProjects: projectsWithCounts.length,
    totalImages,
    totalAds,
    recentProjects,
  });
});

router.get("/projects/:id", requireAuth, async (req, res): Promise<void> => {
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

  const ads = await db
    .select()
    .from(adsTable)
    .where(eq(adsTable.projectId, projectId))
    .orderBy(desc(adsTable.createdAt));

  res.json({
    id: project.id,
    userId: project.userId,
    name: project.name,
    description: project.description ?? null,
    originalImageUrl: project.originalImageUrl,
    images: images.map((img) => ({
      id: img.id,
      projectId: img.projectId,
      type: img.type,
      imageUrl: img.imageUrl,
      roomStyle: img.roomStyle ?? null,
      createdAt: img.createdAt.toISOString(),
    })),
    ads: ads.map((ad) => ({
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
    createdAt: project.createdAt.toISOString(),
  });
});

router.delete("/projects/:id", requireAuth, async (req, res): Promise<void> => {
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

  const projectImages = await db
    .select({ imageUrl: editedImagesTable.imageUrl })
    .from(editedImagesTable)
    .where(eq(editedImagesTable.projectId, projectId));

  await db.delete(adsTable).where(eq(adsTable.projectId, projectId));
  await db.delete(editedImagesTable).where(eq(editedImagesTable.projectId, projectId));
  await db.delete(projectsTable).where(eq(projectsTable.id, projectId));

  await Promise.allSettled([
    deleteUploadedImage(project.originalImageUrl),
    ...projectImages.map((image) => deleteUploadedImage(image.imageUrl)),
  ]);

  res.sendStatus(204);
});

export default router;
