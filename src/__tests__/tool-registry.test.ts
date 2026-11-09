import { describe, it, expect } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, resolve, dirname, relative } from "node:path";
import { fileURLToPath } from "node:url";
import type { McpServer } from "@modelcontextprotocol/server";
import { allModules } from "../modules/all.js";
import { TenantManager } from "../core/tenant-manager.js";
import { classifyTool } from "../core/tool-access.js";
import type { ModuleContext } from "../core/types.js";

const srcDir = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const MUTATING_CALL = /\bodataClient\.(post|put|delete)\(/;

function registeredToolNames(): string[] {
  const names: string[] = [];
  const server = {
    registerTool: (name: string) => {
      names.push(name);
      return { enable() {}, disable() {} };
    },
  } as unknown as McpServer;
  const tenantManager = new TenantManager({
    tenants: {
      dev: { name: "DEV", apiUrl: "https://x", oauthUrl: "https://x", clientId: "i", clientSecret: "s" },
    },
    defaultTenant: "dev",
  });
  const context = { tenantManager, odataClient: {} } as unknown as ModuleContext;
  for (const mod of allModules) mod.register(server, context);
  return names;
}

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) return entry === "__tests__" ? [] : sourceFiles(path);
    return path.endsWith(".ts") ? [path] : [];
  });
}

/**
 * Splits each module file into one block per registerTool call and resolves
 * the tool names it registers. Template names (`get_${prefix}`) become a
 * pattern matched against the registered names.
 */
function toolBlocks(): Array<{ label: string; names: string[]; body: string; file: string }> {
  const registered = registeredToolNames();
  return sourceFiles(join(srcDir, "modules")).flatMap((file) => {
    const [, ...blocks] = readFileSync(file, "utf-8").split("registerTool(");
    return blocks.map((body) => {
      const literal = /^\s*(["`])([^"`]+)\1/.exec(body)?.[2] ?? "<no name>";
      const pattern = new RegExp(
        `^${literal.split(/\$\{[^}]+\}/).map((part) => part.replace(/[.*+?^$()|[\]\\]/g, "\\$&")).join("[a-z0-9_]+")}$`
      );
      return {
        label: literal,
        names: registered.filter((name) => pattern.test(name)),
        body,
        file: relative(srcDir, file),
      };
    });
  });
}

describe("tool registry", () => {
  it("every registered tool name has a classification", () => {
    const names = registeredToolNames();
    expect(names.length).toBeGreaterThan(200);
    expect(names.filter((name) => classifyTool(name) === undefined)).toEqual([]);
  });

  it("source scan: every tool that posts, puts or deletes is classified write, except execute_guidelines", () => {
    const misclassified = toolBlocks()
      .filter(({ body }) => MUTATING_CALL.test(body))
      .flatMap(({ names, file }) => names.map((name) => `${file}: ${name}`))
      .filter((entry) => {
        const name = entry.split(": ")[1];
        return name !== "execute_guidelines" && classifyTool(name) !== "write";
      });
    expect(misclassified).toEqual([]);
  });

  it("source scan covers every registered tool", () => {
    const blocks = toolBlocks();
    expect(blocks.filter(({ names }) => names.length === 0).map(({ file, label }) => `${file}: ${label}`)).toEqual([]);
    const covered = new Set(blocks.flatMap(({ names }) => names));
    expect(registeredToolNames().filter((name) => !covered.has(name))).toEqual([]);
  });

  it("no mutating call exists outside registerTool blocks", () => {
    const outside = sourceFiles(join(srcDir, "modules"))
      .filter((file) => MUTATING_CALL.test(readFileSync(file, "utf-8").split("registerTool(")[0]))
      .map((file) => relative(srcDir, file));
    expect(outside).toEqual([]);
  });

  it("execute_guidelines passes allowOnReadOnly", () => {
    const block = toolBlocks().find(({ label }) => label === "execute_guidelines");
    expect(block?.body).toMatch(/odataClient\.post\([^;]*allowOnReadOnly: true/s);
  });
});
