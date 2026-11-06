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

- Node.js 20+
- An SAP Cloud Integration tenant with an OAuth2 client (`client_credentials`) that has the API roles you need, for example `MonitoringDataRead`

## Setup

```sh
npm install
cp config/tenants.example.json config/tenants.json
# edit config/tenants.json with your tenant URL and OAuth credentials
npm start
```

`config/tenants.json` is gitignored. You can configure several tenants and switch between them at runtime with the `set_tenant` tool.

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
npx tsc --noEmit    # type check
npm run coverage    # API coverage report (requires the SAP specs, see docs/api/README.md)
```

## License

[MIT](LICENSE)

## Disclaimer

This is an independent project. It is not affiliated with, endorsed by, or sponsored by SAP SE. SAP, SAP Integration Suite, and SAP Cloud Integration are trademarks or registered trademarks of SAP SE in Germany and other countries. The SAP API specifications are not part of this repository. They are available from the [SAP Business Accelerator Hub](https://api.sap.com/package/CloudIntegrationAPI/odata) under SAP's terms.
