import nodeFs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

/**
 * Locate the published templates directory from either source or bundled output.
 */
export function templatesDir(): string {
	const startDir = path.dirname(fileURLToPath(import.meta.url));
	let directory = startDir;

	for (let depth = 0; depth < 6; depth++) {
		const candidate = path.join(directory, "templates");
		if (nodeFs.existsSync(candidate)) return candidate;
		directory = path.dirname(directory);
	}

	throw new Error(
		`Could not locate templates/. Searched upwards from: ${startDir}`,
	);
}

export function templatesPath(...parts: string[]): string {
	return path.join(templatesDir(), ...parts);
}
