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
   - **(Barebone) Web + API** — minimal Next.js + Express apps with root tooling
   - **Web + API** — Next.js + Express
   - **App + API** — Expo (with NativeWind) + Express
   - **Full monorepo** — Next.js + Expo + Express
3. **Install dependencies** — runs `pnpm install`
4. **Initialize git** — runs `git init`

You can also choose the project type non-interactively:

```bash
pnpm dlx @abduljamac/create-mono-init my-project --kind barebones --description "My app"
pnpm dlx @abduljamac/create-mono-init my-project --barebones --description "My app" --no-install --no-git
```

## What you get

### Opinionated modes

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
├── AGENTS.md            # AI/LLM project guidelines (the source of truth)
├── CLAUDE.md            # Points to AGENTS.md (Claude Code)
└── COPILOT.md           # Points to AGENTS.md (GitHub Copilot)
```

Apps included depend on the project type you choose. In the opinionated Web/App/Full modes, the `packages/shared` package is included — it contains shared TypeScript types (API response shapes, etc.) that keep your API contracts in sync across apps. Import from any app with:

```ts
import type { HelloResponse } from "shared";
```

### Barebone mode

Barebone mode keeps the root Turborepo/Biome setup but skips the opinionated app folders, shared package, tests, middleware, routes, and generated coding rules.

```
my-project/
├── apps/
│   ├── api/
│   │   └── src/index.ts     # Minimal Express listener
│   └── web/
│       └── app/page.tsx     # Hello world page
├── packages/                # Empty
├── turbo.json
├── biome.json
├── pnpm-workspace.yaml
├── AGENTS.md                # Empty
└── CLAUDE.md                # Points to AGENTS.md
```

The barebone API starts with:

```ts
app.listen(port, () => {
  console.log(`[api] listening on http://localhost:${port}`);
});
```

The barebone web page starts with:

```tsx
export default function Page() {
  return <h1>Hello world</h1>;
}
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
pnpm validate     # Lint, type-check, test, and build
pnpm smoke        # Pack and verify every generated project kind
```

The project requires Node.js 20.19 or newer and records its pnpm version in
`package.json` so local development and CI use the same package manager.

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
# Run every release guard, including package-structure verification
pnpm release:check

# Bump the version
npm version patch   # or minor / major

# Publish (prepublishOnly runs the release checks again)
npm publish --access public
```

The local smoke command runs the packaged CLI against all four scaffold modes:
barebones, web, app, and full.
