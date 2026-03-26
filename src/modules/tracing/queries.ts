const BASE = "/api/v1";

export function buildRunsPath(messageGuid: string): string {
  return `${BASE}/MessageProcessingLogs('${messageGuid}')/Runs`;
}

export function buildRunStepsPath(runId: string): string {
  return `${BASE}/MessageProcessingLogRuns('${runId}')/RunSteps`;
}

export function buildTraceMessagesPath(
  runId: string,
  childCount: number
): string {
  return `${BASE}/MessageProcessingLogRunSteps(RunId='${runId}',ChildCount=${childCount})/TraceMessages`;
}

export function buildTraceValuePath(traceId: string): string {
  return `${BASE}/TraceMessages(${traceId}L)/$value`;
}

export function buildTracePropertiesPath(traceId: string): string {
  return `${BASE}/TraceMessages(${traceId}L)/Properties`;
}

export function buildTraceExchangePropertiesPath(traceId: string): string {
  return `${BASE}/TraceMessages(${traceId}L)/ExchangeProperties`;
}
