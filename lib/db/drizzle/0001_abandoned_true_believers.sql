ALTER TABLE "users" ALTER COLUMN "image_model" SET DEFAULT 'gpt-image-2';
--> statement-breakpoint
UPDATE "users"
SET "image_model" = 'gpt-image-2'
WHERE "model_provider" = 'openai' AND "image_model" = 'gpt-image-1';
