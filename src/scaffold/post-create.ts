import type { ScaffoldPlan } from "../prompts.js";
import { runCommand } from "./run-command.js";

/**
 * Runs optional actions after project files are created.
 * Controlled by user prompt choices.
 */
export async function postCreate(
	rootDir: string,
	plan: ScaffoldPlan,
): Promise<void> {
	if (plan.install) {
		await runCommand(rootDir, "pnpm", ["install"]);
	}

	if (plan.git) {
		await runCommand(rootDir, "git", ["init"]);
	}
}
