import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import * as z from "zod/v4";
import type { ModuleContext } from "../../../core/types.js";
import type { JmsBroker } from "../types.js";
import { buildJmsBrokerPath } from "../queries.js";

function formatFlag(value: number | null): string {
  if (value === null) return "n/a";
  return value === 0 ? "OK" : "HIGH";
}

function formatBroker(b: JmsBroker): string {
  return [
    `Key: ${b.Key ?? "n/a"}`,
    `Capacity: ${b.Capacity ?? "n/a"}`,
    `MaxCapacity: ${b.MaxCapacity ?? "n/a"}`,
    `IsTransactedSessionsHigh: ${formatFlag(b.IsTransactedSessionsHigh)}`,
    `IsConsumersHigh: ${formatFlag(b.IsConsumersHigh)}`,
    `IsProducersHigh: ${formatFlag(b.IsProducersHigh)}`,
    `MaxQueueNumber: ${b.MaxQueueNumber ?? "n/a"}`,
    `QueueNumber: ${b.QueueNumber ?? "n/a"}`,
    `CapacityOk: ${b.CapacityOk ?? "n/a"}`,
    `CapacityWarning: ${b.CapacityWarning ?? "n/a"}`,
    `CapacityError: ${b.CapacityError ?? "n/a"}`,
  ].join("\n");
}

export function registerJmsTools(server: McpServer, context: ModuleContext) {
  server.registerTool(
    "get_jms_broker",
    {
      description:
        "Get JMS broker resource information including capacity and queue status on the active SAP Cloud Integration tenant.",
      inputSchema: z.object({
        expand: z
          .enum(["QueueStates", "InactiveQueues"])
          .optional()
          .describe("Expand related entities (QueueStates or InactiveQueues)"),
      }),
    },
    async ({ expand }) => {
      try {
        const broker = await context.odataClient.getEntity<JmsBroker>(
          buildJmsBrokerPath(),
          expand ? { $expand: expand } : undefined
        );
        const text = formatBroker(broker);
        return {
          content: [{ type: "text" as const, text }],
        };
      } catch (error) {
        return {
          isError: true,
          content: [
            { type: "text" as const, text: (error as Error).message },
          ],
        };
      }
    }
  );
}
