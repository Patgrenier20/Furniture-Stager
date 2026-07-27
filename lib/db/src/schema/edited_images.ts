import { pgTable, text, serial, integer, timestamp, index } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { projectsTable } from "./projects";

export const editedImagesTable = pgTable("edited_images", {
  id: serial("id").primaryKey(),
  projectId: integer("project_id")
    .notNull()
    .references(() => projectsTable.id, { onDelete: "cascade" }),
  type: text("type").notNull(), // "background_removed" | "staged"
  imageUrl: text("image_url").notNull(),
  roomStyle: text("room_style"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  index("edited_images_project_id_idx").on(table.projectId),
]);

export const insertEditedImageSchema = createInsertSchema(editedImagesTable).omit({
  id: true,
  createdAt: true,
});

export type InsertEditedImage = z.infer<typeof insertEditedImageSchema>;
export type EditedImage = typeof editedImagesTable.$inferSelect;
