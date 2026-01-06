import path from "node:path";
import fs from "fs-extra";
import { templatePath } from "./paths.js";
import { ensureEmptyDir } from "./fs.js";
import type { ScaffoldPlan } from "../prompts.js";

function workspacePackages(plan: ScaffoldPlan): string[] {
	const pkgs = ["api"];

	if (plan.kind === "web" || plan.kind === "full") pkgs.push("web");
	if (plan.kind === "app" || plan.kind === "full") pkgs.push("app");

	pkgs.push("packages/*");
	return pkgs;
}

async function writeWorkspaceYaml(rootDir: string, plan: ScaffoldPlan) {
	const pkgs = workspacePackages(plan)
		.map((p) => `  - "${p}"`)
		.join("\n");

	const yaml = `packages:\n${pkgs}\n`;

	// pnpm-workspace.yaml defines the workspace boundary and package patterns. :contentReference[oaicite:2]{index=2}
	await fs.writeFile(path.join(rootDir, "pnpm-workspace.yaml"), yaml, "utf8");
}

async function writeRootPackageJson(rootDir: string, plan: ScaffoldPlan) {
	const filters =
		plan.kind === "web"
			? ["./api", "./web"]
			: plan.kind === "app"
				? ["./api", "./app"]
				: ["./api", "./web", "./app"];

	const pkg = {
		name: plan.projectName,
		private: true,
		version: "0.1.0",
		scripts: {
			dev: `pnpm -r --parallel ${filters.map((f) => `--filter ${f}`).join(" ")} dev`,
			"dev:api": "pnpm --filter ./api dev",
			"dev:web": "pnpm --filter ./web dev",
			"dev:app": "pnpm --filter ./app dev",
			check: "biome check .",
			format: "biome check . --write",
		},
		devDependencies: {
			"@biomejs/biome": "latest",
		},
	};

	await fs.writeJson(path.join(rootDir, "package.json"), pkg, { spaces: 2 });
}

export async function createProject(plan: ScaffoldPlan) {
	const rootDir = path.resolve(process.cwd(), plan.projectName);

	await ensureEmptyDir(rootDir);

	// Copy root static templates
	await fs.copy(templatePath("root"), rootDir, { overwrite: true });

	// Always present
	await fs.mkdirp(path.join(rootDir, "packages"));
	await fs.copy(templatePath("api"), path.join(rootDir, "api"), {
		overwrite: true,
	});

	// Placeholders (empty for now)
	if (plan.kind === "web" || plan.kind === "full") {
		await fs.mkdirp(path.join(rootDir, "web"));
	}
	if (plan.kind === "app" || plan.kind === "full") {
		await fs.mkdirp(path.join(rootDir, "app"));
	}

	// Write workspace + root package.json programmatically
	await writeWorkspaceYaml(rootDir, plan);
	await writeRootPackageJson(rootDir, plan);

	// Optional install/git will be wired next step (or end of this step if you want)
	return rootDir;
}
