import path from "node:path";
import process from "node:process";
import fs from "fs-extra";
import type { ScaffoldPlan } from "../prompts.js";
import { writeAgentsMd } from "./agents.js";
import { writeBarebonesApi, writeBarebonesWeb } from "./barebones-apps.js";
import { generateExpoApp, generateNextWebApp } from "./framework-generators.js";
import { setupNativeWindExpo } from "./nativewind.js";
import { templatesPath } from "./template-paths.js";
import { prepareWorkspaceRoot } from "./workspace-root.js";

/**
 * Creates a new monorepo project in the user's current working directory:
 *   <cwd>/<projectName>/
 *
 * The individual framework and template concerns live in focused modules:
 * - Creates a deterministic Turborepo root
 * - Normalises the selected workspace layout
 * - Applies the root and application templates
 */
export async function createProject(plan: ScaffoldPlan): Promise<string> {
	const rootDir = path.resolve(process.cwd(), plan.projectName);

	await prepareWorkspaceRoot(rootDir, plan);
	if (plan.kind === "barebones") {
		await normalizeBarebonesTurborepo(rootDir, plan);
		return rootDir;
	}

	await normalizeTurborepo(rootDir, plan);

	return rootDir;
}

/**
 * Builds the opinionated workspace layout:
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

	// Ensure the selected layout starts from empty app and package directories.
	await fs.mkdirp(appsDir);
	await fs.mkdirp(packagesDir);
	await fs.emptyDir(appsDir);
	await fs.emptyDir(packagesDir);

	await writeWorkspaceConfig(rootDir);

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
	await writeWorkspaceConfig(rootDir);
	await writeRootToolingFiles(rootDir);
	await writeBarebonesApi(apiDir);
	await writeBarebonesWeb(webDir);
	await patchBarebonesPackageJson(rootDir, plan);
	await patchTurboJson(rootDir);
	await writeBarebonesAgentFiles(rootDir);
	await writeBarebonesReadme(rootDir, plan);
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
	pkg.scripts.typecheck ??=
		kind === "web" ? "next typegen && tsc --noEmit" : "tsc --noEmit";
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
	rootPkg.scripts.check ??= "biome lint .";
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
	rootPkg.scripts.typecheck ??= "turbo typecheck";
	rootPkg.scripts.check ??= "biome lint .";
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
		path.join(rootDir, ".gitignore"),
		`node_modules/
.pnpm-store/
dist/
.next/
.expo/
.turbo/
.env
.env.*
!.env.example
*.tsbuildinfo
`,
		"utf8",
	);
}

async function writeWorkspaceConfig(rootDir: string): Promise<void> {
	await fs.writeFile(
		path.join(rootDir, "pnpm-workspace.yaml"),
		`packages:
  - "apps/*"
  - "packages/*"

nodeLinker: hoisted
shamefullyHoist: true
strictPeerDependencies: false

allowBuilds:
  esbuild: true
  sharp: true
`,
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
