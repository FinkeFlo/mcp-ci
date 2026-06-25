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

// Module → spec file(s) it draws operations from.
// Empty array = intentionally no API surface (or no spec available).
export const MODULE_SPECS: Record<string, string[]> = {
  content: ["IntegrationContent.yaml"],
  security: ["SecurityContent.yaml"],
  b2b: ["B2BScenarios.yaml"],
  messagestore: ["MessageStore.yaml"],
  monitoring: ["MessageProcessingLogs.yaml"],
  tracing: ["MessageProcessingLogs.yaml"],
  logfiles: ["LogFiles.yaml"],
  logging: ["MessageProcessingLogs.yaml"],
  idempotent: ["MessageProcessingLogs.yaml"],
  archiving: ["MessageProcessingLogs.yaml", "B2BScenarios.yaml"],
  idmapper: [], // ID Mapping API has no spec among the 6 downloaded files
  tenant: [], // internal tenant switching, no API operation
};
