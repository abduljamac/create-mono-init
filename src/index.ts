import { parseArgs } from "node:util";
import pc from "picocolors";
import type { ProjectKind, ScaffoldPlan } from "./prompts.js";
import { collectPlan } from "./prompts.js";
import { createProject } from "./scaffold/create-project.js";
import { postCreate } from "./scaffold/post-create.js";

function parseCliFlags(): Partial<ScaffoldPlan> {
	const { values, positionals } = parseArgs({
		args: process.argv.slice(2),
		options: {
			kind: { type: "string" },
			install: { type: "boolean" },
			git: { type: "boolean" },
		},
		allowPositionals: true,
		strict: false,
	});

	const partial: Partial<ScaffoldPlan> = {};

	if (positionals[0]) {
		partial.projectName = positionals[0];
	}

	const kind = values.kind as string | undefined;
	if (kind === "web" || kind === "app" || kind === "full") {
		partial.kind = kind as ProjectKind;
	}

	if (values.install !== undefined) {
		partial.install = values.install as boolean;
	}

	if (values.git !== undefined) {
		partial.git = values.git as boolean;
	}

	return partial;
}

const flags = parseCliFlags();

const plan = await collectPlan(flags);

const rootDir = await createProject(plan);

await postCreate(rootDir, plan);

console.log(pc.green("Created project at:"));
console.log(rootDir);
console.log(pc.cyan("Next:"));
console.log(`  cd ${plan.projectName}`);
console.log(`  pnpm dev`);
