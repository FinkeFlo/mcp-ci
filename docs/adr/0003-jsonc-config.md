# 0003. The tenant config is JSONC

- Status: Accepted
- Date: 2026-11-08

## Context

The settings above are safety relevant and benefit from comments next to them. Plain JSON has no
comments. JSON5 allows more (unquoted keys, single quotes) than is useful here and is less widely
supported by editors.

## Decision

- The config is `config/tenants.jsonc`, parsed with `jsonc-parser` (comments and trailing commas
  allowed). `MCP_CI_CONFIG` overrides the path.
- The earlier `config/tenants.json` is no longer read. It stays in `.gitignore` so an old file with
  secrets is not committed by accident.

## Consequences

- Parse errors report line and column.
- Users of the old file rename it once.
