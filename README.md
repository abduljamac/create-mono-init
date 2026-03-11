# create-mono-init

A CLI scaffolding tool that generates opinionated **pnpm + Turborepo** monorepos in one command.

## Usage

```bash
pnpm dlx @abduljamac/create-mono-init
```

Or with npx:

```bash
npx @abduljamac/create-mono-init
```

You'll be prompted to choose:

1. **Project name** — the folder to create
2. **Project type**:
   - **Web + API** — Next.js + Express
   - **App + API** — Expo (with NativeWind) + Express
   - **Full monorepo** — Next.js + Expo + Express
3. **Install dependencies** — runs `pnpm install`
4. **Initialize git** — runs `git init`

## What you get

```
my-project/
├── apps/
│   ├── api/          # Express API (TypeScript, tsx watch)
│   ├── web/          # Next.js (App Router, Tailwind)
│   └── app/          # Expo (NativeWind / Tailwind)
├── packages/
│   └── shared/       # Shared TypeScript types across all apps
├── turbo.json        # Turborepo pipelines (dev, build, check, format)
├── biome.json        # Biome linting & formatting
├── pnpm-workspace.yaml
├── .npmrc
├── AGENTS.md            # AI/LLM project guidelines (the source of truth)
├── CLAUDE.md            # Points to AGENTS.md (Claude Code)
└── COPILOT.md           # Points to AGENTS.md (GitHub Copilot)
```

Apps included depend on the project type you choose. The `packages/shared` package is always included — it contains shared TypeScript types (API response shapes, etc.) that keep your API contracts in sync across apps. Import from any app with:

```ts
import type { HelloResponse } from "shared";
```

## Stack

- **Monorepo**: Turborepo + pnpm workspaces
- **API**: Express + TypeScript + tsx
- **Web**: Next.js (App Router, Tailwind CSS)
- **App**: Expo + NativeWind (Tailwind for React Native)
- **Linting/Formatting**: Biome

## Development

```bash
pnpm install
pnpm build        # Build the CLI
pnpm dev          # Watch mode
```

## Testing locally

After making changes, you can test the CLI locally without publishing to npm:

```bash
# Build the CLI
pnpm build

# Run it directly
node dist/index.js

# Or link it globally so you can run it by name
pnpm link --global
create-mono-init

# When done, unlink it
pnpm unlink --global
```

## Publishing

Changes on GitHub do **not** auto-publish to npm. To publish a new version:

```bash
# Bump the version
npm version patch   # or minor / major

# Build and publish
pnpm build
npm publish --access public
```
