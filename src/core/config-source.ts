import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { parseTenantConfig, resolveConfigPath } from "./config.js";
import type { ConfigSource } from "./extension-points.js";

/**
 * The default `ConfigSource`: one JSONC tenant file for every principal.
 * Without `path` it looks where `loadTenantConfig` looks (`MCP_CI_CONFIG`,
 * the checkout, then XDG). The file is read on every `resolve`.
 */
export function createFileConfigSource(options: { path?: string } = {}): ConfigSource {
  return {
    async resolve() {
      const baseDir = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
      const path = options.path ?? resolveConfigPath(process.env, baseDir, existsSync);
      return parseTenantConfig(readFileSync(path, "utf-8"), path);
    },
  };
}
