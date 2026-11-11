# Extension points and per-session state for remote operation

## Intent

mcp-ci today runs as a local stdio process with one static tenant file and one hard-wired OAuth
method. A downstream, private distribution (an organisation's own repository, not part of this
repository) needs to run the same server remotely, for example on SAP BTP, for many people at once:

- who may use the server is decided by an external identity provider (Microsoft Entra ID);
- which tenants a person sees, and what they may do on each, depends on their role;
- the tenant configuration and secrets live with the deployment, not on every laptop.

This repository stays generic and public. The downstream distribution must be able to depend on it
as a library and supply the organisation-specific parts (identity provider, role rules, config
source) without forking it and without any organisation-specific name, URL or concept entering this
repository.

This document covers only the generic part: the extension points and the changes the core needs so
that several people can use one server at the same time. The downstream repository, the Entra
integration, the role rules and the BTP deployment are separate projects.

## Goals

1. **Library entry point.** The package can be imported without starting a server. It exports
   `buildServer`, the types, and the default implementations below. The CLI (`bin`) keeps working
   exactly as today.
2. **`ConfigSource`.** Asynchronous, resolves the tenant configuration for a given principal.
   Default: the current file lookup (`MCP_CI_CONFIG`, checkout, XDG), same validation, same
   fail-closed rules. The validation and normalisation (`readOnly`, `allowPayloads`, `denyTools`,
   the allow-list, at least one tenant, a valid default) runs on the result of **every**
   `ConfigSource`, not only on the file source, so a downstream source cannot skip the safety
   rules by returning a `TenantConfig` object directly.
3. **`TokenProvider`.** Replaces the hard-wired `Auth`. Receives the tenant and the principal.
   Default: the current OAuth `client_credentials` with a token cache.
4. **`Principal`.** Who is calling: a stable subject plus roles and raw claims. In stdio mode it is
   one fixed local principal, so nothing changes for local users. `Principal` does **not** carry the
   caller's raw credential (no bearer token in `claims`); the `Authenticator` sees the request, the
   rest of the server sees only the principal. If token exchange is added later, an opaque
   credential field can be added without breaking the interfaces.
5. **Session-scoped tenant state.** The active tenant, the tool visibility that depends on it, and
   the read-only/payload guards are per session, not per process. Two sessions must never see or
   change each other's active tenant. Token and CSRF caches stay shared, but their keys are made
   unambiguous: the token cache is keyed by token endpoint and client id (today: client id only),
   the CSRF cache by API URL, client id and principal subject (today: client id only). Two tenants
   that share a client id but not a URL must not share a token or a CSRF token.
6. **Optional HTTP transport, library only.** The package exports a function that starts a
   Streamable HTTP server and requires an `Authenticator` (request in, `Principal` out); it throws
   if none is given. The CLI (`bin`) stays stdio only and gets no HTTP flag, because a flag cannot
   carry an authenticator. A downstream package provides its own entry point. Either transport runs
   per process; serving both in one process is not required.
7. **Tool allow-list per tenant (separable, last).** A setting that restricts a tenant to an
   explicit set of tools or tool classes (`read`, `payload`, `write`), next to the existing
   `denyTools`. Semantics: a missing setting means no extra restriction; a present setting, even an
   empty list, means only the listed tools or classes; a tool in both the allow-list and
   `denyTools` is denied; `get_tenant` and `set_tenant` stay usable. Fail closed like the rest:
   unknown names or a wrong type are a config error, and it can only narrow what `readOnly` and
   `allowPayloads` already allow, never widen it.

## Non-goals

- Anything specific to one organisation or identity provider: Entra ID, group-to-role mapping,
  BTP deployment descriptors, a config server. These live downstream.
- Role definitions in this repository. The core receives an already resolved `TenantConfig` with
  `settings`; it does not know roles.
- Reloading configuration while the server runs.
- Per-user identity towards SAP (token exchange / on-behalf-of). `TokenProvider` receives the
  principal so it can be added later; no implementation here.
- Audit logging. The principal is available in the session context so it can be added later.
- Horizontal scaling across several server instances. Sessions are held in memory; this is stated
  in the docs, not solved.
- New tools. `npm run schema-budget` must show no change in the tool list.

## Anti-goals (a failure even if the tests pass)

- An HTTP server that can be started without an authenticator, or that falls back to an anonymous
  principal when authentication fails.
- Any state shared between sessions that lets one person's `set_tenant` change another person's
  active tenant, tool list, or guard decision, including through async work still running after the
  switch.
- A weaker read-only or payload guarantee than ADR 0001 gives today. The two guard layers, the
  pinned tenant per call and the fail-closed defaults stay as they are.
- A tenant or tool being available because a new setting was missing, misspelled or of the wrong
  type.
- Local stdio users having to change their config, their MCP client entry or their README setup.
- Secrets in log output, error messages or the principal passed to hooks.

## Constraints

- Node 22+, TypeScript, existing dependencies. Add a dependency only where the MCP SDK needs one for
  HTTP; check its current docs first (Context7, `@modelcontextprotocol/server` v2.4) instead of
  relying on memory.
- Repository conventions: English code, comments and docs; ADRs in `docs/adr` from the template,
  never edited after acceptance; one ADR per decision below.
- Tests first for behaviour changes. `npm test`, `npm run typecheck`, `npm run schema-budget`,
  `npm run coverage` and `npm run test:eval` keep passing.
- `config/tenants.jsonc` and `config/*.swp` hold real credentials locally. Nothing in this work
  reads, prints or commits them; tests use fixtures.

## Decisions

Made by the user:

- The public repository gets the extension points; the organisation-specific parts live in a
  separate private repository that depends on this one.
- The remote deployment will authenticate people with Entra ID, and tenants and tool permissions
  depend on the person's role.
- Remote operation is later (not part of this document).

My calls (checked against the code and the SDK docs, please correct):

- **Sessionful HTTP, one server per session.** `set_tenant` is stateful by design and the SDK's
  stateless per-request handler would drop it. Each session builds its own `McpServer` and
  `TenantManager` from `ConfigSource.resolve(principal)`; the token provider and the HTTP/CSRF
  caches are created once and shared. Consequence: one instance, or sticky sessions; documented.
- **Role handling stays out of the core.** The core only accepts the resolved config. The existing
  `readOnly`, `allowPayloads`, `denyTools` plus the allow-list are the vocabulary a downstream role
  rule produces.
- **HTTP lives in this repository**, behind the `Authenticator` hook, because session handling
  cannot be tested without it and a generic remote mode is useful to others.
- **Defaults reproduce today's behaviour exactly**, so existing tests pass unchanged.
- **No built-in HTTP authenticator in this repository.** The authentication method belongs to the
  deployment; shipping a static token or JWT verifier here would be a second thing to secure.
- **Sessions are bound to the person.** Every request on an existing session is authenticated
  again and refused if its subject differs from the one that created the session. When
  authentication succeeds but `ConfigSource` returns no usable tenant for the person, the answer is
  403 and no session is created; when `ConfigSource` throws, the answer is 503 without details and
  no session.
- **Cache key fixes belong to this work.** They are small, they matter once several people share
  a process, and they fix an existing ambiguity.

## Design

Names are proposals; the builder may change them if the intent holds.

```ts
interface Principal { subject: string; roles: string[]; claims: Record<string, unknown> }

interface ConfigSource  { resolve(principal: Principal): Promise<TenantConfig> }
interface TokenProvider { getToken(tenant: Tenant, principal: Principal): Promise<string> }
interface Authenticator { authenticate(request: Request): Promise<Principal> } // throws on failure

interface ServerOptions {
  configSource: ConfigSource;
  tokenProvider?: TokenProvider;   // default: client credentials
}
```

- `buildServer(config, options)` keeps its signature and meaning for the existing callers and
  tests. A new session factory wraps it: resolve config for the principal, build a server and
  `TenantManager` for that session, share the token provider and caches.
- `Tenant` keeps `clientId`/`clientSecret` as the default credentials. How a tenant describes other
  authentication (a typed `auth` block, secret references) is left to the builder, with one
  requirement: an existing config file must load unchanged, and a downstream `TokenProvider` must be
  able to read what it needs from the tenant without the core knowing the method.
- The ODataClient and the token/CSRF caches already use the tenant's credentials as cache keys;
  confirm they stay correct when two principals use the same tenant, and when two tenants share a
  `clientId` but not a URL.
- `index.ts` is the CLI. A new side-effect-free module is the library entry, referenced by
  `package.json` `exports`.
- HTTP entry: an exported start function, listen address defaulting to loopback, session limit and
  idle timeout, session id handling as in the SDK docs. A request without valid authentication gets
  401 before any session is created; see Decisions for the other cases.

## Records to write

One ADR each, in `docs/adr`, next number onward:

1. Extension points: `ConfigSource`, `TokenProvider`, `Authenticator`, `Principal`.
2. Tenant state is per session.
3. Remote operation requires authentication.
4. Per-tenant tool allow-list (if goal 7 is built).

## Tests that must exist

- Defaults: the file config and client-credentials provider behave as before (existing tests).
- Two sessions with different principals and different tenants: `set_tenant`, tool list and guards
  stay independent, including a call still running while the other session switches.
- A read-only tenant stays unwritable through the session factory, for each guard layer.
- HTTP: no authenticator means no start; failed authentication means 401 and no session; a valid
  principal gets a session limited to what `ConfigSource` returned for it; a request on an existing
  session from a different subject is refused; zero tenants gives 403, a throwing `ConfigSource`
  gives 503.
- A `ConfigSource` that returns an unvalidated object with a string `"false"` for `readOnly`, a
  non-list `denyTools` or an unknown tool name is rejected or fails closed, same as the file source.
- Cache keys: two tenants with the same client id and different URLs do not share a token or a
  CSRF token.
- Allow-list: missing means unrestricted, empty means nothing but the tenant tools, deny wins,
  unknown names are a config error, a wrong type does not widen access.
- The library entry imports without starting anything.

## Left to the builder

File layout, names, the shape of the `auth` block, the HTTP library choice within the SDK's
packages, the exact session limits, and how to split the work into commits.

## Open for the user

- Whether calls to SAP should run as the person (token exchange) or as a technical user. Nothing in
  this document depends on it; `TokenProvider` receives the principal so either fits.
- Whether audit logging of principal, tool and tenant belongs in this part or in the downstream one.
