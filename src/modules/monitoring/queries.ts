import type { ODataParams } from "../../core/odata-client.js";

const MPL_SELECT = [
  "MessageGuid",
  "CorrelationId",
  "ApplicationMessageId",
  "IntegrationFlowName",
  "Status",
  "LogLevel",
  "Sender",
  "Receiver",
  "LogStart",
  "LogEnd",
  "AlternateWebLink",
  "IntegrationArtifact",
].join(",");

export interface ListMessagesFilters {
  status?: string;
  flowName?: string;
  from?: string;
  to?: string;
  correlationId?: string;
  applicationMessageId?: string;
  top?: number;
}

export function buildListMessagesParams(
  filters: ListMessagesFilters
): ODataParams {
  const conditions: string[] = [];
  if (filters.status) conditions.push(`Status eq '${filters.status}'`);
  if (filters.flowName)
    conditions.push(`IntegrationFlowName eq '${filters.flowName}'`);
  if (filters.from) conditions.push(`LogEnd ge datetime'${filters.from}'`);
  if (filters.to) conditions.push(`LogEnd le datetime'${filters.to}'`);
  if (filters.correlationId)
    conditions.push(`CorrelationId eq '${filters.correlationId}'`);
  if (filters.applicationMessageId)
    conditions.push(
      `ApplicationMessageId eq '${filters.applicationMessageId}'`
    );

  const top = filters.top ? Math.min(filters.top, 200) : 50;

  return {
    $select: MPL_SELECT,
    $orderby: "LogEnd desc",
    $top: top,
    ...(conditions.length > 0 ? { $filter: conditions.join(" and ") } : {}),
  };
}

export function buildGetErrorsParams(filters: {
  from?: string;
}): ODataParams {
  const from =
    filters.from ??
    new Date(Date.now() - 3600_000).toISOString().replace(/\.\d{3}Z$/, "Z");

  return {
    $select: MPL_SELECT,
    $orderby: "LogEnd desc",
    $top: 200,
    $filter: `Status eq 'FAILED' and LogEnd ge datetime'${from}'`,
  };
}
