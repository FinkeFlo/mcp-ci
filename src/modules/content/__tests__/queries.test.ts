import { describe, it, expect } from "vitest";
import {
  buildRuntimeArtifactPath,
  buildRuntimeArtifactErrorPath,
  buildDesigntimeArtifactPath,
  buildDesigntimeArtifactValuePath,
  buildConfigurationLinkPath,
  buildResourcePath,
  buildResourceValuePath,
  buildGuidelineResultsPath,
  buildGuidelineResultPath,
  buildExecuteGuidelinesPath,
  buildTypeArtifactsPath,
  buildTypeArtifactPath,
  buildMdiDeltaTokenPath,
} from "../queries.js";

describe("Runtime artifact paths", () => {
  it("builds single-key path", () => {
    expect(buildRuntimeArtifactPath("MyIFlow")).toBe(
      "/api/v1/IntegrationRuntimeArtifacts('MyIFlow')"
    );
  });

  it("escapes single quotes in id", () => {
    expect(buildRuntimeArtifactPath("Flow's_Test")).toBe(
      "/api/v1/IntegrationRuntimeArtifacts('Flow''s_Test')"
    );
  });

  it("builds error information path", () => {
    expect(buildRuntimeArtifactErrorPath("MyIFlow")).toBe(
      "/api/v1/IntegrationRuntimeArtifacts('MyIFlow')/ErrorInformation/$value"
    );
  });
});

describe("Designtime artifact paths (composite key Id+Version)", () => {
  it("uses 'active' as default version", () => {
    expect(buildDesigntimeArtifactPath("MyIFlow")).toBe(
      "/api/v1/IntegrationDesigntimeArtifacts(Id='MyIFlow',Version='active')"
    );
  });

  it("uses explicit version", () => {
    expect(buildDesigntimeArtifactPath("MyIFlow", "1.0.0")).toBe(
      "/api/v1/IntegrationDesigntimeArtifacts(Id='MyIFlow',Version='1.0.0')"
    );
  });

  it("builds $value path with default version", () => {
    expect(buildDesigntimeArtifactValuePath("MyIFlow")).toBe(
      "/api/v1/IntegrationDesigntimeArtifacts(Id='MyIFlow',Version='active')/$value"
    );
  });

  it("escapes quotes in both id and version", () => {
    expect(buildDesigntimeArtifactPath("Flow's", "v'1")).toBe(
      "/api/v1/IntegrationDesigntimeArtifacts(Id='Flow''s',Version='v''1')"
    );
  });
});

describe("Configuration link path ($links pattern)", () => {
  it("builds $links path with all three keys escaped", () => {
    expect(buildConfigurationLinkPath("MyIFlow", "active", "endpoint_url")).toBe(
      "/api/v1/IntegrationDesigntimeArtifacts(Id='MyIFlow',Version='active')/$links/Configurations('endpoint_url')"
    );
  });

  it("escapes single quotes in param key", () => {
    expect(buildConfigurationLinkPath("MyIFlow", "1.0.0", "key's")).toBe(
      "/api/v1/IntegrationDesigntimeArtifacts(Id='MyIFlow',Version='1.0.0')/$links/Configurations('key''s')"
    );
  });
});

describe("Resource path (4-part composite key)", () => {
  it("builds path with all four parts", () => {
    expect(buildResourcePath("MyIFlow", "active", "script.groovy", "groovy")).toBe(
      "/api/v1/IntegrationDesigntimeArtifacts(Id='MyIFlow',Version='active')/Resources(Name='script.groovy',ResourceType='groovy')"
    );
  });

  it("builds $value path for resource download", () => {
    expect(buildResourceValuePath("MyIFlow", "active", "script.groovy", "groovy")).toBe(
      "/api/v1/IntegrationDesigntimeArtifacts(Id='MyIFlow',Version='active')/Resources(Name='script.groovy',ResourceType='groovy')/$value"
    );
  });

  it("escapes quotes in resource name", () => {
    expect(buildResourcePath("MyIFlow", "active", "file'name", "xslt")).toBe(
      "/api/v1/IntegrationDesigntimeArtifacts(Id='MyIFlow',Version='active')/Resources(Name='file''name',ResourceType='xslt')"
    );
  });
});

describe("Guideline paths (artifactType branching)", () => {
  it("uses IntegrationDesigntimeArtifacts for iflow", () => {
    expect(buildGuidelineResultsPath("iflow", "MyIFlow")).toBe(
      "/api/v1/IntegrationDesigntimeArtifacts(Id='MyIFlow',Version='active')/DesignGuidelineExecutionResults"
    );
  });

  it("uses ScriptCollectionDesigntimeArtifacts for script_collection", () => {
    expect(buildGuidelineResultsPath("script_collection", "MyScript")).toBe(
      "/api/v1/ScriptCollectionDesigntimeArtifacts(Id='MyScript',Version='active')/DesignGuidelineExecutionResults"
    );
  });

  it("builds single result path with executionId", () => {
    expect(buildGuidelineResultPath("iflow", "MyIFlow", "active", "exec-123")).toBe(
      "/api/v1/IntegrationDesigntimeArtifacts(Id='MyIFlow',Version='active')/DesignGuidelineExecutionResults('exec-123')"
    );
  });

  it("branches execute guidelines path by artifact type", () => {
    expect(buildExecuteGuidelinesPath("iflow")).toBe(
      "/api/v1/ExecuteIntegrationDesigntimeArtifactsGuidelines"
    );
    expect(buildExecuteGuidelinesPath("script_collection")).toBe(
      "/api/v1/ExecuteScriptCollectionDesigntimeArtifactsGuidelines"
    );
  });

  it("uses explicit version for guideline results", () => {
    expect(buildGuidelineResultsPath("iflow", "MyIFlow", "1.0.0")).toBe(
      "/api/v1/IntegrationDesigntimeArtifacts(Id='MyIFlow',Version='1.0.0')/DesignGuidelineExecutionResults"
    );
  });
});

describe("Type artifact paths (dynamic entity name)", () => {
  it("builds collection path with artifact type", () => {
    expect(buildTypeArtifactsPath("MessageTypeDesigntimeArtifacts")).toBe(
      "/api/v1/MessageTypeDesigntimeArtifacts"
    );
  });

  it("builds single entity path with default version", () => {
    expect(buildTypeArtifactPath("DataTypeDesigntimeArtifacts", "MyType")).toBe(
      "/api/v1/DataTypeDesigntimeArtifacts(Id='MyType',Version='active')"
    );
  });

  it("builds single entity path with explicit version", () => {
    expect(buildTypeArtifactPath("DataTypeDesigntimeArtifacts", "MyType", "1.0.0")).toBe(
      "/api/v1/DataTypeDesigntimeArtifacts(Id='MyType',Version='1.0.0')"
    );
  });

  it("escapes quotes in type artifact id", () => {
    expect(buildTypeArtifactPath("MessageTypeDesigntimeArtifacts", "Type's")).toBe(
      "/api/v1/MessageTypeDesigntimeArtifacts(Id='Type''s',Version='active')"
    );
  });
});

describe("MDI Delta Token path", () => {
  it("builds composite key path with all three parts", () => {
    expect(buildMdiDeltaTokenPath("upsert", "sap.odm.finance.costobject.CostCenter", "1")).toBe(
      "/api/v1/MDIDeltaToken(Operation='upsert',Entity='sap.odm.finance.costobject.CostCenter',Version='1')"
    );
  });
});
