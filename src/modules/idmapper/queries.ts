function escapeOData(value: string): string {
  return value.replace(/'/g, "''");
}

export function buildFromIdPath(sourceId: string): string {
  return `/api/v1/IdMapFromIds('${escapeOData(sourceId)}')/ToIds`;
}

export function buildToIdPath(targetId: string): string {
  return `/api/v1/IdMapToIds('${escapeOData(targetId)}')/FromId2s`;
}
