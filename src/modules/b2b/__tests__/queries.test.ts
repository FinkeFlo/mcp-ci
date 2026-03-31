import { describe, it, expect } from "vitest";
import {
  buildOrphanedInterchangesPath,
  buildOrphanedInterchangePath,
  buildOrphanedInterchangesCountPath,
  buildOrphanedInterchangeErrorDetailsPath,
  buildOrphanedInterchangeEventsPath,
  buildOrphanedInterchangePayloadsPath,
  buildOrphanedInterchangeHeadersPath,
  buildBusinessDocumentsPath,
  buildBusinessDocumentPath,
  buildBusinessDocumentsCountPath,
  buildBusinessDocSenderTechAckPath,
  buildBusinessDocReceiverTechAckPath,
  buildBusinessDocSenderFuncAckPath,
  buildBusinessDocReceiverFuncAckPath,
  buildBusinessDocEventsPath,
  buildBusinessDocPayloadsPath,
  buildBusinessDocPayloadValuePath,
  buildBusinessDocNotesPath,
  buildBusinessDocCustomObjectsPath,
  buildBusinessDocExtFieldsPath,
  buildBusinessDocLastErrorPath,
  buildBusinessDocHeadersPath,
  buildTechnicalAckPath,
  buildTechnicalAckValuePath,
  buildFunctionalAckPath,
  buildFunctionalAckValuePath,
  buildActivateB2BArchivingPath,
  buildB2BArchivingConfigPath,
  buildB2BArchivingKpisPath,
} from "../queries.js";

describe("Orphaned interchange paths", () => {
  it("builds collection path", () => {
    expect(buildOrphanedInterchangesPath()).toBe("/api/v1/OrphanedInterchanges");
  });

  it("builds single interchange path", () => {
    expect(buildOrphanedInterchangePath("abc-123")).toBe(
      "/api/v1/OrphanedInterchanges('abc-123')"
    );
  });

  it("builds count path", () => {
    expect(buildOrphanedInterchangesCountPath()).toBe("/api/v1/OrphanedInterchanges/$count");
  });

  it("builds error details navigation path", () => {
    expect(buildOrphanedInterchangeErrorDetailsPath("abc-123")).toBe(
      "/api/v1/OrphanedInterchanges('abc-123')/ErrorDetails"
    );
  });

  it("builds events navigation path", () => {
    expect(buildOrphanedInterchangeEventsPath("abc-123")).toBe(
      "/api/v1/OrphanedInterchanges('abc-123')/BusinessDocumentProcessingEvent"
    );
  });

  it("builds payloads navigation path", () => {
    expect(buildOrphanedInterchangePayloadsPath("abc-123")).toBe(
      "/api/v1/OrphanedInterchanges('abc-123')/BusinessDocumentPayloads"
    );
  });

  it("builds headers navigation path", () => {
    expect(buildOrphanedInterchangeHeadersPath("abc-123")).toBe(
      "/api/v1/OrphanedInterchanges('abc-123')/BusinessDocumentProtocolHeaders"
    );
  });

  it("escapes single quotes in id", () => {
    expect(buildOrphanedInterchangePath("id's")).toBe(
      "/api/v1/OrphanedInterchanges('id''s')"
    );
  });
});

describe("Business document paths", () => {
  it("builds collection path", () => {
    expect(buildBusinessDocumentsPath()).toBe("/api/v1/BusinessDocuments");
  });

  it("builds single document path", () => {
    expect(buildBusinessDocumentPath("doc-456")).toBe(
      "/api/v1/BusinessDocuments('doc-456')"
    );
  });

  it("builds count path", () => {
    expect(buildBusinessDocumentsCountPath()).toBe("/api/v1/BusinessDocuments/$count");
  });

  it("builds sender tech ack path", () => {
    expect(buildBusinessDocSenderTechAckPath("doc-456")).toBe(
      "/api/v1/BusinessDocuments('doc-456')/SenderTechnicalAcknowledgement"
    );
  });

  it("builds receiver tech ack path", () => {
    expect(buildBusinessDocReceiverTechAckPath("doc-456")).toBe(
      "/api/v1/BusinessDocuments('doc-456')/ReceiverTechnicalAcknowledgement"
    );
  });

  it("builds sender func ack path", () => {
    expect(buildBusinessDocSenderFuncAckPath("doc-456")).toBe(
      "/api/v1/BusinessDocuments('doc-456')/SenderFunctionalAcknowledgement"
    );
  });

  it("builds receiver func ack path", () => {
    expect(buildBusinessDocReceiverFuncAckPath("doc-456")).toBe(
      "/api/v1/BusinessDocuments('doc-456')/ReceiverFunctionalAcknowledgement"
    );
  });

  it("builds events path", () => {
    expect(buildBusinessDocEventsPath("doc-456")).toBe(
      "/api/v1/BusinessDocuments('doc-456')/BusinessDocumentProcessingEvents"
    );
  });

  it("builds payloads path", () => {
    expect(buildBusinessDocPayloadsPath("doc-456")).toBe(
      "/api/v1/BusinessDocuments('doc-456')/BusinessDocumentPayloads"
    );
  });

  it("builds payload value path", () => {
    expect(buildBusinessDocPayloadValuePath("payload-789")).toBe(
      "/api/v1/BusinessDocumentPayloads('payload-789')/$value"
    );
  });

  it("builds notes path", () => {
    expect(buildBusinessDocNotesPath("doc-456")).toBe(
      "/api/v1/BusinessDocuments('doc-456')/BusinessDocumentNotes"
    );
  });

  it("builds custom objects path", () => {
    expect(buildBusinessDocCustomObjectsPath("doc-456")).toBe(
      "/api/v1/BusinessDocuments('doc-456')/CustomObjects"
    );
  });

  it("builds ext fields path", () => {
    expect(buildBusinessDocExtFieldsPath("doc-456")).toBe(
      "/api/v1/BusinessDocuments('doc-456')/BusinessDocumentExtFields"
    );
  });

  it("builds last error path", () => {
    expect(buildBusinessDocLastErrorPath("doc-456")).toBe(
      "/api/v1/BusinessDocuments('doc-456')/LastErrorDetails"
    );
  });

  it("builds headers path", () => {
    expect(buildBusinessDocHeadersPath("doc-456")).toBe(
      "/api/v1/BusinessDocuments('doc-456')/BusinessDocumentProtocolHeaders"
    );
  });

  it("escapes single quotes in document id", () => {
    expect(buildBusinessDocumentPath("doc's")).toBe(
      "/api/v1/BusinessDocuments('doc''s')"
    );
  });
});

describe("Acknowledgement paths", () => {
  it("builds technical ack path", () => {
    expect(buildTechnicalAckPath("ack-001")).toBe(
      "/api/v1/TechnicalAcknowledgements('ack-001')"
    );
  });

  it("builds technical ack value path", () => {
    expect(buildTechnicalAckValuePath("ack-001")).toBe(
      "/api/v1/TechnicalAcknowledgements('ack-001')/$value"
    );
  });

  it("builds functional ack path", () => {
    expect(buildFunctionalAckPath("ack-002")).toBe(
      "/api/v1/FunctionalAcknowledgements('ack-002')"
    );
  });

  it("builds functional ack value path", () => {
    expect(buildFunctionalAckValuePath("ack-002")).toBe(
      "/api/v1/FunctionalAcknowledgements('ack-002')/$value"
    );
  });

  it("escapes single quotes in ack id", () => {
    expect(buildTechnicalAckPath("ack's")).toBe(
      "/api/v1/TechnicalAcknowledgements('ack''s')"
    );
  });
});

describe("B2B archiving paths", () => {
  it("builds activate archiving path", () => {
    expect(buildActivateB2BArchivingPath()).toBe("/api/v1/activateB2BArchivingConfiguration");
  });

  it("builds archiving config path", () => {
    expect(buildB2BArchivingConfigPath("myTenant")).toBe(
      "/api/v1/B2BArchivingConfigurations('myTenant')"
    );
  });

  it("builds archiving KPIs path", () => {
    expect(buildB2BArchivingKpisPath()).toBe("/api/v1/B2BArchivingKeyPerformanceIndicators");
  });

  it("escapes single quotes in tenant name", () => {
    expect(buildB2BArchivingConfigPath("tenant's")).toBe(
      "/api/v1/B2BArchivingConfigurations('tenant''s')"
    );
  });
});
