import { spawn } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";
import { SCENARIOS } from "./scenarios.js";
import { parseToolCalls, scoreScenario } from "./score.js";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
// Only what claude needs to start; nothing else from this shell reaches the model.
const ENV_ALLOWED = /^(PATH|HOME|USER|LOGNAME|LANG|LC_[A-Z]+|TMPDIR|SHELL|TERM|ANTHROPIC_[A-Z_]+|CLAUDE_CODE_[A-Z_]+|NODE_EXTRA_CA_CERTS|HTTPS?_PROXY|NO_PROXY)$/;

const { values } = parseArgs({
  options: {
    model: { type: "string", default: "claude-haiku-5-5" },
    only: { type: "string" },
    budget: { type: "string", default: "0.3" },
    timeout: { type: "string", default: "180000" },
  },
});

const tempDir = mkdtempSync(join(tmpdir(), "mcp-ci-eval-"));
const mcpConfig = join(tempDir, "mcp.json");
writeFileSync(
  mcpConfig,
  JSON.stringify({
    mcpServers: {
      "mcp-ci": { command: join(repoRoot, "node_modules/.bin/tsx"), args: [join(repoRoot, "scripts/evals/eval-server.ts")] },
    },
  })
);

function runClaude(question: string): Promise<{ lines: string[]; failure?: string }> {
  const args = [
    "-p", question,
    "--model", values.model!,
    "--tools", "",
    "--strict-mcp-config", "--mcp-config", mcpConfig,
    "--allowedTools", "mcp__mcp-ci__*",
    "--permission-mode", "dontAsk",
    "--restricted",
    "--output-format", "stream-json", "--verbose",
    "--no-session-persistence",
    "--max-budget-usd", values.budget!,
  ];
  const env = Object.fromEntries(Object.entries(process.env).filter(([key]) => ENV_ALLOWED.test(key)));
  return new Promise((resolve, reject) => {
    const child = spawn("claude", args, { cwd: repoRoot, env, stdio: ["ignore", "pipe", "pipe"] });
    let stdout = "";
    let stderr = "";
    child.stdout.setEncoding("utf8").on("data", (chunk) => (stdout += chunk));
    // Drained so a full pipe cannot stall claude; the tail explains failures.
    child.stderr.setEncoding("utf8").on("data", (chunk) => (stderr = (stderr + chunk).slice(-500)));
    const timer = setTimeout(() => child.kill("SIGTERM"), Number(values.timeout));
    child.on("error", reject);
    child.on("close", (code, signal) => {
      clearTimeout(timer);
      const failure = signal ? `claude killed by ${signal}` : code ? `claude exited with ${code}: ${stderr.trim().split("\n").at(-1) ?? ""}` : undefined;
      resolve({ lines: stdout.split("\n").filter(Boolean), failure });
    });
  });
}

const only = values.only?.split(",");
const scenarios = SCENARIOS.filter((s) => !only || only.includes(s.id));
let passed = 0;
let cost = 0;
try {
  for (const scenario of scenarios) {
    const { lines, failure } = await runClaude(scenario.question);
    const calls = parseToolCalls(lines);
    const result = scoreScenario(calls, scenario.expect);
    const final = lines.map((l) => { try { return JSON.parse(l); } catch { return null; } }).find((e) => e?.type === "result");
    cost += final?.total_cost_usd ?? 0;
    if (result.pass) passed++;
    const reason = result.pass ? "" : [result.reason, failure].filter(Boolean).join("; ");
    console.log(`${result.pass ? "PASS" : "FAIL"}  ${scenario.id.padEnd(24)} ${calls.length} call(s)  ${reason}`);
  }
} finally {
  rmSync(tempDir, { recursive: true, force: true });
}
console.log(`\n${passed}/${scenarios.length} passed with ${values.model}, cost $${cost.toFixed(4)}`);
if (passed < scenarios.length) process.exitCode = 1;
