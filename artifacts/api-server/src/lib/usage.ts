import { db, usersTable } from "@workspace/db";
import { and, eq, lt, sql } from "drizzle-orm";

/**
 * Checks whether a user is allowed to consume one unit of AI usage and, if
 * so, records the usage.
 *
 * The previous implementation read `trialUsed`/`trialLimit`, compared them
 * in application code, and issued a separate UPDATE to increment the
 * counter. That is a classic check-then-act race: two concurrent requests
 * could both read the same `trialUsed` value, both pass the `< trialLimit`
 * check, and both proceed, letting a free-plan user exceed their trial (and
 * each request also triggers a billable OpenAI call). The conditional
 * UPDATE below closes that window by making the check and the increment a
 * single atomic statement — Postgres's row-level locking during the UPDATE
 * guarantees only requests that are still under the limit at the moment the
 * row is locked can succeed, no matter how many arrive concurrently.
 */
export async function checkAndIncrementUsage(userId: number): Promise<{ allowed: boolean; message?: string }> {
  // Pro users have unlimited usage, so their trial counter is intentionally
  // left untouched (matches the previous behavior of returning early).
  const [proUser] = await db
    .select({ id: usersTable.id })
    .from(usersTable)
    .where(and(eq(usersTable.id, userId), eq(usersTable.plan, "pro")));

  if (proUser) {
    return { allowed: true };
  }

  const [updated] = await db
    .update(usersTable)
    .set({ trialUsed: sql`${usersTable.trialUsed} + 1` })
    .where(and(eq(usersTable.id, userId), lt(usersTable.trialUsed, usersTable.trialLimit)))
    .returning({ id: usersTable.id });

  if (updated) {
    return { allowed: true };
  }

  const [user] = await db
    .select({ trialLimit: usersTable.trialLimit })
    .from(usersTable)
    .where(eq(usersTable.id, userId));

  if (!user) {
    return { allowed: false, message: "User not found" };
  }

  return {
    allowed: false,
    message: `Free trial limit of ${user.trialLimit} uses reached. Upgrade to Pro for unlimited access.`,
  };
}
