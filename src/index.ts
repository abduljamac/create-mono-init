import pc from "picocolors";
import { collectPlan } from "./prompts.js";
import { createProject } from "./scaffold/create-project.js";

const plan = await collectPlan();

const rootDir = await createProject(plan);

console.log(pc.green("Created project at:"));
console.log(rootDir);

console.log(pc.cyan("Next:"));
console.log(`  cd ${plan.projectName}`);
console.log(`  pnpm install`);
console.log(`  pnpm dev`);
