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

## API Structure (`apps/api/`)

- **`routes/`** — One file per resource (`<resource>.route.ts`). Keep handlers thin — call services for business logic.
- **`middleware/`** — Cross-cutting concerns (auth, validation, error handling)
- **`services/`** — Business logic and external service integrations
- **`config/`** — Environment config, database connections
- **`utils/`** — Pure helper functions
- **`migrations/`** — Database migration scripts (if using a database)
- Use the shared types from `packages/shared` for all request/response shapes
- Error handling: use the `errorHandler` middleware for unhandled errors; throw typed errors from services
- Auth: apply auth middleware at the router level, not per-handler

## Shared Types

All API request/response types live in `packages/shared/`. Import them in any app:

```ts
import type { ApiResponse, PaginatedResponse } from "shared";
```

When adding a new API endpoint, define the response type in `packages/shared/src/api.ts` first.

## Testing

- **Approach**: Test-Driven Development (TDD) — write failing tests before implementing.
- **Test runner**: Vitest. Run `pnpm test` from the root or an app directory.
- **File location**: `__tests__/` directory mirroring the source structure, `.test.ts` / `.test.tsx` suffix.
- **TDD workflow**:
  1. Write a failing test that defines the expected behavior.
  2. Implement the minimum code to make the test pass.
  3. Refactor while keeping tests green.

### API (`apps/api/`)
- Test route handlers (status codes, response shapes, error cases) using `supertest` against the exported `app`
- Test service functions for business logic and edge cases
- Mock external dependencies (databases, third-party APIs) with `vi.mock` / `vi.fn`; keep logic under test real

### Mobile App (`apps/app/`)
- Test utility functions, custom hooks (state changes, async behavior)
- Test components with `@testing-library/react-native` (rendering, interactions, conditional UI)
- Mock navigation, async storage, and native modules

### General
- Don't test framework internals, third-party behavior, or trivial getters/setters

## Commands

- `pnpm dev` — Start all apps concurrently (Turborepo)
- `pnpm build` — Build all packages and apps
- `pnpm test` — Run all tests
- `pnpm typecheck` — Type-check all packages
- `pnpm check` — Lint with Biome
- `pnpm format` — Lint and auto-fix with Biome

## AI Workflow Tips

- **Write a build guide first**: Before asking AI to implement a feature, write a step-by-step spec (file paths, API shapes, SQL schemas). AI follows precise instructions far better than it infers vague intent.
- **Break tasks into focused prompts**: Instead of "build the entire auth system", use sequential prompts: routes → service layer → frontend hooks → tests. Each builds on verified output.
- **Specify value mappings explicitly**: When frontend and backend use different naming (e.g., `"light"` vs `"lightly_active"`), list the mappings. AI won't guess.
- **Restate code style in prompts**: AI tools default to spaces, single quotes, no semicolons. Even with this file, restating "tabs, double quotes, semicolons" prevents drift — especially with subagents.
- **Use TDD prompts**: Instead of "build feature X", try "write failing tests for feature X, then implement it." This produces more focused, testable code and catches bugs immediately.

## General Principles

- Prefer simple, explicit code over clever abstractions
- Don't over-engineer — solve the current problem, not hypothetical future ones
- Use `workspace:*` to depend on internal packages
- Run `pnpm dev` from the root to start all apps concurrently via Turborepo
