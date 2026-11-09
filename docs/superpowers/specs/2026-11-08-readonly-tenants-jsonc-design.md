# Read-only and enable/disable tenants, JSONC config

## Intent

An autonomous agent will later exercise this MCP server against a real SAP Cloud Integration
tenant to find rough edges. That agent may read from the tenant and must never write to it.
A prompt instruction is not enough: the server exposes many write tools (`create_*`, `update_*`, `delete_*`, `deploy_*`, `undeploy_*`, `activate_*`, `import_*`, and others), so the
guarantee has to be enforced by the server itself.

This change is the prerequisite for that loop. The loop itself (tester agent, improver agent,
scenarios, logs) is out of scope here and will not live in this repository.

## Goals

1. A per-tenant setting `settings.readOnly`. When true, nothing can modify that tenant through
   this server.
2. A per-tenant flag `enabled`. Disabled tenants are not loaded, not listed, and cannot be
   selected.
3. The config file accepts comments (JSONC) so every option can be documented in place.
4. Tests that prove the read-only guarantee for every tool, and fail when a new tool is added
   without being classified.

## Non-goals

- The tester/improver loop, scenarios, protocol logs, scheduling.
- Keeping `clientSecret` out of the agent's reach on disk. Noted as a follow-up for the loop setup.
- Per-tool or per-module permission lists beyond read vs. write.

## Anti-goals (failure even if tests pass)

- Any path where a write request reaches a `readOnly` tenant, including retry paths and
  tools that are mis-classified as read-only.
- A disabled tenant showing up in `get_tenant`, `set_tenant` messages or tool descriptions.
- A config typo silently disabling the safety (for example `readonly` or `"readOnly": "true"`
  being treated as false).

## Decisions made by the user

- Format is **JSONC** (not JSON5).
- `readOnly` lives in a `settings` object on the tenant entry, next to a tenant-level `enabled`.
- Two layers: (1) write tools are not offered when the active tenant is read-only, (2) a hard
  guard in `ODataClient` rejects every non-GET request for a read-only tenant. Both are wanted;
  layer 2 is the actual guarantee.
- Tests for the guarantee are essential.
- Opus 5.5 implements this.

## Design

### Config

Default file `config/tenants.jsonc`. Example shape:

```jsonc
{
  "tenants": {
    "prod": {
      "name": "PROD",
      "enabled": true,
      "settings": { "readOnly": true },
      "apiUrl": "...", "oauthUrl": "...", "clientId": "...", "clientSecret": "..."
    }
  },
  "defaultTenant": "prod"
}
```

- A tenant is enabled **only** if `enabled` is exactly the boolean `true`. Anything else is off:
  missing, `false`, the string `"true"`, `1`, a typo in the key. No error, the entry is simply
  dropped (fail closed). Existing configs without the field therefore need `"enabled": true`
  added; README and example file say so.
- `settings.readOnly` is fail closed too (decided by the user): a tenant is writable only with
  exactly `"readOnly": false`. Anything else, including a missing key or a missing `settings`
  object, means read-only, without an error. Unknown keys inside `settings` of an enabled tenant
  are still a startup error, so a typo like `readonly` is reported instead of silently leaving the
  tenant read-only.
- Disabled tenants are dropped at load, without further validation.
- `defaultTenant` must refer to an enabled tenant, otherwise startup fails with a clear message. At least one enabled tenant is required.
- `config/tenants.example.jsonc` replaces the example file and documents every field in comments.
  `.gitignore`, README and any docs are updated.

### Layer 2: guard in ODataClient (the guarantee)

`post`, `put` and `delete` are the only mutating paths and `fetch` is called nowhere else except
the OAuth token request in `auth.ts`. Each of them checks the active tenant's `readOnly` before any
network call (before the CSRF fetch and the retry-on-403 path) and throws a clear error. The check
reads the tenant at call time, not at construction, so a tenant switch cannot bypass it.

Some `post` calls may be reads in disguise (for example action-style or query-style endpoints).
The builder audits all `post` call sites; any that are genuinely read-only get an explicit,
named read-only variant instead of weakening the guard.

### Layer 1: hiding write tools

Every tool is classified as read or write. Use the MCP annotation `readOnlyHint` where the SDK
supports it, plus whatever internal registry the builder needs. When the active tenant is
read-only, write tools are not callable and not listed. Tenant switching at runtime means the set
of exposed tools may need to change after `set_tenant` (the SDK's enable/disable with a
list-changed notification is the likely mechanism; the builder confirms against current SDK docs).
If dynamic hiding is not feasible, tools stay registered and layer 2 plus a clear error carries
the guarantee; that must be stated in the code and README.

### Tenant switching

`set_tenant` and `get_tenant` only see enabled tenants. No additional session lock: isolation for
the agent comes from running it with its own config that enables only the tenant under test.

### Config path

An environment variable (name chosen by the builder, e.g. `MCP_CI_CONFIG`) overrides the config
path, so the agent can run against a separate config. Default stays `config/tenants.jsonc`.

## Tests (essential)

- Config: JSONC with comments and trailing commas parses; defaults; type errors; unknown
  `settings` keys; `enabled` missing, `false`, `"true"`, `1` all count as disabled and only
  `true` enables; disabled tenants removed without validation; invalid default tenant; no enabled
  tenant.
- `execute_guidelines` works on a read-only tenant; every other write path stays blocked.
- `ODataClient`: with a read-only tenant, `post`, `put`, `delete` throw and `fetch` is never called
  (including the 403 retry path); `getCollection`, `getEntity`, `getValue` still work.
- Tool coverage: iterate every registered tool; each must have a read/write classification (a new
  unclassified tool fails the test). For every write-classified tool, calling it against a
  read-only tenant yields an error result and no HTTP request. For read-classified tools, no
  mutating request is ever issued.
- `set_tenant`/`get_tenant` never expose disabled tenants.
- Existing tests keep passing; `npm run typecheck` and `npm test` are green.

## Calls made by the author (not yet confirmed by the user)

- **Strict rule:** any non-GET request is a write, with explicit exceptions only. The user
  confirmed `execute_guidelines` is safe on a read-only tenant, so it is the first allowed
  exception, via a named read-only POST variant. The `post` audit may add further exceptions
  only for calls that cannot change tenant state at all; each exception is listed explicitly in
  the code and in the PR description. Everything else stays blocked.
- **Write tools fail before any HTTP request.** In the static fallback (no dynamic hiding) a
  tool-level check refuses write-classified tools on a read-only tenant before they touch the
  client, so not even a lookup GET is issued. This includes the confirm-less preview of
  confirm-gated tools: it is refused too, for one simple rule.
- **Threat model:** the guarantee holds for tool calls through a correctly configured server. It
  does not protect against an agent that can edit the config, change the env var or start its own
  server process. Protecting the config file and secrets is part of the later loop setup.
- **Disabled tenants** are not validated at all (decided by the user: only `enabled: true`
  switches a tenant on). A half-filled stub never breaks startup.

## Left to the builder

- JSONC library choice (verify current docs), file-fallback behavior from `tenants.json`,
  env var name, classification mechanism, dynamic tool hiding vs. static, error message wording.
- Commit structure and branch naming.
