import { describe, it, expect } from "vitest";
import { categoryForPath } from "../category-for-path.js";

describe("categoryForPath", () => {
  const cases: Array<[string, string]> = [
    // MPL / monitoring family
    ["/api/v1/MessageProcessingLogs", "mpl"],
    ["/api/v1/MessageProcessingLogs('abc')/Runs", "mpl"],
    ["/api/v1/TraceMessages(12345L)/$value", "mpl"],
    ["/api/v1/MessageStoreEntries('e1')/$value", "mpl"],
    ["/api/v1/DataStoreEntries", "mpl"],
    ["/api/v1/Variables", "mpl"],
    ["/api/v1/JmsBrokers('Broker1')", "mpl"],
    ["/api/v1/IdMapFromIds('SRC')/ToIds", "mpl"],
    ["/api/v1/IdempotentRepositoryEntries?id=x", "mpl"],
    ["/api/v1/LogFiles", "mpl"],
    ["/api/v1/OrphanedInterchanges", "mpl"],
    ["/api/v1/BusinessDocuments('id')/BusinessDocumentPayloads", "mpl"],
    ["/api/v1/B2BArchivingKeyPerformanceIndicators", "mpl"],
    // Design time
    ["/api/v1/IntegrationPackages('pkg1')", "designtime"],
    ["/api/v1/IntegrationDesigntimeArtifacts(Id='f',Version='active')", "designtime"],
    ["/api/v1/DeployIntegrationDesigntimeArtifact?Id='f'&Version='1.0.0'", "designtime"],
    ["/api/v1/MessageMappingDesigntimeArtifacts", "designtime"],
    // Runtime
    ["/api/v1/IntegrationRuntimeArtifacts('flow1')", "runtime"],
    ["/api/v1/ServiceEndpoints", "runtime"],
    ["/api/v1/BuildAndDeployStatus", "runtime"],
    // Security
    ["/api/v1/UserCredentials('u')", "security"],
    ["/api/v1/KeystoreEntries('k')/Certificate/$value", "security"],
    ["/api/v1/OAuth2ClientCredentials", "security"],
    ["/api/v1/CertificateResources('c')/$value", "security"],
    // Number range
    ["/api/v1/NumberRanges('nr')", "numberRange"],
  ];

  it.each(cases)("maps %s -> %s", (path, expected) => {
    expect(categoryForPath(path)).toBe(expected);
  });

  it("falls back to default for unknown entities", () => {
    expect(categoryForPath("/api/v1/SomethingBrandNew")).toBe("default");
  });

  it("falls back to default for the CSRF root path (no entity segment)", () => {
    expect(categoryForPath("/api/v1/")).toBe("default");
  });

  it("falls back to default for a non-matching path", () => {
    expect(categoryForPath("/health")).toBe("default");
  });
});
