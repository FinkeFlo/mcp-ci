# 0002. A tenant is only active with `"enabled": true`

- Status: Accepted
- Date: 2026-11-08

## Context

A config often lists several tenants, some of which should not be reachable in a given setup, for
example a separate config for an agent. Commenting entries out is easy to get wrong, and a tenant
that is present but forgotten is reachable through `set_tenant`.

## Decision

- Only entries with `enabled` exactly `true` are loaded. Anything else (missing, `false`, the string
  `"true"`, a misspelled key) drops the entry without validating it.
- `defaultTenant` must name an enabled tenant. Lookups use own properties only, so names such as
  `constructor` are never treated as tenants.

## Consequences

- Configs from before this setting need `"enabled": true` on each tenant that should stay usable.
- A disabled entry may be incomplete; it is never parsed beyond `enabled`.
