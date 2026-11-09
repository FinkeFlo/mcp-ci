# 0007. Remote operation requires authentication

- Status: Proposed
- Date: 2026-11-09

## Context

Over stdio the caller is the person who started the process. Over HTTP anyone who can reach the
port is a caller, and a server that answers an unauthenticated or anonymous request would give
that caller every tenant it is configured for.

## Decision

- `startHttpServer` (library only) requires an `Authenticator` and rejects before it opens a
  port if there is none. The CLI stays stdio only and gets no HTTP flag, because a flag cannot
  carry an authenticator; a downstream package provides its own entry point.
- No authenticator ships with this package, and there is no anonymous fallback. The method belongs
  to the deployment. A downstream `Authenticator` may use the SDK's `verifyBearerToken`; the
  SDK's `requireBearerAuth` is not used because it only verifies a bearer token, while the
  authenticator sees the whole request and returns a `Principal`.
- Every request is authenticated, including requests on an existing session. A request without
  valid authentication, or whose result is not a valid `Principal`, gets 401 before any session
  or config lookup. The authenticator gets a request without a body, and its error text never
  reaches the response.
- A session is bound to the subject that created it. A request on it from another subject gets 403
  and leaves the session alone; an unknown session id gets 404.
- Authenticated but no usable tenant (`NoTenantsError`): 403, no session. `ConfigSource` throws or
  its config breaks the safety rules: 503 without details, no session.
- Sessions are limited in number (slots are reserved before the session exists, so concurrent
  `initialize` requests cannot overshoot) and closed after an idle timeout. The default listen
  address is loopback.
- Transport: one `McpServer` and one `WebStandardStreamableHTTPServerTransport` per session, routed by
  `Mcp-Session-Id`, with a small Node bridge. The SDK's `createMcpHandler` builds a fresh server per
  request and has no sessions, so `set_tenant` would be lost. `@modelcontextprotocol/node` has no
  release matching the 2.4 server package and would add `hono`, so no dependency is added.
- The request handed to the transport has `Authorization`, `Proxy-Authorization` and `Cookie`
  removed, and the core forwards no `authInfo`, because tool handlers can read that request. Only
  the authenticator sees the credential. The library writes no log output.
- A session also remembers the roles its principal had when it started. A later request whose
  authenticated roles differ gets 403 and ends the session, so the client starts a new one with the
  config of the new roles. Without this, a demoted person would keep the old config for as long as
  the session stays active.

## Consequences

- TLS, Host and Origin checks and rate limits belong to the deployment (a proxy in front); the
  loopback default is the only protection the core adds.
- Sessions live in memory, so one instance or sticky routing (ADR 0006).
- The authenticator runs on every request, so a slow identity provider slows every call; caching
  belongs in the authenticator.
