import {
	cancel,
	confirm,
	intro,
	isCancel,
	outro,
	select,
	text,
} from "@clack/prompts";

export type ProjectKind = "web" | "app" | "full";

export type ScaffoldPlan = {
	projectName: string;
	description: string;
	kind: ProjectKind;
	install: boolean;
	git: boolean;
};

function toSafeFolderName(input: string): string {
	return input
		.trim()
		.replace(/[<>:"/\\|?*\u0000-\u001F]/g, "-")
		.replace(/\s+/g, "-");
}

function bailIfCancelled<T>(value: T): asserts value is Exclude<T, symbol> {
	if (isCancel(value)) {
		cancel("Aborted.");
		process.exit(1);
	}
}

/**
 * Collect user intent for scaffolding.
 * Accepts an optional partial plan from CLI flags — prompts are skipped for any
 * fields that are already provided.
 */
export async function collectPlan(
	partial: Partial<ScaffoldPlan> = {},
): Promise<ScaffoldPlan> {
	intro("create-mono-init");

	let projectName: string;
	if (partial.projectName) {
		projectName = toSafeFolderName(partial.projectName);
	} else {
		const rawName = await text({
			message: "Project name (folder):",
			placeholder: "do-not-stop",
			validate: (value) =>
				!value.trim() ? "Project name is required." : undefined,
		});
		bailIfCancelled(rawName);
		projectName = toSafeFolderName(String(rawName));
	}

	let description: string;
	if (partial.description !== undefined) {
		description = partial.description;
	} else {
		const rawDesc = await text({
			message: "Project description:",
			placeholder: "A brief description of your app",
		});
		bailIfCancelled(rawDesc);
		description = String(rawDesc || "");
	}

	let kind: ProjectKind;
	if (partial.kind) {
		kind = partial.kind;
	} else {
		const rawKind = await select<ProjectKind>({
			message: "What do you want to scaffold?",
			options: [
				{ value: "web", label: "Web + API (Next.js + Express)" },
				{ value: "app", label: "App + API (Expo + Express)" },
				{ value: "full", label: "Full monorepo (Web + App + API)" },
			],
		});
		bailIfCancelled(rawKind);
		kind = rawKind;
	}

	let install: boolean;
	if (partial.install !== undefined) {
		install = partial.install;
	} else {
		const rawInstall = await confirm({
			message: "Install dependencies now (pnpm install)?",
			initialValue: true,
		});
		bailIfCancelled(rawInstall);
		install = rawInstall;
	}

	let git: boolean;
	if (partial.git !== undefined) {
		git = partial.git;
	} else {
		const rawGit = await confirm({
			message: "Initialize a git repository?",
			initialValue: true,
		});
		bailIfCancelled(rawGit);
		git = rawGit;
	}

	outro("Plan captured.");

	return { projectName, description, kind, install, git };
}
