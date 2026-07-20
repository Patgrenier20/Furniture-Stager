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
 * The SQL kept here is intentionally small and mirrors the Drizzle schema.
 * It gives a fresh local checkout a usable database without requiring Docker,
 * PostgreSQL, or a manual migration command before the API can start.
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
    user_id INTEGER NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    original_image_url TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  );

  CREATE TABLE IF NOT EXISTS edited_images (
    id SERIAL PRIMARY KEY,
    project_id INTEGER NOT NULL,
    type TEXT NOT NULL,
    image_url TEXT NOT NULL,
    room_style TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  );

  CREATE TABLE IF NOT EXISTS ads (
    id SERIAL PRIMARY KEY,
    project_id INTEGER NOT NULL,
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    price NUMERIC(10, 2),
    condition TEXT,
    location TEXT,
    image_url TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  );

  CREATE INDEX IF NOT EXISTS projects_user_id_idx ON projects (user_id);
  CREATE INDEX IF NOT EXISTS edited_images_project_id_idx ON edited_images (project_id);
  CREATE INDEX IF NOT EXISTS ads_project_id_idx ON ads (project_id);
`;

type Database = NodePgDatabase<typeof schema>;

/** The network pool exists only when a hosted PostgreSQL URL is configured. */
export let pool: pg.Pool | null = null;

let database: Database;

if (process.env.DATABASE_URL) {
  pool = new Pool({ connectionString: process.env.DATABASE_URL });
  await pool.query(bootstrapSql);
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
