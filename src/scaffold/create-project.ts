import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import fs from "fs-extra";
import { execa } from "execa";
import type { ScaffoldPlan } from "../prompts.js";
import nodeFs from "node:fs";

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
			"--skip-transforms",
		],
		{ cwd: parentDir, stdio: "inherit" },
	);
}

async function generateNextWebApp(rootDir: string): Promise<void> {
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

	// Copy root-level config files from templates (Biome + npmrc).
	// These templates are shipped with the generator package.
	await fs.copy(
		templatesPath("root", "biome.json"),
		path.join(rootDir, "biome.json"),
		{ overwrite: true },
	);
	await fs.copy(templatesPath("root", ".npmrc"), path.join(rootDir, ".npmrc"), {
		overwrite: true,
	});

	// Patch root package.json: keep whatever create-turbo produced, add Biome scripts + devDependency.
	await patchRootPackageJson(rootDir);

	// Copy package templates into apps/
	await fs.copy(templatesPath("api"), path.join(appsDir, "api"), {
		overwrite: true,
	});

	if (plan.kind === "web" || plan.kind === "full") {
		await generateNextWebApp(rootDir);
	}

	if (plan.kind === "app" || plan.kind === "full") {
		await fs.copy(templatesPath("app"), path.join(appsDir, "app"), {
			overwrite: true,
		});
	}
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
async function patchRootPackageJson(rootDir: string): Promise<void> {
	const rootPkgPath = path.join(rootDir, "package.json");
	const rootPkg = await fs.readJson(rootPkgPath);

	rootPkg.scripts ??= {};
	rootPkg.scripts.check ??= "biome check .";
	rootPkg.scripts.format ??= "biome check . --write";

	rootPkg.devDependencies ??= {};
	rootPkg.devDependencies["@biomejs/biome"] ??= "^2.3.10";

	await fs.writeJson(rootPkgPath, rootPkg, { spaces: 2 });
}
