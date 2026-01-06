import { execa } from "execa";

/**
 * Run a system command in a specific working directory, streaming output to the terminal.
 *
 * Why: We need a consistent way to run `pnpm install`, `git init`,
 * and later `create-next-app` / `create-expo-app`, while preserving logs.
 */
export async function runCommand(
	cwd: string,
	cmd: string,
	args: string[],
): Promise<void> {
	await execa(cmd, args, { cwd, stdio: "inherit" });
}
