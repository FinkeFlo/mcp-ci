import { describe, it, expect, vi, beforeEach } from "vitest";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerPackageArtifactTools } from "../tools/package-artifacts.js";
import type { ModuleContext } from "../../../core/types.js";

describe("package artifact tools", () => {
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

    registerPackageArtifactTools(mockServer, context);
  });

  it("registers all 11 tools", () => {
    expect(handlers.size).toBe(11);
    expect(handlers.has("get_package_designtime_artifact")).toBe(true);
    expect(handlers.has("list_package_message_mappings")).toBe(true);
    expect(handlers.has("get_package_message_mapping")).toBe(true);
    expect(handlers.has("list_package_value_mappings")).toBe(true);
    expect(handlers.has("get_package_value_mapping")).toBe(true);
    expect(handlers.has("get_package_script_collection")).toBe(true);
    expect(handlers.has("get_package_custom_tags")).toBe(true);
    expect(handlers.has("list_package_message_types")).toBe(true);
    expect(handlers.has("list_package_fault_message_types")).toBe(true);
    expect(handlers.has("list_package_data_types")).toBe(true);
    expect(handlers.has("list_package_service_interfaces")).toBe(true);
  });

  // --- get_package_designtime_artifact ---
  describe("get_package_designtime_artifact", () => {
    it("returns formatted artifact", async () => {
      mockODataClient.getEntity.mockResolvedValue({
        Id: "flow1",
        Name: "My Flow",
        Version: "1.0.0",
        PackageId: "pkg1",
        Description: "A test flow",
        ArtifactContent: null,
      });
      const result = await handlers.get("get_package_designtime_artifact")!({
        packageId: "pkg1",
        artifactId: "flow1",
        version: "1.0.0",
      });
      const text = result.content[0].text;
      expect(text).toContain("Id: flow1");
      expect(text).toContain("Name: My Flow");
      expect(text).toContain("PackageId: pkg1");
    });

    it("defaults version to 'active'", async () => {
      mockODataClient.getEntity.mockResolvedValue({
        Id: "flow1",
        Name: "Flow",
        Version: "active",
        PackageId: "pkg1",
        Description: null,
        ArtifactContent: null,
      });
      await handlers.get("get_package_designtime_artifact")!({
        packageId: "pkg1",
        artifactId: "flow1",
      });
      expect(mockODataClient.getEntity).toHaveBeenCalledWith(
        "/api/v1/IntegrationPackages('pkg1')/IntegrationDesigntimeArtifacts(Id='flow1',Version='active')"
      );
    });

    it("escapes OData special chars in packageId and artifactId", async () => {
      mockODataClient.getEntity.mockResolvedValue({
        Id: "it's-special",
        Name: "Flow",
        Version: "active",
        PackageId: "it's-pkg",
        Description: null,
        ArtifactContent: null,
      });
      await handlers.get("get_package_designtime_artifact")!({
        packageId: "it's-pkg",
        artifactId: "it's-special",
      });
      expect(mockODataClient.getEntity).toHaveBeenCalledWith(
        "/api/v1/IntegrationPackages('it''s-pkg')/IntegrationDesigntimeArtifacts(Id='it''s-special',Version='active')"
      );
    });

    it("returns isError on failure", async () => {
      mockODataClient.getEntity.mockRejectedValue(
        new Error("OData error (404): Not Found")
      );
      const result = await handlers.get("get_package_designtime_artifact")!({
        packageId: "pkg1",
        artifactId: "nonexistent",
      });
      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain("OData error (404)");
    });
  });

  // --- list_package_message_mappings ---
  describe("list_package_message_mappings", () => {
    it("returns formatted message mappings", async () => {
      mockODataClient.getCollection.mockResolvedValue([
        { Id: "mm1", Name: "Mapping1", Version: "1.0.0", PackageId: "pkg1", Description: "desc1", ArtifactContent: null },
        { Id: "mm2", Name: "Mapping2", Version: "2.0.0", PackageId: "pkg1", Description: null, ArtifactContent: null },
      ]);
      const result = await handlers.get("list_package_message_mappings")!({ packageId: "pkg1" });
      const text = result.content[0].text;
      expect(text).toContain("Id: mm1");
      expect(text).toContain("Id: mm2");
      expect(text).toContain("Name: Mapping1");
    });

    it("returns empty message when no mappings found", async () => {
      mockODataClient.getCollection.mockResolvedValue([]);
      const result = await handlers.get("list_package_message_mappings")!({ packageId: "pkg1" });
      expect(result.content[0].text).toBe("No message mappings found.");
    });

    it("calls correct OData path", async () => {
      mockODataClient.getCollection.mockResolvedValue([]);
      await handlers.get("list_package_message_mappings")!({ packageId: "myPkg" });
      expect(mockODataClient.getCollection).toHaveBeenCalledWith(
        "/api/v1/IntegrationPackages('myPkg')/MessageMappingDesigntimeArtifacts"
      );
    });

    it("returns isError on failure", async () => {
      mockODataClient.getCollection.mockRejectedValue(
        new Error("OData error (500): internal server error")
      );
      const result = await handlers.get("list_package_message_mappings")!({ packageId: "pkg1" });
      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain("OData error (500)");
    });
  });

  // --- get_package_message_mapping ---
  describe("get_package_message_mapping", () => {
    it("returns formatted message mapping", async () => {
      mockODataClient.getEntity.mockResolvedValue({
        Id: "mm1",
        Name: "Mapping1",
        Version: "1.0.0",
        PackageId: "pkg1",
        Description: "desc",
        ArtifactContent: null,
      });
      const result = await handlers.get("get_package_message_mapping")!({
        packageId: "pkg1",
        artifactId: "mm1",
        version: "1.0.0",
      });
      expect(result.content[0].text).toContain("Id: mm1");
    });

    it("defaults version to 'active'", async () => {
      mockODataClient.getEntity.mockResolvedValue({
        Id: "mm1", Name: "M", Version: "active", PackageId: "pkg1", Description: null, ArtifactContent: null,
      });
      await handlers.get("get_package_message_mapping")!({ packageId: "pkg1", artifactId: "mm1" });
      expect(mockODataClient.getEntity).toHaveBeenCalledWith(
        "/api/v1/IntegrationPackages('pkg1')/MessageMappingDesigntimeArtifacts(Id='mm1',Version='active')"
      );
    });

    it("returns isError on failure", async () => {
      mockODataClient.getEntity.mockRejectedValue(new Error("OData error (404): Not Found"));
      const result = await handlers.get("get_package_message_mapping")!({ packageId: "p", artifactId: "x" });
      expect(result.isError).toBe(true);
    });
  });

  // --- list_package_value_mappings ---
  describe("list_package_value_mappings", () => {
    it("returns formatted value mappings", async () => {
      mockODataClient.getCollection.mockResolvedValue([
        { Id: "vm1", Name: "VM1", Version: "1.0.0", PackageId: "pkg1", Description: "d", ArtifactContent: null },
      ]);
      const result = await handlers.get("list_package_value_mappings")!({ packageId: "pkg1" });
      expect(result.content[0].text).toContain("Id: vm1");
    });

    it("returns empty message when no value mappings found", async () => {
      mockODataClient.getCollection.mockResolvedValue([]);
      const result = await handlers.get("list_package_value_mappings")!({ packageId: "pkg1" });
      expect(result.content[0].text).toBe("No value mappings found.");
    });

    it("calls correct OData path", async () => {
      mockODataClient.getCollection.mockResolvedValue([]);
      await handlers.get("list_package_value_mappings")!({ packageId: "myPkg" });
      expect(mockODataClient.getCollection).toHaveBeenCalledWith(
        "/api/v1/IntegrationPackages('myPkg')/ValueMappingDesigntimeArtifacts"
      );
    });

    it("returns isError on failure", async () => {
      mockODataClient.getCollection.mockRejectedValue(new Error("OData error (500): err"));
      const result = await handlers.get("list_package_value_mappings")!({ packageId: "pkg1" });
      expect(result.isError).toBe(true);
    });
  });

  // --- get_package_value_mapping ---
  describe("get_package_value_mapping", () => {
    it("returns formatted value mapping", async () => {
      mockODataClient.getEntity.mockResolvedValue({
        Id: "vm1", Name: "VM1", Version: "1.0.0", PackageId: "pkg1", Description: "d", ArtifactContent: null,
      });
      const result = await handlers.get("get_package_value_mapping")!({
        packageId: "pkg1", artifactId: "vm1", version: "1.0.0",
      });
      expect(result.content[0].text).toContain("Id: vm1");
    });

    it("defaults version to 'active'", async () => {
      mockODataClient.getEntity.mockResolvedValue({
        Id: "vm1", Name: "V", Version: "active", PackageId: "pkg1", Description: null, ArtifactContent: null,
      });
      await handlers.get("get_package_value_mapping")!({ packageId: "pkg1", artifactId: "vm1" });
      expect(mockODataClient.getEntity).toHaveBeenCalledWith(
        "/api/v1/IntegrationPackages('pkg1')/ValueMappingDesigntimeArtifacts(Id='vm1',Version='active')"
      );
    });

    it("returns isError on failure", async () => {
      mockODataClient.getEntity.mockRejectedValue(new Error("OData error (404): Not Found"));
      const result = await handlers.get("get_package_value_mapping")!({ packageId: "p", artifactId: "x" });
      expect(result.isError).toBe(true);
    });
  });

  // --- get_package_script_collection ---
  describe("get_package_script_collection", () => {
    it("returns formatted script collection", async () => {
      mockODataClient.getEntity.mockResolvedValue({
        Id: "sc1", Name: "SC1", Version: "2.0.0", PackageId: "pkg1", Description: "Script", ArtifactContent: null,
      });
      const result = await handlers.get("get_package_script_collection")!({
        packageId: "pkg1", artifactId: "sc1", version: "2.0.0",
      });
      expect(result.content[0].text).toContain("Id: sc1");
      expect(result.content[0].text).toContain("Name: SC1");
    });

    it("defaults version to 'active'", async () => {
      mockODataClient.getEntity.mockResolvedValue({
        Id: "sc1", Name: "S", Version: "active", PackageId: "pkg1", Description: null, ArtifactContent: null,
      });
      await handlers.get("get_package_script_collection")!({ packageId: "pkg1", artifactId: "sc1" });
      expect(mockODataClient.getEntity).toHaveBeenCalledWith(
        "/api/v1/IntegrationPackages('pkg1')/ScriptCollectionDesigntimeArtifacts(Id='sc1',Version='active')"
      );
    });

    it("returns isError on failure", async () => {
      mockODataClient.getEntity.mockRejectedValue(new Error("OData error (404): Not Found"));
      const result = await handlers.get("get_package_script_collection")!({ packageId: "p", artifactId: "x" });
      expect(result.isError).toBe(true);
    });
  });

  // --- get_package_custom_tags ---
  describe("get_package_custom_tags", () => {
    it("returns formatted custom tags", async () => {
      mockODataClient.getCollection.mockResolvedValue([
        { Name: "Author", Value: "Fred" },
        { Name: "LoB", Value: "" },
      ]);
      const result = await handlers.get("get_package_custom_tags")!({ packageId: "pkg1" });
      const text = result.content[0].text;
      expect(text).toContain("Name: Author");
      expect(text).toContain("Value: Fred");
      expect(text).toContain("Name: LoB");
    });

    it("returns empty message when no tags found", async () => {
      mockODataClient.getCollection.mockResolvedValue([]);
      const result = await handlers.get("get_package_custom_tags")!({ packageId: "pkg1" });
      expect(result.content[0].text).toBe("No custom tags found.");
    });

    it("calls correct OData path", async () => {
      mockODataClient.getCollection.mockResolvedValue([]);
      await handlers.get("get_package_custom_tags")!({ packageId: "myPkg" });
      expect(mockODataClient.getCollection).toHaveBeenCalledWith(
        "/api/v1/IntegrationPackages('myPkg')/CustomTags"
      );
    });

    it("returns isError on failure", async () => {
      mockODataClient.getCollection.mockRejectedValue(new Error("OData error (500): err"));
      const result = await handlers.get("get_package_custom_tags")!({ packageId: "pkg1" });
      expect(result.isError).toBe(true);
    });
  });

  // --- list_package_message_types ---
  describe("list_package_message_types", () => {
    it("returns formatted message types", async () => {
      mockODataClient.getCollection.mockResolvedValue([
        { Id: "mt1", Name: "OrderMsg", Version: "1.0.0", PackageId: "pkg1", Namespace: "urn:order", Description: "Order" },
      ]);
      const result = await handlers.get("list_package_message_types")!({ packageId: "pkg1" });
      const text = result.content[0].text;
      expect(text).toContain("Id: mt1");
      expect(text).toContain("Namespace: urn:order");
    });

    it("returns empty message when no types found", async () => {
      mockODataClient.getCollection.mockResolvedValue([]);
      const result = await handlers.get("list_package_message_types")!({ packageId: "pkg1" });
      expect(result.content[0].text).toBe("No message types found.");
    });

    it("calls correct OData path", async () => {
      mockODataClient.getCollection.mockResolvedValue([]);
      await handlers.get("list_package_message_types")!({ packageId: "myPkg" });
      expect(mockODataClient.getCollection).toHaveBeenCalledWith(
        "/api/v1/IntegrationPackages('myPkg')/MessageTypeDesigntimeArtifacts"
      );
    });

    it("returns isError on failure", async () => {
      mockODataClient.getCollection.mockRejectedValue(new Error("OData error (500): err"));
      const result = await handlers.get("list_package_message_types")!({ packageId: "pkg1" });
      expect(result.isError).toBe(true);
    });
  });

  // --- list_package_fault_message_types ---
  describe("list_package_fault_message_types", () => {
    it("returns empty message when no types found", async () => {
      mockODataClient.getCollection.mockResolvedValue([]);
      const result = await handlers.get("list_package_fault_message_types")!({ packageId: "pkg1" });
      expect(result.content[0].text).toBe("No fault message types found.");
    });

    it("calls correct OData path", async () => {
      mockODataClient.getCollection.mockResolvedValue([]);
      await handlers.get("list_package_fault_message_types")!({ packageId: "myPkg" });
      expect(mockODataClient.getCollection).toHaveBeenCalledWith(
        "/api/v1/IntegrationPackages('myPkg')/FaultMessageTypeDesigntimeArtifacts"
      );
    });

    it("returns formatted fault message types", async () => {
      mockODataClient.getCollection.mockResolvedValue([
        { Id: "fmt1", Name: "FaultMsg", Version: "1.0.0", PackageId: "pkg1", Namespace: "urn:fault", Description: null },
      ]);
      const result = await handlers.get("list_package_fault_message_types")!({ packageId: "pkg1" });
      expect(result.content[0].text).toContain("Id: fmt1");
    });

    it("returns isError on failure", async () => {
      mockODataClient.getCollection.mockRejectedValue(new Error("OData error (500): err"));
      const result = await handlers.get("list_package_fault_message_types")!({ packageId: "pkg1" });
      expect(result.isError).toBe(true);
    });
  });

  // --- list_package_data_types ---
  describe("list_package_data_types", () => {
    it("returns empty message when no data types found", async () => {
      mockODataClient.getCollection.mockResolvedValue([]);
      const result = await handlers.get("list_package_data_types")!({ packageId: "pkg1" });
      expect(result.content[0].text).toBe("No data types found.");
    });

    it("calls correct OData path", async () => {
      mockODataClient.getCollection.mockResolvedValue([]);
      await handlers.get("list_package_data_types")!({ packageId: "myPkg" });
      expect(mockODataClient.getCollection).toHaveBeenCalledWith(
        "/api/v1/IntegrationPackages('myPkg')/DataTypeDesigntimeArtifacts"
      );
    });

    it("returns formatted data types", async () => {
      mockODataClient.getCollection.mockResolvedValue([
        { Id: "dt1", Name: "DataType1", Version: "1.0.0", PackageId: "pkg1", Namespace: "urn:data", Description: "d" },
      ]);
      const result = await handlers.get("list_package_data_types")!({ packageId: "pkg1" });
      expect(result.content[0].text).toContain("Id: dt1");
    });

    it("returns isError on failure", async () => {
      mockODataClient.getCollection.mockRejectedValue(new Error("OData error (500): err"));
      const result = await handlers.get("list_package_data_types")!({ packageId: "pkg1" });
      expect(result.isError).toBe(true);
    });
  });

  // --- list_package_service_interfaces ---
  describe("list_package_service_interfaces", () => {
    it("returns empty message when no service interfaces found", async () => {
      mockODataClient.getCollection.mockResolvedValue([]);
      const result = await handlers.get("list_package_service_interfaces")!({ packageId: "pkg1" });
      expect(result.content[0].text).toBe("No service interfaces found.");
    });

    it("calls correct OData path", async () => {
      mockODataClient.getCollection.mockResolvedValue([]);
      await handlers.get("list_package_service_interfaces")!({ packageId: "myPkg" });
      expect(mockODataClient.getCollection).toHaveBeenCalledWith(
        "/api/v1/IntegrationPackages('myPkg')/ServiceInterfaceDesigntimeArtifacts"
      );
    });

    it("returns formatted service interfaces", async () => {
      mockODataClient.getCollection.mockResolvedValue([
        { Id: "si1", Name: "SI1", Version: "1.0.0", PackageId: "pkg1", Namespace: "urn:si", Description: "desc" },
      ]);
      const result = await handlers.get("list_package_service_interfaces")!({ packageId: "pkg1" });
      expect(result.content[0].text).toContain("Id: si1");
      expect(result.content[0].text).toContain("Namespace: urn:si");
    });

    it("returns isError on failure", async () => {
      mockODataClient.getCollection.mockRejectedValue(new Error("OData error (500): err"));
      const result = await handlers.get("list_package_service_interfaces")!({ packageId: "pkg1" });
      expect(result.isError).toBe(true);
    });
  });
});
