import { describe, it, expect } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, resolve, dirname, relative } from "node:path";
import { fileURLToPath } from "node:url";
import type { McpServer } from "@modelcontextprotocol/server";
import { allModules } from "../modules/all.js";
import { TenantManager } from "../core/tenant-manager.js";
import { classifyTool } from "../core/tool-access.js";
import { TOOL_CLASSES } from "../core/tool-classes.js";
import type { ModuleContext } from "../core/types.js";

const srcDir = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const MUTATING_CALL = /\bodataClient\.(post|put|delete)\(/;

// Naming convention, only used to suggest a class and to catch a table entry
// that contradicts the tool's name. Runtime access reads TOOL_CLASSES only.
const READ_PREFIXES = ["get_", "list_", "count_", "download_", "aggregate_", "export_"];
const WRITE_PREFIXES = [
  "create_", "update_", "delete_", "deploy_", "undeploy_", "save_", "upsert_", "import_",
  "activate_", "deactivate_", "restore_", "rename_", "generate_", "copy_", "validate_",
];
// Classes that differ from what the name suggests, with the reason in TOOL_CLASSES.
const NAME_EXCEPTIONS = new Set(["set_tenant", "execute_guidelines"]);

function classByPrefix(name: string): "read" | "write" {
  if (WRITE_PREFIXES.some((prefix) => name.startsWith(prefix))) return "write";
  return READ_PREFIXES.some((prefix) => name.startsWith(prefix)) ? "read" : "write";
}

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
  it("every registered tool has an entry in TOOL_CLASSES", () => {
    const names = registeredToolNames();
    expect(names.length).toBeGreaterThan(200);
    const missing = names.filter((name) => !Object.hasOwn(TOOL_CLASSES, name)).map((name) => `${name}: "${classByPrefix(name)}"`);
    expect(missing, "add these to src/core/tool-classes.ts (suggested class from the name)").toEqual([]);
  });

  it("tools that return message, store or log content are payload", () => {
    for (const name of ["get_trace", "download_message_store_entry", "download_data_store_entry", "download_log_file", "export_keystore"]) {
      expect(TOOL_CLASSES[name], name).toBe("payload");
    }
  });

  it("tools that only list payload metadata stay read", () => {
    for (const name of ["get_business_document_payloads", "get_orphaned_interchange_payloads"]) {
      expect(TOOL_CLASSES[name], name).toBe("read");
    }
  });

  it("every TOOL_CLASSES entry is a registered tool", () => {
    const names = new Set(registeredToolNames());
    expect(Object.keys(TOOL_CLASSES).filter((name) => !names.has(name))).toEqual([]);
  });

  it("no TOOL_CLASSES entry contradicts its name, except the listed exceptions", () => {
    const contradicting = Object.entries(TOOL_CLASSES)
      // payload is a subset of read: it may carry a read prefix, never a write prefix.
      .filter(([name, kind]) => !NAME_EXCEPTIONS.has(name) && (kind === "write" ? "write" : "read") !== classByPrefix(name))
      .map(([name, kind]) => `${name}: ${kind}`);
    expect(contradicting).toEqual([]);
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

  it("no tool other than execute_guidelines passes allowOnReadOnly", () => {
    const others = toolBlocks()
      .filter(({ body, label }) => /allowOnReadOnly/.test(body) && label !== "execute_guidelines")
      .map(({ file, label }) => `${file}: ${label}`);
    expect(others).toEqual([]);
    const outside = sourceFiles(join(srcDir, "modules"))
      .filter((file) => /allowOnReadOnly/.test(readFileSync(file, "utf-8").split("registerTool(")[0]))
      .map((file) => relative(srcDir, file));
    expect(outside).toEqual([]);
  });

  it("execute_guidelines passes allowOnReadOnly", () => {
    const block = toolBlocks().find(({ label }) => label === "execute_guidelines");
    expect(block?.body).toMatch(/odataClient\.post\([^;]*allowOnReadOnly: true/s);
  });
});
