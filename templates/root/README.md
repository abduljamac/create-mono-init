# Monorepo (create-mono-init)

## Structure

- `apps/api/` — Express API server
- `apps/web/` — Next.js frontend (if selected)
- `apps/app/` — Expo mobile app (if selected)
- `packages/shared/` — Shared TypeScript types used across all apps

## Getting started

```bash
pnpm install
pnpm dev
```

## Shared types

The `packages/shared` package contains shared TypeScript types (API request/response shapes, etc.) that are used by all apps. This keeps your API contracts in sync across the stack.

### Adding a new type

1. Add your type to `packages/shared/src/api.ts` (or create a new file)
2. Export it from `packages/shared/src/index.ts`
3. Import it in any app:

```ts
import type { HelloResponse } from "shared";
```

The `shared` package is linked via `"shared": "workspace:*"` in each app's `package.json`, so changes are picked up immediately during development.
