export interface ArchivingKeyPerformanceIndicators {
  RunStart: string | null;
  RunDurationInMinutes: string | null;
  DataCollectionDurationInMinutes: string | null;
  DataCompressionDurationInMinutes: string | null;
  DataUploadDurationInMinutes: string | null;
  MplsToBeArchived: string | null;
  MplsArchived: string | null;
  MplsArchivingFailed: string | null;
  MplsArchivedUntilDate: string | null;
  DateOfOldestMplToBeArchivedAfterRun: string | null;
  DataUploadedInMb: string | null;
  RunStatus: string | null;
  RunFailedPhase: string | null;
}
