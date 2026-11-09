# Architecture decision records

Short records of decisions that shape the server, so the reasons survive the code. Each record
states the context, the decision and its consequences. A record is not edited when a decision
changes: a new record supersedes it and says so.

| # | Decision | Status |
|---|---|---|
| [0001](0001-read-only-tenants-fail-closed.md) | Read-only tenants are fail closed and guarded in two layers | Accepted |
| [0002](0002-tenants-enabled-explicitly.md) | A tenant is only active with `"enabled": true` | Accepted |
| [0003](0003-jsonc-config.md) | The tenant config is JSONC | Accepted |
| [0004](0004-explicit-tool-classes.md) | Tool access comes from an explicit class table | Accepted |
| [0005](0005-extension-points.md) | Extension points: `ConfigSource`, `TokenProvider`, `Authenticator`, `Principal` | Proposed |
| [0006](0006-tenant-state-per-session.md) | Tenant state is per session | Proposed |

New records copy [template.md](template.md) and take the next number.
