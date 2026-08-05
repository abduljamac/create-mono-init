import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import type { ScaffoldPlan } from "../prompts.js";
import { PNPM_VERSION, TURBO_VERSION } from "./versions.js";
import { prepareWorkspaceRoot } from "./workspace-root.js";

const temporaryDirectories: string[] = [];
const plan: ScaffoldPlan = {
	projectName: "example-project",
	description: "Example",
	kind: "web",
	install: false,
	git: false,
};

async function temporaryDirectory(): Promise<string> {
	const directory = await mkdtemp(
		path.join(tmpdir(), "create-mono-init-test-"),
	);
	temporaryDirectories.push(directory);
	return directory;
}

afterEach(async () => {
	await Promise.all(
		temporaryDirectories
			.splice(0)
			.map((directory) => rm(directory, { recursive: true, force: true })),
	);
});

describe("prepareWorkspaceRoot", () => {
	it("creates a deterministic Turborepo package baseline", async () => {
		const parent = await temporaryDirectory();
		const root = path.join(parent, plan.projectName);

		await prepareWorkspaceRoot(root, plan);

		const packageJson = JSON.parse(
			await readFile(path.join(root, "package.json"), "utf8"),
		);
		expect(packageJson).toMatchObject({
			name: plan.projectName,
			private: true,
			packageManager: `pnpm@${PNPM_VERSION}`,
			scripts: {
				build: "turbo build",
				dev: "turbo dev",
			},
			devDependencies: {
				turbo: TURBO_VERSION,
			},
		});
	});

	it("refuses to overwrite a non-empty target directory", async () => {
		const root = await temporaryDirectory();
		await writeFile(path.join(root, "existing.txt"), "keep me", "utf8");

		await expect(prepareWorkspaceRoot(root, plan)).rejects.toThrow(
			"Target directory already exists and is not empty",
		);
	});
});
