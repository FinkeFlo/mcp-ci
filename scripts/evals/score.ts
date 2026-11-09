export interface ToolCall {
  tool: string;
  input: Record<string, unknown>;
}

const PREFIX = "mcp__mcp-ci__";

/** mcp-ci tool calls from a `claude -p --output-format stream-json` transcript, in order. */
export function parseToolCalls(lines: string[]): ToolCall[] {
  const calls: ToolCall[] = [];
  for (const line of lines) {
    let event: any;
    try {
      event = JSON.parse(line);
    } catch {
      continue;
    }
    if (event?.type !== "assistant" || !Array.isArray(event.message?.content)) continue;
    for (const part of event.message.content) {
      if (part?.type === "tool_use" && typeof part.name === "string" && part.name.startsWith(PREFIX)) {
        calls.push({ tool: part.name.slice(PREFIX.length), input: part.input ?? {} });
      }
    }
  }
  return calls;
}

function matches(actual: unknown, expected: unknown): boolean {
  if (typeof expected === "string") return typeof actual === "string" && actual.trim() === expected;
  return JSON.stringify(actual) === JSON.stringify(expected);
}

/** Scores the first mcp-ci call against the expectation. */
export function scoreScenario(
  calls: ToolCall[],
  expectation: { tools: string[]; args?: Record<string, unknown>; present?: string[] }
): { pass: boolean; reason: string } {
  const [first] = calls;
  if (!first) return { pass: false, reason: "no mcp-ci tool called" };
  if (!expectation.tools.includes(first.tool)) {
    return { pass: false, reason: `first call ${first.tool}, expected ${expectation.tools.join(" or ")}` };
  }
  for (const [key, value] of Object.entries(expectation.args ?? {})) {
    if (!matches(first.input[key], value)) {
      return { pass: false, reason: `${first.tool}: ${key} was ${JSON.stringify(first.input[key])}, expected ${JSON.stringify(value)}` };
    }
  }
  for (const key of expectation.present ?? []) {
    if (first.input[key] === undefined || first.input[key] === "") {
      return { pass: false, reason: `${first.tool}: ${key} missing` };
    }
  }
  return { pass: true, reason: "ok" };
}
