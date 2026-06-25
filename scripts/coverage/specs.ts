import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { load as yamlLoad } from "js-yaml";
import type { Operation } from "./types.js";

const HTTP_METHODS = ["get", "post", "put", "patch", "delete"] as const;

interface SwaggerOperation {
  tags?: string[];
  summary?: string;
}
interface SwaggerDoc {
  paths?: Record<string, Record<string, SwaggerOperation>>;
}

export function parseSpecs(apiDir: string): Operation[] {
  const ops: Operation[] = [];
  const files = readdirSync(apiDir).filter((f) => f.endsWith(".yaml"));
  for (const file of files) {
    const doc = yamlLoad(readFileSync(join(apiDir, file), "utf8")) as SwaggerDoc;
    const paths = doc.paths ?? {};
    for (const [path, methods] of Object.entries(paths)) {
      for (const method of HTTP_METHODS) {
        const op = methods[method];
        if (!op) continue;
        ops.push({
          spec: file,
          method: method.toUpperCase(),
          path,
          tag: op.tags?.[0] ?? "",
          summary: op.summary ?? "",
        });
      }
    }
  }
  return ops;
}
