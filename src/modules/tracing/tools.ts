import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import * as z from "zod/v4";
import type { Module, ModuleContext } from "../../core/types.js";
import type {
  MessageProcessingLogRun,
  MessageProcessingLogRunStep,
  TraceMessage,
  TraceMessageProperty,
} from "./types.js";
import {
  buildRunsPath,
  buildRunStepsPath,
  buildTraceMessagesPath,
  buildTraceValuePath,
  buildTracePropertiesPath,
  buildTraceExchangePropertiesPath,
} from "./queries.js";

const MAX_TRACE_PAYLOAD = 100 * 1024;

export const tracingModule: Module = {
  name: "tracing",
  register(server: McpServer, context: ModuleContext) {
    // get_message_runs
    server.registerTool(
      "get_message_runs",
      {
        description:
          "Get all processing runs of a message. Each message can have multiple runs (e.g., retries).",
        inputSchema: z.object({
          messageGuid: z
            .string()
            .describe("The MessageGuid of the message"),
        }),
      },
      async ({ messageGuid }) => {
        try {
          const runs =
            await context.odataClient.getCollection<MessageProcessingLogRun>(
              buildRunsPath(messageGuid),
              { $orderby: "RunStart desc" }
            );

          if (runs.length === 0) {
            return {
              content: [
                {
                  type: "text" as const,
                  text: "No runs found for this message.",
                },
              ],
            };
          }

          const output = runs
            .map(
              (r, i) =>
                `[Run ${i + 1}]\n  RunId: ${r.Id}\n  State: ${r.OverallState ?? "n/a"}\n  LogLevel: ${r.LogLevel ?? "n/a"}\n  Start: ${r.RunStart ?? "n/a"}\n  Stop: ${r.RunStop ?? "n/a"}`
            )
            .join("\n\n");

          return {
            content: [
              {
                type: "text" as const,
                text: `${runs.length} run(s) for message ${messageGuid}:\n\n${output}`,
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

    // get_run_steps
    server.registerTool(
      "get_run_steps",
      {
        description:
          "Get individual processing steps of a run. Shows the exact processing path with activity, status, and errors.",
        inputSchema: z.object({
          runId: z
            .string()
            .describe("The RunId (from get_message_runs)"),
        }),
      },
      async ({ runId }) => {
        try {
          const steps =
            await context.odataClient.getCollection<MessageProcessingLogRunStep>(
              buildRunStepsPath(runId),
              { $orderby: "ChildCount asc" }
            );

          if (steps.length === 0) {
            return {
              content: [
                {
                  type: "text" as const,
                  text: "No steps found for this run.",
                },
              ],
            };
          }

          const output = steps
            .map(
              (s) =>
                `[Step ${s.ChildCount}]\n  Activity: ${s.Activity ?? "n/a"}\n  Status: ${s.Status ?? "n/a"}\n  Start: ${s.StepStart ?? "n/a"}\n  Stop: ${s.StepStop ?? "n/a"}\n  ModelStepId: ${s.ModelStepId ?? "n/a"}${s.Error ? `\n  Error: ${s.Error}` : ""}`
            )
            .join("\n\n");

          return {
            content: [
              {
                type: "text" as const,
                text: `${steps.length} step(s) for run ${runId}:\n\n${output}`,
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

    // get_trace
    server.registerTool(
      "get_trace",
      {
        description:
          "Get the trace payload and headers/exchange properties of a specific processing step. Shows the actual message content at that point in the flow. Large payloads (>100KB) are truncated.",
        inputSchema: z.object({
          runId: z.string().describe("The RunId of the run"),
          childCount: z
            .number()
            .describe("The ChildCount (step number, from get_run_steps)"),
        }),
      },
      async ({ runId, childCount }) => {
        try {
          const traceMessages =
            await context.odataClient.getCollection<TraceMessage>(
              buildTraceMessagesPath(runId, childCount)
            );

          if (traceMessages.length === 0) {
            return {
              content: [
                {
                  type: "text" as const,
                  text: "No trace data available for this step. Ensure tracing is enabled (LogLevel TRACE) for this integration flow.",
                },
              ],
            };
          }

          const parts: string[] = [];

          for (const trace of traceMessages) {
            parts.push(`Trace ${trace.TraceId}:`);
            parts.push(`  MimeType: ${trace.MimeType ?? "n/a"}`);
            parts.push(
              `  PayloadSize: ${trace.PayloadSize ?? "n/a"} bytes`
            );

            const payloadSize = trace.PayloadSize
              ? Number(trace.PayloadSize)
              : 0;

            if (payloadSize > MAX_TRACE_PAYLOAD) {
              parts.push(
                `  Payload: TRUNCATED (${trace.PayloadSize} bytes exceeds ${MAX_TRACE_PAYLOAD / 1024}KB limit)`
              );
            } else {
              try {
                const payload = await context.odataClient.getValue(
                  buildTraceValuePath(trace.TraceId)
                );
                parts.push(`  Payload:\n${payload}`);
              } catch {
                parts.push("  Payload: Could not fetch trace payload");
              }
            }

            const [props, exchProps] = await Promise.all([
              context.odataClient
                .getCollection<TraceMessageProperty>(
                  buildTracePropertiesPath(trace.TraceId)
                )
                .catch(() => [] as TraceMessageProperty[]),
              context.odataClient
                .getCollection<TraceMessageProperty>(
                  buildTraceExchangePropertiesPath(trace.TraceId)
                )
                .catch(() => [] as TraceMessageProperty[]),
            ]);

            if (props.length > 0) {
              parts.push("  Headers:");
              for (const p of props) {
                parts.push(`    ${p.Name}: ${p.Value ?? ""}`);
              }
            }

            if (exchProps.length > 0) {
              parts.push("  Exchange Properties:");
              for (const p of exchProps) {
                parts.push(`    ${p.Name}: ${p.Value ?? ""}`);
              }
            }

            parts.push("");
          }

          return {
            content: [{ type: "text" as const, text: parts.join("\n") }],
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
