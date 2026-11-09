import { describe, it, expect } from "vitest";
import { parseToolCalls, scoreScenario } from "../score.js";

const line = (event: unknown) => JSON.stringify(event);
const toolUse = (name: string, input: unknown) =>
  line({ type: "assistant", message: { content: [{ type: "tool_use", id: name, name, input }] } });

describe("parseToolCalls", () => {
  it("returns mcp-ci calls in order with the prefix removed, ignoring other events and tools", () => {
    const calls = parseToolCalls([
      line({ type: "system", subtype: "init" }),
      toolUse("mcp__mcp-ci__get_errors", { from: "2026-01-01" }),
      toolUse("ToolSearch", {}),
      "not json",
      toolUse("mcp__mcp-ci__get_message", { messageGuid: "g1" }),
    ]);
    expect(calls).toEqual([
      { tool: "get_errors", input: { from: "2026-01-01" } },
      { tool: "get_message", input: { messageGuid: "g1" } },
    ]);
  });
});

describe("scoreScenario", () => {
  const expectation = { tools: ["list_keystore_entries"], args: { expiringWithinDays: 30 } };

  it("passes when the first call matches tool and arguments", () => {
    expect(scoreScenario([{ tool: "list_keystore_entries", input: { expiringWithinDays: 30 } }], expectation)).toEqual({ pass: true, reason: "ok" });
  });

  it("fails on wrong arguments in the first call, even if a later call is right", () => {
    const result = scoreScenario(
      [{ tool: "list_keystore_entries", input: {} }, { tool: "list_keystore_entries", input: { expiringWithinDays: 30 } }],
      expectation
    );
    expect(result.pass).toBe(false);
    expect(result.reason).toContain("expiringWithinDays");
  });

  it("accepts any listed alternative and string arguments that contain the expected value", () => {
    expect(scoreScenario([{ tool: "aggregate_messages", input: {} }], { tools: ["get_errors", "aggregate_messages"] }).pass).toBe(true);
    expect(scoreScenario([{ tool: "get_message", input: { messageGuid: " AAA1 " } }], { tools: ["get_message"], args: { messageGuid: "AAA1" } }).pass).toBe(true);
  });

  it("fails on a wrong first tool", () => {
    const result = scoreScenario([{ tool: "list_messages", input: {} }], expectation);
    expect(result).toEqual({ pass: false, reason: "first call list_messages, expected list_keystore_entries" });
  });

  it("compares string arguments exactly after trimming", () => {
    expect(scoreScenario([{ tool: "count_messages", input: { status: "NOT_FAILED" } }], { tools: ["count_messages"], args: { status: "FAILED" } }).pass).toBe(false);
  });

  it("requires the arguments listed in present, whatever their value", () => {
    const expectation = { tools: ["get_errors"], present: ["from"] };
    expect(scoreScenario([{ tool: "get_errors", input: { from: "2026-01-01T00:00:00Z" } }], expectation).pass).toBe(true);
    expect(scoreScenario([{ tool: "get_errors", input: {} }], expectation)).toEqual({ pass: false, reason: "get_errors: from missing" });
  });

  it("fails without any call", () => {
    expect(scoreScenario([], expectation)).toEqual({ pass: false, reason: "no mcp-ci tool called" });
  });
});
