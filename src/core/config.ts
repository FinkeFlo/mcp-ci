import { existsSync, readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { parse, printParseErrorCode, type ParseError } from "jsonc-parser";
import type { Tenant, TenantConfig } from "./types.js";

const CONNECTION_FIELDS = ["apiUrl", "oauthUrl", "clientId", "clientSecret"] as const;
const SETTINGS_KEYS = new Set(["readOnly", "allowPayloads"]);

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function position(text: string, offset: number): string {
  const before = text.slice(0, offset);
  const line = before.split("\n").length;
  const column = offset - before.lastIndexOf("\n");
  return `line ${line}, column ${column}`;
}

function normalizeTenant(key: string, raw: Record<string, unknown>): Tenant {
  for (const field of CONNECTION_FIELDS) {
    if (typeof raw[field] !== "string" || raw[field] === "") {
      throw new Error(`Tenant '${key}': '${field}' must be a non-empty string`);
    }
  }

  if (raw.name !== undefined && typeof raw.name !== "string") {
    throw new Error(`Tenant '${key}': 'name' must be a string`);
  }

  const settings = raw.settings ?? {};
  if (!isObject(settings)) {
    throw new Error(`Tenant '${key}': 'settings' must be an object`);
  }
  for (const settingKey of Object.keys(settings)) {
    if (!SETTINGS_KEYS.has(settingKey)) {
      throw new Error(
        `Tenant '${key}': unknown setting '${settingKey}' (allowed: ${[...SETTINGS_KEYS].join(", ")})`
      );
    }
  }
  return {
    name: (raw.name as string | undefined) || key,
    apiUrl: raw.apiUrl as string,
    oauthUrl: raw.oauthUrl as string,
    clientId: raw.clientId as string,
    clientSecret: raw.clientSecret as string,
    // Fail closed: only an explicit false makes the tenant writable, and only
    // an explicit true exposes message, store and log content.
    settings: { readOnly: settings.readOnly !== false, allowPayloads: settings.allowPayloads === true },
  };
}

/**
 * Parses a JSONC tenant config. Only tenants with `"enabled": true` are kept;
 * every other entry is dropped without validation (fail closed).
 */
export function parseTenantConfig(text: string, source = "tenant config"): TenantConfig {
  const errors: ParseError[] = [];
  const raw: unknown = parse(text, errors, { allowTrailingComma: true });
  if (errors.length > 0) {
    const first = errors[0];
    throw new Error(
      `${source}: ${printParseErrorCode(first.error)} at ${position(text, first.offset)}`
    );
  }
  if (!isObject(raw) || !isObject(raw.tenants)) {
    throw new Error(`${source}: expected an object with a 'tenants' object`);
  }

  const tenants: Record<string, Tenant> = {};
  for (const [key, entry] of Object.entries(raw.tenants)) {
    if (!isObject(entry) || entry.enabled !== true) continue;
    tenants[key] = normalizeTenant(key, entry);
  }

  if (Object.keys(tenants).length === 0) {
    throw new Error(
      `${source}: no enabled tenant. A tenant is only active with "enabled": true`
    );
  }
  const defaultTenant = raw.defaultTenant;
  if (typeof defaultTenant !== "string" || !tenants[defaultTenant]) {
    throw new Error(
      `${source}: default tenant '${String(defaultTenant)}' is missing or not enabled ("enabled": true)`
    );
  }

  return { tenants, defaultTenant };
}

/** `MCP_CI_CONFIG` wins; otherwise `config/tenants.jsonc`. */
export function resolveConfigPath(
  env: NodeJS.ProcessEnv,
  baseDir: string,
  exists: (path: string) => boolean
): string {
  if (env.MCP_CI_CONFIG) return resolve(env.MCP_CI_CONFIG);
  const jsonc = resolve(baseDir, "config/tenants.jsonc");
  if (exists(jsonc)) return jsonc;
  throw new Error(`No tenant config found at ${jsonc}. Copy config/tenants.example.jsonc to start.`);
}

export function loadTenantConfig(): TenantConfig {
  const baseDir = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
  const path = resolveConfigPath(process.env, baseDir, existsSync);
  return parseTenantConfig(readFileSync(path, "utf-8"), path);
}
