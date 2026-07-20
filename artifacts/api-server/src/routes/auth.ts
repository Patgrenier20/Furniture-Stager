import { Router, type IRouter, type Request } from "express";
import bcrypt from "bcryptjs";
import { db, usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { requireAuth } from "../middlewares/requireAuth";

const router: IRouter = Router();

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

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

  await establishSession(req, user.id);

  res.json(serializeUser(user));
});

router.post("/auth/logout", (req, res): void => {
  req.session.destroy((error) => {
    if (error) {
      res.status(500).json({ error: "Unable to log out" });
      return;
    }

    res.clearCookie("connect.sid", { path: "/" });
    res.json({ ok: true });
  });
});

router.get("/auth/me", requireAuth, async (req, res): Promise<void> => {
  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, req.session.userId!));

  if (!user) {
    res.status(401).json({ error: "User not found" });
    return;
  }

  res.json(serializeUser(user));
});

export default router;
