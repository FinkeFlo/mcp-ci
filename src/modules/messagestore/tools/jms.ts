import type { McpServer } from "@modelcontextprotocol/server";
import * as z from "zod/v4";
import type { ModuleContext } from "../../../core/types.js";
import { textTool } from "../../../core/tool.js";
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
  // @api GET /JmsBrokers('Broker1')
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
    textTool(async ({ expand }) => {
      const broker = await context.odataClient.getEntity<JmsBroker>(
        buildJmsBrokerPath(),
        expand ? { $expand: expand } : undefined
      );
      const text = formatBroker(broker);
      return text;
    })
  );
}
