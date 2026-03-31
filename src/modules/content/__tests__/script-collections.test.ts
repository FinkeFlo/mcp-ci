import { describe, it, expect, vi, beforeEach } from "vitest";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerScriptCollectionTools } from "../tools/script-collections.js";
import type { ModuleContext } from "../../../core/types.js";

describe("script collection tools", () => {
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

    registerScriptCollectionTools(mockServer, context);
  });

  it("registers all 8 tools", () => {
    expect(handlers.size).toBe(8);
    expect(handlers.has("list_script_collections")).toBe(true);
    expect(handlers.has("get_script_collection")).toBe(true);
    expect(handlers.has("create_script_collection")).toBe(true);
    expect(handlers.has("update_script_collection")).toBe(true);
    expect(handlers.has("delete_script_collection")).toBe(true);
    expect(handlers.has("deploy_script_collection")).toBe(true);
    expect(handlers.has("save_script_collection_version")).toBe(true);
    expect(handlers.has("download_script_collection")).toBe(true);
  });

  describe("list_script_collections", () => {
    it("returns formatted script collections", async () => {
      mockODataClient.getCollection.mockResolvedValue([
        {
          Id: "sc1",
          Name: "My Script Collection",
          Version: "1.0.0",
          PackageId: "pkg1",
          Description: "A script collection",
        },
        {
          Id: "sc2",
          Name: "Other Collection",
          Version: "2.0.0",
          PackageId: "pkg1",
          Description: null,
        },
      ]);

      const result = await handlers.get("list_script_collections")!({
        packageId: "pkg1",
      });
      const text = result.content[0].text;
      expect(text).toContain("Id: sc1");
      expect(text).toContain("Name: My Script Collection");
      expect(text).toContain("Version: 1.0.0");
      expect(text).toContain("PackageId: pkg1");
      expect(text).toContain("Description: A script collection");
      expect(text).toContain("Id: sc2");
      expect(text).toContain("Description: n/a");
    });

    it("calls correct package-scoped path", async () => {
      mockODataClient.getCollection.mockResolvedValue([]);
      await handlers.get("list_script_collections")!({ packageId: "pkg1" });
      expect(mockODataClient.getCollection).toHaveBeenCalledWith(
        "/api/v1/IntegrationPackages('pkg1')/ScriptCollectionDesigntimeArtifacts"
      );
    });

    it("returns empty message when no script collections found", async () => {
      mockODataClient.getCollection.mockResolvedValue([]);
      const result = await handlers.get("list_script_collections")!({
        packageId: "pkg1",
      });
      expect(result.content[0].text).toBe("No script collections found.");
    });

    it("returns isError on failure", async () => {
      mockODataClient.getCollection.mockRejectedValue(
        new Error("OData error (500): internal server error")
      );
      const result = await handlers.get("list_script_collections")!({
        packageId: "pkg1",
      });
      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain("OData error (500)");
    });
  });

  describe("get_script_collection", () => {
    it("returns formatted script collection", async () => {
      mockODataClient.getEntity.mockResolvedValue({
        Id: "sc1",
        Name: "My Script Collection",
        Version: "1.0.0",
        PackageId: "pkg1",
        Description: "A script collection",
      });

      const result = await handlers.get("get_script_collection")!({
        id: "sc1",
      });
      const text = result.content[0].text;
      expect(text).toContain("Id: sc1");
      expect(text).toContain("Name: My Script Collection");
      expect(text).toContain("PackageId: pkg1");
    });

    it("uses default version 'active'", async () => {
      mockODataClient.getEntity.mockResolvedValue({
        Id: "sc1",
        Name: "SC",
        Version: "active",
        PackageId: "pkg1",
        Description: null,
      });
      await handlers.get("get_script_collection")!({ id: "sc1" });
      expect(mockODataClient.getEntity).toHaveBeenCalledWith(
        "/api/v1/ScriptCollectionDesigntimeArtifacts(Id='sc1',Version='active')"
      );
    });

    it("uses provided version", async () => {
      mockODataClient.getEntity.mockResolvedValue({
        Id: "sc1",
        Name: "SC",
        Version: "1.0.0",
        PackageId: "pkg1",
        Description: null,
      });
      await handlers.get("get_script_collection")!({
        id: "sc1",
        version: "1.0.0",
      });
      expect(mockODataClient.getEntity).toHaveBeenCalledWith(
        "/api/v1/ScriptCollectionDesigntimeArtifacts(Id='sc1',Version='1.0.0')"
      );
    });

    it("returns isError on 404", async () => {
      mockODataClient.getEntity.mockRejectedValue(
        new Error("OData error (404): Resource not found")
      );
      const result = await handlers.get("get_script_collection")!({
        id: "nonexistent",
      });
      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain("OData error (404)");
    });
  });

  describe("create_script_collection", () => {
    it("shows preview without confirm", async () => {
      const result = await handlers.get("create_script_collection")!({
        id: "sc1",
        name: "My Script Collection",
        packageId: "pkg1",
        description: "A collection",
      });
      const text = result.content[0].text;
      expect(text).toContain("Script collection to create:");
      expect(text).toContain("Id: sc1");
      expect(text).toContain("Name: My Script Collection");
      expect(text).toContain("PackageId: pkg1");
      expect(text).toContain("Description: A collection");
      expect(text).toContain("Set confirm to true to proceed.");
      expect(mockODataClient.post).not.toHaveBeenCalled();
    });

    it("creates script collection with confirm", async () => {
      mockODataClient.post.mockResolvedValue({});
      const result = await handlers.get("create_script_collection")!({
        id: "sc1",
        name: "My Script Collection",
        packageId: "pkg1",
        description: "A collection",
        artifactContent: "base64data",
        confirm: true,
      });
      expect(mockODataClient.post).toHaveBeenCalledWith(
        "/api/v1/ScriptCollectionDesigntimeArtifacts",
        {
          Id: "sc1",
          Name: "My Script Collection",
          PackageId: "pkg1",
          Description: "A collection",
          ArtifactContent: "base64data",
        }
      );
      expect(result.content[0].text).toContain("created successfully");
    });

    it("only includes defined fields in body", async () => {
      mockODataClient.post.mockResolvedValue({});
      await handlers.get("create_script_collection")!({
        id: "sc1",
        name: "My Script Collection",
        packageId: "pkg1",
        confirm: true,
      });
      expect(mockODataClient.post).toHaveBeenCalledWith(
        "/api/v1/ScriptCollectionDesigntimeArtifacts",
        { Id: "sc1", Name: "My Script Collection", PackageId: "pkg1" }
      );
    });

    it("returns isError on failure", async () => {
      mockODataClient.post.mockRejectedValue(
        new Error("OData error (409): Conflict")
      );
      const result = await handlers.get("create_script_collection")!({
        id: "sc1",
        name: "SC",
        packageId: "pkg1",
        confirm: true,
      });
      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain("OData error (409)");
    });
  });

  describe("update_script_collection", () => {
    it("shows preview without confirm", async () => {
      mockODataClient.getEntity.mockResolvedValue({
        Id: "sc1",
        Name: "Old Name",
        Version: "1.0.0",
        PackageId: "pkg1",
        Description: "Old desc",
      });

      const result = await handlers.get("update_script_collection")!({
        id: "sc1",
        version: "1.0.0",
        name: "New Name",
        description: "New desc",
      });
      const text = result.content[0].text;
      expect(text).toContain("Script collection to update:");
      expect(text).toContain("Id: sc1");
      expect(text).toContain("Proposed changes:");
      expect(text).toContain("Name: Old Name -> New Name");
      expect(text).toContain("Description: Old desc -> New desc");
      expect(text).toContain("Set confirm to true to proceed.");
      expect(mockODataClient.put).not.toHaveBeenCalled();
    });

    it("updates script collection with confirm", async () => {
      mockODataClient.put.mockResolvedValue({});
      const result = await handlers.get("update_script_collection")!({
        id: "sc1",
        version: "1.0.0",
        name: "New Name",
        description: "New desc",
        artifactContent: "newbase64",
        confirm: true,
      });
      expect(mockODataClient.put).toHaveBeenCalledWith(
        "/api/v1/ScriptCollectionDesigntimeArtifacts(Id='sc1',Version='1.0.0')",
        {
          Name: "New Name",
          Description: "New desc",
          ArtifactContent: "newbase64",
        }
      );
      expect(result.content[0].text).toContain("updated successfully");
    });

    it("only includes defined fields in body", async () => {
      mockODataClient.put.mockResolvedValue({});
      await handlers.get("update_script_collection")!({
        id: "sc1",
        version: "1.0.0",
        name: "New Name",
        confirm: true,
      });
      expect(mockODataClient.put).toHaveBeenCalledWith(
        "/api/v1/ScriptCollectionDesigntimeArtifacts(Id='sc1',Version='1.0.0')",
        { Name: "New Name" }
      );
    });

    it("returns isError on failure", async () => {
      mockODataClient.put.mockRejectedValue(
        new Error("OData error (400): Bad Request")
      );
      const result = await handlers.get("update_script_collection")!({
        id: "sc1",
        version: "1.0.0",
        name: "New",
        confirm: true,
      });
      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain("OData error (400)");
    });
  });

  describe("delete_script_collection", () => {
    it("shows preview without confirm", async () => {
      mockODataClient.getEntity.mockResolvedValue({
        Id: "sc1",
        Name: "My Script Collection",
        Version: "1.0.0",
        PackageId: "pkg1",
        Description: "A collection",
      });

      const result = await handlers.get("delete_script_collection")!({
        id: "sc1",
        version: "1.0.0",
      });
      const text = result.content[0].text;
      expect(text).toContain("Script collection to delete:");
      expect(text).toContain("Id: sc1");
      expect(text).toContain("Name: My Script Collection");
      expect(text).toContain("Set confirm to true to proceed.");
      expect(mockODataClient.delete).not.toHaveBeenCalled();
    });

    it("deletes script collection with confirm", async () => {
      mockODataClient.delete.mockResolvedValue(undefined);
      const result = await handlers.get("delete_script_collection")!({
        id: "sc1",
        version: "1.0.0",
        confirm: true,
      });
      expect(mockODataClient.delete).toHaveBeenCalledWith(
        "/api/v1/ScriptCollectionDesigntimeArtifacts(Id='sc1',Version='1.0.0')"
      );
      expect(result.content[0].text).toContain("deleted successfully");
    });

    it("returns isError when preview fetch fails", async () => {
      mockODataClient.getEntity.mockRejectedValue(
        new Error("OData error (404): Resource not found")
      );
      const result = await handlers.get("delete_script_collection")!({
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
      const result = await handlers.get("delete_script_collection")!({
        id: "sc1",
        version: "1.0.0",
        confirm: true,
      });
      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain("OData error (403)");
    });
  });

  describe("deploy_script_collection", () => {
    it("shows preview without confirm", async () => {
      const result = await handlers.get("deploy_script_collection")!({
        id: "sc1",
        version: "1.0.0",
      });
      const text = result.content[0].text;
      expect(text).toContain("Script collection to deploy:");
      expect(text).toContain("Id: sc1");
      expect(text).toContain("Version: 1.0.0");
      expect(text).toContain("Set confirm to true to proceed.");
      expect(mockODataClient.post).not.toHaveBeenCalled();
    });

    it("deploys script collection with confirm", async () => {
      mockODataClient.post.mockResolvedValue({});
      const result = await handlers.get("deploy_script_collection")!({
        id: "sc1",
        version: "1.0.0",
        confirm: true,
      });
      expect(mockODataClient.post).toHaveBeenCalledWith(
        "/api/v1/DeployScriptCollectionDesigntimeArtifact?Id='sc1'&Version='1.0.0'"
      );
      expect(result.content[0].text).toContain(
        "deployment triggered successfully"
      );
    });

    it("returns isError on failure", async () => {
      mockODataClient.post.mockRejectedValue(
        new Error("OData error (500): internal server error")
      );
      const result = await handlers.get("deploy_script_collection")!({
        id: "sc1",
        version: "1.0.0",
        confirm: true,
      });
      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain("OData error (500)");
    });
  });

  describe("save_script_collection_version", () => {
    it("shows preview without confirm", async () => {
      const result = await handlers.get("save_script_collection_version")!({
        id: "sc1",
        version: "1.0.0",
        newVersion: "1.0.1",
      });
      const text = result.content[0].text;
      expect(text).toContain("Script collection version to save:");
      expect(text).toContain("Id: sc1");
      expect(text).toContain("Current Version: 1.0.0");
      expect(text).toContain("New Version: 1.0.1");
      expect(text).toContain("Set confirm to true to proceed.");
      expect(mockODataClient.post).not.toHaveBeenCalled();
    });

    it("saves version with confirm", async () => {
      mockODataClient.post.mockResolvedValue({});
      const result = await handlers.get("save_script_collection_version")!({
        id: "sc1",
        version: "1.0.0",
        newVersion: "2.0.0",
        confirm: true,
      });
      expect(mockODataClient.post).toHaveBeenCalledWith(
        "/api/v1/ScriptCollectionDesigntimeArtifactSaveAsVersion?Id='sc1'&Version='1.0.0'&SaveAsVersion='2.0.0'"
      );
      expect(result.content[0].text).toContain(
        "saved as version '2.0.0' successfully"
      );
    });

    it("returns isError on failure", async () => {
      mockODataClient.post.mockRejectedValue(
        new Error("OData error (400): Bad Request")
      );
      const result = await handlers.get("save_script_collection_version")!({
        id: "sc1",
        version: "1.0.0",
        newVersion: "2.0.0",
        confirm: true,
      });
      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain("OData error (400)");
    });
  });

  describe("download_script_collection", () => {
    it("returns content length info", async () => {
      mockODataClient.getValue.mockResolvedValue("binary-zip-content-here");
      const result = await handlers.get("download_script_collection")!({
        id: "sc1",
      });
      const text = result.content[0].text;
      expect(text).toContain("downloaded successfully");
      expect(text).toContain("Content length:");
      expect(text).toContain("binary ZIP data");
    });

    it("uses default version 'active'", async () => {
      mockODataClient.getValue.mockResolvedValue("data");
      await handlers.get("download_script_collection")!({ id: "sc1" });
      expect(mockODataClient.getValue).toHaveBeenCalledWith(
        "/api/v1/ScriptCollectionDesigntimeArtifacts(Id='sc1',Version='active')/$value"
      );
    });

    it("uses provided version", async () => {
      mockODataClient.getValue.mockResolvedValue("data");
      await handlers.get("download_script_collection")!({
        id: "sc1",
        version: "1.0.0",
      });
      expect(mockODataClient.getValue).toHaveBeenCalledWith(
        "/api/v1/ScriptCollectionDesigntimeArtifacts(Id='sc1',Version='1.0.0')/$value"
      );
    });

    it("returns isError on failure", async () => {
      mockODataClient.getValue.mockRejectedValue(
        new Error("OData error (404): Resource not found")
      );
      const result = await handlers.get("download_script_collection")!({
        id: "nonexistent",
      });
      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain("OData error (404)");
    });
  });
});
