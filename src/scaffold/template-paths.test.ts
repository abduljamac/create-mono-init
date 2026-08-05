import path from "node:path";
import { describe, expect, it } from "vitest";
import { templatesDir, templatesPath } from "./template-paths.js";

describe("template paths", () => {
	it("finds the repository templates directory", () => {
		expect(path.basename(templatesDir())).toBe("templates");
	});

	it("builds paths inside the templates directory", () => {
		expect(templatesPath("root", "AGENTS.md")).toBe(
			path.join(templatesDir(), "root", "AGENTS.md"),
		);
	});
});
