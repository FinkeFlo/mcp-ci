import type { McpServer } from "@modelcontextprotocol/server";
import * as z from "zod/v4";
import type { ModuleContext } from "../../../core/types.js";
import type { B2BArchivingKpi } from "../types.js";
import {
  buildB2BArchivingConfigPath,
  buildB2BArchivingKpisPath,
  buildActivateB2BArchivingPath,
} from "../queries.js";

function extractIsActivatedField(parsed: unknown): boolean | undefined {
  if (parsed && typeof parsed === "object") {
    const obj = parsed as Record<string, unknown>;
    // Standard OData: { d: { IsActivated: ... } }
    if (obj.d && typeof obj.d === "object") {
      const d = obj.d as Record<string, unknown>;
      if (typeof d.IsActivated === "boolean") return d.IsActivated;
    }
    // Non-standard: { entry: { content: { properties: { IsActivated: ... } } } }
    if (obj.entry && typeof obj.entry === "object") {
      const entry = obj.entry as Record<string, unknown>;
      if (entry.content && typeof entry.content === "object") {
        const content = entry.content as Record<string, unknown>;
        if (content.properties && typeof content.properties === "object") {
          const props = content.properties as Record<string, unknown>;
          if (typeof props.IsActivated === "boolean") return props.IsActivated;
        }
      }
    }
    // Fallback: search top-level
    if (typeof obj.IsActivated === "boolean") return obj.IsActivated;
  }
  return undefined;
}

async function getB2BArchivingStatus(
  context: ModuleContext,
  tenantName: string
): Promise<string> {
  const raw = await context.odataClient.getValue(
    buildB2BArchivingConfigPath(tenantName)
  );
  const parsed = JSON.parse(raw) as unknown;
  const isActivated = extractIsActivatedField(parsed);
  if (isActivated === true) {
    return "B2B archiving is ENABLED";
  } else if (isActivated === false) {
    return "B2B archiving is DISABLED";
  }
  return "B2B archiving status is UNKNOWN";
}

function formatB2BArchivingKpi(kpi: B2BArchivingKpi): string {
  const lines: string[] = [];
  if (kpi.RunStart) lines.push(`RunStart: ${kpi.RunStart}`);
  if (kpi.RunEnd) lines.push(`RunEnd: ${kpi.RunEnd}`);
  if (kpi.RunStatus) lines.push(`RunStatus: ${kpi.RunStatus}`);
  if (kpi.DocumentsArchived) lines.push(`DocumentsArchived: ${kpi.DocumentsArchived}`);
  return lines.join("\n");
}

export function registerB2BArchivingTools(
  server: McpServer,
  context: ModuleContext
) {
  // @api GET /B2BArchivingConfigurations('{TenantName}')
  server.registerTool(
    "get_b2b_archiving_config",
    {
      description:
        "Get the B2B archiving configuration for a given SAP Cloud Integration tenant.",
      inputSchema: z.object({
        tenantName: z.string().describe("The tenant name to retrieve archiving configuration for"),
      }),
    },
    async ({ tenantName }) => {
      try {
        const statusText = await getB2BArchivingStatus(context, tenantName);
        return {
          content: [{ type: "text" as const, text: statusText }],
        };
      } catch (error) {
        return {
          isError: true,
          content: [{ type: "text" as const, text: (error as Error).message }],
        };
      }
    }
  );

  // @api GET /B2BArchivingKeyPerformanceIndicators
  server.registerTool(
    "get_b2b_archiving_kpis",
    {
      description:
        "Get B2B archiving Key Performance Indicators (KPIs). Optionally filter by OData filter expression.",
      inputSchema: z.object({
        filter: z
          .string()
          .optional()
          .describe(
            "Optional OData filter expression, e.g. \"RunStatus eq 'COMPLETED'\""
          ),
      }),
    },
    async ({ filter }) => {
      try {
        const params = filter ? { $filter: filter } : undefined;
        const kpis = await context.odataClient.getCollection<B2BArchivingKpi>(
          buildB2BArchivingKpisPath(),
          params
        );
        if (kpis.length === 0) {
          return {
            content: [
              { type: "text" as const, text: "No B2B archiving runs found." },
            ],
          };
        }
        const text = kpis.map(formatB2BArchivingKpi).join("\n\n");
        return {
          content: [{ type: "text" as const, text }],
        };
      } catch (error) {
        return {
          isError: true,
          content: [{ type: "text" as const, text: (error as Error).message }],
        };
      }
    }
  );

  // @api POST /activateB2BArchivingConfiguration
  server.registerTool(
    "activate_b2b_archiving",
    {
      description:
        "Activate B2B archiving for a given SAP Cloud Integration tenant. Without confirm, shows current config and a preview. Call again with confirm: true to apply.",
      inputSchema: z.object({
        tenantName: z.string().describe("The tenant name to activate B2B archiving for"),
        confirm: z
          .boolean()
          .optional()
          .describe("Set to true to actually activate B2B archiving"),
      }),
    },
    async ({ tenantName, confirm }) => {
      try {
        if (!confirm) {
          const statusText = await getB2BArchivingStatus(context, tenantName);
          return {
            content: [
              {
                type: "text" as const,
                text: `Current status: ${statusText}\n\nThis will activate B2B archiving. Call again with confirm: true to proceed.`,
              },
            ],
          };
        }

        const result = await context.odataClient.post(
          buildActivateB2BArchivingPath(),
          { TenantName: tenantName }
        );
        const message =
          result?.message ??
          result?.d?.message ??
          "B2B archiving activated successfully.";
        return {
          content: [{ type: "text" as const, text: String(message) }],
        };
      } catch (error) {
        return {
          isError: true,
          content: [{ type: "text" as const, text: (error as Error).message }],
        };
      }
    }
  );
}
