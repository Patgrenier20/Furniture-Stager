import { db, usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";

type User = typeof usersTable.$inferSelect;

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

/**
 * Lifetime Pro accounts are configured outside source control as a
 * comma-separated list. Keeping the allowlist in the environment prevents a
 * private owner email address from being published with the application.
 */
export function hasLifetimeProEntitlement(email: string): boolean {
  const configuredEmails = process.env.LIFETIME_PRO_EMAILS ?? "";
  const normalizedEmail = normalizeEmail(email);

  return configuredEmails
    .split(",")
    .map(normalizeEmail)
    .filter(Boolean)
    .includes(normalizedEmail);
}

/**
 * Persist the effective plan so every existing plan check (including usage
 * reservation) sees Pro without requiring special-case logic downstream.
 */
export async function applyLifetimeProEntitlement(user: User): Promise<User> {
  if (user.plan === "pro" || !hasLifetimeProEntitlement(user.email)) {
    return user;
  }

  const [updated] = await db
    .update(usersTable)
    .set({ plan: "pro" })
    .where(eq(usersTable.id, user.id))
    .returning();

  return updated ?? user;
}
