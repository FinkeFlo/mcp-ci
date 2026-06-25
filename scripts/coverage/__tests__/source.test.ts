import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { scanSource } from "../source.js";

const TOOLS_FILE = `
// @api GET /Things
// @api POST /Things
server.registerTool(
  "list_things",
  { description: "x" },
  async () => {}
);

// --- separator comment, not an annotation ---
// @api GET /Things('{Id}')
server.registerTool("get_thing", {}, async () => {});

server.registerTool("unannotated_tool", {}, async () => {});

// @api none
server.registerTool("internal_tool", {}, async () => {});

// @api GET /DoesNotExist
server.registerTool("orphan_tool", {}, async () => {});
`;

describe("scanSource", () => {
  let dir: string;
  beforeAll(() => {
    dir = mkdtempSync(join(tmpdir(), "src-"));
    const mod = join(dir, "demo", "tools");
    mkdirSync(mod, { recursive: true });
    writeFileSync(join(mod, "things.ts"), TOOLS_FILE);
    // a test dir that must be ignored
    const testDir = join(dir, "demo", "__tests__");
    mkdirSync(testDir, { recursive: true });
    writeFileSync(join(testDir, "things.test.ts"), `server.registerTool("should_be_ignored", {}, async () => {});`);
  });
  afterAll(() => rmSync(dir, { recursive: true, force: true }));

  it("finds every tool and assigns the module name", () => {
    const tools = scanSource(dir);
    const names = tools.map((t) => t.tool).sort();
    expect(names).toEqual([
      "get_thing",
      "internal_tool",
      "list_things",
      "orphan_tool",
      "unannotated_tool",
    ]);
    expect(tools.every((t) => t.module === "demo")).toBe(true);
  });

  it("captures contiguous @api annotations directly above the call", () => {
    const tools = scanSource(dir);
    const list = tools.find((t) => t.tool === "list_things")!;
    expect(list.annotations).toEqual([
      { method: "GET", path: "/Things" },
      { method: "POST", path: "/Things" },
    ]);
  });

  it("does not attach annotations separated by a non-annotation comment", () => {
    const tools = scanSource(dir);
    const get = tools.find((t) => t.tool === "get_thing")!;
    expect(get.annotations).toEqual([{ method: "GET", path: "/Things('{Id}')" }]);
  });

  it("represents `@api none` as a NONE sentinel", () => {
    const tools = scanSource(dir);
    const internal = tools.find((t) => t.tool === "internal_tool")!;
    expect(internal.annotations).toEqual([{ method: "NONE", path: "" }]);
  });

  it("leaves un-annotated tools with no annotations", () => {
    const tools = scanSource(dir);
    const un = tools.find((t) => t.tool === "unannotated_tool")!;
    expect(un.annotations).toEqual([]);
  });

  it("ignores files under __tests__", () => {
    const tools = scanSource(dir);
    expect(tools.find((t) => t.tool === "should_be_ignored")).toBeUndefined();
  });
});
