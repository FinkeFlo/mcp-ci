import { describe, it, expect } from "vitest";
import { SCENARIOS } from "../scenarios.js";
import { TOOL_CLASSES } from "../../../src/core/tool-classes.js";

describe("eval scenarios", () => {
  it("has at least ten scenarios with unique ids", () => {
    expect(SCENARIOS.length).toBeGreaterThanOrEqual(10);
    expect(new Set(SCENARIOS.map((s) => s.id)).size).toBe(SCENARIOS.length);
  });

  it("only expects read tools, which the eval server exposes", () => {
    const wrong = SCENARIOS.flatMap((s) => s.expect.tools.filter((tool) => TOOL_CLASSES[tool] !== "read").map((tool) => `${s.id}: ${tool}`));
    expect(wrong).toEqual([]);
  });
});
