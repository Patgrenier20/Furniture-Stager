import { PGlite } from "@electric-sql/pglite";
import { drizzle as drizzlePglite } from "drizzle-orm/pglite";
import {
  drizzle as drizzlePostgres,
  type NodePgDatabase,
} from "drizzle-orm/node-postgres";
import pg from "pg";
import { mkdir } from "node:fs/promises";
import path from "node:path";
import * as schema from "./schema";

const { Pool } = pg;

/**
 * Local-dev-only convenience bootstrap for the zero-config PGlite database.
 *
 * This intentionally mirrors the *current* schema (including the foreign
 * keys and indexes defined in ./schema) so a fresh `pnpm dev` checkout gets
 * a fully-formed database with no manual steps. It is NOT the source of
 * truth for schema changes going forward, and it is never run against a
 * real PostgreSQL database (see the DATABASE_URL branch below).
 *
 * Why not just call the real migrator here too? This module gets bundled
 * by esbuild into a single dist/index.mjs file (see artifacts/api-server's
 * build.mjs). Once bundled, `import.meta.url` resolves to that bundle's own
 * location, not to this source file's location in lib/db/src -- so a
 * migrationsFolder path computed relative to this file would silently
 * point at the wrong directory at runtime. A plain SQL string has no such
 * path dependency, which is why it's the right tool for this dev-only
 * convenience path specifically.
 *
 * If you already have a local .local-data directory from before the
 * foreign keys/indexes/billing_events table existed, IF NOT EXISTS means
 * those additions won't retroactively apply to it. Local dev data is
 * disposable -- delete .local-data (or set LOCAL_DATABASE_PATH elsewhere)
 * to get a clean recreate with the current schema.
 */
const bootstrapSql = `
  CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    email TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    plan TEXT NOT NULL DEFAULT 'free',
    trial_used INTEGER NOT NULL DEFAULT 0,
    trial_limit INTEGER NOT NULL DEFAULT 3,
    model_provider TEXT NOT NULL DEFAULT 'openai',
    text_model TEXT NOT NULL DEFAULT 'gpt-4.1',
    image_model TEXT NOT NULL DEFAULT 'gpt-image-1',
    multimodal_model TEXT NOT NULL DEFAULT 'gpt-4.1',
    openai_api_key TEXT,
    anthropic_api_key TEXT,
    google_api_key TEXT,
    xai_api_key TEXT,
    mistral_api_key TEXT,
    stripe_customer_id TEXT,
    stripe_subscription_id TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  );

  CREATE TABLE IF NOT EXISTS projects (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT,
    original_image_url TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  );

  CREATE TABLE IF NOT EXISTS edited_images (
    id SERIAL PRIMARY KEY,
    project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    type TEXT NOT NULL,
    image_url TEXT NOT NULL,
    room_style TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  );

  CREATE TABLE IF NOT EXISTS ads (
    id SERIAL PRIMARY KEY,
    project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    price NUMERIC(10, 2),
    condition TEXT,
    location TEXT,
    image_url TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  );

  CREATE TABLE IF NOT EXISTS billing_events (
    id SERIAL PRIMARY KEY,
    stripe_event_id TEXT NOT NULL UNIQUE,
    type TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  );

  CREATE INDEX IF NOT EXISTS users_stripe_customer_id_idx ON users (stripe_customer_id);
  CREATE INDEX IF NOT EXISTS projects_user_id_idx ON projects (user_id);
  CREATE INDEX IF NOT EXISTS edited_images_project_id_idx ON edited_images (project_id);
  CREATE INDEX IF NOT EXISTS ads_project_id_idx ON ads (project_id);
`;

type Database = NodePgDatabase<typeof schema>;

/** The network pool exists only when a hosted PostgreSQL URL is configured. */
export let pool: pg.Pool | null = null;

let database: Database;

if (process.env.DATABASE_URL) {
  // Schema for a real PostgreSQL database is managed exclusively through
  // versioned migrations in lib/db/drizzle/ (source of truth: lib/db/src/schema).
  // Run `pnpm --filter @workspace/db run migrate` as an explicit deploy step
  // BEFORE starting this server -- it must not run implicitly on every app
  // boot, both to keep schema changes reviewable/auditable and to avoid
  // multiple server replicas racing to apply the same migration concurrently
  // on startup. If you see "relation ... does not exist" errors, that means
  // migrations haven't been applied to this DATABASE_URL yet.
  pool = new Pool({ connectionString: process.env.DATABASE_URL });
  database = drizzlePostgres(pool, { schema });
} else if (process.env.NODE_ENV === "production") {
  throw new Error("DATABASE_URL is required when NODE_ENV=production.");
} else {
  // PGlite is real PostgreSQL compiled to WebAssembly. Using a filesystem data
  // directory makes local accounts and projects survive API restarts.
  const dataDirectory = process.env.LOCAL_DATABASE_PATH
    ?? path.resolve(process.cwd(), ".local-data", "furniflip");

  // PGlite creates the database directory itself, but its parent must exist.
  await mkdir(path.dirname(dataDirectory), { recursive: true });
  const client = new PGlite(dataDirectory);

  await client.exec(bootstrapSql);
  database = drizzlePglite(client, { schema }) as unknown as Database;
}

export const db = database;

export * from "./schema";
