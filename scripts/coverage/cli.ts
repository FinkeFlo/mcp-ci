import { existsSync, readdirSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { parseSpecs } from "./specs.js";
import { scanSource } from "./source.js";
import { buildReport } from "./report.js";
import type { CoverageReport } from "./types.js";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const specDir = join(repoRoot, "docs", "api");
const modulesDir = join(repoRoot, "src", "modules");

function renderMarkdown(report: CoverageReport): string {
  const out: string[] = ["# Coverage Report", ""];
  let totalOps = 0;
  let totalCovered = 0;
  for (const m of report.modules) {
    totalOps += m.totalOps;
    totalCovered += m.coveredOps;
  }
  out.push(`**Total:** ${totalCovered}/${totalOps} operations covered`, "");

  for (const m of report.modules) {
    const specLabel = m.specs.length ? m.specs.join(", ") : "(no spec)";
    out.push(`## ${m.module} — ${m.coveredOps}/${m.totalOps} (${specLabel})`);
    if (m.gaps.length) {
      out.push("", "**Gaps:**");
      for (const g of m.gaps) {
        out.push(`- ${g.method} ${g.path}${g.summary ? ` — ${g.summary}` : ""}`);
      }
    }
    if (m.unannotatedTools.length) {
      out.push("", `**Un-annotated tools (${m.unannotatedTools.length}):** ${m.unannotatedTools.join(", ")}`);
    }
    if (m.orphanAnnotations.length) {
      out.push("", "**Orphan annotations:**");
      for (const o of m.orphanAnnotations) out.push(`- ${o.tool}: ${o.method} ${o.path}`);
    }
    out.push("");
  }
  return out.join("\n");
}

if (!existsSync(specDir) || !readdirSync(specDir).some((f) => f.endsWith(".yaml"))) {
  process.stderr.write(
    `No SAP API specs found in ${specDir}.\nDownload them from https://api.sap.com/package/CloudIntegrationAPI/odata — see docs/api/README.md.\n`,
  );
  process.exit(1);
}

const operations = parseSpecs(specDir);
const tools = scanSource(modulesDir);
const report = buildReport(operations, tools, "docs/api", "src/modules");

writeFileSync(join(repoRoot, "coverage-report.json"), JSON.stringify(report, null, 2));
process.stdout.write(renderMarkdown(report) + "\n");
