import { escapeOData } from "../../core/odata-utils.js";

// --- Message Store Entries ---
export const buildMessageStoreEntriesPath = (messageGuid: string) =>
  `/api/v1/MessageProcessingLogs('${escapeOData(messageGuid)}')/MessageStoreEntries`;
export const buildMessageStoreEntryPath = (entryId: string) =>
  `/api/v1/MessageStoreEntries('${escapeOData(entryId)}')`;
export const buildMessageStoreEntryValuePath = (entryId: string) =>
  `/api/v1/MessageStoreEntries('${escapeOData(entryId)}')/$value`;
export const buildMessageStoreEntryAttachmentsPath = (entryId: string) =>
  `/api/v1/MessageStoreEntries('${escapeOData(entryId)}')/Attachments`;
export const buildMessageStoreEntryAttachmentPath = (attachmentId: string) =>
  `/api/v1/MessageStoreEntryAttachments('${escapeOData(attachmentId)}')`;
export const buildMessageStoreEntryAttachmentValuePath = (attachmentId: string) =>
  `/api/v1/MessageStoreEntryAttachments('${escapeOData(attachmentId)}')/$value`;
export const buildMessageStoreEntryAttachmentPropertiesPath = (attachmentId: string) =>
  `/api/v1/MessageStoreEntryAttachments('${escapeOData(attachmentId)}')/Properties`;
export const buildMessageStoreEntryAttachmentPropertyPath = (attachmentId: string, name: string) =>
  `/api/v1/MessageStoreEntryAttachmentProperties(AttachmentId='${escapeOData(attachmentId)}',Name='${escapeOData(name)}')`;
export const buildMessageStoreEntryPropertiesPath = (entryId: string) =>
  `/api/v1/MessageStoreEntries('${escapeOData(entryId)}')/Properties`;
export const buildMessageStoreEntryPropertyPath = (entryId: string, propertyName: string) =>
  `/api/v1/MessageStoreEntryProperties(MessageId='${escapeOData(entryId)}',Name='${escapeOData(propertyName)}')`;

// --- JMS ---
export const buildJmsBrokerPath = () => "/api/v1/JmsBrokers('Broker1')";

// --- Number Ranges ---
export const buildNumberRangesPath = () => "/api/v1/NumberRanges";
export const buildNumberRangePath = (name: string) =>
  `/api/v1/NumberRanges('${escapeOData(name)}')`;

// --- Data Stores ---
export const buildDataStoresPath = () => "/api/v1/DataStores";
export const buildDataStorePath = (name: string, integrationFlow: string, type: string) =>
  `/api/v1/DataStores(DataStoreName='${escapeOData(name)}',IntegrationFlow='${escapeOData(integrationFlow)}',Type='${escapeOData(type)}')`;
export const buildDataStoreEntriesPath = () => "/api/v1/DataStoreEntries";
export const buildDataStoreEntriesByStorePath = (name: string, integrationFlow: string, type: string) =>
  `/api/v1/DataStores(DataStoreName='${escapeOData(name)}',IntegrationFlow='${escapeOData(integrationFlow)}',Type='${escapeOData(type)}')/Entries`;
export const buildDataStoreEntryPath = (id: string, name: string, integrationFlow: string, type: string) =>
  `/api/v1/DataStoreEntries(Id='${escapeOData(id)}',DataStoreName='${escapeOData(name)}',IntegrationFlow='${escapeOData(integrationFlow)}',Type='${escapeOData(type)}')`;
export const buildDataStoreEntryValuePath = (id: string, name: string, integrationFlow: string, type: string) =>
  `/api/v1/DataStoreEntries(Id='${escapeOData(id)}',DataStoreName='${escapeOData(name)}',IntegrationFlow='${escapeOData(integrationFlow)}',Type='${escapeOData(type)}')/$value`;

// --- Variables ---
export const buildVariablesPath = () => "/api/v1/Variables";
export const buildVariablePath = (name: string, integrationFlow: string) =>
  `/api/v1/Variables(VariableName='${escapeOData(name)}',IntegrationFlow='${escapeOData(integrationFlow)}')`;
export const buildVariableValuePath = (name: string, integrationFlow: string) =>
  `/api/v1/Variables(VariableName='${escapeOData(name)}',IntegrationFlow='${escapeOData(integrationFlow)}')/$value`;
