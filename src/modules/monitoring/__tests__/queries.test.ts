import { describe, it, expect } from "vitest";
import { buildListMessagesParams, buildGetErrorsParams } from "../queries.js";

describe("buildListMessagesParams", () => {
  it("returns default params when no filters given", () => {
    const params = buildListMessagesParams({});
    expect(params.$top).toBe(50);
    expect(params.$orderby).toBe("LogEnd desc");
    expect(params.$select).toBeDefined();
    expect(params.$filter).toBeUndefined();
  });
  it("filters by status", () => {
    expect(buildListMessagesParams({ status: "FAILED" }).$filter).toBe(
      "Status eq 'FAILED'"
    );
  });
  it("filters by integration flow name", () => {
    expect(buildListMessagesParams({ flowName: "MyFlow" }).$filter).toBe(
      "IntegrationFlowName eq 'MyFlow'"
    );
  });
  it("filters by time range", () => {
    expect(
      buildListMessagesParams({ from: "2026-03-26T00:00:00Z" }).$filter
    ).toBe("LogEnd ge datetime'2026-03-26T00:00:00Z'");
  });
  it("combines multiple filters with and", () => {
    expect(
      buildListMessagesParams({ status: "FAILED", flowName: "MyFlow" }).$filter
    ).toBe("Status eq 'FAILED' and IntegrationFlowName eq 'MyFlow'");
  });
  it("respects custom top with max 200", () => {
    expect(buildListMessagesParams({ top: 10 }).$top).toBe(10);
    expect(buildListMessagesParams({ top: 500 }).$top).toBe(200);
  });
  it("filters by correlationId", () => {
    expect(
      buildListMessagesParams({ correlationId: "corr-123" }).$filter
    ).toBe("CorrelationId eq 'corr-123'");
  });
  it("filters by applicationMessageId", () => {
    expect(
      buildListMessagesParams({ applicationMessageId: "app-456" }).$filter
    ).toBe("ApplicationMessageId eq 'app-456'");
  });
  it("escapes single quotes in filter values", () => {
    expect(
      buildListMessagesParams({ flowName: "Flow's_Test" }).$filter
    ).toBe("IntegrationFlowName eq 'Flow''s_Test'");
  });
  it("strips milliseconds from datetime filters", () => {
    expect(
      buildListMessagesParams({ from: "2026-03-26T10:00:00.123Z" }).$filter
    ).toBe("LogEnd ge datetime'2026-03-26T10:00:00Z'");
  });
});

describe("buildGetErrorsParams", () => {
  it("filters for FAILED status with default 1h time range", () => {
    const params = buildGetErrorsParams({});
    expect(params.$filter).toContain("Status eq 'FAILED'");
    expect(params.$filter).toContain("LogEnd ge datetime'");
    expect(params.$top).toBe(200);
    expect(params.$orderby).toBe("LogEnd desc");
  });
  it("uses custom time range", () => {
    const params = buildGetErrorsParams({ from: "2026-03-26T00:00:00Z" });
    expect(params.$filter).toContain(
      "LogEnd ge datetime'2026-03-26T00:00:00Z'"
    );
  });
  it("strips milliseconds from user-provided from value", () => {
    const params = buildGetErrorsParams({ from: "2026-03-26T10:00:00.456Z" });
    expect(params.$filter).toContain(
      "LogEnd ge datetime'2026-03-26T10:00:00Z'"
    );
  });
});
