import type { ODataClient, ODataParams } from "../../src/core/odata-client.js";

const HOUR = 3_600_000;
const DAY = 24 * HOUR;
const date = (ms: number) => `/Date(${ms})/`;
const now = Date.now();

function message(i: number, flow: string, status: string) {
  return {
    MessageGuid: `AAAAAAAAAAAAAAAAAAAAAAAAAA${String(i).padStart(2, "0")}`,
    CorrelationId: `corr-${i}`,
    ApplicationMessageId: null,
    IntegrationFlowName: flow,
    Status: status,
    CustomStatus: status,
    LogLevel: "INFO",
    Sender: "SenderSystem",
    Receiver: "ReceiverSystem",
    LogStart: date(now - i * HOUR),
    LogEnd: date(now - i * HOUR + 2000),
    AlternateWebLink: null,
    IntegrationArtifact: { Id: flow, Name: flow, Type: "INTEGRATION_FLOW", PackageId: "PKG_A", PackageName: "Package A" },
  };
}

// Synthetic tenant: a few flows, some failed messages, one flow in deployment error.
const MESSAGES = [
  ...[1, 2, 3, 4].map((i) => message(i, "TestFlow_Orders", "FAILED")),
  ...[5, 6].map((i) => message(i, "TestFlow_Invoices", "FAILED")),
  ...[7, 8, 9, 10].map((i) => message(i, "TestFlow_Orders", "COMPLETED")),
];
const ARTIFACTS = [
  { Id: "TestFlow_Orders", Version: "1.0.3", Name: "TestFlow_Orders", Type: "INTEGRATION_FLOW", DeployedBy: "operator", DeployedOn: date(now - 9 * DAY), Status: "STARTED" },
  { Id: "TestFlow_Invoices", Version: "2.1.0", Name: "TestFlow_Invoices", Type: "INTEGRATION_FLOW", DeployedBy: "operator", DeployedOn: date(now - 3 * DAY), Status: "STARTED" },
  { Id: "TestFlow_Customers", Version: "1.0.0", Name: "TestFlow_Customers", Type: "INTEGRATION_FLOW", DeployedBy: "operator", DeployedOn: date(now - DAY), Status: "ERROR" },
];
const KEYSTORE = [
  { Hexalias: "73696768", Alias: "signing_key", KeyType: "RSA", KeySize: 2048, ValidNotBefore: date(now - 300 * DAY), ValidNotAfter: date(now + 12 * DAY), Owner: "Tenant", Status: "ACTIVE" },
  { Hexalias: "726f6f74", Alias: "partner_root_ca", KeyType: "RSA", KeySize: 4096, ValidNotBefore: date(now - 900 * DAY), ValidNotAfter: date(now + 700 * DAY), Owner: "SAP", Status: "ACTIVE" },
  { Hexalias: "6f6c64", Alias: "old_partner_cert", KeyType: "RSA", KeySize: 2048, ValidNotBefore: date(now - 800 * DAY), ValidNotAfter: date(now - 4 * DAY), Owner: "Tenant", Status: "ACTIVE" },
];
const PACKAGES = [
  { Id: "PKG_A", Name: "Package A", Description: "Order processing", Version: "1.2.0", Vendor: "Example", Mode: "EDIT_ALLOWED" },
  { Id: "PKG_B", Name: "Package B", Description: "Invoicing", Version: "1.0.0", Vendor: "Example", Mode: "EDIT_ALLOWED" },
];

function byStatus<T extends { Status: string }>(rows: T[], params?: ODataParams): T[] {
  const status = /Status eq '([A-Z]+)'/.exec(params?.$filter ?? "")?.[1];
  return status ? rows.filter((row) => row.Status === status) : rows;
}

/**
 * A read-only stand-in for ODataClient with synthetic data, so evals run
 * without a tenant or credentials. Unknown paths return empty results.
 */
export function createMockClient(): ODataClient {
  const client = {
    async getCollection(path: string, params?: ODataParams) {
      if (/MessageProcessingLogs\('[^']*'\)\/Runs/.test(path)) {
        return [{ Id: "RUN_1", OverallState: "FAILED", LogLevel: "INFO", RunStart: date(now - HOUR), RunStop: date(now - HOUR + 2000) }];
      }
      if (/MessageProcessingLogRuns\('[^']*'\)\/RunSteps/.test(path)) {
        return [
          { RunId: "RUN_1", ChildCount: 1, Activity: "StartEvent", Status: "COMPLETED", StepStart: date(now - HOUR), StepStop: date(now - HOUR), StepId: "s1", ModelStepId: "m1", BranchId: null, Error: null },
          { RunId: "RUN_1", ChildCount: 2, Activity: "Request Reply", Status: "FAILED", StepStart: date(now - HOUR), StepStop: date(now - HOUR), StepId: "s2", ModelStepId: "m2", BranchId: null, Error: "HTTP 503 from receiver" },
        ];
      }
      if (path.includes("/MessageProcessingLogs")) return byStatus(MESSAGES, params).slice(0, params?.$top ?? 200);
      if (path.includes("/IntegrationRuntimeArtifacts")) return byStatus(ARTIFACTS, params);
      if (path.includes("/KeystoreEntries")) return KEYSTORE;
      if (path.includes("/IntegrationPackages")) return PACKAGES;
      return [];
    },
    async getEntity(path: string) {
      const guid = /MessageProcessingLogs\('([^']*)'\)/.exec(path)?.[1];
      if (guid) return MESSAGES.find((m) => m.MessageGuid === guid) ?? MESSAGES[0];
      if (path.includes("/IntegrationRuntimeArtifacts")) return ARTIFACTS[2];
      if (path.includes("/IntegrationPackages")) return PACKAGES[0];
      return {};
    },
    async getValue(path: string) {
      if (path.includes("/IntegrationRuntimeArtifacts")) {
        if (path.includes("$count")) return String(ARTIFACTS.length);
        return JSON.stringify({ message: { subsystemName: "Deploy", messageId: "DEPLOY_FAILED" }, parameter: ["Endpoint /orders already used by TestFlow_Orders"] });
      }
      if (path.includes("$count")) return String(MESSAGES.filter((m) => m.Status === "FAILED").length);
      if (path.includes("ErrorInformation")) return "com.example.ReceiverException: HTTP 503 Service Unavailable from receiver";
      return "";
    },
    async post(): Promise<never> {
      throw new Error("The eval backend is read-only");
    },
    async put(): Promise<never> {
      throw new Error("The eval backend is read-only");
    },
    async delete(): Promise<never> {
      throw new Error("The eval backend is read-only");
    },
  };
  return client as unknown as ODataClient;
}
