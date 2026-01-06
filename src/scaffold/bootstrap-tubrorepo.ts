import path from "node:path";
import fs from "fs-extra";
import { execa } from "execa";

export async function bootstrapTurboRepo(targetDir: string) {
	const parentDir = path.dirname(targetDir);
	const dirName = path.basename(targetDir);

	// create-turbo wants to create the directory; if it exists and is empty, remove it.
	if (await fs.pathExists(targetDir)) {
		const entries = await fs.readdir(targetDir);
		if (entries.length > 0) {
			throw new Error(
				`Target directory already exists and is not empty: ${targetDir}`,
			);
		}
		await fs.remove(targetDir);
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
