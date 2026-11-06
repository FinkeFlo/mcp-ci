import { describe, it, expect, vi, beforeEach } from "vitest";
import type { McpServer } from "@modelcontextprotocol/server";
import { registerFlowTools } from "../tools/flows.js";
import type { ModuleContext } from "../../../core/types.js";

describe("integration flow tools", () => {
  let handlers: Map<string, (...args: any[]) => any>;
  let mockODataClient: {
    getCollection: ReturnType<typeof vi.fn>;
    getEntity: ReturnType<typeof vi.fn>;
    getValue: ReturnType<typeof vi.fn>;
    post: ReturnType<typeof vi.fn>;
    put: ReturnType<typeof vi.fn>;
    delete: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    handlers = new Map();
    const mockServer = {
      registerTool: (name: string, _opts: any, handler: any) => {
        handlers.set(name, handler);
      },
    } as unknown as McpServer;

    mockODataClient = {
      getCollection: vi.fn(),
      getEntity: vi.fn(),
      getValue: vi.fn(),
      post: vi.fn(),
      put: vi.fn(),
      delete: vi.fn(),
    };

    const context = {
      tenantManager: {} as any,
      odataClient: mockODataClient as any,
    } satisfies ModuleContext;

    registerFlowTools(mockServer, context);
  });

  it("registers all 16 tools", () => {
    expect(handlers.size).toBe(16);
    expect(handlers.has("list_designtime_artifacts")).toBe(true);
    expect(handlers.has("get_designtime_artifact")).toBe(true);
    expect(handlers.has("create_designtime_artifact")).toBe(true);
    expect(handlers.has("update_designtime_artifact")).toBe(true);
    expect(handlers.has("delete_designtime_artifact")).toBe(true);
    expect(handlers.has("deploy_designtime_artifact")).toBe(true);
    expect(handlers.has("validate_designtime_artifact")).toBe(true);
    expect(handlers.has("download_designtime_artifact")).toBe(true);
    expect(handlers.has("save_designtime_artifact_version")).toBe(true);
    expect(handlers.has("list_configurations")).toBe(true);
    expect(handlers.has("update_configuration")).toBe(true);
    expect(handlers.has("count_configurations")).toBe(true);
    expect(handlers.has("list_resources")).toBe(true);
    expect(handlers.has("get_resource")).toBe(true);
    expect(handlers.has("download_resource")).toBe(true);
    expect(handlers.has("count_resources")).toBe(true);
  });

  // --- 1. list_designtime_artifacts ---
  describe("list_designtime_artifacts", () => {
    it("returns formatted artifacts", async () => {
      mockODataClient.getCollection.mockResolvedValue([
        {
          Id: "flow1",
          Name: "My Flow",
          Version: "1.0.0",
          PackageId: "pkg1",
          Description: "A flow",
        },
        {
          Id: "flow2",
          Name: "Other Flow",
          Version: "2.0.0",
          PackageId: "pkg1",
          Description: null,
        },
      ]);

      const result = await handlers.get("list_designtime_artifacts")!({
        packageId: "pkg1",
      });
      const text = result.content[0].text;
      expect(text).toContain("Id: flow1");
      expect(text).toContain("Name: My Flow");
      expect(text).toContain("Version: 1.0.0");
      expect(text).toContain("PackageId: pkg1");
      expect(text).toContain("Description: A flow");
      expect(text).toContain("Id: flow2");
      expect(text).toContain("Description: n/a");
    });

    it("returns empty message when no artifacts found", async () => {
      mockODataClient.getCollection.mockResolvedValue([]);
      const result = await handlers.get("list_designtime_artifacts")!({
        packageId: "pkg1",
      });
      expect(result.content[0].text).toBe("No designtime artifacts found.");
    });

    it("calls correct path with package ID", async () => {
      mockODataClient.getCollection.mockResolvedValue([]);
      await handlers.get("list_designtime_artifacts")!({
        packageId: "pkg1",
      });
      expect(mockODataClient.getCollection).toHaveBeenCalledWith(
        "/api/v1/IntegrationPackages('pkg1')/IntegrationDesigntimeArtifacts"
      );
    });

    it("returns isError on failure", async () => {
      mockODataClient.getCollection.mockRejectedValue(
        new Error("OData error (500): internal server error")
      );
      const result = await handlers.get("list_designtime_artifacts")!({
        packageId: "pkg1",
      });
      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain("OData error (500)");
    });
  });

  // --- 2. get_designtime_artifact ---
  describe("get_designtime_artifact", () => {
    it("returns formatted artifact", async () => {
      mockODataClient.getEntity.mockResolvedValue({
        Id: "flow1",
        Name: "My Flow",
        Version: "1.0.0",
        PackageId: "pkg1",
        Description: "A flow",
      });

      const result = await handlers.get("get_designtime_artifact")!({
        id: "flow1",
      });
      const text = result.content[0].text;
      expect(text).toContain("Id: flow1");
      expect(text).toContain("Name: My Flow");
      expect(text).toContain("Version: 1.0.0");
      expect(text).toContain("PackageId: pkg1");
    });

    it("uses default version 'active'", async () => {
      mockODataClient.getEntity.mockResolvedValue({
        Id: "flow1",
        Name: "My Flow",
        Version: "active",
        PackageId: "pkg1",
        Description: null,
      });
      await handlers.get("get_designtime_artifact")!({ id: "flow1" });
      expect(mockODataClient.getEntity).toHaveBeenCalledWith(
        "/api/v1/IntegrationDesigntimeArtifacts(Id='flow1',Version='active')"
      );
    });

    it("uses provided version", async () => {
      mockODataClient.getEntity.mockResolvedValue({
        Id: "flow1",
        Name: "My Flow",
        Version: "1.0.0",
        PackageId: "pkg1",
        Description: null,
      });
      await handlers.get("get_designtime_artifact")!({
        id: "flow1",
        version: "1.0.0",
      });
      expect(mockODataClient.getEntity).toHaveBeenCalledWith(
        "/api/v1/IntegrationDesigntimeArtifacts(Id='flow1',Version='1.0.0')"
      );
    });

    it("returns isError on 404", async () => {
      mockODataClient.getEntity.mockRejectedValue(
        new Error("OData error (404): Resource not found")
      );
      const result = await handlers.get("get_designtime_artifact")!({
        id: "nonexistent",
      });
      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain("OData error (404)");
    });
  });

  // --- 3. create_designtime_artifact ---
  describe("create_designtime_artifact", () => {
    it("shows preview without confirm", async () => {
      const result = await handlers.get("create_designtime_artifact")!({
        id: "flow1",
        name: "My Flow",
        packageId: "pkg1",
        artifactContent: "base64data",
      });
      const text = result.content[0].text;
      expect(text).toContain("Artifact to create:");
      expect(text).toContain("Id: flow1");
      expect(text).toContain("Name: My Flow");
      expect(text).toContain("PackageId: pkg1");
      expect(text).toContain("ArtifactContent: (provided)");
      expect(text).toContain("Set confirm to true to proceed.");
      expect(mockODataClient.post).not.toHaveBeenCalled();
    });

    it("shows preview without artifactContent", async () => {
      const result = await handlers.get("create_designtime_artifact")!({
        id: "flow1",
        name: "My Flow",
        packageId: "pkg1",
      });
      const text = result.content[0].text;
      expect(text).toContain("ArtifactContent: n/a");
    });

    it("creates artifact with confirm", async () => {
      mockODataClient.post.mockResolvedValue({});
      const result = await handlers.get("create_designtime_artifact")!({
        id: "flow1",
        name: "My Flow",
        packageId: "pkg1",
        artifactContent: "base64data",
        confirm: true,
      });
      expect(mockODataClient.post).toHaveBeenCalledWith(
        "/api/v1/IntegrationDesigntimeArtifacts",
        {
          Id: "flow1",
          Name: "My Flow",
          PackageId: "pkg1",
          ArtifactContent: "base64data",
        }
      );
      expect(result.content[0].text).toContain("created successfully");
    });

    it("only includes defined fields in body", async () => {
      mockODataClient.post.mockResolvedValue({});
      await handlers.get("create_designtime_artifact")!({
        id: "flow1",
        name: "My Flow",
        packageId: "pkg1",
        confirm: true,
      });
      expect(mockODataClient.post).toHaveBeenCalledWith(
        "/api/v1/IntegrationDesigntimeArtifacts",
        { Id: "flow1", Name: "My Flow", PackageId: "pkg1" }
      );
    });

    it("returns isError on failure", async () => {
      mockODataClient.post.mockRejectedValue(
        new Error("OData error (409): Conflict")
      );
      const result = await handlers.get("create_designtime_artifact")!({
        id: "flow1",
        name: "My Flow",
        packageId: "pkg1",
        confirm: true,
      });
      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain("OData error (409)");
    });
  });

  // --- 4. update_designtime_artifact ---
  describe("update_designtime_artifact", () => {
    it("shows preview without confirm", async () => {
      mockODataClient.getEntity.mockResolvedValue({
        Id: "flow1",
        Name: "Old Name",
        Version: "1.0.0",
        PackageId: "pkg1",
        Description: "Old description",
      });

      const result = await handlers.get("update_designtime_artifact")!({
        id: "flow1",
        version: "1.0.0",
        name: "New Name",
      });
      const text = result.content[0].text;
      expect(text).toContain("Artifact to update:");
      expect(text).toContain("Id: flow1");
      expect(text).toContain("Proposed changes:");
      expect(text).toContain("Name: Old Name -> New Name");
      expect(text).toContain("Set confirm to true to proceed.");
      expect(mockODataClient.put).not.toHaveBeenCalled();
    });

    it("shows artifactContent change in preview", async () => {
      mockODataClient.getEntity.mockResolvedValue({
        Id: "flow1",
        Name: "My Flow",
        Version: "1.0.0",
        PackageId: "pkg1",
        Description: null,
      });

      const result = await handlers.get("update_designtime_artifact")!({
        id: "flow1",
        version: "1.0.0",
        artifactContent: "newbase64",
      });
      const text = result.content[0].text;
      expect(text).toContain("ArtifactContent: (new content provided)");
    });

    it("updates artifact with confirm", async () => {
      mockODataClient.put.mockResolvedValue(undefined);
      const result = await handlers.get("update_designtime_artifact")!({
        id: "flow1",
        version: "1.0.0",
        name: "New Name",
        artifactContent: "newbase64",
        confirm: true,
      });
      expect(mockODataClient.put).toHaveBeenCalledWith(
        "/api/v1/IntegrationDesigntimeArtifacts(Id='flow1',Version='1.0.0')",
        { Name: "New Name", ArtifactContent: "newbase64" }
      );
      expect(result.content[0].text).toContain("updated successfully");
    });

    it("returns isError when preview fetch fails", async () => {
      mockODataClient.getEntity.mockRejectedValue(
        new Error("OData error (404): Resource not found")
      );
      const result = await handlers.get("update_designtime_artifact")!({
        id: "nonexistent",
        version: "1.0.0",
        name: "New Name",
      });
      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain("OData error (404)");
    });

    it("returns isError when update fails", async () => {
      mockODataClient.put.mockRejectedValue(
        new Error("OData error (403): Forbidden")
      );
      const result = await handlers.get("update_designtime_artifact")!({
        id: "flow1",
        version: "1.0.0",
        name: "New Name",
        confirm: true,
      });
      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain("OData error (403)");
    });
  });

  // --- 5. delete_designtime_artifact ---
  describe("delete_designtime_artifact", () => {
    it("shows preview without confirm", async () => {
      mockODataClient.getEntity.mockResolvedValue({
        Id: "flow1",
        Name: "My Flow",
        Version: "1.0.0",
        PackageId: "pkg1",
        Description: "A flow",
      });

      const result = await handlers.get("delete_designtime_artifact")!({
        id: "flow1",
        version: "1.0.0",
      });
      const text = result.content[0].text;
      expect(text).toContain("Artifact to delete:");
      expect(text).toContain("Id: flow1");
      expect(text).toContain("Name: My Flow");
      expect(text).toContain("Set confirm to true to proceed.");
      expect(mockODataClient.delete).not.toHaveBeenCalled();
    });

    it("deletes artifact with confirm", async () => {
      mockODataClient.delete.mockResolvedValue(undefined);
      const result = await handlers.get("delete_designtime_artifact")!({
        id: "flow1",
        version: "1.0.0",
        confirm: true,
      });
      expect(mockODataClient.delete).toHaveBeenCalledWith(
        "/api/v1/IntegrationDesigntimeArtifacts(Id='flow1',Version='1.0.0')"
      );
      expect(result.content[0].text).toContain("deleted successfully");
    });

    it("returns isError when preview fetch fails", async () => {
      mockODataClient.getEntity.mockRejectedValue(
        new Error("OData error (404): Resource not found")
      );
      const result = await handlers.get("delete_designtime_artifact")!({
        id: "nonexistent",
        version: "1.0.0",
      });
      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain("OData error (404)");
    });

    it("returns isError when delete fails", async () => {
      mockODataClient.delete.mockRejectedValue(
        new Error("OData error (403): Forbidden")
      );
      const result = await handlers.get("delete_designtime_artifact")!({
        id: "flow1",
        version: "1.0.0",
        confirm: true,
      });
      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain("OData error (403)");
    });
  });

  // --- 6. deploy_designtime_artifact ---
  describe("deploy_designtime_artifact", () => {
    it("shows preview without confirm", async () => {
      const result = await handlers.get("deploy_designtime_artifact")!({
        id: "flow1",
        version: "1.0.0",
      });
      const text = result.content[0].text;
      expect(text).toContain("Artifact to deploy:");
      expect(text).toContain("Id: flow1");
      expect(text).toContain("Version: 1.0.0");
      expect(text).toContain("Set confirm to true to proceed.");
      expect(mockODataClient.post).not.toHaveBeenCalled();
    });

    it("deploys artifact with confirm using correct query param path", async () => {
      mockODataClient.post.mockResolvedValue({});
      const result = await handlers.get("deploy_designtime_artifact")!({
        id: "flow1",
        version: "1.0.0",
        confirm: true,
      });
      expect(mockODataClient.post).toHaveBeenCalledWith(
        "/api/v1/DeployIntegrationDesigntimeArtifact?Id='flow1'&Version='1.0.0'"
      );
      expect(result.content[0].text).toContain(
        "deployment triggered successfully"
      );
    });

    it("escapes special characters in query params", async () => {
      mockODataClient.post.mockResolvedValue({});
      await handlers.get("deploy_designtime_artifact")!({
        id: "flow's",
        version: "1.0.0",
        confirm: true,
      });
      expect(mockODataClient.post).toHaveBeenCalledWith(
        "/api/v1/DeployIntegrationDesigntimeArtifact?Id='flow''s'&Version='1.0.0'"
      );
    });

    it("returns isError on failure", async () => {
      mockODataClient.post.mockRejectedValue(
        new Error("OData error (500): internal server error")
      );
      const result = await handlers.get("deploy_designtime_artifact")!({
        id: "flow1",
        version: "1.0.0",
        confirm: true,
      });
      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain("OData error (500)");
    });
  });

  // --- 7. validate_designtime_artifact ---
  describe("validate_designtime_artifact", () => {
    it("shows preview without confirm", async () => {
      const result = await handlers.get("validate_designtime_artifact")!({
        id: "flow1",
        version: "1.0.0",
      });
      const text = result.content[0].text;
      expect(text).toContain("Artifact to validate:");
      expect(text).toContain("Id: flow1");
      expect(text).toContain("Version: 1.0.0");
      expect(text).toContain("Set confirm to true to proceed.");
      expect(mockODataClient.post).not.toHaveBeenCalled();
    });

    it("validates artifact with confirm using correct query param path", async () => {
      mockODataClient.post.mockResolvedValue({});
      const result = await handlers.get("validate_designtime_artifact")!({
        id: "flow1",
        version: "1.0.0",
        confirm: true,
      });
      expect(mockODataClient.post).toHaveBeenCalledWith(
        "/api/v1/ValidateIntegrationDesigntimeArtifact?Id='flow1'&Version='1.0.0'"
      );
      expect(result.content[0].text).toContain(
        "validation triggered successfully"
      );
    });

    it("returns isError on failure", async () => {
      mockODataClient.post.mockRejectedValue(
        new Error("OData error (500): internal server error")
      );
      const result = await handlers.get("validate_designtime_artifact")!({
        id: "flow1",
        version: "1.0.0",
        confirm: true,
      });
      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain("OData error (500)");
    });
  });

  // --- 8. download_designtime_artifact ---
  describe("download_designtime_artifact", () => {
    it("returns content length info", async () => {
      mockODataClient.getValue.mockResolvedValue("binary-zip-content-here");
      const result = await handlers.get("download_designtime_artifact")!({
        id: "flow1",
      });
      const text = result.content[0].text;
      expect(text).toContain("downloaded successfully");
      expect(text).toContain("Content length:");
      expect(text).toContain("binary ZIP data");
    });

    it("uses default version 'active'", async () => {
      mockODataClient.getValue.mockResolvedValue("data");
      await handlers.get("download_designtime_artifact")!({ id: "flow1" });
      expect(mockODataClient.getValue).toHaveBeenCalledWith(
        "/api/v1/IntegrationDesigntimeArtifacts(Id='flow1',Version='active')/$value"
      );
    });

    it("uses provided version", async () => {
      mockODataClient.getValue.mockResolvedValue("data");
      await handlers.get("download_designtime_artifact")!({
        id: "flow1",
        version: "1.0.0",
      });
      expect(mockODataClient.getValue).toHaveBeenCalledWith(
        "/api/v1/IntegrationDesigntimeArtifacts(Id='flow1',Version='1.0.0')/$value"
      );
    });

    it("returns isError on failure", async () => {
      mockODataClient.getValue.mockRejectedValue(
        new Error("OData error (404): Resource not found")
      );
      const result = await handlers.get("download_designtime_artifact")!({
        id: "nonexistent",
      });
      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain("OData error (404)");
    });
  });

  // --- 9. save_designtime_artifact_version ---
  describe("save_designtime_artifact_version", () => {
    it("shows preview without confirm", async () => {
      const result = await handlers.get("save_designtime_artifact_version")!({
        id: "flow1",
        version: "1.0.0",
        newVersion: "1.0.1",
      });
      const text = result.content[0].text;
      expect(text).toContain("Artifact version to save:");
      expect(text).toContain("Id: flow1");
      expect(text).toContain("Current Version: 1.0.0");
      expect(text).toContain("New Version: 1.0.1");
      expect(text).toContain("Set confirm to true to proceed.");
      expect(mockODataClient.post).not.toHaveBeenCalled();
    });

    it("saves version with confirm using correct query param path", async () => {
      mockODataClient.post.mockResolvedValue({});
      const result = await handlers.get("save_designtime_artifact_version")!({
        id: "flow1",
        version: "1.0.0",
        newVersion: "1.0.1",
        confirm: true,
      });
      expect(mockODataClient.post).toHaveBeenCalledWith(
        "/api/v1/IntegrationDesigntimeArtifactSaveAsVersion?Id='flow1'&Version='1.0.0'&SaveAsVersion='1.0.1'"
      );
      expect(result.content[0].text).toContain(
        "saved as version '1.0.1' successfully"
      );
    });

    it("returns isError on failure", async () => {
      mockODataClient.post.mockRejectedValue(
        new Error("OData error (500): internal server error")
      );
      const result = await handlers.get("save_designtime_artifact_version")!({
        id: "flow1",
        version: "1.0.0",
        newVersion: "1.0.1",
        confirm: true,
      });
      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain("OData error (500)");
    });
  });

  // --- 10. list_configurations ---
  describe("list_configurations", () => {
    it("returns formatted configurations", async () => {
      mockODataClient.getCollection.mockResolvedValue([
        {
          ParameterKey: "endpoint.url",
          ParameterValue: "https://example.com",
          DataType: "xsd:string",
          Description: "The endpoint URL",
        },
        {
          ParameterKey: "timeout",
          ParameterValue: "30000",
          DataType: "xsd:integer",
          Description: "Timeout in ms",
        },
      ]);

      const result = await handlers.get("list_configurations")!({
        artifactId: "flow1",
      });
      const text = result.content[0].text;
      expect(text).toContain("ParameterKey: endpoint.url");
      expect(text).toContain("ParameterValue: https://example.com");
      expect(text).toContain("DataType: xsd:string");
      expect(text).toContain("ParameterKey: timeout");
      expect(text).toContain("ParameterValue: 30000");
      expect(text).toContain("DataType: xsd:integer");
    });

    it("returns empty message when no configurations found", async () => {
      mockODataClient.getCollection.mockResolvedValue([]);
      const result = await handlers.get("list_configurations")!({
        artifactId: "flow1",
      });
      expect(result.content[0].text).toBe("No configurations found.");
    });

    it("calls correct path with default version", async () => {
      mockODataClient.getCollection.mockResolvedValue([]);
      await handlers.get("list_configurations")!({ artifactId: "flow1" });
      expect(mockODataClient.getCollection).toHaveBeenCalledWith(
        "/api/v1/IntegrationDesigntimeArtifacts(Id='flow1',Version='active')/Configurations"
      );
    });

    it("calls correct path with provided version", async () => {
      mockODataClient.getCollection.mockResolvedValue([]);
      await handlers.get("list_configurations")!({
        artifactId: "flow1",
        version: "1.0.0",
      });
      expect(mockODataClient.getCollection).toHaveBeenCalledWith(
        "/api/v1/IntegrationDesigntimeArtifacts(Id='flow1',Version='1.0.0')/Configurations"
      );
    });

    it("returns isError on failure", async () => {
      mockODataClient.getCollection.mockRejectedValue(
        new Error("OData error (500): internal server error")
      );
      const result = await handlers.get("list_configurations")!({
        artifactId: "flow1",
      });
      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain("OData error (500)");
    });
  });

  // --- 11. update_configuration ---
  describe("update_configuration", () => {
    it("shows preview without confirm", async () => {
      const result = await handlers.get("update_configuration")!({
        artifactId: "flow1",
        version: "active",
        parameterKey: "endpoint.url",
        parameterValue: "https://new.example.com",
        dataType: "xsd:string",
      });
      const text = result.content[0].text;
      expect(text).toContain("Configuration to update:");
      expect(text).toContain("ArtifactId: flow1");
      expect(text).toContain("Version: active");
      expect(text).toContain("ParameterKey: endpoint.url");
      expect(text).toContain("ParameterValue: https://new.example.com");
      expect(text).toContain("DataType: xsd:string");
      expect(text).toContain("Set confirm to true to proceed.");
      expect(mockODataClient.put).not.toHaveBeenCalled();
    });

    it("shows preview without dataType", async () => {
      const result = await handlers.get("update_configuration")!({
        artifactId: "flow1",
        version: "active",
        parameterKey: "endpoint.url",
        parameterValue: "https://new.example.com",
      });
      const text = result.content[0].text;
      expect(text).toContain("DataType: n/a");
    });

    it("updates configuration with confirm using $links path", async () => {
      mockODataClient.put.mockResolvedValue(undefined);
      const result = await handlers.get("update_configuration")!({
        artifactId: "flow1",
        version: "active",
        parameterKey: "endpoint.url",
        parameterValue: "https://new.example.com",
        dataType: "xsd:string",
        confirm: true,
      });
      expect(mockODataClient.put).toHaveBeenCalledWith(
        "/api/v1/IntegrationDesigntimeArtifacts(Id='flow1',Version='active')/$links/Configurations('endpoint.url')",
        { ParameterValue: "https://new.example.com", DataType: "xsd:string" }
      );
      expect(result.content[0].text).toContain("updated successfully");
    });

    it("updates configuration without dataType", async () => {
      mockODataClient.put.mockResolvedValue(undefined);
      await handlers.get("update_configuration")!({
        artifactId: "flow1",
        version: "active",
        parameterKey: "endpoint.url",
        parameterValue: "https://new.example.com",
        confirm: true,
      });
      expect(mockODataClient.put).toHaveBeenCalledWith(
        "/api/v1/IntegrationDesigntimeArtifacts(Id='flow1',Version='active')/$links/Configurations('endpoint.url')",
        { ParameterValue: "https://new.example.com" }
      );
    });

    it("returns isError on failure", async () => {
      mockODataClient.put.mockRejectedValue(
        new Error("OData error (403): Forbidden")
      );
      const result = await handlers.get("update_configuration")!({
        artifactId: "flow1",
        version: "active",
        parameterKey: "endpoint.url",
        parameterValue: "new-value",
        confirm: true,
      });
      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain("OData error (403)");
    });
  });

  // --- 12. list_resources ---
  describe("list_resources", () => {
    it("returns formatted resources", async () => {
      mockODataClient.getCollection.mockResolvedValue([
        { Name: "script.groovy", ResourceType: "groovy" },
        { Name: "mapping.xsl", ResourceType: "xslt" },
      ]);

      const result = await handlers.get("list_resources")!({
        artifactId: "flow1",
      });
      const text = result.content[0].text;
      expect(text).toContain("Name: script.groovy");
      expect(text).toContain("ResourceType: groovy");
      expect(text).toContain("Name: mapping.xsl");
      expect(text).toContain("ResourceType: xslt");
    });

    it("returns empty message when no resources found", async () => {
      mockODataClient.getCollection.mockResolvedValue([]);
      const result = await handlers.get("list_resources")!({
        artifactId: "flow1",
      });
      expect(result.content[0].text).toBe("No resources found.");
    });

    it("calls correct path with default version", async () => {
      mockODataClient.getCollection.mockResolvedValue([]);
      await handlers.get("list_resources")!({ artifactId: "flow1" });
      expect(mockODataClient.getCollection).toHaveBeenCalledWith(
        "/api/v1/IntegrationDesigntimeArtifacts(Id='flow1',Version='active')/Resources"
      );
    });

    it("calls correct path with provided version", async () => {
      mockODataClient.getCollection.mockResolvedValue([]);
      await handlers.get("list_resources")!({
        artifactId: "flow1",
        version: "1.0.0",
      });
      expect(mockODataClient.getCollection).toHaveBeenCalledWith(
        "/api/v1/IntegrationDesigntimeArtifacts(Id='flow1',Version='1.0.0')/Resources"
      );
    });

    it("returns isError on failure", async () => {
      mockODataClient.getCollection.mockRejectedValue(
        new Error("OData error (500): internal server error")
      );
      const result = await handlers.get("list_resources")!({
        artifactId: "flow1",
      });
      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain("OData error (500)");
    });
  });

  // --- 13. get_resource ---
  describe("get_resource", () => {
    it("returns formatted resource detail", async () => {
      mockODataClient.getEntity.mockResolvedValue({
        Name: "script.groovy",
        ResourceType: "groovy",
        ReferencedResourceType: null,
        ResourceContent: "println 'hello'",
      });

      const result = await handlers.get("get_resource")!({
        artifactId: "flow1",
        version: "active",
        name: "script.groovy",
        resourceType: "groovy",
      });
      const text = result.content[0].text;
      expect(text).toContain("Name: script.groovy");
      expect(text).toContain("ResourceType: groovy");
      expect(text).toContain("ReferencedResourceType: n/a");
      expect(text).toContain("ResourceContent: println 'hello'");
    });

    it("calls correct path", async () => {
      mockODataClient.getEntity.mockResolvedValue({
        Name: "script.groovy",
        ResourceType: "groovy",
        ReferencedResourceType: null,
        ResourceContent: null,
      });
      await handlers.get("get_resource")!({
        artifactId: "flow1",
        version: "active",
        name: "script.groovy",
        resourceType: "groovy",
      });
      expect(mockODataClient.getEntity).toHaveBeenCalledWith(
        "/api/v1/IntegrationDesigntimeArtifacts(Id='flow1',Version='active')/Resources(Name='script.groovy',ResourceType='groovy')"
      );
    });

    it("returns isError on failure", async () => {
      mockODataClient.getEntity.mockRejectedValue(
        new Error("OData error (404): Resource not found")
      );
      const result = await handlers.get("get_resource")!({
        artifactId: "flow1",
        version: "active",
        name: "nonexistent",
        resourceType: "groovy",
      });
      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain("OData error (404)");
    });
  });

  // --- 14. download_resource ---
  describe("download_resource", () => {
    it("returns resource content", async () => {
      mockODataClient.getValue.mockResolvedValue("println 'hello world'");
      const result = await handlers.get("download_resource")!({
        artifactId: "flow1",
        version: "active",
        name: "script.groovy",
        resourceType: "groovy",
      });
      expect(result.content[0].text).toBe("println 'hello world'");
    });

    it("truncates content exceeding 100KB", async () => {
      const largeContent = "A".repeat(150 * 1024);
      mockODataClient.getValue.mockResolvedValue(largeContent);
      const result = await handlers.get("download_resource")!({
        artifactId: "flow1",
        version: "active",
        name: "large.groovy",
        resourceType: "groovy",
      });
      const text = result.content[0].text;
      expect(text).toContain("TRUNCATED");
      expect(text).toContain("100KB");
      expect(text).toContain(`${150 * 1024} bytes total`);
      // The truncated content should be 100KB = 102400 chars of 'A'
      expect(text).toContain("A".repeat(100));
    });

    it("calls correct value path", async () => {
      mockODataClient.getValue.mockResolvedValue("data");
      await handlers.get("download_resource")!({
        artifactId: "flow1",
        version: "active",
        name: "script.groovy",
        resourceType: "groovy",
      });
      expect(mockODataClient.getValue).toHaveBeenCalledWith(
        "/api/v1/IntegrationDesigntimeArtifacts(Id='flow1',Version='active')/Resources(Name='script.groovy',ResourceType='groovy')/$value"
      );
    });

    it("returns isError on failure", async () => {
      mockODataClient.getValue.mockRejectedValue(
        new Error("OData error (404): Resource not found")
      );
      const result = await handlers.get("download_resource")!({
        artifactId: "flow1",
        version: "active",
        name: "nonexistent",
        resourceType: "groovy",
      });
      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain("OData error (404)");
    });
  });

  // --- 15. count_configurations ---
  describe("count_configurations", () => {
    it("returns configuration count", async () => {
      mockODataClient.getValue.mockResolvedValue("5");
      const result = await handlers.get("count_configurations")!({
        artifactId: "flow1",
      });
      expect(result.content[0].text).toBe("5");
    });

    it("calls correct $count path with default version", async () => {
      mockODataClient.getValue.mockResolvedValue("3");
      await handlers.get("count_configurations")!({ artifactId: "flow1" });
      expect(mockODataClient.getValue).toHaveBeenCalledWith(
        "/api/v1/IntegrationDesigntimeArtifacts(Id='flow1',Version='active')/Configurations/$count"
      );
    });

    it("calls correct $count path with explicit version", async () => {
      mockODataClient.getValue.mockResolvedValue("3");
      await handlers.get("count_configurations")!({ artifactId: "flow1", version: "1.0.0" });
      expect(mockODataClient.getValue).toHaveBeenCalledWith(
        "/api/v1/IntegrationDesigntimeArtifacts(Id='flow1',Version='1.0.0')/Configurations/$count"
      );
    });

    it("returns isError on failure", async () => {
      mockODataClient.getValue.mockRejectedValue(
        new Error("OData error (404): Resource not found")
      );
      const result = await handlers.get("count_configurations")!({ artifactId: "nonexistent" });
      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain("OData error (404)");
    });
  });

  // --- 16. count_resources ---
  describe("count_resources", () => {
    it("returns resources count", async () => {
      mockODataClient.getValue.mockResolvedValue("12");
      const result = await handlers.get("count_resources")!({
        artifactId: "flow1",
      });
      expect(result.content[0].text).toBe("12");
    });

    it("calls correct $count path with default version", async () => {
      mockODataClient.getValue.mockResolvedValue("12");
      await handlers.get("count_resources")!({ artifactId: "flow1" });
      expect(mockODataClient.getValue).toHaveBeenCalledWith(
        "/api/v1/IntegrationDesigntimeArtifacts(Id='flow1',Version='active')/Resources/$count"
      );
    });

    it("calls correct $count path with explicit version", async () => {
      mockODataClient.getValue.mockResolvedValue("12");
      await handlers.get("count_resources")!({ artifactId: "flow1", version: "2.0.0" });
      expect(mockODataClient.getValue).toHaveBeenCalledWith(
        "/api/v1/IntegrationDesigntimeArtifacts(Id='flow1',Version='2.0.0')/Resources/$count"
      );
    });

    it("returns isError on failure", async () => {
      mockODataClient.getValue.mockRejectedValue(
        new Error("OData error (500): internal server error")
      );
      const result = await handlers.get("count_resources")!({ artifactId: "flow1" });
      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain("OData error (500)");
    });
  });
});
