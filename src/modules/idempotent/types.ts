export interface GenericIdempotentRepositoryEntry {
  HexVendor: string;
  HexSource: string;
  HexEntry: string;
  HexComponent: string;
  Source: string | null;
  Entry: string | null;
  Component: string | null;
  Vendor: string | null;
  CreationTime: string | null;
  ExpirationTime: string | null;
}

export interface IdempotentRepositoryEntry {
  HexSource: string;
  HexEntry: string;
  Source: string | null;
  Entry: string | null;
  Component: string | null;
  CreationTime: string | null;
  ExpirationTime: string | null;
}
