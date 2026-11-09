import { describe, it, expect } from "vitest";
import { checkBudget } from "../check.js";
import { measureToolSchemas } from "../measure.js";

const budget = { readOnly: { maxTools: 10, maxChars: 1000 }, writable: { maxTools: 20, maxChars: 2000 } };
const within = { readOnly: { tools: 10, chars: 1000, largest: [] }, writable: { tools: 15, chars: 1500, largest: [] } };

describe("checkBudget", () => {
  it("passes at the limit", () => {
    expect(checkBudget(within, budget)).toEqual([]);
  });

  it("reports every exceeded limit with mode, value and limit", () => {
    const problems = checkBudget(
      { ...within, writable: { tools: 21, chars: 2001, largest: [] } },
      budget
    );
    expect(problems).toEqual([
      "writable: 21 tools exceed the budget of 20",
      "writable: 2001 chars exceed the budget of 2000",
    ]);
  });
});

describe("measureToolSchemas", () => {
  it("measures the tools/list payload of the real server", async () => {
    const readOnly = await measureToolSchemas(true);
    const writable = await measureToolSchemas(false);
    expect(readOnly.tools).toBeGreaterThan(0);
    expect(writable.tools).toBeGreaterThan(readOnly.tools);
    expect(writable.chars).toBeGreaterThan(readOnly.chars);
    expect(readOnly.largest).toHaveLength(10);
    expect(readOnly.largest[0].chars).toBeGreaterThanOrEqual(readOnly.largest[9].chars);
  });
});
