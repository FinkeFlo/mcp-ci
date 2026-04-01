export function escapeOData(value: string): string {
  return value.replace(/'/g, "''");
}

export function stripMilliseconds(iso: string): string {
  return iso.replace(/\.\d{3}Z$/, "").replace(/Z$/, "");
}
