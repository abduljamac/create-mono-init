import path from "node:path";
import fs from "fs-extra";
import type { ScaffoldPlan } from "../prompts.js";
import { PNPM_VERSION, TURBO_VERSION } from "./versions.js";

/**
 * Create the small root baseline that every scaffold mode shares.
 */
export async function prepareWorkspaceRoot(
	rootDir: string,
	plan: ScaffoldPlan,
): Promise<void> {
	if (await fs.pathExists(rootDir)) {
		const entries = await fs.readdir(rootDir);
		if (entries.length > 0) {
			throw new Error(
				`Target directory already exists and is not empty: ${rootDir}`,
			);
		}
	}

	await fs.mkdirp(path.join(rootDir, "apps"));
	await fs.mkdirp(path.join(rootDir, "packages"));
	await fs.writeJson(
		path.join(rootDir, "package.json"),
		{
			name: plan.projectName,
			private: true,
			packageManager: `pnpm@${PNPM_VERSION}`,
			scripts: {
				dev: "turbo dev",
				build: "turbo build",
			},
			devDependencies: {
				turbo: TURBO_VERSION,
			},
		},
		{ spaces: 2 },
	);
}
