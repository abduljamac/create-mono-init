import { access, readFile } from "node:fs/promises";

const requiredFiles = [
	"dist/index.js",
	"templates/api/package.json",
	"templates/root/AGENTS.md",
	"templates/root/biome.json",
	"templates/shared/package.json",
	"LICENSE",
];

const removedFiles = [
	"templates/app/package.json",
	"templates/web/package.json",
	"templates/root/.gitignore",
	"templates/root/.npmrc",
	"templates/root/README.md",
];

await Promise.all(requiredFiles.map((file) => access(file)));

for (const file of removedFiles) {
	try {
		await access(file);
		throw new Error(`Unused template still exists: ${file}`);
	} catch (error) {
		if (error instanceof Error && "code" in error && error.code === "ENOENT") {
			continue;
		}
		throw error;
	}
}

const entrypoint = await readFile("dist/index.js", "utf8");
if (!entrypoint.startsWith("#!/usr/bin/env node")) {
	throw new Error("dist/index.js is missing its executable shebang");
}

const packageJson = JSON.parse(await readFile("package.json", "utf8"));
if (packageJson.bin?.["create-mono-init"] !== "dist/index.js") {
	throw new Error("package.json does not expose the expected CLI entrypoint");
}

console.log("Package structure verified.");
