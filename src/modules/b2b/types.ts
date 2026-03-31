export interface OrphanedInterchange {
  Id: string | null;
  AdapterType: string | null;
  Date: string | null;
}

export interface BusinessDocument {
  Id: string | null;
  SenderMessageType: string | null;
  SenderGroupControlNumber: string | null;
  SenderDocumentStandard: string | null;
  SenderInterchangeControlNumber: string | null;
  SenderMessageNumber: string | null;
  SenderTradingPartnerName: string | null;
  SenderSystemId: string | null;
  SenderAdapterType: string | null;
  SenderCommunicationPartnerName: string | null;
  ReceiverMessageType: string | null;
  ReceiverGroupControlNumber: string | null;
  ReceiverDocumentStandard: string | null;
  ReceiverInterchangeControlNumber: string | null;
  ReceiverMessageNumber: string | null;
  ReceiverSystemId: string | null;
  ReceiverAdapterType: string | null;
  ReceiverTradingPartnerName: string | null;
  ReceiverCommunicationPartnerName: string | null;
  Bulk: boolean | null;
  TransactionDocumentType: string | null;
  ProcessingStatus: string | null;
  ReceiverFunctionalAckStatus: string | null;
  ReceiverTechnicalAckStatus: string | null;
  OverallStatus: string | null;
  StartedAt: string | null;
  EndedAt: string | null;
  DocumentCreationTime: string | null;
  TechnicalAckDueTime: string | null;
  FunctionalAckDueTime: string | null;
  ResendAllowed: boolean | null;
  RetryAllowed: boolean | null;
  AgreementTypeName: string | null;
  TransactionTypeName: string | null;
  ArchivingStatus: string | null;
  InterchangeName: string | null;
  InterchangeDirection: string | null;
  TransactionActivityType: string | null;
}

export interface BusinessDocumentProcessingEvent {
  Id: string | null;
  EventType: string | null;
  Date: string | null;
  MonitoringType: string | null;
  MonitoringId: string | null;
}

export interface BusinessDocumentPayload {
  Id: string | null;
  ProcessingState: string | null;
  Direction: string | null;
  PayloadId: string | null;
  PayloadContainerContentType: string | null;
  PayloadContentType: string | null;
  ArchivingRelevant: boolean | null;
}

export interface BusinessDocumentProtocolHeader {
  Id: string | null;
  Name: string | null;
  Value: string | null;
}

export interface BusinessDocumentNote {
  Id: string | null;
  User: string | null;
  CreatedAt: string | null;
  NoteContent: string | null;
}

export interface BusinessDocumentExtField {
  Id: string | null;
  Name: string | null;
  Value: string | null;
}

export interface CustomSearchAttribute {
  Id: string | null;
  Name: string | null;
  Value: string | null;
}

export interface ErrorDetail {
  Id: string | null;
  ErrorCategory: string | null;
  ErrorMessage: string | null;
}

export interface TechnicalAcknowledgement {
  Id: string | null;
  Type: string | null;
  Direction: string | null;
  PayloadId: string | null;
  Status: string | null;
  PayloadContainerContentType: string | null;
  PayloadContentType: string | null;
}

export interface FunctionalAcknowledgement {
  Id: string | null;
  Type: string | null;
  Direction: string | null;
  PayloadId: string | null;
  Status: string | null;
  PayloadContainerContentType: string | null;
  PayloadContentType: string | null;
}

export interface B2BArchivingConfiguration {
  TenantName: string | null;
  IsActivated: boolean | null;
}

export interface B2BArchivingKpi {
  RunStart: string | null;
  RunEnd: string | null;
  RunStatus: string | null;
  DocumentsArchived: string | null;
}
