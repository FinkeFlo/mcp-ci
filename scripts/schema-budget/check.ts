import type { Budget, Measurement, Mode } from "./types.js";

/** Every limit the measurements exceed; empty when within budget. */
export function checkBudget(measurements: Record<Mode, Measurement>, budget: Budget): string[] {
  const problems: string[] = [];
  for (const mode of ["readOnly", "writable"] as const) {
    const { tools, chars } = measurements[mode];
    const { maxTools, maxChars } = budget[mode];
    if (tools > maxTools) problems.push(`${mode}: ${tools} tools exceed the budget of ${maxTools}`);
    if (chars > maxChars) problems.push(`${mode}: ${chars} chars exceed the budget of ${maxChars}`);
  }
  return problems;
}
