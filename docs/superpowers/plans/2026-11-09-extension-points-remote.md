# Extension points and per-session state Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make mcp-ci importable as a library with `ConfigSource` / `TokenProvider` / `Authenticator` / `Principal` extension points, per-session tenant state, an authenticated Streamable HTTP start function, and a per-tenant tool allow-list, without changing stdio behaviour.

**Architecture:** `buildServer(config, options)` stays the single place that wires one `McpServer` + `TenantManager` + `ODataClient`; it now validates every config it receives. A new session factory resolves config per `Principal` and calls `buildServer` once per session, sharing only the token provider and a CSRF cache whose keys are unambiguous. HTTP is one `McpServer` + `WebStandardStreamableHTTPServerTransport` per session, routed by `Mcp-Session-Id`, every request authenticated, sessions bound to the creating subject.

**Tech Stack:** Node 22, TypeScript, vitest, `@modelcontextprotocol/server` 2.4.0 (no new dependency, see Task 5), jsonc-parser, zod.

**Spec:** `docs/superpowers/specs/2026-11-09-extension-points-remote-design.md`

## Global Constraints

- Node 22+, TypeScript, existing dependencies only. Checked with Context7 (`/modelcontextprotocol/typescript-sdk/v2.4.0`): `createMcpHandler` is per-request and stateless (no `Mcp-Session-Id`), sessions need the hand-wired transport, `requireBearerAuth` only verifies a bearer token. `@modelcontextprotocol/node` has no 2.4.0 release (latest 2.1.2) and pulls in `hono`, so it is not used. `WebStandardStreamableHTTPServerTransport` ships in `@modelcontextprotocol/server`.
- English code, comments and docs. ADRs in `docs/adr` from `docs/adr/template.md`, numbers 0005 to 0008, one per decision, status `Proposed` (the repo's accepted ADRs are never edited, so acceptance happens at merge).
- Defaults reproduce today's behaviour exactly; existing tests pass unchanged.
- `config/tenants.jsonc` and `config/*.swp` are never read, printed or staged. Tests use `src/__tests__/fixtures/`. Stage files by explicit path, never `git add -A`.
- Branch `feat/extension-points`; no commits to `main`, no push, no destructive git.
- After every task: `npm run typecheck && npm test`. At the end also `npm run schema-budget`, `npm run coverage`, `npm run test:eval`.
- Baseline before this work: typecheck clean, 1254 tests pass, schema-budget `writable: 230/232 tools, 119141/122000 chars`, test:eval 15/15. `npm run coverage` exits 1 at baseline because the SAP API specs (`docs/api/*.yaml`, gitignored) are not present; report it as such.
- Anti-goals are failures: Task 5 (no anonymous HTTP), Task 4 (no shared session state, no weaker guards), Tasks 2 and 6 (missing / misspelled / wrong-typed setting never widens access), Task 1 (stdio users change nothing), Tasks 2 and 5 (no secrets in errors or logs).

## Review Focus

- A `ConfigSource` returning a tenant key `__proto__`: rejected, not silently dropped or prototype-polluting (Task 2).
- An `Authenticator` returning `undefined`, `{ subject: "" }` or `roles` that is not a string list: 401, never an anonymous principal (Task 5).
- A `ConfigSource` handing the same object to two people, or mutating it after a session started: sessions keep their own validated copy and their own guards (Task 4).
- `maxSessions + 1` concurrent `initialize` requests, and a failed initialize (ConfigSource throws): exactly the overflow gets 503 and the reserved slot is released (Task 5).
- `allowTools: ["write"]` or `["payload"]` on a read-only or payload-less tenant: no tool becomes visible; `allowTools` as a string at runtime: only the tenant tools remain (Task 6).

---

## File map

| File | Responsibility |
|---|---|
| `src/core/extension-points.ts` (new) | `Principal`, `ConfigSource`, `TokenProvider`, `Authenticator`, `ServerOptions`, `LOCAL_PRINCIPAL`, `assertPrincipal` |
| `src/core/config-source.ts` (new) | `createFileConfigSource` (default `ConfigSource`) |
| `src/core/config.ts` | `validateTenantConfig`, `NoTenantsError`, `auth` passthrough, `allowTools` |
| `src/core/csrf-cache.ts` (new) | shared CSRF cache with unambiguous keys |
| `src/core/auth.ts` | default `TokenProvider`, key = token endpoint + client id |
| `src/core/odata-client.ts` | takes `TokenProvider`, principal, shared `CsrfTokenCache` |
| `src/core/session-factory.ts` (new) | `createSessionFactory`, `Session` |
| `src/http/node-bridge.ts`, `session-registry.ts`, `server.ts` (new) | Node to Web bridge, session bookkeeping, `startHttpServer` |
| `src/lib.ts` (new) | side-effect-free library entry |
| `src/__tests__/helpers/mcp-client.ts` (new) | in-memory JSON-RPC client helper for tests |
| `src/__tests__/fixtures/tenants.fixture.jsonc` (new) | fake tenants for CLI and config tests |

---

### Task 1: Library entry, extension-point types, defaults (no behaviour change)

**Files:**
- Create: `src/core/extension-points.ts`, `src/core/config-source.ts`, `src/lib.ts`, `src/__tests__/fixtures/tenants.fixture.jsonc`
- Modify: `src/core/auth.ts`, `src/core/odata-client.ts` (constructor type only), `src/core/types.ts`, `src/server.ts`, `package.json`, `.gitignore` (add `config/*.swp`)
- Test: `src/core/__tests__/extension-points.test.ts`, `src/core/__tests__/config-source.test.ts`, `src/__tests__/lib.test.ts`, `src/__tests__/cli.test.ts`

**Interfaces:**
- Produces (`extension-points.ts`): `interface Principal { subject: string; roles: string[]; claims: Record<string, unknown> }`; `interface ConfigSource { resolve(principal: Principal): Promise<TenantConfig> }`; `interface TokenProvider { getToken(tenant: Tenant, principal: Principal): Promise<string> }`; `interface Authenticator { authenticate(request: Request): Promise<Principal> }`; `interface ServerOptions { configSource: ConfigSource; tokenProvider?: TokenProvider }`; `const LOCAL_PRINCIPAL: Principal` (deeply frozen, subject `"local"`, no roles, no claims); `function assertPrincipal(value: unknown): Principal` (throws unless subject is a non-empty string, roles a string list, claims a plain object; returns a copy).
- Produces (`config-source.ts`): `function createFileConfigSource(options?: { path?: string }): ConfigSource`. Reads and parses at `resolve` time through `parseTenantConfig`; without `path` it uses `resolveConfigPath` (env `MCP_CI_CONFIG`, checkout, XDG) exactly like `loadTenantConfig`.
- Produces (`types.ts`): `Tenant.auth?: Record<string, unknown>` (opaque block for a downstream `TokenProvider`, filled in Task 2); `ModuleContext.principal?: Principal` (optional because existing tests build contexts by hand).
- Produces (`server.ts`): `buildServer(config, options?: { odataClient?: ODataClient; tokenProvider?: TokenProvider; principal?: Principal })`, returning `{ server, tenantManager, odataClient }`. `principal` defaults to `LOCAL_PRINCIPAL` and is put into `ModuleContext`. Without `odataClient`, it creates `new ODataClient(options.tokenProvider ?? new Auth(), tenantManager)`.
- Produces (`lib.ts`): named exports `buildServer`, `LOCAL_PRINCIPAL`, `assertPrincipal`, `createFileConfigSource`, `parseTenantConfig`, `loadTenantConfig`, `Auth as ClientCredentialsTokenProvider`, `ODataClient`, `TenantManager`, and the types above plus `Tenant`, `TenantConfig`, `TenantSettings`, `Module`, `ModuleContext`. Later tasks append to this list. No top-level side effects.

- [ ] **Step 1: Branch hygiene.** Confirm `git branch --show-current` is `feat/extension-points`; add `config/*.swp` to `.gitignore`; commit the spec and this plan: `git add docs/superpowers/specs/2026-11-09-extension-points-remote-design.md docs/superpowers/plans/2026-11-09-extension-points-remote.md .gitignore && git commit -m "docs: add extension points spec and plan"`.
- [ ] **Step 2: Write the failing tests.**
  - `lib.test.ts`: `import * as lib from "../lib.js"`; `expect(Object.keys(lib).sort()).toEqual([...])` with the exact export list above (catches accidental exports); a child-process test that runs `process.execPath --import tsx -e "await import('./src/lib.ts')"` with `MCP_CI_CONFIG` pointing at a non-existent file and a 10 s timeout, expecting exit code 0, empty stderr and no stdout (nothing started, no config read); `package.json` has `main === "dist/lib.js"`, `exports["."].default === "./dist/lib.js"`, `bin["mcp-ci"] === "dist/index.js"`, and `mcpServer` unchanged.
  - `cli.test.ts` (anti-goal: local users change nothing): spawn `process.execPath --import tsx src/index.ts` with `MCP_CI_CONFIG=src/__tests__/fixtures/tenants.fixture.jsonc`, send an `initialize` JSON-RPC line then `tools/list` on stdin, expect an `mcp-ci` `serverInfo`, a non-empty tool list without write tools (fixture default tenant is read-only) and stderr containing `mcp-ci server running on stdio (tenant: fixture, read-only)`. Also `parseTenantConfig` of the fixture and of `config/tenants.example.jsonc` (tracked, fake values) still succeed unchanged; if the example has no enabled tenant, drop that one assertion.
  - `extension-points.test.ts`: `LOCAL_PRINCIPAL` is frozen and has subject `"local"`; `assertPrincipal` rejects `undefined`, `null`, `{}`, `{ subject: "" }`, `{ subject: "a", roles: "admin", claims: {} }`, `{ subject: "a", roles: [1], claims: {} }`, `{ subject: "a", roles: [], claims: [] }`; accepts a valid one and returns a copy (`not.toBe`).
  - `config-source.test.ts`: with a temp file under `os.tmpdir()` containing the fixture text, `createFileConfigSource({ path }).resolve(LOCAL_PRINCIPAL)` equals `parseTenantConfig(text)`; a missing path rejects; with no `path` and `MCP_CI_CONFIG` set (restore env in `afterEach`) it uses the env path; invalid content rejects with the same message `parseTenantConfig` gives (fail closed).
  - Fixture `tenants.fixture.jsonc`: one tenant `fixture` (`"enabled": true`, name `FIXTURE`, `https://fixture.example.com`, fake client id and secret, no `settings`), `defaultTenant: "fixture"`.
- [ ] **Step 3: Run them to see them fail.** `npx vitest run src/__tests__/lib.test.ts src/__tests__/cli.test.ts src/core/__tests__/extension-points.test.ts src/core/__tests__/config-source.test.ts` → FAIL (modules missing).
- [ ] **Step 4: Implement** the files and signatures above. `Auth` gets `implements TokenProvider` and keeps `getToken(tenant: Tenant)` (fewer parameters is assignable; existing `auth.test.ts` stays untouched). `ODataClient`'s first constructor parameter becomes type `TokenProvider` and it calls `getToken(tenant, LOCAL_PRINCIPAL)` for now (Task 3 swaps in the real principal). Update `package.json`: `"main": "dist/lib.js"`, `"types": "dist/lib.d.ts"`, `"exports": { ".": { "types": "./dist/lib.d.ts", "default": "./dist/lib.js" }, "./package.json": "./package.json" }`. `src/index.ts` stays as is.
- [ ] **Step 5: Verify.** `npm run typecheck && npm test` → clean, all existing tests plus the new ones pass.
- [ ] **Step 6: Commit.** `git add src package.json .gitignore && git commit -m "feat: add side-effect-free library entry and extension-point types"`.

---

### Task 2: Validation for every ConfigSource

**Files:**
- Modify: `src/core/config.ts`, `src/core/types.ts` (`TenantSettings`), `src/server.ts`, `src/core/config-source.ts`
- Test: `src/core/__tests__/config-validation.test.ts`, extend `src/__tests__/server.test.ts` only by adding a new `describe`

**Interfaces:**
- Consumes: `ConfigSource`, `Principal` from Task 1.
- Produces: `class NoTenantsError extends Error` (exported from `config.ts` and `lib.ts`); `function validateTenantConfig(config: unknown, source?: string): TenantConfig` returning a fresh deep copy where every tenant went through the existing `normalizeTenant` rules (`readOnly` true unless exactly `false`, `allowPayloads` true only if exactly `true`, `denyTools` a list of known tool names, unknown setting keys rejected). It throws `NoTenantsError` for an empty `tenants` object, a plain `Error` for a missing or unknown `defaultTenant`, a non-object tenant, or the tenant key `__proto__`. `normalizeTenant` copies an optional `auth` block (must be a plain object, else `Tenant 'x': 'auth' must be an object`) onto `Tenant.auth` via `structuredClone`. `parseTenantConfig` reuses the same final checks and throws `NoTenantsError` for "no enabled tenant" (message unchanged). `buildServer` calls `validateTenantConfig(config, "server config")` first and uses the result.

- [ ] **Step 1: Write the failing tests** in `config-validation.test.ts` (inline objects, fake values):
  - `readOnly: "false"` (cast) → resulting `settings.readOnly === true`; same for `readOnly: 0`, `"no"`; `allowPayloads: "true"` → `false`.
  - `denyTools: "create_package"` (string) throws `'denyTools' must be a list of tool names`; `denyTools: ["no_such_tool"]` throws `unknown tool 'no_such_tool'`; `settings: { allowtools: [] }` throws unknown setting.
  - `{ tenants: {}, defaultTenant: "x" }` rejects with `NoTenantsError`; unknown `defaultTenant` rejects; `defaultTenant: "toString"` rejects; tenant key `__proto__` (create with `JSON.parse('{"tenants":{"__proto__":{...}}}')`) rejects.
  - Copy semantics: result `not.toBe` input, `result.tenants.a` `not.toBe` `input.tenants.a`, mutating the input afterwards leaves the result unchanged; `auth: { method: "x", ref: "r" }` passes through as a copy; `auth: "x"` rejects.
  - Error messages never contain the `clientSecret` value (anti-goal: secrets), checked for a missing-field and an unknown-tool error.
  - `parseTenantConfig` of a text without enabled tenant rejects with `instanceof NoTenantsError` and the old message.
  - In `server.test.ts` (new `describe("buildServer config validation")`): `buildServer` with `denyTools: ["no_such_tool"]` throws; with `readOnly: "false"` cast, the tool list contains no write tool (fails closed).
  - A custom `ConfigSource` returning the invalid objects above, run through `createFileConfigSource`-independent path: `validateTenantConfig(await source.resolve(p))` throws, i.e. a downstream source cannot skip the rules because `buildServer` re-checks (covered by the `buildServer` tests; Task 4 repeats it through the session factory).
- [ ] **Step 2: Run** `npx vitest run src/core/__tests__/config-validation.test.ts` → FAIL.
- [ ] **Step 3: Implement** `validateTenantConfig`, `NoTenantsError`, `auth` passthrough and the `buildServer` call; refactor `parseTenantConfig` to share the final "at least one tenant, valid default" checks. `Tenant.auth` is documented as "opaque; the core never reads it".
- [ ] **Step 4: Verify.** `npm run typecheck && npm test` → clean. If an existing test fails because it passed a config the validator now rejects, fix the fixture only when the config was invalid by the repo's own rules; otherwise adjust the validator.
- [ ] **Step 5: Commit.** `git add src && git commit -m "feat: validate every tenant config, not only the file source"`.

---

### Task 3: Unambiguous cache keys, principal plumbing, ADR 0005

**Files:**
- Create: `src/core/csrf-cache.ts`, `docs/adr/0005-extension-points.md`
- Modify: `src/core/auth.ts`, `src/core/odata-client.ts`, `src/server.ts`, `src/lib.ts`, `docs/adr/README.md`
- Test: `src/core/__tests__/csrf-cache.test.ts`, extend `auth.test.ts` and `odata-client.test.ts` with new `it` blocks only

**Interfaces:**
- Produces: `class CsrfTokenCache { constructor(now?: () => number); get(key: string): string | undefined; set(key: string, token: string): void; delete(key: string): void; static keyFor(tenant: Tenant, principal: Principal): string }`. TTL 30 minutes as today. `keyFor` is `JSON.stringify([tenant.apiUrl, tenant.clientId, principal.subject])`. `Auth` cache key is `JSON.stringify([tenant.oauthUrl, tenant.clientId])`. `new ODataClient(tokenProvider: TokenProvider, tenantManager: TenantManager, options?: { principal?: Principal; csrfCache?: CsrfTokenCache })`; defaults `LOCAL_PRINCIPAL` and a private cache; every `getToken` call passes the principal. `buildServer` options gain `csrfCache?: CsrfTokenCache` and pass `principal` and `csrfCache` to the `ODataClient` it creates. `lib.ts` also exports `CsrfTokenCache`.

- [ ] **Step 1: Write the failing tests.**
  - `auth.test.ts` (new): two tenants with the same `clientId` and different `oauthUrl` → two token fetches and each gets its own token; same `oauthUrl` and `clientId` → one fetch.
  - `csrf-cache.test.ts`: `keyFor` differs when only `apiUrl`, only `clientId` or only `subject` differs; `keyFor({apiUrl:"a|b",clientId:"c"}, p)` ≠ `keyFor({apiUrl:"a",clientId:"b|c"}, p)`; entry expires after 30 minutes with an injected clock; `delete` removes.
  - `odata-client.test.ts` (new): with a spied `getToken` and mocked `fetch`, two tenants sharing a `clientId` but with different `apiUrl` each trigger their own `X-CSRF-Token: Fetch` request on `post` (two CSRF fetches, each against its own URL); two `ODataClient`s sharing one `CsrfTokenCache` with different principal subjects on the same tenant fetch two CSRF tokens, same subject fetches one; `getToken` is called with `(tenant, principal)` for that client's principal.
- [ ] **Step 2: Run** `npx vitest run src/core/__tests__/csrf-cache.test.ts src/core/__tests__/auth.test.ts src/core/__tests__/odata-client.test.ts` → new tests FAIL.
- [ ] **Step 3: Implement** the signatures above. Replace the `csrfTokens` map and its three `delete(tenant.clientId)` call sites with the shared cache and `keyFor`.
- [ ] **Step 4: Write ADR 0005** (`Extension points: ConfigSource, TokenProvider, Authenticator, Principal`) from the template: context (downstream distribution, stays generic), decision (the four interfaces, `Principal` carries no raw credential and an opaque credential field can be added later, every `ConfigSource` result is validated by `buildServer`, `Tenant.auth` is an opaque passthrough, `clientId`/`clientSecret` stay required, cache key fix, library entry via `exports` while `bin` stays the CLI), consequences (a downstream tenant using another method still has to fill `clientId`/`clientSecret`; revisit when token exchange is built). Add the row to `docs/adr/README.md`. Status `Proposed`, date 2026-11-09.
- [ ] **Step 5: Verify.** `npm run typecheck && npm test` → clean.
- [ ] **Step 6: Commit.** `git add src docs/adr && git commit -m "fix: make token and CSRF cache keys unambiguous and pass the principal through"`.

---

### Task 4: Session factory and isolation tests, ADR 0006

**Files:**
- Create: `src/core/session-factory.ts`, `src/__tests__/helpers/mcp-client.ts`, `docs/adr/0006-tenant-state-per-session.md`
- Modify: `src/lib.ts`, `docs/adr/README.md`
- Test: `src/core/__tests__/session-factory.test.ts`

**Interfaces:**
- Consumes: `ServerOptions`, `buildServer` (returns `odataClient`), `CsrfTokenCache`, `Auth`.
- Produces: `interface Session { server: McpServer; tenantManager: TenantManager; odataClient: ODataClient; principal: Principal }`; `interface SessionFactory { createSession(principal: Principal): Promise<Session> }`; `function createSessionFactory(options: ServerOptions): SessionFactory`. One `TokenProvider` (`options.tokenProvider ?? new Auth()`) and one `CsrfTokenCache` are created per factory and shared; `createSession` calls `options.configSource.resolve(principal)` and `buildServer(config, { tokenProvider, csrfCache, principal })`. Errors from `resolve` or validation propagate unchanged (the HTTP layer classifies them). Test helper: `connectClient(server: McpServer): Promise<{ request(method: string, params?: object): Promise<any>; toolNames(): Promise<string[]>; callTool(name: string, args?: object): Promise<any>; close(): Promise<void> }>` using `InMemoryTransport`, same wire logic as `server.test.ts`.

- [ ] **Step 1: Write the failing tests** (fake `TokenProvider` returning `"t"`; outbound HTTP via `vi.spyOn(globalThis, "fetch")`; each tenant has its own `apiUrl` host so calls are attributable):
  - Independence: person A resolves `{ a_rw (readOnly false), a_ro }` default `a_ro`; person B resolves `{ b_ro }`. A `set_tenant a_rw` → A's `toolNames()` gains `create_package`; B's `toolNames()` and `get_tenant` text are unchanged; B's `set_tenant a_rw` returns an error and B stays on `b_ro`. Tool list is compared before and after for both.
  - Same tenant key in both configs (`shared`, one default read-only for B and writable for A): A switching does not change B's active key, tools or guard.
  - Running call: A is on writable `rw` (apiUrl `https://rw.example.com`); the fake `TokenProvider.getToken` for A's call is held on a deferred promise; A calls `create_package`; while it is pending B (same config shape) runs `set_tenant ro`; resolve the deferred; A's fetch calls all target `https://rw.example.com` and A's `tenantManager.getActiveTenantKey()` is still `rw`. Mirror: A on read-only `ro` has `list_packages` pending, B switches to a writable tenant, A's session still reports `ro` and a subsequent `create_package` from A is refused with zero fetch calls.
  - Config object shared: the same `TenantConfig` object returned for two principals gives two sessions whose active tenant objects are `not.toBe` each other; flipping `settings.readOnly = false` on the source object after `createSession` leaves the session read-only (tool list and `odataClient.post` unchanged).
  - Read-only through the factory, each layer, on a `readOnly: true, allowPayloads: false` tenant: (1) `toolNames()` has no write and no payload tool; (2) `callTool("create_package", …)` and `callTool("download_log_file", …)` are refused (`isError` or JSON-RPC error) with `fetch` never called; (3) `session.odataClient.post("/x", {})`, `put` and `delete` reject with `read-only` and make no `fetch` or `getToken` call.
  - `ConfigSource.resolve` receives exactly the principal passed in; the fake `TokenProvider` records `getToken(tenant, principal)` per session and sees each session's own principal; two sessions share one token provider instance and one `CsrfTokenCache` (assert with a counting provider and a shared-cache CSRF fetch count for the same tenant and subject).
  - A `ConfigSource` returning `denyTools: "create_package"`, `denyTools: ["no_such_tool"]`, `readOnly: "false"` or zero tenants: `createSession` rejects (or yields a read-only session for the string case), same as the file source; zero tenants rejects with `NoTenantsError`.
- [ ] **Step 2: Run** `npx vitest run src/core/__tests__/session-factory.test.ts` → FAIL (module missing).
- [ ] **Step 3: Implement** `createSessionFactory` and the helper. No new module-level state anywhere (grep confirmed there is none today).
- [ ] **Step 4: Write ADR 0006** (`Tenant state is per session`): active tenant, tool visibility and guards live in a per-session `TenantManager`/`ToolAccess`/`ODataClient`; shared are only the token provider and the CSRF cache (keys include token endpoint/client id and API URL/client id/subject); the pinned-tenant `AsyncLocalStorage` and both guard layers from ADR 0001 are unchanged; consequence: sessions live in memory, so one instance or sticky routing. Add to the README index.
- [ ] **Step 5: Verify.** `npm run typecheck && npm test` → clean.
- [ ] **Step 6: Commit.** `git add src docs/adr && git commit -m "feat: add per-session server factory with isolated tenant state"`.

---

### Task 5: HTTP start function with required Authenticator, ADR 0007

**Files:**
- Create: `src/http/node-bridge.ts`, `src/http/session-registry.ts`, `src/http/server.ts`, `docs/adr/0007-remote-operation-requires-authentication.md`
- Modify: `src/lib.ts`, `docs/adr/README.md`
- Test: `src/http/__tests__/session-registry.test.ts`, `src/http/__tests__/server.test.ts`

**Interfaces:**
- Consumes: `SessionFactory`/`createSessionFactory`, `Authenticator`, `assertPrincipal`, `NoTenantsError`, `WebStandardStreamableHTTPServerTransport` and `isInitializeRequest` from `@modelcontextprotocol/server`.
- Produces: `interface HttpServerOptions extends ServerOptions { authenticator: Authenticator; host?: string /* "127.0.0.1" */; port?: number /* 3000, 0 = ephemeral */; path?: string /* "/mcp" */; maxSessions?: number /* 100 */; idleTimeoutMs?: number /* 1_800_000 */ }`; `interface RunningHttpServer { url: string; port: number; sessionCount(): number; close(): Promise<void> }`; `function startHttpServer(options: HttpServerOptions): Promise<RunningHttpServer>` rejects before binding any port when `options.authenticator?.authenticate` is not a function. `SessionRegistry` (`reserve(): boolean`, `release(): void`, `add(entry)`, `get(id)`, `remove(id)`, `size`, `touch`/open-request counting, `sweep(now: number, idleTimeoutMs: number): Entry[]` returning idle entries with no open request) so the idle logic is unit-testable with an injected clock. `lib.ts` also exports `createSessionFactory`, `startHttpServer`, and the types.
- The `Authenticator` receives a body-less `Request` (method, full URL, headers). The core never forwards `authInfo` to the transport, so the credential stays out of tool contexts.

Response contract (generic JSON-RPC error bodies, never the underlying error text):

| Situation | Status | Session created |
|---|---|---|
| path other than `path` | 404 | no |
| `authenticate` throws, or returns something `assertPrincipal` rejects | 401 + `WWW-Authenticate: Bearer` | no, `resolve` not called |
| `Mcp-Session-Id` unknown | 404 | no |
| `Mcp-Session-Id` known, subject differs from the creator's (every request, incl. `GET`, `DELETE`) | 403, session untouched | no |
| no session id, not a `POST` / body over 4 MiB / not JSON / not `initialize` | 405 / 413 / 400 / 400 | no |
| `maxSessions` reached (open + pending) | 503 | no |
| `NoTenantsError` from the session factory | 403 | no |
| any other error from `ConfigSource` or validation | 503, no details | no |
| otherwise | transport response (200, `Mcp-Session-Id`) | yes, bound to `principal.subject` |

- [ ] **Step 1: Check the SDK docs again before coding** (Context7 `/modelcontextprotocol/typescript-sdk/v2.4.0`: `WebStandardStreamableHTTPServerTransport` options `sessionIdGenerator`, `onsessioninitialized`, `handleRequest(req, { parsedBody })`) and note any signature that differs from this plan in the commit message.
- [ ] **Step 2: Write the failing tests.**
  - `session-registry.test.ts`: `reserve` stops at the limit, `release` frees; `sweep` returns only entries idle longer than the timeout with zero open requests; an entry with an open request is never swept.
  - `server.test.ts` (real loopback server on port 0, real `fetch` with `Accept: application/json, text/event-stream`, helper that parses the SSE `data:` line; authenticator maps `Authorization: Bearer <name>` to principals; `ConfigSource` returns per-subject tenants; fake `TokenProvider`; every test closes the server):
    - `startHttpServer` rejects for no authenticator, `undefined`, `{}` and `{ authenticate: "x" }`, and nothing is listening afterwards.
    - 401 and `sessionCount() === 0`, `ConfigSource.resolve` not called, for: authenticator throws; returns `undefined`; returns `{ subject: "", roles: [], claims: {} }`; returns roles that are not a list; no `Authorization` header. Response body contains no part of the thrown error's message.
    - Valid principal: `initialize` → 200 with `mcp-session-id`; `tools/list` for the read-only person has no write tool, for the writable person has `create_package`; `get_tenant` lists only that person's tenants; A's `set_tenant` does not change B's `get_tenant` (HTTP-level isolation).
    - Each request on an existing session re-runs the authenticator (counting authenticator); a request with the right session id from another subject gets 403 for `POST`, `GET` and `DELETE`, and the owner can still use the session afterwards.
    - Zero tenants → 403 and no session; `ConfigSource` throwing `new Error("secret-xyz")` → 503, body without `secret-xyz`, no session; a `ConfigSource` returning `denyTools: ["no_such_tool"]` → 503.
    - Unknown session id → 404; non-initialize without session id → 400; second `initialize` request body on a valid session id is not a way to get a new session.
    - `maxSessions: 2`: third `initialize` → 503; after `DELETE` of one the next works; five concurrent `initialize` with `maxSessions: 2` give exactly two 200 and three 503; after a `ConfigSource` failure the slot is free again.
    - Default `url` starts with `http://127.0.0.1:`.
    - Logging: capture `console.error`/`console.log` during a full session; the output contains neither the bearer token nor a marker string placed in `principal.claims`.
- [ ] **Step 3: Run** `npx vitest run src/http` → FAIL.
- [ ] **Step 4: Implement.** `node-bridge.ts`: `toWebRequest(req: IncomingMessage, origin: string, body?: string): Request` (no body for authentication) and `sendWebResponse(res: ServerResponse, response: Response): Promise<void>` that streams the body and cancels the reader when the socket closes. `server.ts` flow: path check, authenticate, `assertPrincipal`, then session routing per the table; new sessions read the body itself (cap 4 MiB), check `isInitializeRequest`, `registry.reserve()`, `factory.createSession(principal)` in a `try/finally` that releases the slot on any failure, create the transport with `sessionIdGenerator: randomUUID` and `onsessioninitialized` registering `{ subject, server, transport }`, `server.connect(transport)`, `transport.handleRequest(request, { parsedBody })`. Count open responses per session through `res.on("close")` so a live SSE stream is not idle. `setInterval(..., Math.min(idleTimeoutMs / 2, 60_000)).unref()` closes swept sessions (`server.close()`); `close()` stops the timer, closes all sessions, then the HTTP server and its connections. Startup log line prints only the URL.
- [ ] **Step 5: Write ADR 0007** (`Remote operation requires authentication`): `startHttpServer` requires an `Authenticator`; 401 before any session; sessions bound to subject and re-authenticated each request; no built-in authenticator and no anonymous fallback; CLI stays stdio-only; `createMcpHandler`/`requireBearerAuth` not used because the former is stateless and the latter only verifies a bearer token (a downstream `Authenticator` may call `verifyBearerToken` itself); web-standard transport chosen over `@modelcontextprotocol/node` (no 2.4.0 release, extra `hono` dependency); sessions in memory, sticky routing; no TLS termination and no Host/Origin checks in the core (loopback default, deployment puts a proxy in front). README index row.
- [ ] **Step 6: Verify.** `npm run typecheck && npm test` → clean.
- [ ] **Step 7: Commit.** `git add src docs/adr && git commit -m "feat: add authenticated Streamable HTTP server with per-person sessions"`.

---

### Task 6: Per-tenant tool allow-list, ADR 0008

**Files:**
- Create: `docs/adr/0008-tenant-tool-allow-list.md`
- Modify: `src/core/types.ts`, `src/core/config.ts`, `src/core/tenant-manager.ts`, `src/core/tool-access.ts`, `config/tenants.example.jsonc` (one commented example), `docs/adr/README.md`
- Test: `src/core/__tests__/allow-list.test.ts`, extend `tool-access.test.ts` with new `it` blocks only

**Interfaces:**
- Produces: `TenantSettings.allowTools?: string[]` (entries are tool names from `TOOL_CLASSES` or the class names `"read"`, `"payload"`, `"write"`); `TenantManager.getAllowTools(): string[] | undefined` (`undefined` only when the setting is absent; a present but non-array value returns `[]`, i.e. fail closed); `ToolAccess.isAllowed(name)` additionally requires, when an allow-list exists, that the tool name or its class (`classifyTool(name) ?? "write"`) is listed or the tool is `get_tenant` or `set_tenant`; `denyTools` is checked first and always wins; the allow-list can only narrow the existing `readOnly` / `allowPayloads` result. `normalizeTenant` validates it (array of strings, every entry a known tool or class name; otherwise `Tenant 'x': 'allowTools' must be a list of tool or class names` / `unknown tool 'x' in allowTools`), copies it, and omits the key when absent.

- [ ] **Step 1: Write the failing tests** in `allow-list.test.ts` (through `buildServer` + `connectClient` for visibility and call-time refusal):
  - Missing → tool list identical to today's for read-only and for writable tenants.
  - `[]` → only `get_tenant` and `set_tenant` listed; calling `get_package` is refused with no `fetch`.
  - `["read"]` on a writable tenant → exactly the `read`-class tools plus the two tenant tools; `["get_package"]` → `get_package` + tenant tools; `["read", "create_package"]` on a writable tenant → read tools + `create_package`.
  - Deny wins: `allowTools: ["read"]`, `denyTools: ["get_package"]` → `get_package` absent and refused.
  - Never widens: `["write"]` on a read-only tenant and `["payload"]` with `allowPayloads: false` expose nothing beyond the tenant tools; same through `set_tenant` switching from a writable to a read-only tenant in one session.
  - Config errors: `["get_pakage"]`, `"read"` (string), `5`, `null`, `{}`, `[1]`, `["Read"]` all throw; `settings: { allowtools: [] }` throws unknown setting. Runtime fail-closed: a `TenantManager` built by bypassing validation with `allowTools: "read"` yields `getAllowTools()` equal to `[]` and only tenant tools allowed.
  - `validateTenantConfig` output copies the list (`not.toBe`) and keeps `[]` as `[]`.
- [ ] **Step 2: Run** `npx vitest run src/core/__tests__/allow-list.test.ts` → FAIL.
- [ ] **Step 3: Implement** per the interfaces above; add `"allowTools"` to `SETTINGS_KEYS`; update the `isToolDenied` doc comment in `tenant-manager.ts` if it mentions the list of settings.
- [ ] **Step 4: Write ADR 0008** (`Per-tenant tool allow-list`): semantics as in spec goal 7, name `allowTools`, class names accepted, only narrows, exemption for `get_tenant`/`set_tenant`, fail closed on wrong type, no schema-budget impact. README index row.
- [ ] **Step 5: Verify.** `npm run typecheck && npm test && npm run schema-budget` → clean and the budget line is still `writable: 230/232 tools, 119141/122000 chars`.
- [ ] **Step 6: Commit.** `git add src config/tenants.example.jsonc docs/adr && git commit -m "feat: add per-tenant tool allow-list"`.

---

### Task 7: Documentation and final verification

**Files:**
- Modify: `README.md` (settings table: `allowTools`; new sections "Use as a library" and "Remote operation", stating sessions are in memory so run one instance or use sticky sessions, and that the CLI stays stdio only), `SECURITY.md` only if it lists settings or transports
- No new tests.

- [ ] **Step 1: Write the docs.** Keep local setup text untouched. The remote section shows a minimal `startHttpServer({ configSource, authenticator })` snippet and states that no authenticator ships with the package.
- [ ] **Step 2: Full verification, show the output of each:** `npm run typecheck && npm test`; `npm run schema-budget` (expect unchanged `230/232`, `119141/122000`); `npm run coverage` (expect the baseline "No SAP API specs found", exit 1, unless the specs were supplied; report it as not verifiable); `npm run test:eval` (expect 15/15).
- [ ] **Step 3: Package check.** `npm run build`, then from the repo root `node -e "import('mcp-ci').then(m => console.log(Object.keys(m).sort().join(',')))"` prints the library exports and starts nothing; `node dist/index.js` with `MCP_CI_CONFIG=src/__tests__/fixtures/tenants.fixture.jsonc` still starts on stdio (close stdin).
- [ ] **Step 4: Hygiene check.** `git diff --stat main...HEAD`; `git ls-files | grep -E 'tenants\.jsonc$|\.swp$'` prints nothing; `git status --short` shows no untracked credential files.
- [ ] **Step 5: Commit.** `git add README.md SECURITY.md docs && git commit -m "docs: document library use and remote operation"` (omit `SECURITY.md` if unchanged).
- [ ] **Step 6: Review.** Run `superpowers:requesting-code-review` over `main...HEAD` and fix findings before reporting; report which spec "Tests that must exist" item maps to which test file.

---

## Self-review

- **Spec coverage:** goal 1 → Task 1; 2 → Tasks 1, 2; 3 → Tasks 1, 3; 4 → Tasks 1, 3 (no credential in `Principal`, `authInfo` not forwarded in Task 5); 5 → Tasks 3, 4; 6 → Task 5; 7 → Task 6. Decisions: sessionful HTTP, 401/403/503, subject binding → Task 5; caches → Task 3. ADRs 1 to 4 → 0005 to 0008 in Tasks 3, 4, 5, 6. Each item of "Tests that must exist" has a task above; "library entry imports without starting anything" is the child-process test in Task 1.
- **Names:** `createFileConfigSource`, `validateTenantConfig`, `NoTenantsError`, `CsrfTokenCache`, `createSessionFactory`, `Session`, `startHttpServer`, `allowTools`, `getAllowTools` are used identically in every task that mentions them.
- **Open points to raise with the user, not decided here:** `clientId`/`clientSecret` stay required even for downstream methods that do not use them (ADR 0005); `coverage` cannot run without the SAP specs; the HTTP server does no TLS and no Host/Origin checks.
