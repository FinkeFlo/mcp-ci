import { describe, it, expect } from "vitest";
import { buildListMessagesParams, buildGetErrorsParams, buildCountParams } from "../queries.js";

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
    ).toBe("LogEnd ge datetime'2026-03-26T00:00:00'");
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
    ).toBe("LogEnd ge datetime'2026-03-26T10:00:00'");
  });
  it("builds filterCustomHeaderProperties for single header", () => {
    const params = buildListMessagesParams({
      customHeaders: { documentNumber: "1234567890" },
    });
    expect(params.filterCustomHeaderProperties).toBe(
      "'documentNumber' eq '1234567890'"
    );
  });
  it("combines multiple custom headers with and", () => {
    const params = buildListMessagesParams({
      customHeaders: { documentNumber: "1234567890", customerId: "0000012345" },
    });
    expect(params.filterCustomHeaderProperties).toContain(
      "'documentNumber' eq '1234567890'"
    );
    expect(params.filterCustomHeaderProperties).toContain(
      "'customerId' eq '0000012345'"
    );
    expect(params.filterCustomHeaderProperties).toContain(" and ");
  });
  it("escapes single quotes in custom header values", () => {
    const params = buildListMessagesParams({
      customHeaders: { key: "val'ue" },
    });
    expect(params.filterCustomHeaderProperties).toBe(
      "'key' eq 'val''ue'"
    );
  });
  it("does not set filterCustomHeaderProperties when empty", () => {
    expect(buildListMessagesParams({}).filterCustomHeaderProperties).toBeUndefined();
    expect(
      buildListMessagesParams({ customHeaders: {} }).filterCustomHeaderProperties
    ).toBeUndefined();
  });
});

describe("buildCountParams", () => {
  it("returns filter-only params without $top, $select, $orderby", () => {
    const params = buildCountParams({ status: "FAILED" });
    expect(params.$filter).toBe("Status eq 'FAILED'");
    expect(params.$top).toBeUndefined();
    expect(params.$select).toBeUndefined();
    expect(params.$orderby).toBeUndefined();
  });

  it("returns empty object when no filters given", () => {
    const params = buildCountParams({});
    expect(params.$filter).toBeUndefined();
    expect(Object.keys(params)).toHaveLength(0);
  });

  it("applies escapeOData and stripMilliseconds", () => {
    const params = buildCountParams({
      flowName: "Flow's_Test",
      from: "2026-03-26T10:00:00.123Z",
    });
    expect(params.$filter).toContain("IntegrationFlowName eq 'Flow''s_Test'");
    expect(params.$filter).toContain("LogEnd ge datetime'2026-03-26T10:00:00'");
  });

  it("includes filterCustomHeaderProperties for customHeaders", () => {
    const params = buildCountParams({
      customHeaders: { documentNumber: "1234567890" },
    });
    expect(params.filterCustomHeaderProperties).toBe(
      "'documentNumber' eq '1234567890'"
    );
    expect(params.$top).toBeUndefined();
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
      "LogEnd ge datetime'2026-03-26T00:00:00'"
    );
  });
  it("strips milliseconds from user-provided from value", () => {
    const params = buildGetErrorsParams({ from: "2026-03-26T10:00:00.456Z" });
    expect(params.$filter).toContain(
      "LogEnd ge datetime'2026-03-26T10:00:00'"
    );
  });
});
