# SAP Cloud Integration API Specifications

The OpenAPI (Swagger 2.0) specifications are **not included** in this repository. Download them from the [SAP Business Accelerator Hub](https://api.sap.com/package/CloudIntegrationAPI/odata). Choose the API, then **API Specification**, then **YAML**, and save each file into this directory under the name listed below. These files are gitignored.

| File | API |
|------|-----|
| `MessageProcessingLogs.yaml` | Message Processing Logs |
| `IntegrationContent.yaml` | Integration Content |
| `MessageStore.yaml` | Message Stores |
| `LogFiles.yaml` | Log Files |
| `SecurityContent.yaml` | Security Content |
| `B2BScenarios.yaml` | B2B Scenarios |

The server does not need these specs at runtime. Only `npm run coverage` uses them, to report which API operations have MCP tools.

Official documentation: [SAP Cloud Integration – OData APIs](https://help.sap.com/docs/cloud-integration).
