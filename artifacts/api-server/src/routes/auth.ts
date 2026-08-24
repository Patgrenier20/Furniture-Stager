import { Router, type IRouter, type Request } from "express";
import bcrypt from "bcryptjs";
import {
  adsTable,
  db,
  editedImagesTable,
  projectsTable,
  usersTable,
} from "@workspace/db";
import { eq, inArray } from "drizzle-orm";
import { requireAuth } from "../middlewares/requireAuth";
import { applyLifetimeProEntitlement } from "../lib/entitlements";
import { unlink } from "node:fs/promises";
import path from "node:path";

const router: IRouter = Router();

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const SESSION_COOKIE_NAME = "furniflip.sid";
const UPLOADS_PREFIX = "/api/uploads/";

type Credentials = { email: string; password: string };

function parseCredentials(body: unknown):
  | { ok: true; value: Credentials }
  | { ok: false; error: string } {
  if (!body || typeof body !== "object") {
    return { ok: false, error: "Email and password are required" };
  }

  const candidate = body as Record<string, unknown>;
  const email = typeof candidate.email === "string"
    ? candidate.email.trim().toLowerCase()
    : "";
  const password = typeof candidate.password === "string"
    ? candidate.password
    : "";

  if (!email || !password) {
    return { ok: false, error: "Email and password are required" };
  }

  if (email.length > 254 || !EMAIL_PATTERN.test(email)) {
    return { ok: false, error: "Enter a valid email address" };
  }

  if (password.length < 8 || password.length > 128) {
    return { ok: false, error: "Password must be between 8 and 128 characters" };
  }

  return { ok: true, value: { email, password } };
}

function isUniqueViolation(error: unknown): boolean {
  return Boolean(
    error
      && typeof error === "object"
      && "code" in error
      && (error as { code?: unknown }).code === "23505",
  );
}

/** Regenerate before login/register to prevent session fixation. */
async function establishSession(req: Request, userId: number): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    req.session.regenerate((error) => error ? reject(error) : resolve());
  });

  req.session.userId = userId;

  // Waiting for the store confirms the session is persisted before the client
  // follows the redirect and immediately requests /auth/me.
  await new Promise<void>((resolve, reject) => {
    req.session.save((error) => error ? reject(error) : resolve());
  });
}

function serializeUser(user: typeof usersTable.$inferSelect) {
  return {
    id: user.id,
    email: user.email,
    plan: user.plan,
    trialUsed: user.trialUsed,
    trialLimit: user.trialLimit,
    modelProvider: user.modelProvider,
    textModel: user.textModel,
    imageModel: user.imageModel,
    multimodalModel: user.multimodalModel,
    openaiApiKey: user.openaiApiKey ? "configured" : null,
    anthropicApiKey: user.anthropicApiKey ? "configured" : null,
    googleApiKey: user.googleApiKey ? "configured" : null,
    xaiApiKey: user.xaiApiKey ? "configured" : null,
    mistralApiKey: user.mistralApiKey ? "configured" : null,
    stripeCustomerId: user.stripeCustomerId ?? null,
    createdAt: user.createdAt.toISOString(),
  };
}

function uploadedFilename(imageUrl: string | null | undefined): string | null {
  if (!imageUrl?.startsWith(UPLOADS_PREFIX)) return null;
  const filename = imageUrl.slice(UPLOADS_PREFIX.length);
  return filename && path.basename(filename) === filename ? filename : null;
}

async function cancelActiveSubscription(subscriptionId: string | null): Promise<void> {
  if (!subscriptionId) return;

  const secretKey = process.env.STRIPE_SECRET_KEY;
  if (!secretKey) {
    throw new Error("Stripe is not configured to cancel the active subscription");
  }

  const Stripe = (await import("stripe")).default;
  const stripe = new Stripe(secretKey);
  await stripe.subscriptions.cancel(subscriptionId);
}

router.post("/auth/register", async (req, res): Promise<void> => {
  const credentials = parseCredentials(req.body);
  if (!credentials.ok) {
    res.status(400).json({ error: credentials.error });
    return;
  }

  const { email, password } = credentials.value;
  const existing = await db.select().from(usersTable).where(eq(usersTable.email, email));
  if (existing.length > 0) {
    res.status(409).json({ error: "Email already registered" });
    return;
  }

  const passwordHash = await bcrypt.hash(password, 12);
  let user: typeof usersTable.$inferSelect;

  try {
    [user] = await db
      .insert(usersTable)
      .values({ email, passwordHash })
      .returning();
  } catch (error) {
    // The pre-check provides a quick response; the constraint handles two
    // registrations for the same normalized email arriving concurrently.
    if (isUniqueViolation(error)) {
      res.status(409).json({ error: "Email already registered" });
      return;
    }
    throw error;
  }

  user = await applyLifetimeProEntitlement(user);
  await establishSession(req, user.id);

  res.status(201).json(serializeUser(user));
});

router.post("/auth/login", async (req, res): Promise<void> => {
  const credentials = parseCredentials(req.body);
  if (!credentials.ok) {
    res.status(400).json({ error: credentials.error });
    return;
  }

  const { email, password } = credentials.value;
  const [user] = await db.select().from(usersTable).where(eq(usersTable.email, email));
  if (!user) {
    res.status(401).json({ error: "Invalid email or password" });
    return;
  }

  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) {
    res.status(401).json({ error: "Invalid email or password" });
    return;
  }

  const entitledUser = await applyLifetimeProEntitlement(user);
  await establishSession(req, entitledUser.id);

  res.json(serializeUser(entitledUser));
});

router.post("/auth/logout", (req, res): void => {
  req.session.destroy((error) => {
    if (error) {
      res.status(500).json({ error: "Unable to log out" });
      return;
    }

    res.clearCookie(SESSION_COOKIE_NAME, { path: "/" });
    res.json({ ok: true });
  });
});

/**
 * Permanently deletes the authenticated account and all owned project data.
 * Google Play requires an in-app deletion path for every app that offers
 * account creation. Requiring the current password protects an unattended
 * authenticated device from silently erasing the account.
 */
router.delete("/auth/account", requireAuth, async (req, res): Promise<void> => {
  const password = typeof req.body?.password === "string" ? req.body.password : "";
  if (!password) {
    res.status(400).json({ error: "Current password is required" });
    return;
  }

  const [user] = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.id, req.session.userId!));

  if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
    res.status(401).json({ error: "Current password is incorrect" });
    return;
  }

  // Stop recurring billing before deleting the local customer record. A
  // failed cancellation deliberately blocks deletion so the user can never be
  // charged for an account that no longer exists.
  try {
    await cancelActiveSubscription(user.stripeSubscriptionId);
  } catch (error) {
    req.log.error({ err: error, userId: user.id }, "Subscription cancellation failed during account deletion");
    res.status(502).json({
      error: "We could not cancel the active subscription. Please try again or contact support.",
    });
    return;
  }

  const projects = await db
    .select({ id: projectsTable.id, originalImageUrl: projectsTable.originalImageUrl })
    .from(projectsTable)
    .where(eq(projectsTable.userId, user.id));
  const projectIds = projects.map((project) => project.id);
  const [editedImages, ads] = projectIds.length > 0
    ? await Promise.all([
        db
          .select({ imageUrl: editedImagesTable.imageUrl })
          .from(editedImagesTable)
          .where(inArray(editedImagesTable.projectId, projectIds)),
        db
          .select({ imageUrl: adsTable.imageUrl })
          .from(adsTable)
          .where(inArray(adsTable.projectId, projectIds)),
      ])
    : [[], []];

  const filenames = new Set(
    [
      ...projects.map((project) => project.originalImageUrl),
      ...editedImages.map((image) => image.imageUrl),
      ...ads.map((ad) => ad.imageUrl),
    ]
      .map(uploadedFilename)
      .filter((filename): filename is string => Boolean(filename)),
  );

  await db.delete(usersTable).where(eq(usersTable.id, user.id));

  await Promise.allSettled(
    [...filenames].map((filename) => unlink(path.join(process.cwd(), "uploads", filename))),
  );

  req.session.destroy((error) => {
    if (error) {
      req.log.warn({ err: error, userId: user.id }, "Deleted account but could not destroy session");
    }
    res.clearCookie(SESSION_COOKIE_NAME, { path: "/" });
    res.json({ ok: true });
  });
});

router.get("/auth/me", requireAuth, async (req, res): Promise<void> => {
  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, req.session.userId!));

  if (!user) {
    res.status(401).json({ error: "User not found" });
    return;
  }

  res.json(serializeUser(await applyLifetimeProEntitlement(user)));
});

export default router;
