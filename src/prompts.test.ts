import { describe, expect, it } from "vitest";
import { toSafeFolderName } from "./prompts.js";

describe("toSafeFolderName", () => {
	it("normalizes whitespace without changing valid characters", () => {
		expect(toSafeFolderName("  my new-project  ")).toBe("my-new-project");
	});

	it("replaces filesystem-reserved and control characters", () => {
		expect(toSafeFolderName("my/app:name\u0000")).toBe("my-app-name-");
	});

	it("preserves unicode project names", () => {
		expect(toSafeFolderName("café app")).toBe("café-app");
	});
});
