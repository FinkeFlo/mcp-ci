export function toHex(value: string): string {
  return Buffer.from(value, "utf-8").toString("hex");
}

export function buildEntriesPath(id: string): string {
  return `/api/v1/GenericIdempotentRepositoryEntries?id=${encodeURIComponent(id)}`;
}

export function buildEntryPath(
  vendor: string,
  source: string,
  entry: string,
  component: string
): string {
  return `/api/v1/GenericIdempotentRepositoryEntries(HexVendor='${toHex(vendor)}',HexSource='${toHex(source)}',HexEntry='${toHex(entry)}',HexComponent='${toHex(component)}')`;
}
