import { mkdir, mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import process from "node:process";
import { execa } from "execa";

const supportedKinds = ["barebones", "web", "app", "full"];
const requestedKinds = process.argv.slice(2);
const projectKinds =
	requestedKinds.length > 0 ? requestedKinds : supportedKinds;
const projectRoot = process.cwd();
const smokeRoot = await mkdtemp(path.join(tmpdir(), "create-mono-init-smoke-"));
let succeeded = false;

for (const kind of projectKinds) {
	if (!supportedKinds.includes(kind)) {
		throw new Error(
			`Unknown scaffold kind "${kind}". Expected one of: ${supportedKinds.join(", ")}`,
		);
	}
}

async function run(command, args, cwd) {
	await execa(command, args, {
		cwd,
		stdio: "inherit",
	});
}

try {
	const packResult = await execa(
		"npm",
		["pack", "--json", "--ignore-scripts", "--pack-destination", smokeRoot],
		{ cwd: projectRoot },
	);
	const [{ filename }] = JSON.parse(packResult.stdout);
	const packageArchive = path.join(smokeRoot, filename);
	const packageDirectory = path.join(smokeRoot, "installed");
	await mkdir(packageDirectory);
	await run(
		"npm",
		[
			"install",
			"--ignore-scripts",
			"--no-audit",
			"--no-fund",
			"--prefix",
			packageDirectory,
			packageArchive,
		],
		smokeRoot,
	);

	const cliPath = path.join(
		packageDirectory,
		"node_modules",
		"@abduljamac",
		"create-mono-init",
		"dist",
		"index.js",
	);
	const projectsDirectory = path.join(smokeRoot, "projects");
	await mkdir(projectsDirectory);

	for (const kind of projectKinds) {
		const projectName = `smoke-${kind}`;
		console.log(`\n=== Scaffolding ${kind} from packed CLI ===\n`);
		await run(
			process.execPath,
			[
				cliPath,
				projectName,
				"--kind",
				kind,
				"--description",
				`Packaged ${kind} smoke test`,
				"--install",
				"--no-git",
			],
			projectsDirectory,
		);

		const generatedRoot = path.join(projectsDirectory, projectName);
		const generatedPackage = JSON.parse(
			await readFile(path.join(generatedRoot, "package.json"), "utf8"),
		);
		for (const command of ["check", "typecheck", "test", "build"]) {
			if (!generatedPackage.scripts?.[command]) continue;
			console.log(`\n--- ${kind}: pnpm ${command} ---\n`);
			await run("pnpm", [command], generatedRoot);
		}
	}

	succeeded = true;
	console.log("\nAll packaged scaffold smoke tests passed.");
} finally {
	if (succeeded || process.env.SMOKE_KEEP !== "1") {
		await rm(smokeRoot, { recursive: true, force: true });
	} else {
		console.error(`Smoke-test output preserved at: ${smokeRoot}`);
	}
}
