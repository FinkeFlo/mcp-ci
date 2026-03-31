import { describe, it, expect } from "vitest";
import {
  buildLogFileArchivesPath,
  buildLogFileArchivePath,
  buildLogFileArchiveValuePath,
  buildLogFilesPath,
  buildLogFilePath,
  buildLogFileValuePath,
} from "../queries.js";

describe("buildLogFileArchivesPath", () => {
  it("builds collection path", () => {
    expect(buildLogFileArchivesPath()).toBe("/api/v1/LogFileArchives");
  });
});

describe("buildLogFileArchivePath", () => {
  it("builds entity path with composite key", () => {
    expect(buildLogFileArchivePath("all", "http")).toBe(
      "/api/v1/LogFileArchives(Scope='all',LogFileType='http',NodeScope='worker')"
    );
  });

  it("escapes single quotes in scope", () => {
    expect(buildLogFileArchivePath("te'st", "trace")).toBe(
      "/api/v1/LogFileArchives(Scope='te''st',LogFileType='trace',NodeScope='worker')"
    );
  });

  it("escapes single quotes in logFileType", () => {
    expect(buildLogFileArchivePath("latest", "tra'ce")).toBe(
      "/api/v1/LogFileArchives(Scope='latest',LogFileType='tra''ce',NodeScope='worker')"
    );
  });
});

describe("buildLogFileArchiveValuePath", () => {
  it("builds $value path for download", () => {
    expect(buildLogFileArchiveValuePath("latest", "trace")).toBe(
      "/api/v1/LogFileArchives(Scope='latest',LogFileType='trace',NodeScope='worker')/$value"
    );
  });

  it("escapes single quotes", () => {
    expect(buildLogFileArchiveValuePath("al'l", "http")).toBe(
      "/api/v1/LogFileArchives(Scope='al''l',LogFileType='http',NodeScope='worker')/$value"
    );
  });
});

describe("buildLogFilesPath", () => {
  it("builds collection path", () => {
    expect(buildLogFilesPath()).toBe("/api/v1/LogFiles");
  });
});

describe("buildLogFilePath", () => {
  it("builds entity path with composite key", () => {
    expect(buildLogFilePath("ljs_trace_2026-03-31.log", "myapp")).toBe(
      "/api/v1/LogFiles(Name='ljs_trace_2026-03-31.log',Application='myapp')"
    );
  });

  it("escapes single quotes in name", () => {
    expect(buildLogFilePath("file'name.log", "app")).toBe(
      "/api/v1/LogFiles(Name='file''name.log',Application='app')"
    );
  });

  it("escapes single quotes in application", () => {
    expect(buildLogFilePath("file.log", "my'app")).toBe(
      "/api/v1/LogFiles(Name='file.log',Application='my''app')"
    );
  });
});

describe("buildLogFileValuePath", () => {
  it("builds $value path for download", () => {
    expect(buildLogFileValuePath("trace.log", "myapp")).toBe(
      "/api/v1/LogFiles(Name='trace.log',Application='myapp')/$value"
    );
  });

  it("escapes single quotes", () => {
    expect(buildLogFileValuePath("file'name.log", "my'app")).toBe(
      "/api/v1/LogFiles(Name='file''name.log',Application='my''app')/$value"
    );
  });
});
