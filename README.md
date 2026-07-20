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

Before deploying a multi-user public service, use a durable production session store, encrypt user-supplied API keys at rest, configure trusted origins, and review data-retention requirements for uploaded images.

## Contributing

Contributions are welcome. See [CONTRIBUTING.md](CONTRIBUTING.md) for the development workflow.

## License

FurniFlip is available under the [MIT License](LICENSE).
