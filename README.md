# mcp-ci

An [MCP](https://modelcontextprotocol.io) server for **SAP Cloud Integration** (SAP Integration Suite). It exposes the Cloud Integration OData APIs as MCP tools, covering:

- message monitoring
- tracing
- integration content
- security content
- message store
- log files
- B2B
- archiving
- related tenant administration tasks

## Requirements

- Node.js 22+
- An SAP Cloud Integration tenant with an OAuth2 client (`client_credentials`) that has the API roles you need, for example `MonitoringDataRead`

## Setup

### With npx (no checkout)

Create the tenant config in your user config directory, then point your MCP client at the GitHub repository:

```sh
mkdir -p ~/.config/mcp-ci
curl -fsSL -o ~/.config/mcp-ci/tenants.jsonc https://raw.githubusercontent.com/FinkeFlo/mcp-ci/main/config/tenants.example.jsonc
chmod 600 ~/.config/mcp-ci/tenants.jsonc
# edit ~/.config/mcp-ci/tenants.jsonc with your tenant URL and OAuth credentials
```

```json
{
  "mcpServers": {
    "mcp-ci": {
      "command": "npx",
      "args": ["-y", "github:FinkeFlo/mcp-ci"]
    }
  }
}
```

npx clones and builds the package on first start, which takes a few seconds; later starts use the npm cache. To use another config file, add `"env": { "MCP_CI_CONFIG": "/path/to/tenants.jsonc" }`.

> **Pin a version for real tenants.** `github:FinkeFlo/mcp-ci` follows `main`, so a new commit can run with your tenant credentials as soon as npx refreshes its cache. Use `github:FinkeFlo/mcp-ci#<tag or commit>` and update it on purpose.

### From a checkout

```sh
npm install
cp config/tenants.example.jsonc config/tenants.jsonc
# edit config/tenants.jsonc with your tenant URL and OAuth credentials
npm start
```

`config/tenants.jsonc` is gitignored and may contain comments. You can configure several tenants and switch between them at runtime with the `set_tenant` tool.

The config is looked up in this order: `MCP_CI_CONFIG`, then `config/tenants.jsonc` in the checkout, then `$XDG_CONFIG_HOME/mcp-ci/tenants.jsonc` (default `~/.config/mcp-ci/tenants.jsonc`). A `config/tenants.jsonc` in a checkout (also one used through `npm link`) therefore wins over the one in your user config directory; set `MCP_CI_CONFIG` to force a specific file.

### Tenant settings

- `enabled`: a tenant is only loaded with `"enabled": true`. Any other value, or a missing or misspelled key, leaves it off and it does not appear in `get_tenant` or `set_tenant`. Configs from before this setting need `"enabled": true` added to each tenant. `defaultTenant` must be enabled.
- `settings.readOnly`: a tenant is only writable with `"readOnly": false`. Any other value, a missing key or a missing `settings` object makes it read-only: the server sends nothing but GET requests to it, write tools (create, update, delete, deploy and similar) are hidden while it is active, and the HTTP client rejects any other request. The one exception is `execute_guidelines`, which only runs a check. Tenants you want to change through the server need `"settings": { "readOnly": false }`. Which tools count as read is listed in `src/core/tool-classes.ts`; a tool missing there counts as write, and a test fails until every registered tool has an entry.
- `settings.allowPayloads`: tools that return message content, attachments, traces, data store entries, variables, log files or a keystore export (class `payload` in `src/core/tool-classes.ts`) are only available with `"allowPayloads": true`. Any other value or a missing key hides them and refuses calls to them. This is independent of `readOnly`: a read-only tenant can allow payloads, a writable one can forbid them. Error texts of failed messages (`get_message`, `get_errors`) are not payload and stay visible; they can contain fragments of a receiver's response.
- `settings.denyTools`: a list of tool names that are hidden and refused on that tenant, whatever their class, for example `["undeploy_runtime_artifact", "delete_package"]`. An unknown name is a config error, so a typo cannot leave a tool allowed.

The read-only guarantee covers tool calls through a correctly configured server. It does not protect against someone who can edit the config file, change `MCP_CI_CONFIG` or start their own server process.

### Using a checkout from an MCP client

```json
{
  "mcpServers": {
    "mcp-ci": {
      "command": "npx",
      "args": ["tsx", "src/index.ts"],
      "cwd": "/path/to/mcp-ci"
    }
  }
}
```

The server communicates over stdio. With npx, use the configuration under [With npx](#with-npx-no-checkout).

> **Note:** Some tools change tenant state. They can deploy and undeploy artifacts, delete entries, and update credentials. Use an OAuth client with only the permissions you need.

## Development

Design decisions and their reasons are recorded in [docs/adr](docs/adr/README.md).

```sh
npm test            # vitest
npm run typecheck   # type check (app + scripts)
npm run coverage    # API coverage report (requires the SAP specs, see docs/api/README.md)
npm run schema-budget  # size of the tool list a client receives, checked in CI
npm run test:eval   # tool-selection evals against mock data (calls a model, costs money)
```

Every tool's name, description and input schema is sent to the model on each turn. `npm run schema-budget` measures the `tools/list` result for a read-only tenant and for a writable tenant with payloads allowed, and fails when it exceeds `scripts/schema-budget/budget.json` (currently 141 tools / ~64k chars read-only, 230 tools / ~118k chars with everything enabled). Raise the budget only on purpose, in the PR that needs it.

### Tool-selection evals

How well a model picks a tool depends almost entirely on tool and parameter descriptions. `npm run test:eval` asks a model the operator questions in `scripts/evals/scenarios.ts` and checks whether its first mcp-ci call uses the expected tool and arguments. It runs `claude -p` (Claude Code CLI, logged in) against the real server with a read-only eval tenant and synthetic data from `scripts/evals/mock-client.ts`, so it needs no tenant or credentials. Options: `--model`, `--only <id,id>`, `--budget <usd per scenario>`.

It is not part of `npm test`: it costs money and a model's choice varies between runs. A pass shows that the descriptions led the model to the right first call on these questions, not that the answer was correct or that other models behave the same. When you change a tool's description, add or adjust a scenario.

## License

[MIT](LICENSE)

## Disclaimer

This is an independent project. It is not affiliated with, endorsed by, or sponsored by SAP SE. SAP, SAP Integration Suite, and SAP Cloud Integration are trademarks or registered trademarks of SAP SE in Germany and other countries. The SAP API specifications are not part of this repository. They are available from the [SAP Business Accelerator Hub](https://api.sap.com/package/CloudIntegrationAPI/odata) under SAP's terms.
