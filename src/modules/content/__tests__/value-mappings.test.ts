import { describe, it, expect, vi, beforeEach } from "vitest";
import type { McpServer } from "@modelcontextprotocol/server";
import { registerValueMappingTools } from "../tools/value-mappings.js";
import type { ModuleContext } from "../../../core/types.js";

describe("value mapping tools", () => {
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

    registerValueMappingTools(mockServer, context);
  });

  it("registers all 11 tools", () => {
    expect(handlers.size).toBe(11);
    expect(handlers.has("list_value_mappings")).toBe(true);
    expect(handlers.has("get_value_mapping")).toBe(true);
    expect(handlers.has("create_value_mapping")).toBe(true);
    expect(handlers.has("delete_value_mapping")).toBe(true);
    expect(handlers.has("deploy_value_mapping")).toBe(true);
    expect(handlers.has("save_value_mapping_version")).toBe(true);
    expect(handlers.has("download_value_mapping")).toBe(true);
    expect(handlers.has("get_value_mapping_schema")).toBe(true);
    expect(handlers.has("upsert_value_maps")).toBe(true);
    expect(handlers.has("update_default_value_map")).toBe(true);
    expect(handlers.has("delete_value_maps")).toBe(true);
  });

  describe("list_value_mappings", () => {
    it("returns formatted value mappings", async () => {
      mockODataClient.getCollection.mockResolvedValue([
        {
          Id: "vm1",
          Name: "My Value Mapping",
          Version: "1.0.0",
          PackageId: "pkg1",
          Description: "A value mapping",
        },
        {
          Id: "vm2",
          Name: "Other Mapping",
          Version: "2.0.0",
          PackageId: "pkg2",
          Description: null,
        },
      ]);

      const result = await handlers.get("list_value_mappings")!({});
      const text = result.content[0].text;
      expect(text).toContain("Id: vm1");
      expect(text).toContain("Name: My Value Mapping");
      expect(text).toContain("Version: 1.0.0");
      expect(text).toContain("PackageId: pkg1");
      expect(text).toContain("Description: A value mapping");
      expect(text).toContain("Id: vm2");
      expect(text).toContain("Description: n/a");
    });

    it("returns empty message when no value mappings found", async () => {
      mockODataClient.getCollection.mockResolvedValue([]);
      const result = await handlers.get("list_value_mappings")!({});
      expect(result.content[0].text).toBe("No value mappings found.");
    });

    it("returns isError on failure", async () => {
      mockODataClient.getCollection.mockRejectedValue(
        new Error("OData error (500): internal server error")
      );
      const result = await handlers.get("list_value_mappings")!({});
      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain("OData error (500)");
    });
  });

  describe("get_value_mapping", () => {
    it("returns formatted value mapping", async () => {
      mockODataClient.getEntity.mockResolvedValue({
        Id: "vm1",
        Name: "My Value Mapping",
        Version: "1.0.0",
        PackageId: "pkg1",
        Description: "A value mapping",
      });

      const result = await handlers.get("get_value_mapping")!({ id: "vm1" });
      const text = result.content[0].text;
      expect(text).toContain("Id: vm1");
      expect(text).toContain("Name: My Value Mapping");
      expect(text).toContain("PackageId: pkg1");
    });

    it("uses default version 'active'", async () => {
      mockODataClient.getEntity.mockResolvedValue({
        Id: "vm1",
        Name: "VM",
        Version: "active",
        PackageId: "pkg1",
        Description: null,
      });
      await handlers.get("get_value_mapping")!({ id: "vm1" });
      expect(mockODataClient.getEntity).toHaveBeenCalledWith(
        "/api/v1/ValueMappingDesigntimeArtifacts(Id='vm1',Version='active')"
      );
    });

    it("uses provided version", async () => {
      mockODataClient.getEntity.mockResolvedValue({
        Id: "vm1",
        Name: "VM",
        Version: "1.0.0",
        PackageId: "pkg1",
        Description: null,
      });
      await handlers.get("get_value_mapping")!({
        id: "vm1",
        version: "1.0.0",
      });
      expect(mockODataClient.getEntity).toHaveBeenCalledWith(
        "/api/v1/ValueMappingDesigntimeArtifacts(Id='vm1',Version='1.0.0')"
      );
    });

    it("returns isError on 404", async () => {
      mockODataClient.getEntity.mockRejectedValue(
        new Error("OData error (404): Resource not found")
      );
      const result = await handlers.get("get_value_mapping")!({
        id: "nonexistent",
      });
      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain("OData error (404)");
    });
  });

  describe("create_value_mapping", () => {
    it("shows preview without confirm", async () => {
      const result = await handlers.get("create_value_mapping")!({
        id: "vm1",
        name: "My Value Mapping",
        packageId: "pkg1",
        description: "A mapping",
      });
      const text = result.content[0].text;
      expect(text).toContain("Value mapping to create:");
      expect(text).toContain("Id: vm1");
      expect(text).toContain("Name: My Value Mapping");
      expect(text).toContain("PackageId: pkg1");
      expect(text).toContain("Description: A mapping");
      expect(text).toContain("Set confirm to true to proceed.");
      expect(mockODataClient.post).not.toHaveBeenCalled();
    });

    it("creates value mapping with confirm", async () => {
      mockODataClient.post.mockResolvedValue({});
      const result = await handlers.get("create_value_mapping")!({
        id: "vm1",
        name: "My Value Mapping",
        packageId: "pkg1",
        description: "A mapping",
        artifactContent: "base64data",
        confirm: true,
      });
      expect(mockODataClient.post).toHaveBeenCalledWith(
        "/api/v1/ValueMappingDesigntimeArtifacts",
        {
          Id: "vm1",
          Name: "My Value Mapping",
          PackageId: "pkg1",
          Description: "A mapping",
          ArtifactContent: "base64data",
        }
      );
      expect(result.content[0].text).toContain("created successfully");
    });

    it("only includes defined fields in body", async () => {
      mockODataClient.post.mockResolvedValue({});
      await handlers.get("create_value_mapping")!({
        id: "vm1",
        name: "My Value Mapping",
        packageId: "pkg1",
        confirm: true,
      });
      expect(mockODataClient.post).toHaveBeenCalledWith(
        "/api/v1/ValueMappingDesigntimeArtifacts",
        { Id: "vm1", Name: "My Value Mapping", PackageId: "pkg1" }
      );
    });

    it("returns isError on failure", async () => {
      mockODataClient.post.mockRejectedValue(
        new Error("OData error (409): Conflict")
      );
      const result = await handlers.get("create_value_mapping")!({
        id: "vm1",
        name: "VM",
        packageId: "pkg1",
        confirm: true,
      });
      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain("OData error (409)");
    });
  });

  describe("delete_value_mapping", () => {
    it("shows preview without confirm", async () => {
      mockODataClient.getEntity.mockResolvedValue({
        Id: "vm1",
        Name: "My Value Mapping",
        Version: "1.0.0",
        PackageId: "pkg1",
        Description: "A mapping",
      });

      const result = await handlers.get("delete_value_mapping")!({
        id: "vm1",
        version: "1.0.0",
      });
      const text = result.content[0].text;
      expect(text).toContain("Value mapping to delete:");
      expect(text).toContain("Id: vm1");
      expect(text).toContain("Name: My Value Mapping");
      expect(text).toContain("Set confirm to true to proceed.");
      expect(mockODataClient.delete).not.toHaveBeenCalled();
    });

    it("deletes value mapping with confirm", async () => {
      mockODataClient.delete.mockResolvedValue(undefined);
      const result = await handlers.get("delete_value_mapping")!({
        id: "vm1",
        version: "1.0.0",
        confirm: true,
      });
      expect(mockODataClient.delete).toHaveBeenCalledWith(
        "/api/v1/ValueMappingDesigntimeArtifacts(Id='vm1',Version='1.0.0')"
      );
      expect(result.content[0].text).toContain("deleted successfully");
    });

    it("returns isError when preview fetch fails", async () => {
      mockODataClient.getEntity.mockRejectedValue(
        new Error("OData error (404): Resource not found")
      );
      const result = await handlers.get("delete_value_mapping")!({
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
      const result = await handlers.get("delete_value_mapping")!({
        id: "vm1",
        version: "1.0.0",
        confirm: true,
      });
      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain("OData error (403)");
    });
  });

  describe("deploy_value_mapping", () => {
    it("shows preview without confirm", async () => {
      const result = await handlers.get("deploy_value_mapping")!({
        id: "vm1",
        version: "1.0.0",
      });
      const text = result.content[0].text;
      expect(text).toContain("Value mapping to deploy:");
      expect(text).toContain("Id: vm1");
      expect(text).toContain("Version: 1.0.0");
      expect(text).toContain("Set confirm to true to proceed.");
      expect(mockODataClient.post).not.toHaveBeenCalled();
    });

    it("deploys value mapping with confirm", async () => {
      mockODataClient.post.mockResolvedValue({});
      const result = await handlers.get("deploy_value_mapping")!({
        id: "vm1",
        version: "1.0.0",
        confirm: true,
      });
      expect(mockODataClient.post).toHaveBeenCalledWith(
        "/api/v1/DeployValueMappingDesigntimeArtifact?Id='vm1'&Version='1.0.0'"
      );
      expect(result.content[0].text).toContain(
        "deployment triggered successfully"
      );
    });

    it("returns isError on failure", async () => {
      mockODataClient.post.mockRejectedValue(
        new Error("OData error (500): internal server error")
      );
      const result = await handlers.get("deploy_value_mapping")!({
        id: "vm1",
        version: "1.0.0",
        confirm: true,
      });
      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain("OData error (500)");
    });
  });

  describe("save_value_mapping_version", () => {
    it("shows preview without confirm", async () => {
      const result = await handlers.get("save_value_mapping_version")!({
        id: "vm1",
        version: "1.0.0",
        newVersion: "1.0.1",
      });
      const text = result.content[0].text;
      expect(text).toContain("Value mapping version to save:");
      expect(text).toContain("Id: vm1");
      expect(text).toContain("Current Version: 1.0.0");
      expect(text).toContain("New Version: 1.0.1");
      expect(text).toContain("Set confirm to true to proceed.");
      expect(mockODataClient.post).not.toHaveBeenCalled();
    });

    it("saves version with confirm", async () => {
      mockODataClient.post.mockResolvedValue({});
      const result = await handlers.get("save_value_mapping_version")!({
        id: "vm1",
        version: "1.0.0",
        newVersion: "2.0.0",
        confirm: true,
      });
      expect(mockODataClient.post).toHaveBeenCalledWith(
        "/api/v1/ValueMappingDesigntimeArtifactSaveAsVersion?Id='vm1'&Version='1.0.0'&SaveAsVersion='2.0.0'"
      );
      expect(result.content[0].text).toContain(
        "saved as version '2.0.0' successfully"
      );
    });

    it("returns isError on failure", async () => {
      mockODataClient.post.mockRejectedValue(
        new Error("OData error (400): Bad Request")
      );
      const result = await handlers.get("save_value_mapping_version")!({
        id: "vm1",
        version: "1.0.0",
        newVersion: "2.0.0",
        confirm: true,
      });
      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain("OData error (400)");
    });
  });

  describe("download_value_mapping", () => {
    it("returns content length info", async () => {
      mockODataClient.getValue.mockResolvedValue("binary-zip-content-here");
      const result = await handlers.get("download_value_mapping")!({
        id: "vm1",
      });
      const text = result.content[0].text;
      expect(text).toContain("downloaded successfully");
      expect(text).toContain("Content length:");
      expect(text).toContain("binary ZIP data");
    });

    it("uses default version 'active'", async () => {
      mockODataClient.getValue.mockResolvedValue("data");
      await handlers.get("download_value_mapping")!({ id: "vm1" });
      expect(mockODataClient.getValue).toHaveBeenCalledWith(
        "/api/v1/ValueMappingDesigntimeArtifacts(Id='vm1',Version='active')/$value"
      );
    });

    it("uses provided version", async () => {
      mockODataClient.getValue.mockResolvedValue("data");
      await handlers.get("download_value_mapping")!({
        id: "vm1",
        version: "1.0.0",
      });
      expect(mockODataClient.getValue).toHaveBeenCalledWith(
        "/api/v1/ValueMappingDesigntimeArtifacts(Id='vm1',Version='1.0.0')/$value"
      );
    });

    it("returns isError on failure", async () => {
      mockODataClient.getValue.mockRejectedValue(
        new Error("OData error (404): Resource not found")
      );
      const result = await handlers.get("download_value_mapping")!({
        id: "nonexistent",
      });
      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain("OData error (404)");
    });
  });

  describe("get_value_mapping_schema", () => {
    it("returns formatted schemas", async () => {
      mockODataClient.getCollection.mockResolvedValue([
        {
          SrcAgency: "agency1",
          SrcId: "src1",
          TgtAgency: "agency2",
          TgtId: "tgt1",
          State: "Active",
        },
        {
          SrcAgency: "agency3",
          SrcId: "src2",
          TgtAgency: "agency4",
          TgtId: "tgt2",
          State: null,
        },
      ]);

      const result = await handlers.get("get_value_mapping_schema")!({
        id: "vm1",
      });
      const text = result.content[0].text;
      expect(text).toContain("SrcAgency: agency1");
      expect(text).toContain("SrcId: src1");
      expect(text).toContain("TgtAgency: agency2");
      expect(text).toContain("TgtId: tgt1");
      expect(text).toContain("State: Active");
      expect(text).toContain("State: n/a");
    });

    it("returns empty message when no schemas found", async () => {
      mockODataClient.getCollection.mockResolvedValue([]);
      const result = await handlers.get("get_value_mapping_schema")!({
        id: "vm1",
      });
      expect(result.content[0].text).toBe("No value mapping schemas found.");
    });

    it("passes expand parameter", async () => {
      mockODataClient.getCollection.mockResolvedValue([]);
      await handlers.get("get_value_mapping_schema")!({
        id: "vm1",
        expand: "ValMaps,DefaultValMaps",
      });
      expect(mockODataClient.getCollection).toHaveBeenCalledWith(
        "/api/v1/ValueMappingDesigntimeArtifacts(Id='vm1',Version='active')/ValMapSchema",
        { $expand: "ValMaps,DefaultValMaps" }
      );
    });

    it("does not pass expand when not provided", async () => {
      mockODataClient.getCollection.mockResolvedValue([]);
      await handlers.get("get_value_mapping_schema")!({ id: "vm1" });
      expect(mockODataClient.getCollection).toHaveBeenCalledWith(
        "/api/v1/ValueMappingDesigntimeArtifacts(Id='vm1',Version='active')/ValMapSchema",
        {}
      );
    });

    it("returns isError on failure", async () => {
      mockODataClient.getCollection.mockRejectedValue(
        new Error("OData error (500): internal server error")
      );
      const result = await handlers.get("get_value_mapping_schema")!({
        id: "vm1",
      });
      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain("OData error (500)");
    });
  });

  describe("upsert_value_maps", () => {
    it("shows preview without confirm", async () => {
      const body = JSON.stringify({ key: "value" });
      const result = await handlers.get("upsert_value_maps")!({ body });
      const text = result.content[0].text;
      expect(text).toContain("Value maps to upsert:");
      expect(text).toContain(body);
      expect(text).toContain("Set confirm to true to proceed.");
      expect(mockODataClient.post).not.toHaveBeenCalled();
    });

    it("upserts with confirm", async () => {
      mockODataClient.post.mockResolvedValue({});
      const payload = { key: "value" };
      const result = await handlers.get("upsert_value_maps")!({
        body: JSON.stringify(payload),
        confirm: true,
      });
      expect(mockODataClient.post).toHaveBeenCalledWith(
        "/api/v1/UpsertValMaps",
        payload
      );
      expect(result.content[0].text).toContain("upserted successfully");
    });

    it("returns isError on invalid JSON", async () => {
      const result = await handlers.get("upsert_value_maps")!({
        body: "not-json",
        confirm: true,
      });
      expect(result.isError).toBe(true);
    });

    it("returns isError on failure", async () => {
      mockODataClient.post.mockRejectedValue(
        new Error("OData error (500): internal server error")
      );
      const result = await handlers.get("upsert_value_maps")!({
        body: JSON.stringify({ key: "value" }),
        confirm: true,
      });
      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain("OData error (500)");
    });
  });

  describe("update_default_value_map", () => {
    it("shows preview without confirm", async () => {
      const body = JSON.stringify({ default: true });
      const result = await handlers.get("update_default_value_map")!({ body });
      const text = result.content[0].text;
      expect(text).toContain("Default value map to update:");
      expect(text).toContain(body);
      expect(text).toContain("Set confirm to true to proceed.");
      expect(mockODataClient.post).not.toHaveBeenCalled();
    });

    it("updates with confirm", async () => {
      mockODataClient.post.mockResolvedValue({});
      const payload = { default: true };
      const result = await handlers.get("update_default_value_map")!({
        body: JSON.stringify(payload),
        confirm: true,
      });
      expect(mockODataClient.post).toHaveBeenCalledWith(
        "/api/v1/UpdateDefaultValMap",
        payload
      );
      expect(result.content[0].text).toContain("updated successfully");
    });

    it("returns isError on invalid JSON", async () => {
      const result = await handlers.get("update_default_value_map")!({
        body: "{bad",
        confirm: true,
      });
      expect(result.isError).toBe(true);
    });

    it("returns isError on failure", async () => {
      mockODataClient.post.mockRejectedValue(
        new Error("OData error (400): Bad Request")
      );
      const result = await handlers.get("update_default_value_map")!({
        body: JSON.stringify({ default: true }),
        confirm: true,
      });
      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain("OData error (400)");
    });
  });

  describe("delete_value_maps", () => {
    it("shows preview without confirm", async () => {
      const body = JSON.stringify({ ids: ["1", "2"] });
      const result = await handlers.get("delete_value_maps")!({ body });
      const text = result.content[0].text;
      expect(text).toContain("Value maps to delete:");
      expect(text).toContain(body);
      expect(text).toContain("Set confirm to true to proceed.");
      expect(mockODataClient.post).not.toHaveBeenCalled();
    });

    it("deletes with confirm", async () => {
      mockODataClient.post.mockResolvedValue({});
      const payload = { ids: ["1", "2"] };
      const result = await handlers.get("delete_value_maps")!({
        body: JSON.stringify(payload),
        confirm: true,
      });
      expect(mockODataClient.post).toHaveBeenCalledWith(
        "/api/v1/DeleteValMaps",
        payload
      );
      expect(result.content[0].text).toContain("deleted successfully");
    });

    it("returns isError on invalid JSON", async () => {
      const result = await handlers.get("delete_value_maps")!({
        body: "invalid",
        confirm: true,
      });
      expect(result.isError).toBe(true);
    });

    it("returns isError on failure", async () => {
      mockODataClient.post.mockRejectedValue(
        new Error("OData error (500): internal server error")
      );
      const result = await handlers.get("delete_value_maps")!({
        body: JSON.stringify({ ids: ["1"] }),
        confirm: true,
      });
      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain("OData error (500)");
    });
  });
});
