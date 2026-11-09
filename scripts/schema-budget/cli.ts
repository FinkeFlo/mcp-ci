import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { checkBudget } from "./check.js";
import { measureToolSchemas } from "./measure.js";
import type { Budget } from "./types.js";

const budgetPath = join(dirname(fileURLToPath(import.meta.url)), "budget.json");
const budget: Budget = JSON.parse(readFileSync(budgetPath, "utf-8"));
const measurements = { readOnly: await measureToolSchemas(true), writable: await measureToolSchemas(false) };

for (const mode of ["readOnly", "writable"] as const) {
  const m = measurements[mode];
  const b = budget[mode];
  console.log(`${mode}: ${m.tools}/${b.maxTools} tools, ${m.chars}/${b.maxChars} chars (~${Math.round(m.chars / 4000)}k tokens)`);
}
console.log("\nLargest tools (writable):");
for (const tool of measurements.writable.largest) console.log(`  ${tool.chars}\t${tool.name}`);

const problems = checkBudget(measurements, budget);
if (problems.length > 0) {
  console.error(`\nTool schema budget exceeded (raise it in ${budgetPath} only on purpose):`);
  for (const problem of problems) console.error(`- ${problem}`);
  process.exitCode = 1;
}
