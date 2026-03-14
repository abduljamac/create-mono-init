# Project Guidelines

## Monorepo Structure

This is a pnpm + Turborepo monorepo. All apps live in `apps/` and shared packages in `packages/`.

- `apps/api/` — Express API server (TypeScript)
- `apps/web/` — Next.js frontend (if present)
- `apps/app/` — Expo mobile app (if present)
- `packages/shared/` — Shared TypeScript types used across all apps

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

## Mobile App Folder Structure (`apps/app/`)

- **`types/`** — TypeScript type definitions and interfaces
- **`utils/`** — Utility functions and helpers (pure logic, no components)
- **`hooks/`** — Custom React hooks
- **`screens/`** — Screen components, organized by feature in subfolders
- **`components/ui/`** — Shared, reusable UI primitives
- **`components/<feature>/`** — Feature-specific components
- **`assets/`** — Images, fonts, and static files

Never put type or utility files inside `screens/` or `components/`. They belong in `types/` and `utils/`.

## Web App Folder Structure (`apps/web/`)

- **`types/`** — TypeScript type definitions and interfaces
- **`utils/`** — Utility functions and helpers (pure logic, no components)
- **`hooks/`** — Custom React hooks
- **`app/`** — Next.js App Router pages and layouts
- **`components/ui/`** — Shared, reusable UI primitives
- **`components/<feature>/`** — Feature-specific components
- **`lib/`** — Client-side libraries and configurations
- **`public/`** — Static assets

Never put type or utility files inside `app/` or `components/`. They belong in `types/` and `utils/`.

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

## Styling

- **Always use Tailwind CSS** for all styling in both web and mobile apps. Never use inline `style={{}}` objects or `StyleSheet.create()`.
- Mobile app uses NativeWind (Tailwind for React Native). Web app uses Tailwind CSS directly.
- Use `className` for all layout, spacing, typography, colors, borders, shadows, and sizing.
- Add design tokens to `tailwind.config.js` `theme.extend` rather than hardcoding hex values in components.
- For values Tailwind doesn't support natively, use arbitrary values (e.g., `text-[15px]`, `tracking-[-0.5px]`, `leading-[21px]`).

## General Principles

- Prefer simple, explicit code over clever abstractions
- Don't over-engineer — solve the current problem, not hypothetical future ones
- Use `workspace:*` to depend on internal packages
- Run `pnpm dev` from the root to start all apps concurrently via Turborepo
