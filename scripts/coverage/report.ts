import { MODULE_SPECS } from "./types.js";
import type {
  CoverageReport,
  ModuleCoverage,
  Operation,
  OrphanAnnotation,
  ToolEntry,
} from "./types.js";

const SEP = "\n";
function opKey(spec: string, method: string, path: string): string {
  return `${spec}${SEP}${method}${SEP}${path}`;
}

export function buildReport(
  operations: Operation[],
  tools: ToolEntry[],
  specDir: string,
  modulesDir: string
): CoverageReport {
  const moduleNames = new Set<string>([
    ...Object.keys(MODULE_SPECS),
    ...tools.map((t) => t.module),
  ]);

  const modules: ModuleCoverage[] = [];

  for (const module of [...moduleNames].sort()) {
    const specs = MODULE_SPECS[module] ?? [];
    const universe = operations.filter((o) => specs.includes(o.spec));
    const universeKeys = new Set(universe.map((o) => opKey(o.spec, o.method, o.path)));
    const moduleTools = tools.filter((t) => t.module === module);

    const covered = new Set<string>();
    const orphanAnnotations: OrphanAnnotation[] = [];
    const unannotatedTools: string[] = [];

    for (const t of moduleTools) {
      const real = t.annotations.filter((a) => a.method !== "NONE");
      const isNone = t.annotations.some((a) => a.method === "NONE");
      if (real.length === 0 && !isNone) {
        unannotatedTools.push(t.tool);
        continue;
      }
      for (const a of real) {
        const matchSpec = specs.find((s) => universeKeys.has(opKey(s, a.method, a.path)));
        if (matchSpec) covered.add(opKey(matchSpec, a.method, a.path));
        else orphanAnnotations.push({ tool: t.tool, method: a.method, path: a.path });
      }
    }

    const gaps = universe.filter((o) => !covered.has(opKey(o.spec, o.method, o.path)));

    modules.push({
      module,
      specs,
      totalOps: universe.length,
      coveredOps: covered.size,
      gaps,
      unannotatedTools: unannotatedTools.sort(),
      orphanAnnotations,
    });
  }

  return { generatedFrom: { specDir, modulesDir }, modules };
}
