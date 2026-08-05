import path from "node:path";
import fs from "fs-extra";
import type { ScaffoldPlan } from "../prompts.js";
import { templatesPath } from "./template-paths.js";

export async function writeAgentsMd(
	rootDir: string,
	plan: ScaffoldPlan,
): Promise<void> {
	const hasWeb = plan.kind === "web" || plan.kind === "full";
	const hasApp = plan.kind === "app" || plan.kind === "full";

	// Start from the base template.
	let content = await fs.readFile(templatesPath("root", "AGENTS.md"), "utf8");

	// Insert the structure listing after the "## Monorepo Structure" paragraph.
	const structureLines = [`- \`apps/api/\` — Express API server (TypeScript)`];
	if (hasWeb) structureLines.push(`- \`apps/web/\` — Next.js frontend`);
	if (hasApp) structureLines.push(`- \`apps/app/\` — Expo mobile app`);
	structureLines.push(
		`- \`packages/shared/\` — Shared TypeScript types used across all apps`,
	);

	content = content.replace(
		"## Monorepo Structure\n\nThis is a pnpm + Turborepo monorepo. All apps live in `apps/` and shared packages in `packages/`.\n",
		`## Monorepo Structure\n\nThis is a pnpm + Turborepo monorepo. All apps live in \`apps/\` and shared packages in \`packages/\`.\n\n${structureLines.join("\n")}\n`,
	);

	// Build kind-specific sections to append before General Principles.
	const extras: string[] = [];

	if (hasApp) {
		extras.push(`## Mobile App Folder Structure (\`apps/app/\`)

- **\`types/\`** — TypeScript type definitions and interfaces
- **\`utils/\`** — Utility functions and helpers (pure logic, no components)
- **\`hooks/\`** — Custom React hooks
- **\`screens/\`** — Screen components, organized by feature in subfolders
- **\`screens/<feature>/components/\`** — Components specific to that screen (co-located)
- **\`components/\`** — Shared, reusable components used across multiple screens
- **\`components/ui/\`** — Generic UI primitives (Button, Input — not tied to any screen)
- **\`services/\`** — API call functions (one file per resource)
- **\`stores/\`** — Global state (Zustand stores)
- **\`assets/\`** — Images, fonts, and static files
- **\`__tests__/\`** — Tests mirroring the source structure

Never put type or utility files inside \`screens/\` or \`components/\`. They belong in \`types/\` and \`utils/\`.`);
	}

	if (hasWeb) {
		extras.push(`## Web App Folder Structure (\`apps/web/\`)

- **\`types/\`** — TypeScript type definitions and interfaces
- **\`utils/\`** — Utility functions and helpers (pure logic, no components)
- **\`hooks/\`** — Custom React hooks
- **\`app/\`** — Next.js App Router pages and layouts
- **\`app/<route>/components/\`** — Components specific to that route (co-located)
- **\`components/\`** — Shared, reusable components used across multiple routes
- **\`components/ui/\`** — Generic UI primitives (not tied to any page)
- **\`lib/\`** — Client-side libraries and configurations
- **\`public/\`** — Static assets

Never put type or utility files inside \`app/\` or \`components/\`. They belong in \`types/\` and \`utils/\`.`);
	}

	if (hasWeb || hasApp) {
		extras.push(`## Screen & Component Decomposition

- **Screens/pages should be thin** — they compose components and hooks, not implement everything inline.
- **Shared components** (used across multiple screens/pages) go in the top-level \`components/\` folder.
- **Screen-specific components** live in a \`components/\` folder co-located inside the screen's route directory (e.g., \`screens/profile/components/avatar.tsx\`).
- **Small, single-use sub-components** can stay inline in the screen file. Move them out only when they grow or get reused elsewhere.`);
	}

	if (hasWeb || hasApp) {
		extras.push(`## Custom Hooks

- **Extract reusable logic into custom hooks** when a screen manages non-trivial state, side effects, or API interactions.
- **Naming**: \`use-<feature>.ts\` in kebab-case (e.g., \`use-auth-flow.ts\`, \`use-form.ts\`).
- **What belongs in a hook**: form state, API mutation wrappers, derived/computed values, loading state.
- **What does NOT belong in a hook**: navigation/screen transitions — these stay in the parent component.
- **Hook categories**:
  - **Query hooks** — Thin TanStack Query wrappers around service functions (\`useQuery\` / \`useMutation\`).
  - **Flow hooks** — Compose multiple query hooks with local state to manage a complete user flow.
- Prefer composing hooks over building monoliths.`);
	}

	if (hasWeb && hasApp) {
		extras.push(`## Styling

- **Always use Tailwind CSS \`className\`** for all styling in both web and mobile apps.
- Mobile app uses NativeWind (Tailwind for React Native). Web app uses Tailwind CSS directly.
- Use \`className\` for all layout, spacing, typography, colors, borders, shadows, and sizing.
- **Inline \`style\` is only acceptable** when Tailwind/NativeWind cannot express the property and it is required (e.g., React Native shadow properties, dynamic prop-driven values like progress bar widths). Always prefer \`className\` first.
- Add design tokens to \`tailwind.config.js\` \`theme.extend\` rather than hardcoding hex values in components.
- For values Tailwind doesn't support natively, use arbitrary values (e.g., \`text-[15px]\`, \`tracking-[-0.5px]\`, \`leading-[21px]\`).`);
	} else if (hasApp) {
		extras.push(`## Styling

- **Always use Tailwind CSS \`className\`** via NativeWind for all styling. Never use inline \`style={{}}\` objects or \`StyleSheet.create()\`.
- **Inline \`style\` is only acceptable** when NativeWind cannot express the property (e.g., React Native shadow properties, dynamic prop-driven values). Always prefer \`className\` first.
- Use \`className\` for all layout, spacing, typography, colors, borders, shadows, and sizing.
- Add design tokens to \`tailwind.config.js\` \`theme.extend\` rather than hardcoding hex values in components.
- For values Tailwind doesn't support natively, use arbitrary values (e.g., \`text-[15px]\`, \`tracking-[-0.5px]\`, \`leading-[21px]\`).`);
	} else {
		extras.push(`## Styling

- **Always use Tailwind CSS \`className\`** for all styling. Never use inline \`style={{}}\` objects.
- Use \`className\` for all layout, spacing, typography, colors, borders, shadows, and sizing.
- Add design tokens to \`tailwind.config.js\` \`theme.extend\` rather than hardcoding hex values in components.
- For values Tailwind doesn't support natively, use arbitrary values (e.g., \`text-[15px]\`, \`tracking-[-0.5px]\`, \`leading-[21px]\`).`);
	}

	// Insert kind-specific sections before "## General Principles".
	content = content.replace(
		"## General Principles",
		`${extras.join("\n\n")}\n\n## General Principles`,
	);

	await fs.writeFile(path.join(rootDir, "AGENTS.md"), content, "utf8");
}
