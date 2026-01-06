import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export function templatesDir() {
	// src/scaffold -> src -> project root
	return path.resolve(__dirname, "..", "templates");
}

export function templatePath(...parts: string[]) {
	return path.resolve(templatesDir(), ...parts);
}
