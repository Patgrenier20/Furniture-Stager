import { pgTable, text, serial, integer, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const editedImagesTable = pgTable("edited_images", {
  id: serial("id").primaryKey(),
  projectId: integer("project_id").notNull(),
  type: text("type").notNull(), // "background_removed" | "staged"
  imageUrl: text("image_url").notNull(),
  roomStyle: text("room_style"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertEditedImageSchema = createInsertSchema(editedImagesTable).omit({
  id: true,
  createdAt: true,
});

export type InsertEditedImage = z.infer<typeof insertEditedImageSchema>;
export type EditedImage = typeof editedImagesTable.$inferSelect;
