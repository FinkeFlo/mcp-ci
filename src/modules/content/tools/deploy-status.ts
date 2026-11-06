import type { McpServer } from "@modelcontextprotocol/server";
import * as z from "zod/v4";
import type { ModuleContext } from "../../../core/types.js";
import type { BuildAndDeployStatus } from "../types.js";
import { buildDeployStatusPath } from "../queries.js";

export function registerDeployStatusTools(
  server: McpServer,
  context: ModuleContext
) {
  // @api GET /BuildAndDeployStatus(TaskId='{taskId}')
  server.registerTool(
    "get_deploy_status",
    {
      description:
        "Get the build and deploy status for a specific task on the active SAP Cloud Integration tenant.",
      inputSchema: z.object({
        taskId: z.string().describe("The task ID to check the deploy status for"),
      }),
    },
    async ({ taskId }) => {
      try {
        const status =
          await context.odataClient.getEntity<BuildAndDeployStatus>(
            buildDeployStatusPath(taskId)
          );
        const lines: string[] = [];
        lines.push(`TaskId: ${status.TaskId ?? "n/a"}`);
        lines.push(`Status: ${status.Status ?? "n/a"}`);
        const text = lines.join("\n");
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
