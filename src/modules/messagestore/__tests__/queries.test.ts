import { describe, it, expect } from "vitest";
import {
  buildMessageStoreEntriesPath,
  buildMessageStoreEntryPath,
  buildMessageStoreEntryValuePath,
  buildMessageStoreEntryAttachmentsPath,
  buildMessageStoreEntryAttachmentPath,
  buildMessageStoreEntryAttachmentValuePath,
  buildMessageStoreEntryAttachmentPropertiesPath,
  buildMessageStoreEntryAttachmentPropertyPath,
  buildMessageStoreEntryPropertiesPath,
  buildMessageStoreEntryPropertyPath,
  buildJmsBrokerPath,
  buildNumberRangesPath,
  buildNumberRangePath,
  buildDataStoresPath,
  buildDataStorePath,
  buildDataStoreEntriesPath,
  buildDataStoreEntriesByStorePath,
  buildDataStoreEntryPath,
  buildDataStoreEntryValuePath,
  buildVariablesPath,
  buildVariablePath,
  buildVariableValuePath,
} from "../queries.js";

describe("messagestore queries", () => {
  describe("Message Store Entries", () => {
    it("builds entries path by message GUID", () => {
      expect(buildMessageStoreEntriesPath("abc-123")).toBe(
        "/api/v1/MessageProcessingLogs('abc-123')/MessageStoreEntries"
      );
    });

    it("escapes single quotes in message GUID", () => {
      expect(buildMessageStoreEntriesPath("it's")).toBe(
        "/api/v1/MessageProcessingLogs('it''s')/MessageStoreEntries"
      );
    });

    it("builds entry path by ID", () => {
      expect(buildMessageStoreEntryPath("entry-1")).toBe(
        "/api/v1/MessageStoreEntries('entry-1')"
      );
    });

    it("builds entry value path", () => {
      expect(buildMessageStoreEntryValuePath("entry-1")).toBe(
        "/api/v1/MessageStoreEntries('entry-1')/$value"
      );
    });

    it("builds attachments path", () => {
      expect(buildMessageStoreEntryAttachmentsPath("entry-1")).toBe(
        "/api/v1/MessageStoreEntries('entry-1')/Attachments"
      );
    });

    it("builds attachment path by ID", () => {
      expect(buildMessageStoreEntryAttachmentPath("att-1")).toBe(
        "/api/v1/MessageStoreEntryAttachments('att-1')"
      );
    });

    it("builds attachment value path", () => {
      expect(buildMessageStoreEntryAttachmentValuePath("att-1")).toBe(
        "/api/v1/MessageStoreEntryAttachments('att-1')/$value"
      );
    });

    it("builds attachment properties path", () => {
      expect(buildMessageStoreEntryAttachmentPropertiesPath("att-1")).toBe(
        "/api/v1/MessageStoreEntryAttachments('att-1')/Properties"
      );
    });

    it("builds attachment property path with composite key", () => {
      expect(
        buildMessageStoreEntryAttachmentPropertyPath("att-1", "Content-Type")
      ).toBe(
        "/api/v1/MessageStoreEntryAttachmentProperties(AttachmentId='att-1',Name='Content-Type')"
      );
    });

    it("builds entry properties path", () => {
      expect(buildMessageStoreEntryPropertiesPath("entry-1")).toBe(
        "/api/v1/MessageStoreEntries('entry-1')/Properties"
      );
    });

    it("builds entry property path with composite key", () => {
      expect(
        buildMessageStoreEntryPropertyPath("entry-1", "X-receiver")
      ).toBe(
        "/api/v1/MessageStoreEntryProperties(MessageId='entry-1',Name='X-receiver')"
      );
    });

    it("escapes single quotes in composite keys", () => {
      expect(
        buildMessageStoreEntryAttachmentPropertyPath("att'1", "it's")
      ).toBe(
        "/api/v1/MessageStoreEntryAttachmentProperties(AttachmentId='att''1',Name='it''s')"
      );
    });
  });

  describe("JMS", () => {
    it("builds JMS broker path", () => {
      expect(buildJmsBrokerPath()).toBe("/api/v1/JmsBrokers('Broker1')");
    });
  });

  describe("Number Ranges", () => {
    it("builds number ranges collection path", () => {
      expect(buildNumberRangesPath()).toBe("/api/v1/NumberRanges");
    });

    it("builds number range path by name", () => {
      expect(buildNumberRangePath("NR1")).toBe(
        "/api/v1/NumberRanges('NR1')"
      );
    });

    it("escapes single quotes in number range name", () => {
      expect(buildNumberRangePath("it's")).toBe(
        "/api/v1/NumberRanges('it''s')"
      );
    });
  });

  describe("Data Stores", () => {
    it("builds data stores collection path", () => {
      expect(buildDataStoresPath()).toBe("/api/v1/DataStores");
    });

    it("builds data store path with composite key", () => {
      expect(buildDataStorePath("MyStore", "Flow1", "XI")).toBe(
        "/api/v1/DataStores(DataStoreName='MyStore',IntegrationFlow='Flow1',Type='XI')"
      );
    });

    it("builds data store entries collection path", () => {
      expect(buildDataStoreEntriesPath()).toBe("/api/v1/DataStoreEntries");
    });

    it("builds data store entries by store path", () => {
      expect(
        buildDataStoreEntriesByStorePath("MyStore", "Flow1", "XI")
      ).toBe(
        "/api/v1/DataStores(DataStoreName='MyStore',IntegrationFlow='Flow1',Type='XI')/Entries"
      );
    });

    it("builds data store entry path with 4-part composite key", () => {
      expect(
        buildDataStoreEntryPath("id-1", "MyStore", "Flow1", "XI")
      ).toBe(
        "/api/v1/DataStoreEntries(Id='id-1',DataStoreName='MyStore',IntegrationFlow='Flow1',Type='XI')"
      );
    });

    it("builds data store entry value path", () => {
      expect(
        buildDataStoreEntryValuePath("id-1", "MyStore", "Flow1", "XI")
      ).toBe(
        "/api/v1/DataStoreEntries(Id='id-1',DataStoreName='MyStore',IntegrationFlow='Flow1',Type='XI')/$value"
      );
    });

    it("handles empty type in composite key", () => {
      expect(buildDataStorePath("Store", "Flow", "")).toBe(
        "/api/v1/DataStores(DataStoreName='Store',IntegrationFlow='Flow',Type='')"
      );
    });

    it("escapes single quotes in composite keys", () => {
      expect(buildDataStorePath("it's", "flow'1", "t'ype")).toBe(
        "/api/v1/DataStores(DataStoreName='it''s',IntegrationFlow='flow''1',Type='t''ype')"
      );
    });
  });

  describe("Variables", () => {
    it("builds variables collection path", () => {
      expect(buildVariablesPath()).toBe("/api/v1/Variables");
    });

    it("builds variable path with composite key", () => {
      expect(buildVariablePath("myVar", "Flow1")).toBe(
        "/api/v1/Variables(VariableName='myVar',IntegrationFlow='Flow1')"
      );
    });

    it("builds variable value path", () => {
      expect(buildVariableValuePath("myVar", "Flow1")).toBe(
        "/api/v1/Variables(VariableName='myVar',IntegrationFlow='Flow1')/$value"
      );
    });

    it("escapes single quotes in variable composite key", () => {
      expect(buildVariablePath("it's", "flow'1")).toBe(
        "/api/v1/Variables(VariableName='it''s',IntegrationFlow='flow''1')"
      );
    });
  });
});
