import { pgTable, text, serial, timestamp } from "drizzle-orm/pg-core";

/**
 * Records every Stripe webhook event that has been successfully processed,
 * keyed by Stripe's own event.id. Stripe explicitly does not guarantee
 * exactly-once delivery -- the same event can be redelivered (e.g. if our
 * server is slow to respond and Stripe times out and retries). Checking
 * this table before applying an event's side effects (and inserting into it
 * atomically via onConflictDoNothing) lets the webhook handler in
 * routes/subscriptions.ts skip anything it has already handled, instead of
 * re-applying a plan change every time Stripe retries.
 */
export const billingEventsTable = pgTable("billing_events", {
  id: serial("id").primaryKey(),
  stripeEventId: text("stripe_event_id").notNull().unique(),
  type: text("type").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type BillingEvent = typeof billingEventsTable.$inferSelect;
