import { escapeOData } from "../../core/odata-utils.js";

export const buildLogFileArchivesPath = () =>
  "/api/v1/LogFileArchives";

export const buildLogFileArchivePath = (scope: string, logFileType: string) =>
  `/api/v1/LogFileArchives(Scope='${escapeOData(scope)}',LogFileType='${escapeOData(logFileType)}',NodeScope='worker')`;

export const buildLogFileArchiveValuePath = (scope: string, logFileType: string) =>
  `/api/v1/LogFileArchives(Scope='${escapeOData(scope)}',LogFileType='${escapeOData(logFileType)}',NodeScope='worker')/$value`;

export const buildLogFilesPath = () =>
  "/api/v1/LogFiles";

export const buildLogFilePath = (name: string, application: string) =>
  `/api/v1/LogFiles(Name='${escapeOData(name)}',Application='${escapeOData(application)}')`;

export const buildLogFileValuePath = (name: string, application: string) =>
  `/api/v1/LogFiles(Name='${escapeOData(name)}',Application='${escapeOData(application)}')/$value`;
