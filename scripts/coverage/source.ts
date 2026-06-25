import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import type { Annotation, ToolEntry } from "./types.js";

// method is a single token; the path may contain spaces (e.g. template
// params like '{Source ID}'), so the path group captures the rest of the line.
const ANNOTATION_RE = /^\s*\/\/\s*@api\s+(\S+)(?:\s+(.+?))?\s*$/;
const REGISTER_RE = /server\.registerTool\(/;
// tool name is the first quoted string after registerTool( — single, double,
// or backtick (factory tools use template-literal names like `list_${x}s`).
const NAME_RE = /["'`]([^"'`]+)["'`]/;

function walkTsFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    if (entry === "__tests__") continue;
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) out.push(...walkTsFiles(full));
    else if (entry.endsWith(".ts")) out.push(full);
  }
  return out;
}

function annotationsAbove(lines: string[], registerLine: number): Annotation[] {
  const collected: Annotation[] = [];
  for (let k = registerLine - 1; k >= 0; k--) {
    const line = lines[k];
    const m = line.match(ANNOTATION_RE);
    if (m) {
      const method = m[1].toUpperCase();
      if (method === "NONE") collected.push({ method: "NONE", path: "" });
      else collected.push({ method, path: m[2] ?? "" });
      continue;
    }
    // Blank line is only tolerated before any annotation has been collected
    if (line.trim() === "" && collected.length === 0) continue;
    break; // any other line ends the contiguous block
  }
  return collected.reverse(); // restore top-to-bottom order
}

export function scanSource(modulesDir: string): ToolEntry[] {
  const entries: ToolEntry[] = [];
  for (const module of readdirSync(modulesDir)) {
    const moduleDir = join(modulesDir, module);
    if (!statSync(moduleDir).isDirectory()) continue;
    for (const file of walkTsFiles(moduleDir)) {
      const lines = readFileSync(file, "utf8").split("\n");
      for (let i = 0; i < lines.length; i++) {
        if (!REGISTER_RE.test(lines[i])) continue;
        let tool = "";
        for (let j = i; j < Math.min(i + 4, lines.length); j++) {
          // tool name is the first quoted string at or after the register call
          const after = j === i ? lines[j].replace(REGISTER_RE, "") : lines[j];
          const m = after.match(NAME_RE);
          if (m) {
            tool = m[1];
            break;
          }
        }
        if (!tool) continue;
        entries.push({ module, file, tool, annotations: annotationsAbove(lines, i) });
      }
    }
  }
  return entries;
}
