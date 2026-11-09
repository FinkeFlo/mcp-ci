# 0001. Read-only tenants are fail closed and guarded in two layers

- Status: Accepted
- Date: 2026-11-08

## Context

The server exposes many tools that change a tenant (create, update, delete, deploy, undeploy,
import and others). Agents and people use it against tenants that must not change, for example
production. A prompt instruction does not prevent a write; a typo in a config value must not make a
tenant writable.

## Decision

- `settings.readOnly` is read-only unless it is exactly the boolean `false`. A missing key, a
  missing `settings` object, `"false"`, `0` or `null` all mean read-only.
- Layer 1: tools a tenant does not allow are hidden while it is active and refused at call time
  (`src/core/guarded-server.ts`, `src/core/tool-access.ts`). A call stays pinned to the tenant it
  was checked against, so a concurrent `set_tenant` cannot redirect it.
- Layer 2, the guarantee: `ODataClient` rejects POST, PUT and DELETE on a read-only tenant before
  any token, CSRF or HTTP request. The single exception is `execute_guidelines`, which only runs a
  check and passes `allowOnReadOnly`.
- The same fail-closed rule applies to `settings.allowPayloads` (only `true` exposes message
  content) and `settings.denyTools` (unknown names are a config error).

## Consequences

- Existing configs need `"settings": { "readOnly": false }` for tenants that should accept writes.
- A new write path in a tool cannot bypass the guard: the guard sits below every tool.
- The guarantee covers tool calls through a correctly configured server. It does not protect against
  someone who can edit the config, set `MCP_CI_CONFIG` or start their own process.
