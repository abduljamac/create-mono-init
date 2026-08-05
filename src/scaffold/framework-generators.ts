import { execa } from "execa";
import {
	CREATE_EXPO_APP_VERSION,
	CREATE_NEXT_APP_VERSION,
} from "./versions.js";

export async function generateNextWebApp(rootDir: string): Promise<void> {
	try {
		await execa(
			"pnpm",
			[
				"dlx",
				`create-next-app@${CREATE_NEXT_APP_VERSION}`,
				"apps/web",
				"--ts",
				"--tailwind",
				"--app",
				"--use-pnpm",
				"--skip-install",
				"--disable-git",
				"--no-linter",
				"--yes",
			],
			{ cwd: rootDir, stdio: "inherit" },
		);
	} catch (error) {
		const message = error instanceof Error ? error.message : String(error);
		throw new Error(`Failed to scaffold Next.js app: ${message}`);
	}
}

export async function generateExpoApp(rootDir: string): Promise<void> {
	try {
		await execa(
			"pnpm",
			[
				"dlx",
				`create-expo-app@${CREATE_EXPO_APP_VERSION}`,
				"apps/app",
				"--yes",
				"--no-install",
				"--template",
				"blank-typescript",
			],
			{ cwd: rootDir, stdio: "inherit" },
		);
	} catch (error) {
		const message = error instanceof Error ? error.message : String(error);
		throw new Error(`Failed to scaffold Expo app: ${message}`);
	}
}
