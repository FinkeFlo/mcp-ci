import { escapeOData } from "../../core/odata-utils.js";

// --- Orphaned Interchanges ---
export const buildOrphanedInterchangesPath = () => "/api/v1/OrphanedInterchanges";
export const buildOrphanedInterchangePath = (id: string) =>
  `/api/v1/OrphanedInterchanges('${escapeOData(id)}')`;
export const buildOrphanedInterchangesCountPath = () => "/api/v1/OrphanedInterchanges/$count";
export const buildOrphanedInterchangeErrorDetailsPath = (id: string) =>
  `/api/v1/OrphanedInterchanges('${escapeOData(id)}')/ErrorDetails`;
export const buildOrphanedInterchangeEventsPath = (id: string) =>
  `/api/v1/OrphanedInterchanges('${escapeOData(id)}')/BusinessDocumentProcessingEvent`;
export const buildOrphanedInterchangePayloadsPath = (id: string) =>
  `/api/v1/OrphanedInterchanges('${escapeOData(id)}')/BusinessDocumentPayloads`;
export const buildOrphanedInterchangeHeadersPath = (id: string) =>
  `/api/v1/OrphanedInterchanges('${escapeOData(id)}')/BusinessDocumentProtocolHeaders`;

// --- Business Documents ---
export const buildBusinessDocumentsPath = () => "/api/v1/BusinessDocuments";
export const buildBusinessDocumentPath = (id: string) =>
  `/api/v1/BusinessDocuments('${escapeOData(id)}')`;
export const buildBusinessDocumentsCountPath = () => "/api/v1/BusinessDocuments/$count";
export const buildBusinessDocSenderTechAckPath = (id: string) =>
  `/api/v1/BusinessDocuments('${escapeOData(id)}')/SenderTechnicalAcknowledgement`;
export const buildBusinessDocReceiverTechAckPath = (id: string) =>
  `/api/v1/BusinessDocuments('${escapeOData(id)}')/ReceiverTechnicalAcknowledgement`;
export const buildBusinessDocSenderFuncAckPath = (id: string) =>
  `/api/v1/BusinessDocuments('${escapeOData(id)}')/SenderFunctionalAcknowledgement`;
export const buildBusinessDocReceiverFuncAckPath = (id: string) =>
  `/api/v1/BusinessDocuments('${escapeOData(id)}')/ReceiverFunctionalAcknowledgement`;
export const buildBusinessDocEventsPath = (id: string) =>
  `/api/v1/BusinessDocuments('${escapeOData(id)}')/BusinessDocumentProcessingEvents`;
export const buildBusinessDocPayloadsPath = (id: string) =>
  `/api/v1/BusinessDocuments('${escapeOData(id)}')/BusinessDocumentPayloads`;
export const buildBusinessDocPayloadValuePath = (id: string) =>
  `/api/v1/BusinessDocumentPayloads('${escapeOData(id)}')/$value`;
export const buildBusinessDocNotesPath = (id: string) =>
  `/api/v1/BusinessDocuments('${escapeOData(id)}')/BusinessDocumentNotes`;
export const buildBusinessDocCustomObjectsPath = (id: string) =>
  `/api/v1/BusinessDocuments('${escapeOData(id)}')/CustomObjects`;
export const buildBusinessDocExtFieldsPath = (id: string) =>
  `/api/v1/BusinessDocuments('${escapeOData(id)}')/BusinessDocumentExtFields`;
export const buildBusinessDocLastErrorPath = (id: string) =>
  `/api/v1/BusinessDocuments('${escapeOData(id)}')/LastErrorDetails`;
export const buildBusinessDocHeadersPath = (id: string) =>
  `/api/v1/BusinessDocuments('${escapeOData(id)}')/BusinessDocumentProtocolHeaders`;

// --- Acknowledgements ---
export const buildTechnicalAckPath = (id: string) =>
  `/api/v1/TechnicalAcknowledgements('${escapeOData(id)}')`;
export const buildTechnicalAckValuePath = (id: string) =>
  `/api/v1/TechnicalAcknowledgements('${escapeOData(id)}')/$value`;
export const buildFunctionalAckPath = (id: string) =>
  `/api/v1/FunctionalAcknowledgements('${escapeOData(id)}')`;
export const buildFunctionalAckValuePath = (id: string) =>
  `/api/v1/FunctionalAcknowledgements('${escapeOData(id)}')/$value`;

// --- B2B Archiving ---
export const buildActivateB2BArchivingPath = () => "/api/v1/activateB2BArchivingConfiguration";
export const buildB2BArchivingConfigPath = (tenantName: string) =>
  `/api/v1/B2BArchivingConfigurations('${escapeOData(tenantName)}')`;
export const buildB2BArchivingKpisPath = () => "/api/v1/B2BArchivingKeyPerformanceIndicators";
