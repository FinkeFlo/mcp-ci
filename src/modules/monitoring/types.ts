export interface MessageProcessingLog {
  MessageGuid: string;
  CorrelationId: string | null;
  ApplicationMessageId: string | null;
  IntegrationFlowName: string | null;
  Status: string;
  LogLevel: string | null;
  Sender: string | null;
  Receiver: string | null;
  LogStart: string | null;
  LogEnd: string | null;
  AlternateWebLink: string | null;
  IntegrationArtifact: {
    Id: string | null;
    Name: string | null;
    Type: string | null;
  };
}

export interface CustomHeaderProperty {
  Id: string;
  Name: string | null;
  Value: string | null;
}

export interface AdapterAttribute {
  Id: string;
  AdapterId: string | null;
  AdapterMessageId: string | null;
  Name: string | null;
  Value: string | null;
}
