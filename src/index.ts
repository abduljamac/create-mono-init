import pc from "picocolors";
import { collectPlan } from "./prompts.js";

const plan = await collectPlan();

// MVP output only (no generation yet)
console.log(pc.green("Scaffold plan:"));
console.log(plan);
