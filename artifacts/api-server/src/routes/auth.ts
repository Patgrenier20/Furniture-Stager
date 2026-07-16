import { Router, type IRouter } from "express";
import bcrypt from "bcryptjs";
import { db, usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { requireAuth } from "../middlewares/requireAuth";

const router: IRouter = Router();

router.post("/auth/register", async (req, res): Promise<void> => {
  const { email, password } = req.body;

  if (!email || !password) {
    res.status(400).json({ error: "Email and password are required" });
    return;
  }

  if (password.length < 8) {
    res.status(400).json({ error: "Password must be at least 8 characters" });
    return;
  }

  const existing = await db.select().from(usersTable).where(eq(usersTable.email, email));
  if (existing.length > 0) {
    res.status(400).json({ error: "Email already registered" });
    return;
  }

  const passwordHash = await bcrypt.hash(password, 12);
  const [user] = await db
    .insert(usersTable)
    .values({ email, passwordHash })
    .returning();

  req.session.userId = user.id;

  res.status(201).json({
    id: user.id,
    email: user.email,
    plan: user.plan,
    trialUsed: user.trialUsed,
    trialLimit: user.trialLimit,
    stripeCustomerId: user.stripeCustomerId ?? null,
    createdAt: user.createdAt.toISOString(),
  });
});

router.post("/auth/login", async (req, res): Promise<void> => {
  const { email, password } = req.body;

  if (!email || !password) {
    res.status(400).json({ error: "Email and password are required" });
    return;
  }

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

  req.session.userId = user.id;

  res.json({
    id: user.id,
    email: user.email,
    plan: user.plan,
    trialUsed: user.trialUsed,
    trialLimit: user.trialLimit,
    stripeCustomerId: user.stripeCustomerId ?? null,
    createdAt: user.createdAt.toISOString(),
  });
});

router.post("/auth/logout", (req, res): void => {
  req.session.destroy(() => {
    res.json({ ok: true });
  });
});

router.get("/auth/me", requireAuth, async (req, res): Promise<void> => {
  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, req.session.userId!));

  if (!user) {
    res.status(401).json({ error: "User not found" });
    return;
  }

  res.json({
    id: user.id,
    email: user.email,
    plan: user.plan,
    trialUsed: user.trialUsed,
    trialLimit: user.trialLimit,
    stripeCustomerId: user.stripeCustomerId ?? null,
    createdAt: user.createdAt.toISOString(),
  });
});

export default router;
