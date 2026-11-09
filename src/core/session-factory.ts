import type { McpServer } from "@modelcontextprotocol/server";
import { buildServer } from "../server.js";
import { Auth } from "./auth.js";
import { CsrfTokenCache } from "./csrf-cache.js";
import type { Principal, ServerOptions } from "./extension-points.js";
import type { ODataClient } from "./odata-client.js";
import type { TenantManager } from "./tenant-manager.js";

/** One person's server: its own tenant state, tool list and guards. */
export interface Session {
  server: McpServer;
  tenantManager: TenantManager;
  odataClient: ODataClient;
  principal: Principal;
}

export interface SessionFactory {
  createSession(principal: Principal): Promise<Session>;
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
      return { server, tenantManager, odataClient, principal };
    },
  };
}
