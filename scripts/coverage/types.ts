export interface Operation {
  spec: string; // e.g. "IntegrationContent.yaml"
  method: string; // "GET" | "POST" | ...
  path: string; // exactly as in the YAML, e.g. "/IntegrationPackages"
  tag: string;
  summary: string;
}

export interface Annotation {
  method: string; // uppercase HTTP method, or "NONE" sentinel
  path: string; // "" for the NONE sentinel
}

export interface ToolEntry {
  module: string;
  file: string;
  tool: string;
  annotations: Annotation[];
}

export interface OrphanAnnotation {
  tool: string;
  method: string;
  path: string;
}

export interface ModuleCoverage {
  module: string;
  specs: string[];
  totalOps: number;
  coveredOps: number;
  gaps: Operation[];
  unannotatedTools: string[];
  orphanAnnotations: OrphanAnnotation[];
}

export interface CoverageReport {
  generatedFrom: { specDir: string; modulesDir: string };
  modules: ModuleCoverage[];
}

// A slice of a spec that belongs to a module. Several specs (notably
// MessageProcessingLogs.yaml) bundle multiple logical areas distinguished by
// their OpenAPI `tags`, so a module owns a tag-scoped slice rather than the
// whole file. An operation belongs to a scope when its spec matches and:
//   - `tags` omitted  → any tag, OR the operation's tag is in `tags`; and
//   - `excludeTags` omitted → no exclusion, OR the operation's tag is NOT in it.
export interface SpecScope {
  spec: string;
  tags?: string[]; // include only operations with one of these tags
  excludeTags?: string[]; // drop operations with one of these tags
}

// Module → the spec slice(s) it draws operations from. The slices are disjoint
// so every operation is owned by at most one module (no double counting).
// Empty array = intentionally no enumerable API surface.
export const MODULE_SPECS: Record<string, SpecScope[]> = {
  content: [{ spec: "IntegrationContent.yaml" }],
  security: [{ spec: "SecurityContent.yaml" }],
  // "Data Archiving" in B2BScenarios.yaml is owned by the archiving module.
  b2b: [{ spec: "B2BScenarios.yaml", excludeTags: ["Data Archiving"] }],
  messagestore: [{ spec: "MessageStore.yaml" }],
  logfiles: [{ spec: "LogFiles.yaml" }],
  monitoring: [
    {
      spec: "MessageProcessingLogs.yaml",
      tags: [
        "Logs",
        "Adapter Attributes",
        "Attachments",
        "Custom Header Properties",
        "Error Information",
      ],
    },
  ],
  idempotent: [{ spec: "MessageProcessingLogs.yaml", tags: ["Idempotent Repository"] }],
  logging: [{ spec: "MessageProcessingLogs.yaml", tags: ["External Logging"] }],
  archiving: [
    { spec: "MessageProcessingLogs.yaml", tags: ["Data Archiving"] },
    { spec: "B2BScenarios.yaml", tags: ["Data Archiving"] },
  ],
  idmapper: [{ spec: "MessageProcessingLogs.yaml", tags: ["ID Mapper"] }],
  // Runs/RunSteps/TraceMessages are navigation properties, not enumerated as
  // paths in MessageProcessingLogs.yaml — no operations to map.
  tracing: [],
  // CSRF "GET /" (tag "CSRF Token Handling") is client infrastructure, owned by
  // no module; it intentionally appears in no module's universe.
  tenant: [], // internal tenant switching, no API operation
};
