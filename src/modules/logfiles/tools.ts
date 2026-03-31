import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import * as z from "zod/v4";
import type { Module, ModuleContext } from "../../core/types.js";
import type { LogFileArchive, LogFile } from "./types.js";
import {
  buildLogFileArchivesPath,
  buildLogFileArchivePath,
  buildLogFileArchiveValuePath,
  buildLogFilesPath,
  buildLogFilePath,
  buildLogFileValuePath,
} from "./queries.js";

function parseODataDate(value: string | null): string {
  if (!value) return "n/a";
  const match = value.match(/\/Date\((\d+)\)\//);
  if (match) return new Date(parseInt(match[1])).toISOString();
  return value;
}

function formatSize(bytes: string | null): string {
  if (!bytes) return "n/a";
  const num = parseInt(bytes);
  if (isNaN(num)) return bytes;
  if (num < 1024) return `${num} B`;
  if (num < 1024 * 1024) return `${(num / 1024).toFixed(1)} KB`;
  return `${(num / (1024 * 1024)).toFixed(1)} MB`;
}

function formatArchive(a: LogFileArchive): string {
  return [
    `Scope: ${a.Scope ?? "n/a"}`,
    `LogFileType: ${a.LogFileType ?? "n/a"}`,
    `NodeScope: ${a.NodeScope ?? "n/a"}`,
    `ContentType: ${a.ContentType ?? "n/a"}`,
  ].join("\n");
}

function formatLogFile(f: LogFile): string {
  return [
    `Name: ${f.Name ?? "n/a"}`,
    `Application: ${f.Application ?? "n/a"}`,
    `LogFileType: ${f.LogFileType ?? "n/a"}`,
    `LastModified: ${parseODataDate(f.LastModified)}`,
    `Size: ${formatSize(f.Size)}`,
    `NodeScope: ${f.NodeScope ?? "n/a"}`,
  ].join("\n");
}

export const logfilesModule: Module = {
  name: "logfiles",
  register(server: McpServer, context: ModuleContext) {
    server.registerTool(
      "list_log_file_archives",
      {
        description:
          "List all available log file archives on the active SAP Cloud Integration tenant.",
        inputSchema: z.object({}),
      },
      async () => {
        try {
          const archives =
            await context.odataClient.getCollection<LogFileArchive>(
              buildLogFileArchivesPath()
            );
          if (archives.length === 0) {
            return {
              content: [
                { type: "text" as const, text: "No log file archives found." },
              ],
            };
          }
          const text = archives.map(formatArchive).join("\n\n");
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

    server.registerTool(
      "get_log_file_archive",
      {
        description:
          "Get metadata for a specific log file archive by scope and log file type.",
        inputSchema: z.object({
          scope: z
            .enum(["all", "latest"])
            .describe("The scope of the archive"),
          logFileType: z
            .enum(["http", "trace"])
            .describe("The type of log file"),
        }),
      },
      async ({ scope, logFileType }) => {
        try {
          const archive =
            await context.odataClient.getEntity<LogFileArchive>(
              buildLogFileArchivePath(scope, logFileType)
            );
          const text = formatArchive(archive);
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

    server.registerTool(
      "download_log_file_archive",
      {
        description:
          "Download a log file archive as ZIP. Returns the raw content of the archive.",
        inputSchema: z.object({
          scope: z
            .enum(["all", "latest"])
            .describe("The scope of the archive"),
          logFileType: z
            .enum(["http", "trace"])
            .describe("The type of log file"),
          modifiedAfter: z
            .string()
            .optional()
            .describe(
              "Only include files modified after this timestamp (format: yyyy-MM-ddTHH:mm:ssZ)"
            ),
        }),
      },
      async ({ scope, logFileType, modifiedAfter }) => {
        try {
          let path = buildLogFileArchiveValuePath(scope, logFileType);
          if (modifiedAfter) {
            path += `?ModifiedAfter=${modifiedAfter}`;
          }
          const content = await context.odataClient.getValue(path);
          return {
            content: [
              {
                type: "text" as const,
                text: `Log file archive downloaded (${content.length} bytes, ZIP format).`,
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

    server.registerTool(
      "list_log_files",
      {
        description:
          "List log files on the active SAP Cloud Integration tenant. Supports OData query options for filtering, sorting, and pagination.",
        inputSchema: z.object({
          filter: z
            .string()
            .optional()
            .describe("OData $filter expression"),
          orderby: z
            .string()
            .optional()
            .describe("OData $orderby expression, e.g. \"LastModified desc\""),
          select: z
            .string()
            .optional()
            .describe("OData $select fields, e.g. \"Name,Application\""),
          top: z
            .number()
            .optional()
            .describe("Maximum number of results to return"),
          skip: z
            .number()
            .optional()
            .describe("Number of results to skip (for pagination)"),
        }),
      },
      async ({ filter, orderby, select, top, skip }) => {
        try {
          const files = await context.odataClient.getCollection<LogFile>(
            buildLogFilesPath(),
            {
              $filter: filter,
              $orderby: orderby,
              $select: select,
              $top: top,
              $skip: skip,
            }
          );
          if (files.length === 0) {
            return {
              content: [
                { type: "text" as const, text: "No log files found." },
              ],
            };
          }
          const text = files.map(formatLogFile).join("\n\n");
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

    server.registerTool(
      "get_log_file",
      {
        description:
          "Get metadata for a specific log file by name and application.",
        inputSchema: z.object({
          name: z.string().describe("The log file name"),
          application: z.string().describe("The application name"),
        }),
      },
      async ({ name, application }) => {
        try {
          const file = await context.odataClient.getEntity<LogFile>(
            buildLogFilePath(name, application)
          );
          const text = formatLogFile(file);
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

    server.registerTool(
      "download_log_file",
      {
        description:
          "Download a specific log file content by name and application.",
        inputSchema: z.object({
          name: z.string().describe("The log file name"),
          application: z.string().describe("The application name"),
        }),
      },
      async ({ name, application }) => {
        try {
          const content = await context.odataClient.getValue(
            buildLogFileValuePath(name, application)
          );
          return {
            content: [{ type: "text" as const, text: content }],
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
