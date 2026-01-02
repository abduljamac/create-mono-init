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
 * In v1 this returns a plan; later steps will execute the plan (file generation).
 */
export async function collectPlan(): Promise<ScaffoldPlan> {
	intro("create-mono-init");

	const rawName = await text({
		message: "Project name (folder):",
		placeholder: "do-not-stop",
		validate: (value) =>
			!value.trim() ? "Project name is required." : undefined,
	});
	bailIfCancelled(rawName);

	const kind = await select<ProjectKind>({
		message: "What do you want to scaffold?",
		options: [
			{ value: "web", label: "Web + API (Next.js + Express)" },
			{ value: "app", label: "App + API (Expo + Express)" },
			{ value: "full", label: "Full monorepo (Web + App + API)" },
		],
	});
	bailIfCancelled(kind);

	const install = await confirm({
		message: "Install dependencies now (pnpm install)?",
		initialValue: true,
	});
	bailIfCancelled(install);

	const git = await confirm({
		message: "Initialize a git repository?",
		initialValue: true,
	});
	bailIfCancelled(git);

	const plan: ScaffoldPlan = {
		projectName: toSafeFolderName(String(rawName)),
		kind,
		install,
		git,
	};

	outro("Plan captured.");
	return plan;
}
