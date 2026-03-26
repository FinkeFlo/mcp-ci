export interface MessageProcessingLogRun {
  Id: string;
  RunStart: string | null;
  RunStop: string | null;
  LogLevel: string | null;
  OverallState: string | null;
  ProcessId: string | null;
}

export interface MessageProcessingLogRunStep {
  RunId: string;
  ChildCount: number;
  StepStart: string | null;
  StepStop: string | null;
  StepId: string | null;
  ModelStepId: string | null;
  BranchId: string | null;
  Status: string | null;
  Error: string | null;
  Activity: string | null;
}

export interface TraceMessage {
  TraceId: string; // Edm.Int64 as string
  MplId: string;
  ModelStepId: string | null;
  PayloadSize: string | null; // Edm.Int64 as string
  MimeType: string | null;
}

export interface TraceMessageProperty {
  TraceId: string;
  Name: string;
  Value: string | null;
}
