# SAP Cloud Integration — API Specifications

## Quelle

OpenAPI (Swagger 2.0) Specs vom [SAP API Business Hub](https://api.sap.com/package/CloudIntegrationAPI/odata).

Offizielle Dokumentation: [OData API - Message Monitoring](https://help.sap.com/viewer/368c481cd6954bdfa5d0435479fd4eaf/Cloud/en-US/827a2d7e9c6f4866a1d6c0e647bcacd2.html)

## Dateien

| Datei | Beschreibung |
|-------|-------------|
| `MessageProcessingLogs.yaml` | Message Processing Logs — Monitoring, Fehler, Attachments, Custom Headers |
| `IntegrationContent.yaml` | Integration Flows, Value Mappings, Packages |
| `MessageStore.yaml` | Message Store Einträge und Payloads |
| `LogFiles.yaml` | HTTP- und Trace-Logdateien |
| `SecurityContent.yaml` | Keystores, Zertifikate, User Credentials |
| `B2BScenarios.yaml` | B2B/EDI-Szenarien und Partner Directories |

## Verwendung

### Als Referenz

Die Specs dienen als **Single Source of Truth** für die MCP-CI Module. Bei Änderungen an den Modulen immer gegen die Spec validieren:

- Entity Sets, Properties und Navigation Properties
- OData-Filter und Query-Optionen
- Berechtigungen (z.B. `MonitoringDataRead` Role Template)

### Typed Client Generation (optional)

Mit dem [SAP Cloud SDK for JavaScript](https://sap.github.io/cloud-sdk/) lassen sich aus den Specs typisierte OData-Clients generieren:

```sh
npm install -D @sap-cloud-sdk/generator

# OData Client aus EDMX generieren
npx generate-odata-client --input docs/api/ --outputDir src/generated
```

Alternativ programmatisch:

```ts
import { generate } from '@sap-cloud-sdk/generator';
generate({ inputDir: 'docs/api', outputDir: 'src/generated' });
```

> **Hinweis:** Die Specs hier sind im OpenAPI/Swagger-Format. Für den OData-Generator wird das EDMX-Format benötigt (Download-Option "OData EDMX" auf dem SAP API Business Hub). Der OpenAPI-Generator unterstützt die YAML-Dateien direkt:
>
> ```sh
> npm install -D @sap-cloud-sdk/openapi-generator
> npx generate-openapi-client --input docs/api/ --outputDir src/generated
> ```

### Weiterführende Links

- [SAP Cloud SDK — OData VDM Generator](https://sap.github.io/cloud-sdk/docs/java/features/odata/vdm-generator)
- [SAP Cloud SDK — REST Client Generator](https://sap.github.io/cloud-sdk/docs/java/features/rest/generate-rest-client)
- [SAP Cloud SDK for JS — OData Client Generation](https://sap.github.io/cloud-sdk/docs/js/features/odata/generate-odata-client)

## Aktualisierung

Bei neuen API-Versionen die Specs vom [SAP API Business Hub](https://api.sap.com/package/CloudIntegrationAPI/odata) neu herunterladen und hier ersetzen.
