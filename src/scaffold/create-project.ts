import nodeFs from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import { execa } from "execa";
import fs from "fs-extra";
import type { ScaffoldPlan } from "../prompts.js";

/**
 * Creates a new monorepo project in the user's current working directory:
 *   <cwd>/<projectName>/
 *
 * This function is intentionally "batteries included" for MVP:
 * - Bootstraps a Turborepo via `create-turbo`
 * - Normalises layout to apps/{api,web,app} and an empty packages/
 * - Writes pnpm-workspace.yaml for apps/* + packages/*
 * - Copies our local templates into apps/*
 * - Patches root package.json to include biome scripts + devDependency
 *
 * Later steps will replace the web/app stubs with real Next/Expo scaffolds.
 */
export async function createProject(plan: ScaffoldPlan): Promise<string> {
	const rootDir = path.resolve(process.cwd(), plan.projectName);

	await bootstrapTurborepo(rootDir);
	if (plan.kind === "barebones") {
		await normalizeBarebonesTurborepo(rootDir, plan);
		return rootDir;
	}

	await normalizeTurborepo(rootDir, plan);

	return rootDir;
}

/**
 * Runs create-turbo to generate a base Turborepo in `rootDir`.
 *
 * We use pnpm dlx so the generator doesn't depend on global installs.
 * We skip install/transforms because the generator controls installation in a later step.
 */
async function bootstrapTurborepo(rootDir: string): Promise<void> {
	const parentDir = path.dirname(rootDir);
	const dirName = path.basename(rootDir);

	// create-turbo expects to create the directory itself.
	// If it exists but is empty, remove it to avoid "already exists" errors.
	if (await fs.pathExists(rootDir)) {
		const entries = await fs.readdir(rootDir);
		if (entries.length > 0) {
			throw new Error(
				`Target directory already exists and is not empty: ${rootDir}`,
			);
		}
		await fs.remove(rootDir);
	}

	try {
		await execa(
			"pnpm",
			[
				"dlx",
				"create-turbo@latest",
				dirName,
				"--example",
				"with-shell-commands",
				"--package-manager",
				"pnpm",
				"--skip-install",
				"--no-git",
				"--skip-transforms",
			],
			{ cwd: parentDir, stdio: "inherit" },
		);
	} catch (err) {
		const msg = err instanceof Error ? err.message : String(err);
		throw new Error(`Failed to bootstrap Turborepo: ${msg}`);
	}
}

async function generateNextWebApp(rootDir: string): Promise<void> {
	try {
		await execa(
			"pnpm",
			[
				"dlx",
				"create-next-app@latest",
				"apps/web",
				"--ts",
				"--tailwind",
				"--app",
				"--use-pnpm",
				"--skip-install",
				"--disable-git",
				"--no-linter",
				"--yes",
			],
			{ cwd: rootDir, stdio: "inherit" },
		);
	} catch (err) {
		const msg = err instanceof Error ? err.message : String(err);
		throw new Error(`Failed to scaffold Next.js app: ${msg}`);
	}
}

async function generateExpoApp(rootDir: string): Promise<void> {
	try {
		await execa(
			"pnpm",
			[
				"dlx",
				"create-expo-app@latest",
				"apps/app",
				"--yes",
				"--no-install",
				"--template",
				"blank-typescript",
			],
			{ cwd: rootDir, stdio: "inherit" },
		);
	} catch (err) {
		const msg = err instanceof Error ? err.message : String(err);
		throw new Error(`Failed to scaffold Expo app: ${msg}`);
	}
}

async function setupNativeWindExpo(appDir: string): Promise<void> {
	// 1) Ensure dependencies (NativeWind docs specify versions for Expo setup)
	// We patch package.json so the final workspace `pnpm install` pulls these in.
	const pkgPath = path.join(appDir, "package.json");
	const pkg = await fs.readJson(pkgPath);

	pkg.dependencies ??= {};
	pkg.devDependencies ??= {};

	// NativeWind + peer deps — use "latest" so projects always start up-to-date.
	pkg.dependencies.nativewind ??= "latest";
	pkg.dependencies["react-native-reanimated"] ??= "latest";
	pkg.dependencies["react-native-worklets"] ??= "latest";
	pkg.dependencies["react-native-safe-area-context"] ??= "latest";
	pkg.devDependencies.tailwindcss ??= "latest";

	await fs.writeJson(pkgPath, pkg, { spaces: 2 });

	// 2) tailwind.config.js
	// NativeWind requires preset + content globs that include files using className
	await fs.writeFile(
		path.join(appDir, "tailwind.config.js"),
		`/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./App.{js,jsx,ts,tsx}",
    "./components/**/*.{js,jsx,ts,tsx}",
    "./app/**/*.{js,jsx,ts,tsx}"
  ],
  presets: [require("nativewind/preset")],
  theme: { extend: {} },
  plugins: [],
};
`,
		"utf8",
	);

	// 3) global.css (Tailwind directives)
	await fs.writeFile(
		path.join(appDir, "global.css"),
		`@tailwind base;
@tailwind components;
@tailwind utilities;
`,
		"utf8",
	);

	// 4) babel.config.js (NativeWind Babel integration)
	await fs.writeFile(
		path.join(appDir, "babel.config.js"),
		`module.exports = function (api) {
  api.cache(true);
  return {
    presets: [
      ["babel-preset-expo", { jsxImportSource: "nativewind" }],
      "nativewind/babel",
    ],
    plugins: ["react-native-reanimated/plugin"],
  };
};
`,
		"utf8",
	);

	// 5) metro.config.js (NativeWind Metro integration)
	await fs.writeFile(
		path.join(appDir, "metro.config.js"),
		`const { getDefaultConfig } = require("expo/metro-config");
const { withNativeWind } = require("nativewind/metro");

const config = getDefaultConfig(__dirname);

module.exports = withNativeWind(config, { input: "./global.css" });
`,
		"utf8",
	);

	// 6) app.json tweak: set web bundler to metro (NativeWind doc)
	const appJsonPath = path.join(appDir, "app.json");
	if (await fs.pathExists(appJsonPath)) {
		const appJson = await fs.readJson(appJsonPath);
		appJson.expo ??= {};
		appJson.expo.web ??= {};
		appJson.expo.web.bundler = "metro";
		await fs.writeJson(appJsonPath, appJson, { spaces: 2 });
	}

	// 7) nativewind-env.d.ts (TypeScript types for className)
	await fs.writeFile(
		path.join(appDir, "nativewind-env.d.ts"),
		`/// <reference types="nativewind/types" />
`,
		"utf8",
	);

	// 8) Ensure App.tsx imports global.css
	const appTsxPath = path.join(appDir, "App.tsx");
	if (await fs.pathExists(appTsxPath)) {
		const src = await fs.readFile(appTsxPath, "utf8");
		if (!src.includes('import "./global.css"')) {
			await fs.writeFile(appTsxPath, `import "./global.css";\n${src}`, "utf8");
		}
	}
}

/**
 * Normalises create-turbo output into the layout we want for this generator:
 *
 *   apps/
 *     api/
 *     web/ (optional)
 *     app/ (optional)
 *   packages/ (empty)
 *
 * Also:
 * - Ensures pnpm-workspace.yaml is apps/* + packages/*
 * - Copies generator templates into apps/*
 * - Patches root package.json to add Biome scripts/dependency
 *
 * This keeps Turborepo conventions (apps vs packages) while using your package names.
 */
async function normalizeTurborepo(
	rootDir: string,
	plan: ScaffoldPlan,
): Promise<void> {
	const appsDir = path.join(rootDir, "apps");
	const packagesDir = path.join(rootDir, "packages");

	// Ensure dirs exist, then wipe any example content from the create-turbo example.
	await fs.mkdirp(appsDir);
	await fs.mkdirp(packagesDir);
	await fs.emptyDir(appsDir);
	await fs.emptyDir(packagesDir);

	// Enforce workspace patterns (apps/* + packages/*).
	// This is the expected Turborepo + pnpm convention.
	const workspaceYaml = `packages:\n  - "apps/*"\n  - "packages/*"\n`;
	await fs.writeFile(
		path.join(rootDir, "pnpm-workspace.yaml"),
		workspaceYaml,
		"utf8",
	);

	await writeRootToolingFiles(rootDir);

	// Generate AGENTS.md tailored to the project kind and create LLM-specific aliases.
	await writeAgentsMd(rootDir, plan);
	const agentsRef = "See AGENTS.md for project guidelines.\n";
	await fs.writeFile(path.join(rootDir, "CLAUDE.md"), agentsRef, "utf8");
	await fs.writeFile(path.join(rootDir, "COPILOT.md"), agentsRef, "utf8");

	// Write README.md with the user's project name and description.
	await writeReadme(rootDir, plan);

	// Patch root package.json: set name/description, add Biome scripts + devDependency.
	await patchRootPackageJson(rootDir, plan);

	// Replace turbo.json with pipelines matching our apps layout.
	await patchTurboJson(rootDir);

	// Copy shared types package into packages/
	await fs.copy(templatesPath("shared"), path.join(packagesDir, "shared"), {
		overwrite: true,
	});

	// Copy package templates into apps/
	await fs.copy(templatesPath("api"), path.join(appsDir, "api"), {
		overwrite: true,
	});

	if (plan.kind === "web" || plan.kind === "full") {
		await generateNextWebApp(rootDir);
		await addSharedDependency(path.join(appsDir, "web"));
		await addTestingSetup(path.join(appsDir, "web"), "web");
		await writeWebEnvExample(path.join(appsDir, "web"));
	}

	if (plan.kind === "app" || plan.kind === "full") {
		await generateExpoApp(rootDir);
		await setupNativeWindExpo(path.join(rootDir, "apps", "app"));
		await addSharedDependency(path.join(appsDir, "app"));
		await addTestingSetup(path.join(appsDir, "app"), "app");
		await writeExpoEnvExample(path.join(appsDir, "app"));
	}
}

async function normalizeBarebonesTurborepo(
	rootDir: string,
	plan: ScaffoldPlan,
): Promise<void> {
	const appsDir = path.join(rootDir, "apps");
	const packagesDir = path.join(rootDir, "packages");
	const apiDir = path.join(appsDir, "api");
	const webDir = path.join(appsDir, "web");

	await fs.emptyDir(appsDir);
	await fs.emptyDir(packagesDir);
	await fs.writeFile(
		path.join(rootDir, "pnpm-workspace.yaml"),
		`packages:\n  - "apps/*"\n  - "packages/*"\n`,
		"utf8",
	);
	await writeRootToolingFiles(rootDir);
	await writeBarebonesApi(apiDir);
	await writeBarebonesWeb(webDir);
	await patchBarebonesPackageJson(rootDir, plan);
	await patchTurboJson(rootDir);
	await writeBarebonesAgentFiles(rootDir);
	await writeBarebonesReadme(rootDir, plan);
}

async function writeBarebonesApi(apiDir: string): Promise<void> {
	await fs.mkdirp(path.join(apiDir, "src"));
	await fs.writeJson(
		path.join(apiDir, "package.json"),
		{
			name: "api",
			private: true,
			type: "module",
			scripts: {
				dev: "node --env-file=.env --import tsx/esm --watch src/index.ts",
				build: "tsc -p tsconfig.json",
				start: "node --env-file=.env dist/index.js",
			},
			dependencies: {
				express: "latest",
			},
			devDependencies: {
				"@types/express": "latest",
				"@types/node": "latest",
				tsx: "latest",
				typescript: "latest",
			},
		},
		{ spaces: 2 },
	);
	await fs.writeFile(
		path.join(apiDir, ".env.example"),
		`# Copy this file to .env and fill in the values
PORT=3001
NODE_ENV=development
`,
		"utf8",
	);
	await fs.writeJson(
		path.join(apiDir, "tsconfig.json"),
		{
			compilerOptions: {
				target: "ES2022",
				module: "NodeNext",
				moduleResolution: "NodeNext",
				strict: true,
				esModuleInterop: true,
				skipLibCheck: true,
				outDir: "dist",
				rootDir: "src",
			},
			include: ["src"],
		},
		{ spaces: 2 },
	);
	await fs.writeFile(
		path.join(apiDir, "src", "index.ts"),
		`import express from "express";

const app = express();
const port = Number(process.env.PORT ?? 3001);

app.listen(port, () => {
  console.log(\`[api] listening on http://localhost:\${port}\`);
});
`,
		"utf8",
	);
}

async function writeBarebonesWeb(webDir: string): Promise<void> {
	await fs.mkdirp(path.join(webDir, "app"));
	await fs.writeJson(
		path.join(webDir, "package.json"),
		{
			name: "web",
			private: true,
			type: "module",
			scripts: {
				dev: "next dev",
				build: "next build",
				start: "next start",
			},
			dependencies: {
				next: "latest",
				react: "latest",
				"react-dom": "latest",
			},
			devDependencies: {
				"@types/node": "latest",
				"@types/react": "latest",
				"@types/react-dom": "latest",
				typescript: "latest",
			},
		},
		{ spaces: 2 },
	);
	await fs.writeJson(
		path.join(webDir, "tsconfig.json"),
		{
			compilerOptions: {
				target: "ES2017",
				lib: ["dom", "dom.iterable", "esnext"],
				allowJs: true,
				skipLibCheck: true,
				strict: true,
				noEmit: true,
				esModuleInterop: true,
				module: "esnext",
				moduleResolution: "bundler",
				resolveJsonModule: true,
				isolatedModules: true,
				jsx: "react-jsx",
				incremental: true,
				plugins: [{ name: "next" }],
			},
			include: [
				"next-env.d.ts",
				"**/*.ts",
				"**/*.tsx",
				".next/types/**/*.ts",
				".next/dev/types/**/*.ts",
			],
			exclude: ["node_modules"],
		},
		{ spaces: 2 },
	);
	await fs.writeFile(
		path.join(webDir, "next-env.d.ts"),
		`/// <reference types="next" />
/// <reference types="next/image-types/global" />
`,
		"utf8",
	);
	await fs.writeFile(
		path.join(webDir, "app", "layout.tsx"),
		`import type { ReactNode } from "react";

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
`,
		"utf8",
	);
	await fs.writeFile(
		path.join(webDir, "app", "page.tsx"),
		`export default function Page() {
  return <h1>Hello world</h1>;
}
`,
		"utf8",
	);
	await fs.writeFile(
		path.join(webDir, ".env.example"),
		`# Copy this file to .env. Next.js auto-loads .env in dev/build.
# Vars prefixed with NEXT_PUBLIC_ are exposed to the browser.
NEXT_PUBLIC_API_URL=http://localhost:3001
`,
		"utf8",
	);
}

/**
 * Patches a web or app package.json to add vitest and a test script,
 * then writes a minimal smoke test so `pnpm test` passes from day one.
 */
async function addTestingSetup(
	appDir: string,
	kind: "web" | "app",
): Promise<void> {
	const pkgPath = path.join(appDir, "package.json");
	if (!(await fs.pathExists(pkgPath))) return;

	const pkg = await fs.readJson(pkgPath);
	pkg.devDependencies ??= {};
	pkg.devDependencies.vitest ??= "latest";
	pkg.scripts ??= {};
	pkg.scripts.test ??= "vitest run";
	pkg.scripts["test:watch"] ??= "vitest";
	await fs.writeJson(pkgPath, pkg, { spaces: 2 });

	// Write a minimal smoke test so the pipeline has something to run.
	const testDir = path.join(appDir, "__tests__");
	await fs.mkdirp(testDir);
	const testContent =
		kind === "web"
			? `import { describe, expect, it } from "vitest";

describe("smoke test", () => {
  it("passes", () => {
    expect(true).toBe(true);
  });
});
`
			: `import { describe, expect, it } from "vitest";

describe("smoke test", () => {
  it("passes", () => {
    expect(true).toBe(true);
  });
});
`;
	await fs.writeFile(path.join(testDir, "smoke.test.ts"), testContent, "utf8");
}

/**
 * Locate the generator's `templates/` directory at runtime.
 *
 * Why: after bundling, `import.meta.url` points at the built output file location
 * (often `dist/index.js`). Hardcoding a fixed number of `..` segments is brittle,
 * so we walk upward until we find a `templates/` folder.
 *
 * Node: `import.meta.url` is module metadata containing the module URL. :contentReference[oaicite:3]{index=3}
 */
function templatesDir(): string {
	let dir = path.dirname(fileURLToPath(import.meta.url));

	for (let i = 0; i < 6; i++) {
		const candidate = path.join(dir, "templates");
		if (nodeFs.existsSync(candidate)) return candidate;
		dir = path.dirname(dir);
	}

	throw new Error(
		`Could not locate templates/. Searched upwards from: ${path.dirname(
			fileURLToPath(import.meta.url),
		)}`,
	);
}

function templatesPath(...parts: string[]): string {
	return path.join(templatesDir(), ...parts);
}

/**
 * Adds Biome scripts + devDependency to the root package.json, without clobbering Turbo scripts.
 * This keeps formatting/linting consistent across generated repos.
 */
/**
 * Writes a turbo.json that matches our apps layout (dev, build, check, format).
 */
async function patchTurboJson(rootDir: string): Promise<void> {
	const turboConfig = {
		$schema: "https://turbo.build/schema.json",
		tasks: {
			build: {
				dependsOn: ["^build"],
				outputs: ["dist/**", ".next/**", "!.next/cache/**"],
			},
			dev: {
				cache: false,
				persistent: true,
			},
			test: {},
			typecheck: {
				dependsOn: ["^build"],
			},
			check: {
				dependsOn: ["^build"],
			},
			format: {},
		},
	};
	await fs.writeJson(path.join(rootDir, "turbo.json"), turboConfig, {
		spaces: 2,
	});
}

/**
 * Adds "shared": "workspace:*" to a package's dependencies so it can import shared types.
 */
async function addSharedDependency(appDir: string): Promise<void> {
	const pkgPath = path.join(appDir, "package.json");
	if (!(await fs.pathExists(pkgPath))) return;
	const pkg = await fs.readJson(pkgPath);
	pkg.dependencies ??= {};
	pkg.dependencies.shared = "workspace:*";
	await fs.writeJson(pkgPath, pkg, { spaces: 2 });
}

async function writeWebEnvExample(webDir: string): Promise<void> {
	await fs.writeFile(
		path.join(webDir, ".env.example"),
		`# Copy this file to .env. Next.js auto-loads .env in dev/build.
# Vars prefixed with NEXT_PUBLIC_ are exposed to the browser.
NEXT_PUBLIC_API_URL=http://localhost:4000
`,
		"utf8",
	);
}

async function writeExpoEnvExample(appDir: string): Promise<void> {
	await fs.writeFile(
		path.join(appDir, ".env.example"),
		`# Copy this file to .env. Expo auto-loads .env in dev/build.
# Vars prefixed with EXPO_PUBLIC_ are exposed to the client bundle.
EXPO_PUBLIC_API_URL=http://localhost:4000
`,
		"utf8",
	);
}

async function writeReadme(rootDir: string, plan: ScaffoldPlan): Promise<void> {
	const title = plan.projectName;
	const descriptionLine = plan.description ? `\n${plan.description}\n` : "";

	const readme = `# ${title}
${descriptionLine}
## Structure

- \`apps/api/\` — Express API server${plan.kind === "web" || plan.kind === "full" ? "\n- `apps/web/` — Next.js frontend" : ""}${plan.kind === "app" || plan.kind === "full" ? "\n- `apps/app/` — Expo mobile app" : ""}
- \`packages/shared/\` — Shared TypeScript types used across all apps

## Getting started

1. Copy \`apps/api/.env.example\` to \`apps/api/.env\` and fill in the values
2. Run \`pnpm install\`
3. Run \`pnpm dev\` to start all apps

## Commands

| Command | Description |
|---------|-------------|
| \`pnpm dev\` | Start all apps concurrently |
| \`pnpm build\` | Build all packages and apps |
| \`pnpm test\` | Run all tests |
| \`pnpm typecheck\` | Type-check all packages |
| \`pnpm check\` | Lint with Biome |
| \`pnpm format\` | Lint and auto-fix with Biome |

## Shared types

The \`packages/shared\` package contains shared TypeScript types (API request/response shapes, etc.) used by all apps.

### Adding a new type

1. Add your type to \`packages/shared/src/api.ts\` (or create a new file)
2. Export it from \`packages/shared/src/index.ts\`
3. Import it in any app:

\`\`\`ts
import type { ApiResponse } from "shared";
\`\`\`

## AI/LLM Guidelines

This project includes an \`AGENTS.md\` file with coding conventions, naming rules, and project structure guidelines. Any AI tool will automatically pick these up. Edit \`AGENTS.md\` to customize how AI assistants write code in this project.
`;

	await fs.writeFile(path.join(rootDir, "README.md"), readme, "utf8");
}

async function writeAgentsMd(
	rootDir: string,
	plan: ScaffoldPlan,
): Promise<void> {
	const hasWeb = plan.kind === "web" || plan.kind === "full";
	const hasApp = plan.kind === "app" || plan.kind === "full";

	// Start from the base template.
	let content = await fs.readFile(templatesPath("root", "AGENTS.md"), "utf8");

	// Insert the structure listing after the "## Monorepo Structure" paragraph.
	const structureLines = [`- \`apps/api/\` — Express API server (TypeScript)`];
	if (hasWeb) structureLines.push(`- \`apps/web/\` — Next.js frontend`);
	if (hasApp) structureLines.push(`- \`apps/app/\` — Expo mobile app`);
	structureLines.push(
		`- \`packages/shared/\` — Shared TypeScript types used across all apps`,
	);

	content = content.replace(
		"## Monorepo Structure\n\nThis is a pnpm + Turborepo monorepo. All apps live in `apps/` and shared packages in `packages/`.\n",
		`## Monorepo Structure\n\nThis is a pnpm + Turborepo monorepo. All apps live in \`apps/\` and shared packages in \`packages/\`.\n\n${structureLines.join("\n")}\n`,
	);

	// Build kind-specific sections to append before General Principles.
	const extras: string[] = [];

	if (hasApp) {
		extras.push(`## Mobile App Folder Structure (\`apps/app/\`)

- **\`types/\`** — TypeScript type definitions and interfaces
- **\`utils/\`** — Utility functions and helpers (pure logic, no components)
- **\`hooks/\`** — Custom React hooks
- **\`screens/\`** — Screen components, organized by feature in subfolders
- **\`screens/<feature>/components/\`** — Components specific to that screen (co-located)
- **\`components/\`** — Shared, reusable components used across multiple screens
- **\`components/ui/\`** — Generic UI primitives (Button, Input — not tied to any screen)
- **\`services/\`** — API call functions (one file per resource)
- **\`stores/\`** — Global state (Zustand stores)
- **\`assets/\`** — Images, fonts, and static files
- **\`__tests__/\`** — Tests mirroring the source structure

Never put type or utility files inside \`screens/\` or \`components/\`. They belong in \`types/\` and \`utils/\`.`);
	}

	if (hasWeb) {
		extras.push(`## Web App Folder Structure (\`apps/web/\`)

- **\`types/\`** — TypeScript type definitions and interfaces
- **\`utils/\`** — Utility functions and helpers (pure logic, no components)
- **\`hooks/\`** — Custom React hooks
- **\`app/\`** — Next.js App Router pages and layouts
- **\`app/<route>/components/\`** — Components specific to that route (co-located)
- **\`components/\`** — Shared, reusable components used across multiple routes
- **\`components/ui/\`** — Generic UI primitives (not tied to any page)
- **\`lib/\`** — Client-side libraries and configurations
- **\`public/\`** — Static assets

Never put type or utility files inside \`app/\` or \`components/\`. They belong in \`types/\` and \`utils/\`.`);
	}

	if (hasWeb || hasApp) {
		extras.push(`## Screen & Component Decomposition

- **Screens/pages should be thin** — they compose components and hooks, not implement everything inline.
- **Shared components** (used across multiple screens/pages) go in the top-level \`components/\` folder.
- **Screen-specific components** live in a \`components/\` folder co-located inside the screen's route directory (e.g., \`screens/profile/components/avatar.tsx\`).
- **Small, single-use sub-components** can stay inline in the screen file. Move them out only when they grow or get reused elsewhere.`);
	}

	if (hasWeb || hasApp) {
		extras.push(`## Custom Hooks

- **Extract reusable logic into custom hooks** when a screen manages non-trivial state, side effects, or API interactions.
- **Naming**: \`use-<feature>.ts\` in kebab-case (e.g., \`use-auth-flow.ts\`, \`use-form.ts\`).
- **What belongs in a hook**: form state, API mutation wrappers, derived/computed values, loading state.
- **What does NOT belong in a hook**: navigation/screen transitions — these stay in the parent component.
- **Hook categories**:
  - **Query hooks** — Thin TanStack Query wrappers around service functions (\`useQuery\` / \`useMutation\`).
  - **Flow hooks** — Compose multiple query hooks with local state to manage a complete user flow.
- Prefer composing hooks over building monoliths.`);
	}

	if (hasWeb && hasApp) {
		extras.push(`## Styling

- **Always use Tailwind CSS \`className\`** for all styling in both web and mobile apps.
- Mobile app uses NativeWind (Tailwind for React Native). Web app uses Tailwind CSS directly.
- Use \`className\` for all layout, spacing, typography, colors, borders, shadows, and sizing.
- **Inline \`style\` is only acceptable** when Tailwind/NativeWind cannot express the property and it is required (e.g., React Native shadow properties, dynamic prop-driven values like progress bar widths). Always prefer \`className\` first.
- Add design tokens to \`tailwind.config.js\` \`theme.extend\` rather than hardcoding hex values in components.
- For values Tailwind doesn't support natively, use arbitrary values (e.g., \`text-[15px]\`, \`tracking-[-0.5px]\`, \`leading-[21px]\`).`);
	} else if (hasApp) {
		extras.push(`## Styling

- **Always use Tailwind CSS \`className\`** via NativeWind for all styling. Never use inline \`style={{}}\` objects or \`StyleSheet.create()\`.
- **Inline \`style\` is only acceptable** when NativeWind cannot express the property (e.g., React Native shadow properties, dynamic prop-driven values). Always prefer \`className\` first.
- Use \`className\` for all layout, spacing, typography, colors, borders, shadows, and sizing.
- Add design tokens to \`tailwind.config.js\` \`theme.extend\` rather than hardcoding hex values in components.
- For values Tailwind doesn't support natively, use arbitrary values (e.g., \`text-[15px]\`, \`tracking-[-0.5px]\`, \`leading-[21px]\`).`);
	} else {
		extras.push(`## Styling

- **Always use Tailwind CSS \`className\`** for all styling. Never use inline \`style={{}}\` objects.
- Use \`className\` for all layout, spacing, typography, colors, borders, shadows, and sizing.
- Add design tokens to \`tailwind.config.js\` \`theme.extend\` rather than hardcoding hex values in components.
- For values Tailwind doesn't support natively, use arbitrary values (e.g., \`text-[15px]\`, \`tracking-[-0.5px]\`, \`leading-[21px]\`).`);
	}

	// Insert kind-specific sections before "## General Principles".
	content = content.replace(
		"## General Principles",
		`${extras.join("\n\n")}\n\n## General Principles`,
	);

	await fs.writeFile(path.join(rootDir, "AGENTS.md"), content, "utf8");
}

async function patchRootPackageJson(
	rootDir: string,
	plan: ScaffoldPlan,
): Promise<void> {
	const rootPkgPath = path.join(rootDir, "package.json");
	const rootPkg = await fs.readJson(rootPkgPath);

	rootPkg.name = plan.projectName;
	if (plan.description) {
		rootPkg.description = plan.description;
	}

	rootPkg.scripts ??= {};
	rootPkg.scripts.test ??= "turbo test";
	rootPkg.scripts.typecheck ??= "turbo typecheck";
	rootPkg.scripts.check ??= "biome check .";
	rootPkg.scripts.format ??= "biome check . --write";

	rootPkg.devDependencies ??= {};
	rootPkg.devDependencies["@biomejs/biome"] ??= "latest";

	await fs.writeJson(rootPkgPath, rootPkg, { spaces: 2 });
}

async function patchBarebonesPackageJson(
	rootDir: string,
	plan: ScaffoldPlan,
): Promise<void> {
	const rootPkgPath = path.join(rootDir, "package.json");
	const rootPkg = await fs.readJson(rootPkgPath);

	rootPkg.name = plan.projectName;
	if (plan.description) {
		rootPkg.description = plan.description;
	}

	rootPkg.scripts ??= {};
	rootPkg.scripts.dev ??= "turbo dev";
	rootPkg.scripts.build ??= "turbo build";
	rootPkg.scripts.check ??= "biome check .";
	rootPkg.scripts.format ??= "biome check . --write";

	rootPkg.devDependencies ??= {};
	rootPkg.devDependencies["@biomejs/biome"] ??= "latest";

	await fs.writeJson(rootPkgPath, rootPkg, { spaces: 2 });
}

async function writeRootToolingFiles(rootDir: string): Promise<void> {
	await fs.copy(
		templatesPath("root", "biome.json"),
		path.join(rootDir, "biome.json"),
		{ overwrite: true },
	);
	await fs.writeFile(
		path.join(rootDir, ".npmrc"),
		"node-linker=hoisted\nshamefully-hoist=true\nstrict-peer-dependencies=false\n",
		"utf8",
	);
}

async function writeBarebonesReadme(
	rootDir: string,
	plan: ScaffoldPlan,
): Promise<void> {
	const descriptionLine = plan.description ? `\n${plan.description}\n` : "";
	const readme = `# ${plan.projectName}
${descriptionLine}
Barebones pnpm + Turborepo workspace.

## Structure

- \`apps/api/\` — minimal Express API
- \`apps/web/\` — minimal Next.js web app
- \`packages/\` — add shared packages here when you need them

## Getting started

1. Run \`pnpm install\`
2. Add apps or packages
3. Run \`pnpm dev\`
`;

	await fs.writeFile(path.join(rootDir, "README.md"), readme, "utf8");
}

async function writeBarebonesAgentFiles(rootDir: string): Promise<void> {
	await fs.writeFile(path.join(rootDir, "AGENTS.md"), "", "utf8");
	await fs.writeFile(
		path.join(rootDir, "CLAUDE.md"),
		"See AGENTS.md for project guidelines.\n",
		"utf8",
	);
}
