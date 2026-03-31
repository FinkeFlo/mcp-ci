export interface IdMapEntry {
  FromId: string;
  ToId: string;
  Mapper: string | null;
  ExpirationTime: string | null;
  Qualifier: string | null;
  Context: string | null;
}
