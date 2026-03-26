import { describe, it, expect } from "vitest";
import {
  buildRunsPath,
  buildRunStepsPath,
  buildTraceMessagesPath,
  buildTraceValuePath,
  buildTracePropertiesPath,
  buildTraceExchangePropertiesPath,
} from "../queries.js";

describe("tracing query paths", () => {
  it("builds runs path from MessageGuid", () => {
    expect(buildRunsPath("abc-123")).toBe(
      "/api/v1/MessageProcessingLogs('abc-123')/Runs"
    );
  });

  it("builds run steps path from RunId", () => {
    expect(buildRunStepsPath("run-456")).toBe(
      "/api/v1/MessageProcessingLogRuns('run-456')/RunSteps"
    );
  });

  it("builds trace messages path from composite key", () => {
    expect(buildTraceMessagesPath("run-456", 3)).toBe(
      "/api/v1/MessageProcessingLogRunSteps(RunId='run-456',ChildCount=3)/TraceMessages"
    );
  });

  it("builds trace value path with L suffix for Int64 key", () => {
    expect(buildTraceValuePath("12345")).toBe(
      "/api/v1/TraceMessages(12345L)/$value"
    );
  });

  it("builds trace properties path with L suffix", () => {
    expect(buildTracePropertiesPath("12345")).toBe(
      "/api/v1/TraceMessages(12345L)/Properties"
    );
  });

  it("builds trace exchange properties path with L suffix", () => {
    expect(buildTraceExchangePropertiesPath("12345")).toBe(
      "/api/v1/TraceMessages(12345L)/ExchangeProperties"
    );
  });
});
