import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, usersTable } from "@workspace/db";
import { requireAuth } from "../middlewares/requireAuth";
import { encryptSecret } from "../lib/crypto";

const router: IRouter = Router();

function sanitizeUser(user: typeof usersTable.$inferSelect) {
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

router.get("/settings/ai", requireAuth, async (req, res): Promise<void> => {
  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, req.session.userId!));

  if (!user) {
    res.status(404).json({ error: "User not found" });
    return;
  }

  res.json(sanitizeUser(user));
});

router.put("/settings/ai", requireAuth, async (req, res): Promise<void> => {
  const userId = req.session.userId!;
  const {
    modelProvider,
    textModel,
    imageModel,
    multimodalModel,
    openaiApiKey,
    anthropicApiKey,
    googleApiKey,
    xaiApiKey,
    mistralApiKey,
  } = req.body ?? {};

  // Provider API keys are encrypted at rest (AES-256-GCM) before they ever
  // reach the database. See ../lib/crypto for the envelope format and the
  // legacy-plaintext fallback on the read side (getImageClientForUser /
  // getAdClientForUser).
  const [updated] = await db
    .update(usersTable)
    .set({
      ...(modelProvider !== undefined ? { modelProvider } : {}),
      ...(textModel !== undefined ? { textModel } : {}),
      ...(imageModel !== undefined ? { imageModel } : {}),
      ...(multimodalModel !== undefined ? { multimodalModel } : {}),
      ...(openaiApiKey !== undefined ? { openaiApiKey: encryptSecret(openaiApiKey) } : {}),
      ...(anthropicApiKey !== undefined ? { anthropicApiKey: encryptSecret(anthropicApiKey) } : {}),
      ...(googleApiKey !== undefined ? { googleApiKey: encryptSecret(googleApiKey) } : {}),
      ...(xaiApiKey !== undefined ? { xaiApiKey: encryptSecret(xaiApiKey) } : {}),
      ...(mistralApiKey !== undefined ? { mistralApiKey: encryptSecret(mistralApiKey) } : {}),
    })
    .where(eq(usersTable.id, userId))
    .returning();

  if (!updated) {
    res.status(404).json({ error: "User not found" });
    return;
  }

  res.json(sanitizeUser(updated));
});

export default router;
