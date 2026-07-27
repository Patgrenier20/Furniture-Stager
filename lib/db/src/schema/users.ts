import { pgTable, text, serial, integer, timestamp, index } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const usersTable = pgTable("users", {
  id: serial("id").primaryKey(),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  plan: text("plan").notNull().default("free"), // "free" | "pro"
  trialUsed: integer("trial_used").notNull().default(0),
  trialLimit: integer("trial_limit").notNull().default(3),
  modelProvider: text("model_provider").notNull().default("openai"),
  textModel: text("text_model").notNull().default("gpt-4.1"),
  imageModel: text("image_model").notNull().default("gpt-image-1"),
  multimodalModel: text("multimodal_model").notNull().default("gpt-4.1"),
  // Encrypted at rest (AES-256-GCM) by artifacts/api-server/src/lib/crypto.ts
  // before being written here — see routes/settings.ts. Never store or log
  // these as plaintext.
  openaiApiKey: text("openai_api_key"),
  anthropicApiKey: text("anthropic_api_key"),
  googleApiKey: text("google_api_key"),
  xaiApiKey: text("xai_api_key"),
  mistralApiKey: text("mistral_api_key"),
  stripeCustomerId: text("stripe_customer_id"),
  stripeSubscriptionId: text("stripe_subscription_id"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  // Every Stripe webhook (subscription created/updated/deleted, checkout
  // completed) looks a user up by stripeCustomerId. Without this index,
  // that lookup is a full table scan on every webhook delivery.
  index("users_stripe_customer_id_idx").on(table.stripeCustomerId),
]);

export const insertUserSchema = createInsertSchema(usersTable).omit({
  id: true,
  createdAt: true,
});

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof usersTable.$inferSelect;
