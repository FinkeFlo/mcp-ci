import { describe, it, expect } from "vitest";
import { textTool, textResult, errorResult } from "../tool.js";

describe("textTool", () => {
  it("wraps a string return as text content", async () => {
    const handler = textTool(async ({ name }: { name: string }) => `Hello ${name}`);
    expect(await handler({ name: "CPI" })).toEqual({
      content: [{ type: "text", text: "Hello CPI" }],
    });
  });

  it("supports synchronous handlers", async () => {
    const handler = textTool(() => "sync");
    expect(await handler()).toEqual(textResult("sync"));
  });

  it("passes a full CallToolResult through unchanged", async () => {
    const result = {
      content: [
        { type: "text" as const, text: "a" },
        { type: "text" as const, text: "b" },
      ],
    };
    const handler = textTool(async () => result);
    expect(await handler()).toBe(result);
  });

  it("turns thrown errors into isError results", async () => {
    const handler = textTool(async () => {
      throw new Error("OData request failed: 404");
    });
    expect(await handler()).toEqual({
      isError: true,
      content: [{ type: "text", text: "OData request failed: 404" }],
    });
  });

  it("stringifies non-Error throws", async () => {
    const handler = textTool(async () => {
      throw "boom";
    });
    expect(await handler()).toEqual(errorResult("boom"));
  });

  it("forwards all arguments to the handler", async () => {
    const handler = textTool(async (args: { a: number }, extra: { b: number }) =>
      String(args.a + extra.b)
    );
    expect(await handler({ a: 1 }, { b: 2 })).toEqual(textResult("3"));
  });
});
