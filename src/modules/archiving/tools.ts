import type { McpServer } from "@modelcontextprotocol/server";
import * as z from "zod/v4";
import type { Module, ModuleContext } from "../../core/types.js";
import { textTool } from "../../core/tool.js";
import type { ArchivingKeyPerformanceIndicators } from "./types.js";

function extractIsArchivedField(parsed: unknown): boolean | undefined {
  if (parsed && typeof parsed === "object") {
    const obj = parsed as Record<string, unknown>;
    // Standard OData: { d: { IsArchived: ... } }
    if (obj.d && typeof obj.d === "object") {
      const d = obj.d as Record<string, unknown>;
      if (typeof d.IsArchived === "boolean") return d.IsArchived;
    }
    // Non-standard: { entry: { content: { properties: { IsArchived: ... } } } }
    if (obj.entry && typeof obj.entry === "object") {
      const entry = obj.entry as Record<string, unknown>;
      if (entry.content && typeof entry.content === "object") {
        const content = entry.content as Record<string, unknown>;
        if (content.properties && typeof content.properties === "object") {
          const props = content.properties as Record<string, unknown>;
          if (typeof props.IsArchived === "boolean") return props.IsArchived;
        }
      }
    }
    // Fallback: search top-level
    if (typeof obj.IsArchived === "boolean") return obj.IsArchived;
  }
  return undefined;
}

async function getArchivingConfig(context: ModuleContext): Promise<string> {
  const tenantName = context.tenantManager.getActiveTenant().name;
  const raw = await context.odataClient.getValue(
    `/api/v1/ArchivingConfigurations('${tenantName}')`
  );
  const parsed = JSON.parse(raw) as unknown;
  const isArchived = extractIsArchivedField(parsed);
  if (isArchived === true) {
    return "Archiving is ENABLED";
  } else if (isArchived === false) {
    return "Archiving is DISABLED";
  }
  return "Archiving status is UNKNOWN";
}

function formatKpi(kpi: ArchivingKeyPerformanceIndicators): string {
  const lines: string[] = [];
  if (kpi.RunStart) lines.push(`RunStart: ${kpi.RunStart}`);
  if (kpi.RunStatus) lines.push(`RunStatus: ${kpi.RunStatus}`);
  if (kpi.RunDurationInMinutes) lines.push(`Duration: ${kpi.RunDurationInMinutes} min`);
  if (kpi.MplsArchived) lines.push(`MplsArchived: ${kpi.MplsArchived}`);
  if (kpi.MplsArchivingFailed) lines.push(`MplsArchivingFailed: ${kpi.MplsArchivingFailed}`);
  if (kpi.DataUploadedInMb) lines.push(`DataUploaded: ${kpi.DataUploadedInMb} MB`);
  return lines.join("\n");
}

export const archivingModule: Module = {
  name: "archiving",
  register(server: McpServer, context: ModuleContext) {
    // @api GET /ArchivingConfigurations('{TenantName}')
    server.registerTool(
      "get_archiving_config",
      {
        description:
          "Get the current data archiving configuration for the active SAP Cloud Integration tenant.",
        inputSchema: z.object({}),
      },
      textTool(async () => {
        const statusText = await getArchivingConfig(context);
        return statusText;
      })
    );

    // @api GET /ArchivingKeyPerformanceIndicators
    server.registerTool(
      "get_archiving_kpis",
      {
        description:
          "Get archiving Key Performance Indicators (KPIs) for the active SAP Cloud Integration tenant. Optionally filter by OData filter expression.",
        inputSchema: z.object({
          filter: z
            .string()
            .optional()
            .describe(
              "Optional OData filter expression, e.g. \"RunStatus eq 'COMPLETED'\""
            ),
        }),
      },
      textTool(async ({ filter }) => {
        const params = filter ? { $filter: filter } : undefined;
        const kpis = await context.odataClient.getCollection<ArchivingKeyPerformanceIndicators>(
          "/api/v1/ArchivingKeyPerformanceIndicators",
          params
        );
        if (kpis.length === 0) {
          return "No archiving runs found.";
        }
        const text = kpis.map(formatKpi).join("\n\n");
        return text;
      })
    );

    // @api POST /activateArchivingConfiguration
    server.registerTool(
      "activate_archiving",
      {
        description:
          "Activate data archiving for the active SAP Cloud Integration tenant. Without confirm, shows current config and a preview. Call again with confirm: true to apply. Note: deactivation is not available through this API.",
        inputSchema: z.object({
          confirm: z
            .boolean()
            .optional()
            .describe("Set to true to actually activate archiving"),
        }),
      },
      textTool(async ({ confirm }) => {
        if (!confirm) {
          const statusText = await getArchivingConfig(context);
          return `Current status: ${statusText}\n\nThis will activate archiving. Call again with confirm: true to proceed.`;
        }

        const result = await context.odataClient.post(
          "/api/v1/activateArchivingConfiguration"
        );
        const message =
          result?.message ??
          result?.d?.message ??
          "Archiving activated successfully.";
        return String(message);
      })
    );
  },
};
