# create-mono-init

A CLI scaffolding tool that generates opinionated **pnpm + Turborepo** monorepos in one command.

## Usage

```bash
pnpm dlx create-mono-init
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
├── packages/         # Shared packages
├── turbo.json        # Turborepo pipelines (dev, build, check, format)
├── biome.json        # Biome linting & formatting
├── pnpm-workspace.yaml
└── .npmrc
```

Apps included depend on the project type you choose.

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
