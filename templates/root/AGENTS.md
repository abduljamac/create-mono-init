# Project Guidelines

## Monorepo Structure

This is a pnpm + Turborepo monorepo. All apps live in `apps/` and shared packages in `packages/`.

## Naming Conventions

- **Files and folders**: `kebab-case` (e.g., `user-profile.ts`, `auth-provider/`)
- **Components**: `kebab-case` file names, `PascalCase` exports (e.g., `user-card.tsx` exports `UserCard`)
- **Functions and variables**: `camelCase`
- **Types and interfaces**: `PascalCase`, no `I` prefix (e.g., `User`, not `IUser`)
- **Constants**: `UPPER_SNAKE_CASE` for true constants, `camelCase` for config objects
- **API routes**: `kebab-case` (e.g., `/api/user-profile`)

## Code Style

- **Formatter/Linter**: Biome (not ESLint/Prettier). Run `pnpm check` to lint, `pnpm format` to fix.
- **Indentation**: Tabs
- **Quotes**: Double quotes
- **Semicolons**: Yes
- **Imports**: Use `import type` for type-only imports. Biome auto-organizes imports.

## API Structure

- **`routes/`** — One file per resource
- **`middleware/`** — Request middleware
- **`lib/`** — Shared server utilities
- Use the shared types from `packages/shared` for request/response shapes
- Keep route handlers thin — business logic goes in separate functions

## Shared Types

All API request/response types live in `packages/shared/`. Import them in any app:

```ts
import type { ApiResponse, UserResponse } from "shared";
```

When adding a new API endpoint, always define the response type in `packages/shared/src/api.ts` first.

## General Principles

- Prefer simple, explicit code over clever abstractions
- Don't over-engineer — solve the current problem, not hypothetical future ones
- Use `workspace:*` to depend on internal packages
- Run `pnpm dev` from the root to start all apps concurrently via Turborepo
