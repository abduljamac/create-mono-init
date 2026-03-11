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
				"--skip-transforms",
			],
			{ cwd: parentDir, stdio: "inherit" },
		);
	} catch {
		throw new Error(
			"Failed to bootstrap Turborepo. Make sure pnpm is installed and you have network access.",
		);
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
	} catch {
		throw new Error(
			"Failed to scaffold Next.js app. Make sure pnpm is installed and you have network access.",
		);
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
	} catch {
		throw new Error(
			"Failed to scaffold Expo app. Make sure pnpm is installed and you have network access.",
		);
	}
}

async function setupNativeWindExpo(appDir: string): Promise<void> {
	// 1) Ensure dependencies (NativeWind docs specify versions for Expo setup)
	// We patch package.json so the final workspace `pnpm install` pulls these in.
	const pkgPath = path.join(appDir, "package.json");
	const pkg = await fs.readJson(pkgPath);

	pkg.dependencies ??= {};
	pkg.devDependencies ??= {};

	// NativeWind + peer deps per NativeWind Expo install docs
	// (versions come from their guide).
	pkg.dependencies["nativewind"] ??= "^4.0.0";
	pkg.dependencies["react-native-reanimated"] ??= "~3.17.4";
	pkg.dependencies["react-native-safe-area-context"] ??= "5.4.0";
	pkg.devDependencies["tailwindcss"] ??= "^3.4.17";

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

	// Copy root-level config files from templates (Biome + npmrc).
	// These templates are shipped with the generator package.
	await fs.copy(
		templatesPath("root", "biome.json"),
		path.join(rootDir, "biome.json"),
		{ overwrite: true },
	);
	// Write .npmrc inline (npm strips .npmrc from published packages for security).
	await fs.writeFile(
		path.join(rootDir, ".npmrc"),
		"node-linker=hoisted\nshamefully-hoist=true\nstrict-peer-dependencies=false\n",
		"utf8",
	);

	// Patch root package.json: keep whatever create-turbo produced, add Biome scripts + devDependency.
	await patchRootPackageJson(rootDir);

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
	}

	if (plan.kind === "app" || plan.kind === "full") {
		await generateExpoApp(rootDir);
		await setupNativeWindExpo(path.join(rootDir, "apps", "app"));
		await addSharedDependency(path.join(appsDir, "app"));
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
	pkg.dependencies["shared"] = "workspace:*";
	await fs.writeJson(pkgPath, pkg, { spaces: 2 });
}

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
