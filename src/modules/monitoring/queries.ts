import type { ODataParams } from "../../core/odata-client.js";
import { escapeOData, stripMilliseconds } from "../../core/odata-utils.js";

const MPL_SELECT = [
  "MessageGuid",
  "CorrelationId",
  "ApplicationMessageId",
  "IntegrationFlowName",
  "Status",
  "CustomStatus",
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
  customStatus?: string;
  flowName?: string;
  from?: string;
  to?: string;
  correlationId?: string;
  applicationMessageId?: string;
  customHeaders?: Record<string, string>;
  top?: number;
}

export function buildListMessagesParams(
  filters: ListMessagesFilters
): ODataParams {
  const conditions: string[] = [];
  if (filters.status) conditions.push(`Status eq '${escapeOData(filters.status)}'`);
  if (filters.customStatus)
    conditions.push(`CustomStatus eq '${escapeOData(filters.customStatus)}'`);
  if (filters.flowName)
    conditions.push(`IntegrationFlowName eq '${escapeOData(filters.flowName)}'`);
  if (filters.from) conditions.push(`LogEnd ge datetime'${stripMilliseconds(filters.from)}'`);
  if (filters.to) conditions.push(`LogEnd le datetime'${stripMilliseconds(filters.to)}'`);
  if (filters.correlationId)
    conditions.push(`CorrelationId eq '${escapeOData(filters.correlationId)}'`);
  if (filters.applicationMessageId)
    conditions.push(
      `ApplicationMessageId eq '${escapeOData(filters.applicationMessageId)}'`
    );

  const top = filters.top ? Math.min(filters.top, 200) : 50;

  let chpFilter: string | undefined;
  if (filters.customHeaders && Object.keys(filters.customHeaders).length > 0) {
    chpFilter = Object.entries(filters.customHeaders)
      .map(([name, value]) => `'${escapeOData(name)}' eq '${escapeOData(value)}'`)
      .join(" and ");
  }

  return {
    $select: MPL_SELECT,
    $orderby: "LogEnd desc",
    $top: top,
    ...(conditions.length > 0 ? { $filter: conditions.join(" and ") } : {}),
    ...(chpFilter ? { filterCustomHeaderProperties: chpFilter } : {}),
  };
}

export function buildCountParams(
  filters: Omit<ListMessagesFilters, "top">
): ODataParams {
  const conditions: string[] = [];
  if (filters.status) conditions.push(`Status eq '${escapeOData(filters.status)}'`);
  if (filters.customStatus)
    conditions.push(`CustomStatus eq '${escapeOData(filters.customStatus)}'`);
  if (filters.flowName)
    conditions.push(`IntegrationFlowName eq '${escapeOData(filters.flowName)}'`);
  if (filters.from) conditions.push(`LogEnd ge datetime'${stripMilliseconds(filters.from)}'`);
  if (filters.to) conditions.push(`LogEnd le datetime'${stripMilliseconds(filters.to)}'`);
  if (filters.correlationId)
    conditions.push(`CorrelationId eq '${escapeOData(filters.correlationId)}'`);
  if (filters.applicationMessageId)
    conditions.push(
      `ApplicationMessageId eq '${escapeOData(filters.applicationMessageId)}'`
    );

  let chpFilter: string | undefined;
  if (filters.customHeaders && Object.keys(filters.customHeaders).length > 0) {
    chpFilter = Object.entries(filters.customHeaders)
      .map(([name, value]) => `'${escapeOData(name)}' eq '${escapeOData(value)}'`)
      .join(" and ");
  }

  return {
    ...(conditions.length > 0 ? { $filter: conditions.join(" and ") } : {}),
    ...(chpFilter ? { filterCustomHeaderProperties: chpFilter } : {}),
  };
}

export type AggregateField =
  | "flowName"
  | "status"
  | "customStatus"
  | "sender"
  | "receiver";

export const AGGREGATE_FIELD_TO_ODATA: Record<AggregateField, string> = {
  flowName: "IntegrationFlowName",
  status: "Status",
  customStatus: "CustomStatus",
  sender: "Sender",
  receiver: "Receiver",
};

export function buildAggregateParams(
  filters: Omit<ListMessagesFilters, "top">,
  groupBy: AggregateField,
  top: number,
  skip: number
): ODataParams {
  return {
    ...buildCountParams(filters),
    $select: AGGREGATE_FIELD_TO_ODATA[groupBy],
    $orderby: "LogEnd desc",
    $top: top,
    $skip: skip,
  };
}

export function buildErrorInformationPath(messageGuid: string): string {
  return `/api/v1/MessageProcessingLogs('${messageGuid}')/ErrorInformation`;
}

export function buildGetErrorsParams(filters: {
  from?: string;
  customStatus?: string;
}): ODataParams {
  const from = stripMilliseconds(
    filters.from ?? new Date(Date.now() - 3600_000).toISOString()
  );

  const conditions = [`Status eq 'FAILED'`, `LogEnd ge datetime'${from}'`];
  if (filters.customStatus)
    conditions.push(`CustomStatus eq '${escapeOData(filters.customStatus)}'`);

  return {
    $select: MPL_SELECT,
    $orderby: "LogEnd desc",
    $top: 200,
    $filter: conditions.join(" and "),
  };
}
