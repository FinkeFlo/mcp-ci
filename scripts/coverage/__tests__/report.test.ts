import { describe, it, expect } from "vitest";
import { buildReport } from "../report.js";
import type { Operation, ToolEntry } from "../types.js";

// monitoring → MessageProcessingLogs.yaml (per MODULE_SPECS)
const OPS: Operation[] = [
  { spec: "MessageProcessingLogs.yaml", method: "GET", path: "/MessageProcessingLogs", tag: "Logs", summary: "list" },
  { spec: "MessageProcessingLogs.yaml", method: "GET", path: "/MessageProcessingLogs('{Id}')", tag: "Logs", summary: "one" },
  { spec: "MessageProcessingLogs.yaml", method: "GET", path: "/MessageProcessingLogAttachments", tag: "Logs", summary: "att" },
];

const TOOLS: ToolEntry[] = [
  {
    module: "monitoring",
    file: "x",
    tool: "list_messages",
    annotations: [{ method: "GET", path: "/MessageProcessingLogs" }],
  },
  {
    module: "monitoring",
    file: "x",
    tool: "orphan",
    annotations: [{ method: "GET", path: "/Nonexistent" }],
  },
  { module: "monitoring", file: "x", tool: "naked", annotations: [] },
];

function monitoring(tools: ToolEntry[]) {
  return buildReport(OPS, tools, "docs/api", "src/modules").modules.find((m) => m.module === "monitoring")!;
}

describe("buildReport", () => {
  it("counts covered operations and lists the rest as gaps", () => {
    const m = monitoring(TOOLS);
    expect(m.totalOps).toBe(3);
    expect(m.coveredOps).toBe(1);
    expect(m.gaps.map((g) => g.path)).toEqual([
      "/MessageProcessingLogs('{Id}')",
      "/MessageProcessingLogAttachments",
    ]);
  });

  it("flags annotations that match no operation as orphans", () => {
    const m = monitoring(TOOLS);
    expect(m.orphanAnnotations).toEqual([
      { tool: "orphan", method: "GET", path: "/Nonexistent" },
    ]);
  });

  it("lists tools with no annotation as un-annotated", () => {
    const m = monitoring(TOOLS);
    expect(m.unannotatedTools).toEqual(["naked"]);
  });

  it("treats `@api none` tools as intentional, not un-annotated", () => {
    const m = monitoring([
      { module: "monitoring", file: "x", tool: "internal", annotations: [{ method: "NONE", path: "" }] },
    ]);
    expect(m.unannotatedTools).toEqual([]);
    expect(m.orphanAnnotations).toEqual([]);
  });

  it("does not double-count a covered operation hit by two tools", () => {
    const m = monitoring([
      ...TOOLS,
      { module: "monitoring", file: "y", tool: "list_again", annotations: [{ method: "GET", path: "/MessageProcessingLogs" }] },
    ]);
    expect(m.coveredOps).toBe(1);
  });
});
