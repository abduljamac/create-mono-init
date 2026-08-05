import path from "node:path";
import fs from "fs-extra";

export async function writeBarebonesApi(apiDir: string): Promise<void> {
	await fs.mkdirp(path.join(apiDir, "src"));
	await fs.writeJson(
		path.join(apiDir, "package.json"),
		{
			name: "api",
			private: true,
			type: "module",
			scripts: {
				dev: "node --env-file=.env --import tsx/esm --watch src/index.ts",
				build: "tsc -p tsconfig.json",
				typecheck: "tsc -p tsconfig.json --noEmit",
				start: "node --env-file=.env dist/index.js",
			},
			dependencies: {
				express: "latest",
			},
			devDependencies: {
				"@types/express": "latest",
				"@types/node": "latest",
				tsx: "latest",
				typescript: "latest",
			},
		},
		{ spaces: 2 },
	);
	await fs.writeFile(
		path.join(apiDir, ".env.example"),
		`# Copy this file to .env and fill in the values
PORT=3001
NODE_ENV=development
`,
		"utf8",
	);
	await fs.writeJson(
		path.join(apiDir, "tsconfig.json"),
		{
			compilerOptions: {
				target: "ES2022",
				module: "NodeNext",
				moduleResolution: "NodeNext",
				strict: true,
				esModuleInterop: true,
				skipLibCheck: true,
				outDir: "dist",
				rootDir: "src",
			},
			include: ["src"],
		},
		{ spaces: 2 },
	);
	await fs.writeFile(
		path.join(apiDir, "src", "index.ts"),
		`import express from "express";

const app = express();
const port = Number(process.env.PORT ?? 3001);

app.listen(port, () => {
  console.log(\`[api] listening on http://localhost:\${port}\`);
});
`,
		"utf8",
	);
}

export async function writeBarebonesWeb(webDir: string): Promise<void> {
	await fs.mkdirp(path.join(webDir, "app"));
	await fs.writeJson(
		path.join(webDir, "package.json"),
		{
			name: "web",
			private: true,
			type: "module",
			scripts: {
				dev: "next dev",
				build: "next build",
				typecheck: "tsc --noEmit",
				start: "next start",
			},
			dependencies: {
				next: "latest",
				react: "latest",
				"react-dom": "latest",
			},
			devDependencies: {
				"@types/node": "latest",
				"@types/react": "latest",
				"@types/react-dom": "latest",
				typescript: "latest",
			},
		},
		{ spaces: 2 },
	);
	await fs.writeJson(
		path.join(webDir, "tsconfig.json"),
		{
			compilerOptions: {
				target: "ES2017",
				lib: ["dom", "dom.iterable", "esnext"],
				allowJs: true,
				skipLibCheck: true,
				strict: true,
				noEmit: true,
				esModuleInterop: true,
				module: "esnext",
				moduleResolution: "bundler",
				resolveJsonModule: true,
				isolatedModules: true,
				jsx: "react-jsx",
				incremental: true,
				plugins: [{ name: "next" }],
			},
			include: [
				"next-env.d.ts",
				"**/*.ts",
				"**/*.tsx",
				".next/types/**/*.ts",
				".next/dev/types/**/*.ts",
			],
			exclude: ["node_modules"],
		},
		{ spaces: 2 },
	);
	await fs.writeFile(
		path.join(webDir, "next-env.d.ts"),
		`/// <reference types="next" />
/// <reference types="next/image-types/global" />
`,
		"utf8",
	);
	await fs.writeFile(
		path.join(webDir, "app", "layout.tsx"),
		`import type { ReactNode } from "react";

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
`,
		"utf8",
	);
	await fs.writeFile(
		path.join(webDir, "app", "page.tsx"),
		`export default function Page() {
  return <h1>Hello world</h1>;
}
`,
		"utf8",
	);
	await fs.writeFile(
		path.join(webDir, ".env.example"),
		`# Copy this file to .env. Next.js auto-loads .env in dev/build.
# Vars prefixed with NEXT_PUBLIC_ are exposed to the browser.
NEXT_PUBLIC_API_URL=http://localhost:3001
`,
		"utf8",
	);
}
