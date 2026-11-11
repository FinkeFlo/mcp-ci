# 0008. Per-tenant tool allow-list

- Status: Proposed
- Date: 2026-11-09

## Context

`denyTools` removes single tools from a tenant. A downstream role rule often wants the opposite: a
person may use only a few tools, or only the read tools, on one tenant. Listing everything else in
`denyTools` is long, and a tool added later would be allowed by default.

## Decision

- `settings.allowTools` is a list of tool names and tool classes (`read`, `payload`, `write`, see
  ADR 0004). It sits next to `denyTools`.
- Missing means no extra restriction. Present, even as an empty list, means only the listed tools
  or classes are available.
- A tool in both `allowTools` and `denyTools` is denied.
- `get_tenant` and `set_tenant` stay usable whatever the list says, so a session can always see and
  switch its tenant.
- The list only narrows. `readOnly` and `allowPayloads` still apply on top of it, so `["write"]` on a
  read-only tenant exposes nothing.
- Fail closed: an unknown name, a wrong type or a misspelled setting key is a config error. If a
  value that is not a list reaches the runtime without validation, it counts as an empty list. An
  `allowTools` key on the tenant itself instead of under `settings`, in any letter case, is a config
  error, since it would otherwise leave the tenant unrestricted.
- The tool list is not changed, so `npm run schema-budget` is unaffected.

## Consequences

- A new tool is excluded from a tenant with an allow-list of names until it is listed; a class entry
  includes it as soon as it is classified in the table of ADR 0004.
- Older versions reject the setting as unknown, so a config using it needs this version.
- Role definitions stay downstream; this setting is part of the vocabulary they produce.
