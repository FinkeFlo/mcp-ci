export interface IntegrationArtifact {
  Id: string | null;
  Name: string | null;
  Type: string | null;
  PackageId?: string | null;
  PackageName?: string | null;
}

export interface MessageProcessingLog {
  MessageGuid: string;
  CorrelationId: string | null;
  ApplicationMessageId: string | null;
  PredecessorMessageGuid?: string | null;
  ApplicationMessageType?: string | null;
  IntegrationFlowName: string | null;
  Status: string;
  CustomStatus?: string | null;
  LogLevel: string | null;
  Sender: string | null;
  Receiver: string | null;
  LogStart: string | null;
  LogEnd: string | null;
  AlternateWebLink: string | null;
  IntegrationArtifact: IntegrationArtifact;
  TransactionId?: string | null;
  PreviousComponentName?: string | null;
  LocalComponentName?: string | null;
  OriginComponentName?: string | null;
  ArchivingStatus?: string | null;
  ArchivingSenderChannelMessages?: string | null;
  ArchivingReceiverChannelMessages?: string | null;
  ArchivingLogAttachments?: string | null;
  ArchivingPersistedMessages?: string | null;
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

export interface MessageProcessingLogAttachment {
  Id: string;
  MessageGuid: string | null;
  TimeStamp: string | null;
  Name: string | null;
  ContentType: string | null;
  PayloadSize: string | null;
}

export interface MessageStoreEntry {
  Id: string;
  MessageGuid: string | null;
  MessageStoreId: string | null;
  TimeStamp: string | null;
  HasAttachments: boolean | null;
}
