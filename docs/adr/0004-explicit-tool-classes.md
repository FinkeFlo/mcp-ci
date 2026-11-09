# 0004. Tool access comes from an explicit class table

- Status: Accepted
- Date: 2026-11-09

## Context

Access was first derived from tool name prefixes (`get_`, `list_` read; `create_`, `delete_` write).
That is fail closed for unknown prefixes, but the class of a single tool was implicit and hard to
review, and it could not express tools that only read but return message content.

## Decision

- `src/core/tool-classes.ts` lists every registered tool with its class: `read`, `payload`
  (reads message, store or log content, or exports a keystore) or `write`.
- Runtime access reads only this table; a tool missing from it counts as write.
- The prefix rule lives on only in tests: they fail when a registered tool has no entry, when an
  entry has no tool, or when an entry contradicts its name (with a short list of exceptions).

## Consequences

- Adding a tool means adding one line to the table; CI says which class the name suggests.
- Reviews of access changes look at one file.
- `npm run schema-budget` measures the tool list, so a new tool is also a deliberate budget change.
