import fs from "fs-extra";

export async function ensureEmptyDir(dir: string) {
	if (await fs.pathExists(dir)) {
		const entries = await fs.readdir(dir);
		if (entries.length > 0) {
			throw new Error(`Target directory is not empty: ${dir}`);
		}
	} else {
		await fs.mkdirp(dir);
	}
}
