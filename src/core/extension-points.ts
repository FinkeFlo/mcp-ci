import type { Tenant, TenantConfig } from "./types.js";

/**
 * Who is calling. Deliberately carries no credential: the `Authenticator` sees
 * the request, everything behind it sees only this.
 */
export interface Principal {
  /** Stable identifier of the person or service. */
  subject: string;
  roles: string[];
  claims: Record<string, unknown>;
}

/** Resolves the tenant configuration one principal may use. */
export interface ConfigSource {
  resolve(principal: Principal): Promise<TenantConfig>;
}

/** Supplies the bearer token for calls to a tenant's API. */
export interface TokenProvider {
  getToken(tenant: Tenant, principal: Principal): Promise<string>;
}

/** Turns an HTTP request into a principal. Must throw when authentication fails. */
export interface Authenticator {
  authenticate(request: Request): Promise<Principal>;
}

export interface ServerOptions {
  configSource: ConfigSource;
  /** Default: OAuth client credentials with a token cache. */
  tokenProvider?: TokenProvider;
}

/** The one principal of a local stdio process. */
export const LOCAL_PRINCIPAL: Principal = Object.freeze({
  subject: "local",
  roles: Object.freeze([]) as unknown as string[],
  claims: Object.freeze({}) as Record<string, unknown>,
});

/**
 * Checks the shape an `Authenticator` returned and returns a copy, so a
 * misbehaving authenticator can neither slip through as anonymous nor change
 * the principal later.
 */
export function assertPrincipal(value: unknown): Principal {
  const candidate = value as Partial<Principal> | null | undefined;
  const valid =
    typeof candidate === "object" &&
    candidate !== null &&
    typeof candidate.subject === "string" &&
    candidate.subject !== "" &&
    Array.isArray(candidate.roles) &&
    candidate.roles.every((role) => typeof role === "string") &&
    typeof candidate.claims === "object" &&
    candidate.claims !== null &&
    !Array.isArray(candidate.claims);
  if (!valid) throw new Error("Invalid principal");
  return {
    subject: candidate.subject!,
    roles: [...candidate.roles!],
    claims: { ...candidate.claims! },
  };
}
