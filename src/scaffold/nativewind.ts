import path from "node:path";
import fs from "fs-extra";

/**
 * Add NativeWind and its Expo integration files to a generated mobile app.
 */
export async function setupNativeWindExpo(appDir: string): Promise<void> {
	const packagePath = path.join(appDir, "package.json");
	const packageJson = await fs.readJson(packagePath);

	packageJson.dependencies ??= {};
	packageJson.devDependencies ??= {};
	packageJson.dependencies.nativewind ??= "latest";
	packageJson.dependencies["react-native-reanimated"] ??= "latest";
	packageJson.dependencies["react-native-worklets"] ??= "latest";
	packageJson.dependencies["react-native-safe-area-context"] ??= "latest";
	packageJson.devDependencies.tailwindcss ??= "latest";

	await fs.writeJson(packagePath, packageJson, { spaces: 2 });

	await fs.writeFile(
		path.join(appDir, "tailwind.config.js"),
		`/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./App.{js,jsx,ts,tsx}",
    "./components/**/*.{js,jsx,ts,tsx}",
    "./app/**/*.{js,jsx,ts,tsx}"
  ],
  presets: [require("nativewind/preset")],
  theme: { extend: {} },
  plugins: [],
};
`,
		"utf8",
	);

	await fs.writeFile(
		path.join(appDir, "global.css"),
		`@tailwind base;
@tailwind components;
@tailwind utilities;
`,
		"utf8",
	);

	await fs.writeFile(
		path.join(appDir, "babel.config.js"),
		`module.exports = (api) => {
  api.cache(true);
  return {
    presets: [
      ["babel-preset-expo", { jsxImportSource: "nativewind" }],
      "nativewind/babel",
    ],
    plugins: ["react-native-reanimated/plugin"],
  };
};
`,
		"utf8",
	);

	await fs.writeFile(
		path.join(appDir, "metro.config.js"),
		`const { getDefaultConfig } = require("expo/metro-config");
const { withNativeWind } = require("nativewind/metro");

const config = getDefaultConfig(__dirname);

module.exports = withNativeWind(config, { input: "./global.css" });
`,
		"utf8",
	);

	const appJsonPath = path.join(appDir, "app.json");
	if (await fs.pathExists(appJsonPath)) {
		const appJson = await fs.readJson(appJsonPath);
		appJson.expo ??= {};
		appJson.expo.web ??= {};
		appJson.expo.web.bundler = "metro";
		await fs.writeJson(appJsonPath, appJson, { spaces: 2 });
	}

	await fs.writeFile(
		path.join(appDir, "nativewind-env.d.ts"),
		`/// <reference types="nativewind/types" />

declare module "*.css";
`,
		"utf8",
	);

	const appPath = path.join(appDir, "App.tsx");
	if (await fs.pathExists(appPath)) {
		const source = await fs.readFile(appPath, "utf8");
		if (!source.includes('import "./global.css"')) {
			await fs.writeFile(appPath, `import "./global.css";\n${source}`, "utf8");
		}
	}
}
