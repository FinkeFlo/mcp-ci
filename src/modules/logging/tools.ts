import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import * as z from "zod/v4";
import type { Module, ModuleContext } from "../../core/types.js";

function extractActiveField(parsed: unknown): boolean | undefined {
  if (parsed && typeof parsed === "object") {
    const obj = parsed as Record<string, unknown>;
    // Standard OData: { d: { Active: ... } }
    if (obj.d && typeof obj.d === "object") {
      const d = obj.d as Record<string, unknown>;
      if (typeof d.Active === "boolean") return d.Active;
    }
    // Non-standard: { entry: { content: { properties: { Active: ... } } } }
    if (obj.entry && typeof obj.entry === "object") {
      const entry = obj.entry as Record<string, unknown>;
      if (entry.content && typeof entry.content === "object") {
        const content = entry.content as Record<string, unknown>;
        if (content.properties && typeof content.properties === "object") {
          const props = content.properties as Record<string, unknown>;
          if (typeof props.Active === "boolean") return props.Active;
        }
      }
    }
    // Fallback: search top-level
    if (typeof obj.Active === "boolean") return obj.Active;
  }
  return undefined;
}

async function getLoggingStatus(context: ModuleContext): Promise<string> {
  const tenantName = context.tenantManager.getActiveTenant().name;
  const raw = await context.odataClient.getValue(
    `/api/v1/ExternalLoggingActivationStatus('${tenantName}')`
  );
  const parsed = JSON.parse(raw) as unknown;
  const active = extractActiveField(parsed);
  if (active === true) {
    return "External logging is ACTIVE";
  } else if (active === false) {
    return "External logging is INACTIVE";
  }
  return "External logging status is UNKNOWN";
}

export const loggingModule: Module = {
  name: "logging",
  register(server: McpServer, context: ModuleContext) {
    server.registerTool(
      "get_external_logging_status",
      {
        description:
          "Get the current external logging activation status for the active SAP Cloud Integration tenant.",
        inputSchema: z.object({}),
      },
      async () => {
        try {
          const statusText = await getLoggingStatus(context);
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

    server.registerTool(
      "activate_external_logging",
      {
        description:
          "Activate external logging for the active SAP Cloud Integration tenant. Requires a log level. Without confirm, shows a preview. Call again with confirm: true to apply.",
        inputSchema: z.object({
          logLevel: z
            .enum(["NONE", "INFO", "ERROR"])
            .describe("The default log level to use when activating external logging"),
          confirm: z
            .boolean()
            .optional()
            .describe("Set to true to actually activate external logging"),
        }),
      },
      async ({ logLevel, confirm }) => {
        try {
          if (!confirm) {
            const statusText = await getLoggingStatus(context);
            return {
              content: [
                {
                  type: "text" as const,
                  text: `Current status: ${statusText}\n\nThis will activate external logging with level ${logLevel}. Call again with confirm: true to proceed.`,
                },
              ],
            };
          }

          const result = await context.odataClient.post(
            `/api/v1/activateExternalLogging?defaultLogLevel=${logLevel}`
          );
          const message =
            result?.message ??
            result?.d?.message ??
            `External logging activated successfully with log level ${logLevel}.`;
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

    server.registerTool(
      "deactivate_external_logging",
      {
        description:
          "Deactivate external logging for the active SAP Cloud Integration tenant. Without confirm, shows a preview. Call again with confirm: true to apply.",
        inputSchema: z.object({
          confirm: z
            .boolean()
            .optional()
            .describe("Set to true to actually deactivate external logging"),
        }),
      },
      async ({ confirm }) => {
        try {
          if (!confirm) {
            const statusText = await getLoggingStatus(context);
            return {
              content: [
                {
                  type: "text" as const,
                  text: `Current status: ${statusText}\n\nThis will deactivate external logging. Call again with confirm: true to proceed.`,
                },
              ],
            };
          }

          const result = await context.odataClient.post(
            "/api/v1/deactivateExternalLogging"
          );
          const message =
            result?.message ??
            result?.d?.message ??
            "External logging deactivated successfully.";
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
  },
};
