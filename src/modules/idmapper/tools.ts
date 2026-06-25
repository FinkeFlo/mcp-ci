import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import * as z from "zod/v4";
import type { Module, ModuleContext } from "../../core/types.js";
import type { IdMapEntry } from "./types.js";
import { buildFromIdPath, buildToIdPath } from "./queries.js";

export const idMapperModule: Module = {
  name: "idmapper",
  register(server: McpServer, context: ModuleContext) {
    // @api GET /IdMapFromIds('{Source ID}')/ToIds
    // @api GET /IdMapToIds('{Target ID}')/FromId2s
    server.registerTool(
      "get_id_mappings",
      {
        description:
          "Look up ID mappings in SAP Cloud Integration. Search by sourceId to find all target IDs, or by targetId to find all source IDs.",
        inputSchema: z.object({
          sourceId: z
            .string()
            .optional()
            .describe("The source ID (FromId) to look up target IDs for"),
          targetId: z
            .string()
            .optional()
            .describe("The target ID (ToId) to look up source IDs for"),
        }),
      },
      async ({ sourceId, targetId }) => {
        if (sourceId && targetId) {
          return {
            content: [
              {
                type: "text" as const,
                text: "Provide either sourceId or targetId, not both.",
              },
            ],
          };
        }

        if (!sourceId && !targetId) {
          return {
            content: [
              {
                type: "text" as const,
                text: "Either sourceId or targetId is required.",
              },
            ],
          };
        }

        try {
          let entries: IdMapEntry[];

          if (sourceId) {
            const raw = await context.odataClient.getCollection<{
              ToId: string;
              FromId_: string;
              Mapper: string | null;
              ExpirationTime: string | null;
              Qualifier: string | null;
              Context: string | null;
            }>(buildFromIdPath(sourceId));

            entries = raw.map((r) => ({
              FromId: r.FromId_,
              ToId: r.ToId,
              Mapper: r.Mapper,
              ExpirationTime: r.ExpirationTime,
              Qualifier: r.Qualifier,
              Context: r.Context,
            }));
          } else {
            const raw = await context.odataClient.getCollection<{
              FromId: string;
              ToId2: string;
              Mapper: string | null;
              ExpirationTime: string | null;
              Qualifier: string | null;
              Context: string | null;
            }>(buildToIdPath(targetId!));

            entries = raw.map((r) => ({
              FromId: r.FromId,
              ToId: r.ToId2,
              Mapper: r.Mapper,
              ExpirationTime: r.ExpirationTime,
              Qualifier: r.Qualifier,
              Context: r.Context,
            }));
          }

          if (entries.length === 0) {
            return {
              content: [
                {
                  type: "text" as const,
                  text: "No mappings found.",
                },
              ],
            };
          }

          const output = entries
            .map(
              (e, i) =>
                `[Mapping ${i + 1}]\n  FromId: ${e.FromId ?? "n/a"}\n  ToId: ${e.ToId ?? "n/a"}\n  Mapper: ${e.Mapper ?? "n/a"}\n  Context: ${e.Context ?? "n/a"}\n  Qualifier: ${e.Qualifier ?? "n/a"}\n  ExpirationTime: ${e.ExpirationTime ?? "n/a"}`
            )
            .join("\n\n");

          return {
            content: [
              {
                type: "text" as const,
                text: `${entries.length} mapping(s) found:\n\n${output}`,
              },
            ],
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
  },
};
