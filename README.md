# FurniFlip

FurniFlip is an open-source prototype for furniture flippers. It combines project tracking, AI-assisted photo preparation, room staging, and marketplace listing copy in one workflow.

> FurniFlip is under active development. Review the security and deployment notes before exposing an instance to the public internet.

## What it does

- Track furniture projects from the original photo through the finished listing.
- Remove image backgrounds and generate staged room concepts.
- Draft marketplace ad copy from item details.
- Let each user configure their own AI models and API key.
- Run locally with an embedded PostgreSQL-compatible database for development.

## Technology

- React 19, Vite, TypeScript, Tailwind CSS, and TanStack Query
- Express 5, Drizzle ORM, PostgreSQL, and PGlite
- OpenAI image and text APIs
- pnpm workspaces

## Requirements

- Node.js 24 or newer
- pnpm 11

## Quick start

```bash
pnpm install
pnpm dev
```

The web app starts on `http://localhost:18209` and proxies API requests to the server on `http://localhost:8080`.

In development, the API creates a persistent local database under `artifacts/api-server/.local-data/`. This directory, environment files, runtime uploads, and private planning documents are excluded from Git.

## Configuration

Set environment variables in your shell or deployment platform. Never commit real credentials.

| Variable | Required | Purpose |
| --- | --- | --- |
| `SESSION_SECRET` | Production | A random secret of at least 32 characters for signing sessions |
| `DATABASE_URL` | Production | PostgreSQL connection string; development falls back to local PGlite |
| `ENCRYPTION_KEY` | Production | Base64-encoded 256-bit key used to encrypt user-supplied AI provider API keys at rest. Generate with `node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"` and keep it out of version control; rotating it will make previously stored keys undecryptable, so back it up like any other production secret |
| `CORS_ORIGIN` | Optional | Comma-separated cross-origin allowlist; production defaults to same-origin only |
| `OPENAI_API_KEY` | Optional | Server-wide fallback key when a user has not configured one |
| `STRIPE_SECRET_KEY` | Billing only | Stripe server API key |
| `STRIPE_WEBHOOK_SECRET` | Billing only | Stripe webhook signature secret |
| `STRIPE_PRO_PRICE_ID` | Billing only | Stripe price identifier for the paid plan |
| `API_PROXY_TARGET` | Optional | Development API proxy target; defaults to `http://127.0.0.1:8080` |
| `BASE_PATH` | Optional | URL base path for deployments below a domain subpath |
| `PORT` | Optional | Service port override |
| `LOG_LEVEL` | Optional | API log level; defaults to `info` |

## Commands

```bash
pnpm dev                 # Start the API and web app
pnpm typecheck           # Type-check all packages
pnpm build               # Type-check and build all applications
pnpm test                # Run reusable integration tests
```

## Database migrations

Schema changes for a real PostgreSQL database (anything using `DATABASE_URL`) are managed exclusively through versioned Drizzle migrations, not by an implicit bootstrap step at app startup:

```bash
pnpm --filter @workspace/db run generate   # After editing lib/db/src/schema/*, diff and write a new SQL migration
pnpm --filter @workspace/db run migrate    # Apply any pending migrations in lib/db/drizzle/ to DATABASE_URL
```

`migrate` must be run as an explicit deploy step **before** starting the server on a given `DATABASE_URL` -- wire it into your deploy pipeline or container entrypoint ahead of `pnpm --filter @workspace/api-server run start`. It intentionally does not run automatically on every app boot, both so schema changes stay reviewable in pull requests and so multiple server replicas never race to apply the same migration concurrently on startup.

**If you already have a database that predates this migration workflow** (i.e., one whose `users`/`projects`/`edited_images`/`ads` tables were created by the old implicit bootstrap step rather than by a migration), the first migration (`lib/db/drizzle/0000_amazing_ares.sql`) will fail with "relation already exists" if you run it as-is, because its `CREATE TABLE` statements aren't guarded with `IF NOT EXISTS`. Before running `migrate` against that database, either:

- **No real user data yet:** point `DATABASE_URL` at a fresh database and let `migrate` create everything from scratch, or
- **Has real user data you need to keep:** manually record migration `0000` as already applied without re-running its `CREATE TABLE` statements, then apply only the genuinely new parts (the foreign keys, indexes, and the new `billing_events` table) by hand. Ask for a copy of that one-time reconciliation script before running `migrate` in this situation -- do not run `migrate` blind against a database with real data.

Local development (PGlite, no `DATABASE_URL` set) is unaffected by any of this -- it keeps using a small embedded bootstrap that mirrors the current schema, so `pnpm dev` continues to work with zero setup.

If your `.local-data/` directory predates this schema change (missing foreign keys, indexes, or the `billing_events` table), delete it and let `pnpm dev` recreate it -- local dev data is disposable by design.

## Repository layout

```text
artifacts/
  api-server/            Express API
  furniture-flip/        React/Vite application
lib/
  api-client-react/      Generated client and fetch wrapper
  api-spec/              OpenAPI source and generator config
  api-zod/               Generated request/response schemas
  db/                    Database schema and connection layer
scripts/                 Maintained workspace setup helpers
```

## Privacy and security

- Runtime uploads and local databases are intentionally untracked.
- Demo furniture images are synthetic and contain no customer or location data.
- Production refuses to start without a strong session secret and a real database.
- Report vulnerabilities privately as described in [SECURITY.md](SECURITY.md).

Before deploying a multi-user public service, use a durable production session store, configure trusted origins, and review data-retention requirements for uploaded images. User-supplied AI provider API keys are encrypted at rest with AES-256-GCM (see `ENCRYPTION_KEY` above and `artifacts/api-server/src/lib/crypto.ts`); make sure that key is generated and stored as a real secret, not left unset.

## Contributing

Contributions are welcome. See [CONTRIBUTING.md](CONTRIBUTING.md) for the development workflow.

## License

FurniFlip is available under the [MIT License](LICENSE).
