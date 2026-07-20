# Contributing to FurniFlip

Thanks for helping improve FurniFlip.

## Development workflow

1. Fork the repository and create a focused branch.
2. Install dependencies with `pnpm install`.
3. Make a small, clearly scoped change.
4. Run `pnpm typecheck`, `pnpm test`, and `pnpm build`.
5. Open a pull request that explains the problem, the chosen approach, and how the change was verified.

## Project expectations

- Never commit credentials, environment files, customer uploads, location metadata, or private planning documents.
- Add or update tests for behavior changes.
- Keep generated API files synchronized with the OpenAPI source.
- Preserve accessible labels, keyboard behavior, and responsive layouts.
- Keep pull requests focused; unrelated cleanup belongs in a separate change.

## Reporting bugs

Please include reproduction steps, expected behavior, actual behavior, environment details, and relevant logs with secrets removed. Security issues must follow [SECURITY.md](SECURITY.md), not a public issue.
