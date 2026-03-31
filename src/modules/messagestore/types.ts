export interface MessageStoreEntry {
  Id: string | null;
  MessageGuid: string | null;
  MessageStoreId: string | null;
  TimeStamp: string | null;
  HasAttachments: boolean;
}

export interface MessageStoreEntryAttachment {
  Id: string | null;
  Name: string | null;
  ContentType: string | null;
}

export interface MessageStoreEntryProperty {
  MessageId: string | null;
  Name: string | null;
  Value: string | null;
}

export interface MessageStoreEntryAttachmentProperty {
  AttachmentId: string | null;
  Name: string | null;
  Value: string | null;
}

export interface JmsBroker {
  Key: string | null;
  Capacity: string | null;
  MaxCapacity: string | null;
  IsTransactedSessionsHigh: number | null;
  IsConsumersHigh: number | null;
  IsProducersHigh: number | null;
  MaxQueueNumber: string | null;
  QueueNumber: string | null;
  CapacityOk: string | null;
  CapacityWarning: string | null;
  CapacityError: string | null;
}

export interface NumberRange {
  Name: string | null;
  Description: string | null;
  MaxValue: string | null;
  MinValue: string | null;
  Rotate: string | null;
  CurrentValue: string | null;
  FieldLength: string | null;
  DeployedBy: string | null;
  DeployedOn: string | null;
}

export interface DataStore {
  DataStoreName: string | null;
  IntegrationFlow: string | null;
  Type: string | null;
  Visibility: string | null;
  NumberOfMessages: string | null;
  NumberOfOverdueMessages: string | null;
}

export interface DataStoreEntry {
  Id: string | null;
  DataStoreName: string | null;
  IntegrationFlow: string | null;
  Type: string | null;
  Status: string | null;
  MessageId: string | null;
  DueAt: string | null;
  CreatedAt: string | null;
  RetainUntil: string | null;
}

export interface Variable {
  VariableName: string | null;
  IntegrationFlow: string | null;
  Visibility: string | null;
  UpdatedAt: string | null;
  RetainUntil: string | null;
}
