import { index, json, pgTable, timestamp, varchar } from "drizzle-orm/pg-core";

/**
 * Durable Express sessions for production deployments.
 *
 * The column names and types intentionally match connect-pg-simple's default
 * contract. Keeping the table in Drizzle's schema ensures it is created by the
 * same reviewed migration workflow as the rest of the application data.
 */
export const sessionsTable = pgTable("user_sessions", {
  sid: varchar("sid").primaryKey(),
  sess: json("sess").notNull(),
  expire: timestamp("expire", { precision: 6 }).notNull(),
}, (table) => [
  index("user_sessions_expire_idx").on(table.expire),
]);
