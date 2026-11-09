# 0005. Extension points: ConfigSource, TokenProvider, Authenticator, Principal

- Status: Proposed
- Date: 2026-11-09

## Context

mcp-ci started as a local stdio process with one static tenant file and one hard-wired OAuth
method. A private, downstream distribution wants to run the same server remotely for many people:
an external identity provider decides who may use it, a person's role decides which tenants they
see and what they may do, and the tenant configuration lives with the deployment. This repository
stays generic: no organisation, identity provider or role concept may enter it.

## Decision

- The package has a side-effect-free library entry (`src/lib.ts`, `package.json` `exports` and
  `main`). The CLI stays `bin` and `src/index.ts`, stdio only, and nothing about local setup changes.
- Four interfaces in `src/core/extension-points.ts`:
  - `Principal { subject, roles, claims }`: who is calling. Over stdio it is the fixed
    `LOCAL_PRINCIPAL`. It never carries the caller's raw credential; if token exchange is added
    later, an opaque credential field can be added without breaking these interfaces.
  - `ConfigSource.resolve(principal)`: the tenant configuration for that principal. The default is
    the file lookup (`createFileConfigSource`).
  - `TokenProvider.getToken(tenant, principal)`: the default is OAuth client credentials with a
    token cache (`Auth`, exported as `ClientCredentialsTokenProvider`).
  - `Authenticator.authenticate(request)`: request in, `Principal` out, throws on failure.
- The core receives an already resolved `TenantConfig`. It knows no roles; `readOnly`,
  `allowPayloads`, `denyTools` and the allow-list (ADR 0008) are the vocabulary a downstream role
  rule produces.
- Every config goes through `validateTenantConfig`, whoever produced it. `buildServer` calls it, so
  a `ConfigSource` cannot skip the fail-closed rules of ADR 0001 by returning an object directly.
  The result is a fresh copy, so a source that keeps handing out one object cannot change a running
  session. Zero tenants raise `NoTenantsError`; the tenant key `__proto__` is refused.
- `Tenant.auth` is an opaque block that the core copies and never reads, so a downstream
  `TokenProvider` can find what it needs on the tenant. `clientId` and `clientSecret` stay required
  as the default credentials.
- Cache keys are unambiguous: the token cache is keyed by token endpoint and client id, the CSRF
  cache by API URL, client id and principal subject (`JSON.stringify` of the parts, so a separator
  inside a part cannot make two keys collide). Two tenants that share a client id but not a URL no
  longer share a token or a CSRF token.

## Consequences

- A downstream tenant that uses another authentication method still has to supply `clientId` and
  `clientSecret` values; this is revisited when token exchange is built.
- Existing config files load unchanged. A config that was accepted but broke the rules (for
  example an unknown tool in `denyTools` passed to `buildServer` directly) is now refused.
- The principal is part of the module context, so audit logging can be added later without
  changing the interfaces; none is built here.
