import { Router, type IRouter } from "express";
import { db, projectsTable, editedImagesTable, adsTable } from "@workspace/db";
import { eq, and, desc, count } from "drizzle-orm";
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

  const projects = await db
    .select()
    .from(projectsTable)
    .where(eq(projectsTable.userId, userId))
    .orderBy(desc(projectsTable.createdAt));

  const projectsWithCounts = await Promise.all(
    projects.map(async (p) => {
      const [imageCount] = await db
        .select({ count: count() })
        .from(editedImagesTable)
        .where(eq(editedImagesTable.projectId, p.id));
      const [adCount] = await db
        .select({ count: count() })
        .from(adsTable)
        .where(eq(adsTable.projectId, p.id));
      return {
        id: p.id,
        userId: p.userId,
        name: p.name,
        description: p.description ?? null,
        originalImageUrl: p.originalImageUrl,
        imageCount: Number(imageCount?.count ?? 0),
        adCount: Number(adCount?.count ?? 0),
        createdAt: p.createdAt.toISOString(),
      };
    }),
  );

  res.json(projectsWithCounts);
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

  const userProjects = await db
    .select()
    .from(projectsTable)
    .where(eq(projectsTable.userId, userId))
    .orderBy(desc(projectsTable.createdAt));

  const projectIds = userProjects.map((p) => p.id);

  let totalImages = 0;
  let totalAds = 0;

  if (projectIds.length > 0) {
    const imageCounts = await Promise.all(
      projectIds.map((id) =>
        db.select({ count: count() }).from(editedImagesTable).where(eq(editedImagesTable.projectId, id)),
      ),
    );
    const adCounts = await Promise.all(
      projectIds.map((id) =>
        db.select({ count: count() }).from(adsTable).where(eq(adsTable.projectId, id)),
      ),
    );
    totalImages = imageCounts.reduce((sum, r) => sum + Number(r[0]?.count ?? 0), 0);
    totalAds = adCounts.reduce((sum, r) => sum + Number(r[0]?.count ?? 0), 0);
  }

  const recentProjects = await Promise.all(
    userProjects.slice(0, 5).map(async (p) => {
      const [imageCount] = await db
        .select({ count: count() })
        .from(editedImagesTable)
        .where(eq(editedImagesTable.projectId, p.id));
      const [adCount] = await db
        .select({ count: count() })
        .from(adsTable)
        .where(eq(adsTable.projectId, p.id));
      return {
        id: p.id,
        userId: p.userId,
        name: p.name,
        description: p.description ?? null,
        originalImageUrl: p.originalImageUrl,
        imageCount: Number(imageCount?.count ?? 0),
        adCount: Number(adCount?.count ?? 0),
        createdAt: p.createdAt.toISOString(),
      };
    }),
  );

  res.json({
    totalProjects: userProjects.length,
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
