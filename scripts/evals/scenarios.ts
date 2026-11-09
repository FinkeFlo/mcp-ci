export interface Scenario {
  id: string;
  /** An operator question, phrased the way a person would ask it. */
  question: string;
  /** The first mcp-ci call must use one of `tools`, with at least `args`, and set every key in `present`. */
  expect: { tools: string[]; args?: Record<string, unknown>; present?: string[] };
}

// Names and IDs are synthetic and match scripts/evals/mock-client.ts.
export const SCENARIOS: Scenario[] = [
  {
    id: "failures-why",
    question: "Which integration flows had failed messages recently, and what were the errors?",
    expect: { tools: ["get_errors"] },
  },
  {
    id: "failed-messages-24h",
    question: "Could you please tell me which messages have failed in the last 24 hours?",
    // Without from, get_errors only looks at the last hour.
    expect: { tools: ["get_errors"], present: ["from"] },
  },
  {
    id: "failed-messages-of-flow",
    question: "List each failed message of flow TestFlow_Orders with its message ID.",
    expect: { tools: ["list_messages"], args: { status: "FAILED", flowName: "TestFlow_Orders" } },
  },
  {
    id: "failures-count",
    question: "How many messages are in status FAILED right now? Just the number.",
    expect: { tools: ["count_messages"], args: { status: "FAILED" } },
  },
  {
    id: "failures-by-flow",
    question: "Group the failed messages by integration flow and give me the counts.",
    expect: { tools: ["aggregate_messages", "get_errors"] },
  },
  {
    id: "message-details",
    question: "Show me the details of message AAAAAAAAAAAAAAAAAAAAAAAAAA01.",
    expect: { tools: ["get_message"], args: { messageGuid: "AAAAAAAAAAAAAAAAAAAAAAAAAA01" } },
  },
  {
    id: "message-runs",
    question: "List the processing runs of message AAAAAAAAAAAAAAAAAAAAAAAAAA02.",
    expect: { tools: ["get_message_runs"], args: { messageGuid: "AAAAAAAAAAAAAAAAAAAAAAAAAA02" } },
  },
  {
    id: "run-steps",
    question: "Show the individual steps of run RUN_1 so I can see where it failed.",
    expect: { tools: ["get_run_steps"], args: { runId: "RUN_1" } },
  },
  {
    id: "deployed-errors",
    question: "Which deployed integration flows are currently in an error state?",
    expect: { tools: ["list_runtime_artifacts"] },
  },
  {
    id: "deploy-error-reason",
    question: "Why is the runtime artifact TestFlow_Customers in error? Get its deployment error.",
    expect: { tools: ["get_runtime_artifact_error"], args: { id: "TestFlow_Customers" } },
  },
  {
    id: "certs-expiring",
    question: "Which certificates in the system keystore expire within the next 30 days?",
    expect: { tools: ["list_keystore_entries"], args: { expiringWithinDays: 30 } },
  },
  {
    id: "packages",
    question: "List the integration packages on this tenant.",
    expect: { tools: ["list_packages"] },
  },
  {
    id: "package-value-mappings",
    question: "Which value mappings does package PKG_A contain?",
    expect: { tools: ["list_package_value_mappings"], args: { packageId: "PKG_A" } },
  },
  {
    id: "which-tenant",
    question: "Which tenant am I connected to, and is it read-only?",
    expect: { tools: ["get_tenant"] },
  },
];
