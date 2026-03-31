export interface LogFileArchive {
  Scope: string | null;
  LogFileType: string | null;
  NodeScope: string | null;
  ContentType: string | null;
}

export interface LogFile {
  Name: string | null;
  Application: string | null;
  LastModified: string | null;
  ContentType: string | null;
  LogFileType: string | null;
  NodeScope: string | null;
  Size: string | null;
}
