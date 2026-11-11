import { createHash } from "node:crypto";
import type { McpServer } from "@modelcontextprotocol/server";
import { buildServer } from "../server.js";
import { Auth } from "./auth.js";
import { CsrfTokenCache } from "./csrf-cache.js";
import type { Principal, ServerOptions } from "./extension-points.js";
import type { ODataClient } from "./odata-client.js";
import type { TenantManager } from "./tenant-manager.js";
import type { TenantConfig } from "./types.js";

/** One person's server: its own tenant state, tool list and guards. */
export interface Session {
  server: McpServer;
  tenantManager: TenantManager;
  odataClient: ODataClient;
  principal: Principal;
  /** Identifies the config the session was built from (see `configKey`). */
  configKey: string;
}

export interface SessionFactory {
  createSession(principal: Principal): Promise<Session>;
  /** Resolves the principal's config again and returns its `configKey`. */
  resolveConfigKey(principal: Principal): Promise<string>;
}

/** JSON with sorted object keys, so equal configs give equal strings. */
function stableStringify(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
  if (value !== null && typeof value === "object") {
    const entries = Object.keys(value)
      .sort()
      .filter((key) => (value as Record<string, unknown>)[key] !== undefined)
      .map((key) => `${JSON.stringify(key)}:${stableStringify((value as Record<string, unknown>)[key])}`);
    return `{${entries.join(",")}}`;
  }
  return JSON.stringify(value) ?? "null";
}

/** A hash of the config, so a session can tell whether its config changed without keeping a copy. */
export function configKey(config: TenantConfig): string {
  return createHash("sha256").update(stableStringify(config)).digest("hex");
}

/**
 * Builds one server per session from `ConfigSource.resolve(principal)`. Only
 * the token provider and the CSRF cache are shared between sessions; their
 * keys name everything a token depends on. Errors from the config source or
 * from validation are passed on unchanged.
 */
export function createSessionFactory(options: ServerOptions): SessionFactory {
  const tokenProvider = options.tokenProvider ?? new Auth();
  const csrfCache = new CsrfTokenCache();
  return {
    async createSession(principal) {
      const config = await options.configSource.resolve(principal);
      const { server, tenantManager, odataClient } = buildServer(config, {
        tokenProvider,
        csrfCache,
        principal,
      });
      return { server, tenantManager, odataClient, principal, configKey: configKey(config) };
    },
    async resolveConfigKey(principal) {
      return configKey(await options.configSource.resolve(principal));
    },
  };
}
