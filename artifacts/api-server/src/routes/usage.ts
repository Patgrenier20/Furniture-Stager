import { Router, type IRouter } from "express";
import { db, usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { requireAuth } from "../middlewares/requireAuth";

const router: IRouter = Router();

router.get("/usage", requireAuth, async (req, res): Promise<void> => {
  const userId = req.session.userId!;

  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, userId));

  if (!user) {
    res.status(404).json({ error: "User not found" });
    return;
  }

  const hasActiveSubscription = user.plan === "pro" && !!user.stripeSubscriptionId;
  const isTrialExpired = user.plan === "free" && user.trialUsed >= user.trialLimit;

  res.json({
    plan: user.plan,
    trialUsed: user.trialUsed,
    trialLimit: user.trialLimit,
    isTrialExpired,
    hasActiveSubscription,
  });
});

export default router;
