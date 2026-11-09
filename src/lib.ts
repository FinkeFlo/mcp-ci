/**
 * Library entry. Importing it starts nothing and reads no configuration; the
 * CLI is `index.ts`.
 */
export { buildServer } from "./server.js";
export { LOCAL_PRINCIPAL, assertPrincipal } from "./core/extension-points.js";
export type {
  Principal,
  ConfigSource,
  TokenProvider,
  Authenticator,
  ServerOptions,
} from "./core/extension-points.js";
export { createSessionFactory } from "./core/session-factory.js";
export type { Session, SessionFactory } from "./core/session-factory.js";
export { createFileConfigSource } from "./core/config-source.js";
export { parseTenantConfig, loadTenantConfig, validateTenantConfig, NoTenantsError } from "./core/config.js";
export { Auth as ClientCredentialsTokenProvider } from "./core/auth.js";
export { CsrfTokenCache } from "./core/csrf-cache.js";
export { ODataClient } from "./core/odata-client.js";
export { TenantManager } from "./core/tenant-manager.js";
export type {
  Tenant,
  TenantConfig,
  TenantSettings,
  Module,
  ModuleContext,
} from "./core/types.js";
