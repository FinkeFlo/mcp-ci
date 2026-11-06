import type { CallToolResult } from "@modelcontextprotocol/server";

export function textResult(text: string): CallToolResult {
  return { content: [{ type: "text", text }] };
}

export function errorResult(message: string): CallToolResult {
  return { isError: true, content: [{ type: "text", text: message }] };
}

/**
 * Wraps a tool handler that returns plain text. Thrown errors become
 * `isError` results so the model sees the message instead of a protocol error.
 * Handlers may still return a full `CallToolResult` for non-text output.
 */
export function textTool<Args extends unknown[]>(
  handler: (...args: Args) => string | CallToolResult | Promise<string | CallToolResult>
): (...args: Args) => Promise<CallToolResult> {
  return async (...args) => {
    try {
      const result = await handler(...args);
      return typeof result === "string" ? textResult(result) : result;
    } catch (error) {
      return errorResult(error instanceof Error ? error.message : String(error));
    }
  };
}
