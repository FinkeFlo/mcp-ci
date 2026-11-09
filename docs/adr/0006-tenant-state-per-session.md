# 0006. Tenant state is per session

- Status: Proposed
- Date: 2026-11-09

## Context

`set_tenant` is stateful by design: the active tenant decides which tools are visible, which guard
applies and which API a call reaches. With one person on a local stdio process that state could
live in the process. When several people share one process, state shared between them would let one
person's `set_tenant` change another person's tool list or turn a read-only guard into a writable
one, including for a call that is still running while the other session switches.

## Decision

- Each session builds its own `McpServer`, `TenantManager`, `ToolAccess` and `ODataClient` from
  `ConfigSource.resolve(principal)` (`createSessionFactory`). The active tenant, the tool
  visibility that depends on it and the read-only, payload and deny guards exist once per session.
- Shared between sessions are only the token provider and the CSRF cache. Their keys are
  unambiguous: token endpoint and client id for tokens; API URL, client id and principal subject
  for CSRF tokens. Tenants that share a client id but not a URL share nothing.
- A session works on a validated copy of its config (ADR 0005), so a source that hands the same
  object to several people, or changes it later, cannot change a running session.
- The pinned tenant per tool call and the two guard layers of ADR 0001 are unchanged.
- The stdio CLI is the same code with `LOCAL_PRINCIPAL` and one session.

## Consequences

- Sessions live in memory. A deployment runs one instance or routes a session to the same instance
  (sticky sessions); sharing sessions across instances is not solved.
- A session reads its config once, at creation. A changed config applies to new sessions only. A
  person whose roles change is refused on the next request and must start a new session (ADR 0007);
  an identity that becomes invalid is refused at once, because the authenticator runs on every
  request. A change that leaves the person's roles as they are, such as an edited config file, reaches
  an active session only when it ends (DELETE, idle timeout, restart). A maximum session lifetime is
  not built.
- The default token provider uses a technical OAuth client, so its token is shared by every session whose
  tenant names the same token endpoint and client id. Tokens that identify a person need a custom
  `TokenProvider`, which receives the principal; the core does not partition tokens by person.
- Cost per session is one server with every tool registered; the session limit of ADR 0007 bounds it.
