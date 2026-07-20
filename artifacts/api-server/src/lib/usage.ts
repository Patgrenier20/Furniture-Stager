import { db, usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";

export async function checkAndIncrementUsage(userId: number): Promise<{ allowed: boolean; message?: string }> {
  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, userId));

  if (!user) {
    return { allowed: false, message: "User not found" };
  }

  if (user.plan === "pro") {
    return { allowed: true };
  }

  if (user.trialUsed >= user.trialLimit) {
    return {
      allowed: false,
      message: `Free trial limit of ${user.trialLimit} uses reached. Upgrade to Pro for unlimited access.`,
    };
  }

  await db
    .update(usersTable)
    .set({ trialUsed: user.trialUsed + 1 })
    .where(eq(usersTable.id, userId));

  return { allowed: true };
}
