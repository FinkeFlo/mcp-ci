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

```sh
npm install
cp config/tenants.example.jsonc config/tenants.jsonc
# edit config/tenants.jsonc with your tenant URL and OAuth credentials
npm start
```

`config/tenants.jsonc` is gitignored and may contain comments. You can configure several tenants and switch between them at runtime with the `set_tenant` tool. Set `MCP_CI_CONFIG` to load a different file.

### Tenant settings

- `enabled`: a tenant is only loaded with `"enabled": true`. Any other value, or a missing or misspelled key, leaves it off and it does not appear in `get_tenant` or `set_tenant`. Configs from before this setting need `"enabled": true` added to each tenant. `defaultTenant` must be enabled.
- `settings.readOnly`: a tenant is only writable with `"readOnly": false`. Any other value, a missing key or a missing `settings` object makes it read-only: the server sends nothing but GET requests to it, write tools (create, update, delete, deploy and similar) are hidden while it is active, and the HTTP client rejects any other request. The one exception is `execute_guidelines`, which only runs a check. Tenants you want to change through the server need `"settings": { "readOnly": false }`.

The read-only guarantee covers tool calls through a correctly configured server. It does not protect against someone who can edit the config file, change `MCP_CI_CONFIG` or start their own server process.

### Using it from an MCP client

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

The server communicates over stdio.

> **Note:** Some tools change tenant state. They can deploy and undeploy artifacts, delete entries, and update credentials. Use an OAuth client with only the permissions you need.

## Development

```sh
npm test            # vitest
npm run typecheck   # type check (app + scripts)
npm run coverage    # API coverage report (requires the SAP specs, see docs/api/README.md)
npm run schema-budget  # size of the tool list a client receives, checked in CI
```

Every tool's name, description and input schema is sent to the model on each turn. `npm run schema-budget` measures the `tools/list` result for a read-only and a writable tenant and fails when it exceeds `scripts/schema-budget/budget.json` (currently 159 tools / ~71k chars read-only, 230 tools / ~118k chars writable). Raise the budget only on purpose, in the PR that needs it.

## License

[MIT](LICENSE)

## Disclaimer

This is an independent project. It is not affiliated with, endorsed by, or sponsored by SAP SE. SAP, SAP Integration Suite, and SAP Cloud Integration are trademarks or registered trademarks of SAP SE in Germany and other countries. The SAP API specifications are not part of this repository. They are available from the [SAP Business Accelerator Hub](https://api.sap.com/package/CloudIntegrationAPI/odata) under SAP's terms.
