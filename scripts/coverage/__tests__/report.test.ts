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

  // A shared spec (MessageProcessingLogs.yaml) is partitioned among modules by
  // OpenAPI tag. An operation tagged for another module must not leak into this
  // module's universe.
  it("scopes a shared spec to the module's tags", () => {
    const ops: Operation[] = [
      { spec: "MessageProcessingLogs.yaml", method: "GET", path: "/MessageProcessingLogs", tag: "Logs", summary: "" },
      { spec: "MessageProcessingLogs.yaml", method: "GET", path: "/IdempotentRepositoryEntries", tag: "Idempotent Repository", summary: "" },
    ];
    const report = buildReport(ops, [], "docs/api", "src/modules");
    const monitoringUni = report.modules.find((m) => m.module === "monitoring")!;
    const idempotentUni = report.modules.find((m) => m.module === "idempotent")!;
    // monitoring owns "Logs", not "Idempotent Repository"
    expect(monitoringUni.gaps.map((g) => g.path)).toEqual(["/MessageProcessingLogs"]);
    // idempotent owns the other slice of the same file
    expect(idempotentUni.gaps.map((g) => g.path)).toEqual(["/IdempotentRepositoryEntries"]);
  });

  // b2b owns all of B2BScenarios.yaml except the "Data Archiving" tag, which
  // belongs to the archiving module.
  it("honors excludeTags so archiving ops do not leak into b2b", () => {
    const ops: Operation[] = [
      { spec: "B2BScenarios.yaml", method: "GET", path: "/BusinessDocuments", tag: "Business Documents", summary: "" },
      { spec: "B2BScenarios.yaml", method: "POST", path: "/activateB2BArchivingConfiguration", tag: "Data Archiving", summary: "" },
    ];
    const report = buildReport(ops, [], "docs/api", "src/modules");
    const b2b = report.modules.find((m) => m.module === "b2b")!;
    const archiving = report.modules.find((m) => m.module === "archiving")!;
    expect(b2b.gaps.map((g) => g.path)).toEqual(["/BusinessDocuments"]);
    expect(archiving.gaps.map((g) => g.path)).toEqual(["/activateB2BArchivingConfiguration"]);
  });
});
