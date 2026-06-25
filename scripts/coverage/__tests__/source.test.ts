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

  // Some SAP paths contain spaces inside template params, e.g. '{Source ID}'.
  // The path must be captured whole, not truncated at the first space.
  it("captures paths that contain spaces", () => {
    const d = mkdtempSync(join(tmpdir(), "src-space-"));
    const mod = join(d, "idmapper");
    mkdirSync(mod, { recursive: true });
    writeFileSync(
      join(mod, "tools.ts"),
      `// @api GET /IdMapFromIds('{Source ID}')/ToIds\nserver.registerTool("get_id_mappings", {}, async () => {});\n`
    );
    try {
      const tools = scanSource(d);
      const tool = tools.find((t) => t.tool === "get_id_mappings")!;
      expect(tool.annotations).toEqual([
        { method: "GET", path: "/IdMapFromIds('{Source ID}')/ToIds" },
      ]);
    } finally {
      rmSync(d, { recursive: true, force: true });
    }
  });
});

describe("template-literal (factory) tool names", () => {
  // Factory helpers register tools with backtick names like `list_${x}s`.
  // The scanner must still capture the call site and its @api annotations.
  it("captures a tool registered with a template-literal name", () => {
    const d = mkdtempSync(join(tmpdir(), "src-factory-"));
    const mod = join(d, "content", "tools");
    mkdirSync(mod, { recursive: true });
    writeFileSync(
      join(mod, "type-artifacts.ts"),
      "// @api GET /MessageTypeDesigntimeArtifacts\n" +
        "// @api GET /DataTypeDesigntimeArtifacts\n" +
        "server.registerTool(\n  `list_${toolPrefix}s`,\n  {},\n  async () => {}\n);\n"
    );
    try {
      const tools = scanSource(d);
      const tool = tools.find((t) => t.tool === "list_${toolPrefix}s");
      expect(tool).toBeDefined();
      expect(tool!.annotations).toEqual([
        { method: "GET", path: "/MessageTypeDesigntimeArtifacts" },
        { method: "GET", path: "/DataTypeDesigntimeArtifacts" },
      ]);
    } finally {
      rmSync(d, { recursive: true, force: true });
    }
  });
});

describe("annotationsAbove blank line handling", () => {
  let dir: string;
  beforeAll(() => {
    dir = mkdtempSync(join(tmpdir(), "src-blank-"));
    const mod = join(dir, "demo", "tools");
    mkdirSync(mod, { recursive: true });

    const blankWithinAnnotationBlock = `
// @api GET /A

// @api POST /B
server.registerTool("split_tool", {}, async () => {});
`;

    const blankBetweenBlockAndCall = `
// @api GET /C
// @api POST /D

server.registerTool("blank_before_call", {}, async () => {});
`;

    writeFileSync(join(mod, "split.ts"), blankWithinAnnotationBlock);
    writeFileSync(join(mod, "blank.ts"), blankBetweenBlockAndCall);
  });
  afterAll(() => rmSync(dir, { recursive: true, force: true }));

  it("only attaches the contiguous annotation block when a blank line separates annotations", () => {
    const tools = scanSource(dir);
    const split = tools.find((t) => t.tool === "split_tool")!;
    // Only POST /B should attach; GET /A is separated by blank line
    expect(split.annotations).toEqual([{ method: "POST", path: "/B" }]);
  });

  it("attaches both annotations when blank line is only between block and call", () => {
    const tools = scanSource(dir);
    const blank = tools.find((t) => t.tool === "blank_before_call")!;
    // Both should attach; blank line is only after the contiguous block
    expect(blank.annotations).toEqual([
      { method: "GET", path: "/C" },
      { method: "POST", path: "/D" },
    ]);
  });
});
