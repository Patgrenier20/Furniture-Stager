import { defineConfig } from "drizzle-kit";

// `generate` only diffs the schema files against prior migration snapshots
// and writes SQL locally -- it never connects to a database, so it must not
// require DATABASE_URL. `migrate` and `push` do connect, and will fail with
// drizzle-kit's own clear error if DATABASE_URL is missing when they run.
export default defineConfig({
  schema: "./src/schema/index.ts",
  out: "./drizzle",
  dialect: "postgresql",
  ...(process.env.DATABASE_URL
    ? { dbCredentials: { url: process.env.DATABASE_URL } }
    : {}),
});