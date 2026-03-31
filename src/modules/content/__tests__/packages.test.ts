import { describe, it, expect, vi, beforeEach } from "vitest";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerPackageTools } from "../tools/packages.js";
import type { ModuleContext } from "../../../core/types.js";

describe("integration package tools", () => {
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

    registerPackageTools(mockServer, context);
  });

  it("registers all 7 tools", () => {
    expect(handlers.size).toBe(7);
    expect(handlers.has("list_packages")).toBe(true);
    expect(handlers.has("get_package")).toBe(true);
    expect(handlers.has("create_package")).toBe(true);
    expect(handlers.has("update_package")).toBe(true);
    expect(handlers.has("delete_package")).toBe(true);
    expect(handlers.has("download_package")).toBe(true);
    expect(handlers.has("copy_package")).toBe(true);
  });

  describe("list_packages", () => {
    it("returns formatted packages", async () => {
      mockODataClient.getCollection.mockResolvedValue([
        {
          Id: "pkg1",
          Name: "My Package",
          Version: "1.0.0",
          Vendor: "SAP",
          Mode: "EDIT_ALLOWED",
          ShortText: "A short description",
        },
        {
          Id: "pkg2",
          Name: "Other Package",
          Version: "2.0.0",
          Vendor: null,
          Mode: "READ_ONLY",
          ShortText: null,
        },
      ]);

      const result = await handlers.get("list_packages")!({});
      const text = result.content[0].text;
      expect(text).toContain("Id: pkg1");
      expect(text).toContain("Name: My Package");
      expect(text).toContain("Version: 1.0.0");
      expect(text).toContain("Vendor: SAP");
      expect(text).toContain("Mode: EDIT_ALLOWED");
      expect(text).toContain("ShortText: A short description");
      expect(text).toContain("Id: pkg2");
      expect(text).toContain("Vendor: n/a");
    });

    it("truncates ShortText at 100 characters", async () => {
      const longText = "A".repeat(150);
      mockODataClient.getCollection.mockResolvedValue([
        {
          Id: "pkg1",
          Name: "Long Text Package",
          Version: "1.0.0",
          Vendor: "SAP",
          Mode: "EDIT_ALLOWED",
          ShortText: longText,
        },
      ]);

      const result = await handlers.get("list_packages")!({});
      const text = result.content[0].text;
      expect(text).toContain("ShortText: " + "A".repeat(100) + "...");
      expect(text).not.toContain("A".repeat(150));
    });

    it("returns empty message when no packages found", async () => {
      mockODataClient.getCollection.mockResolvedValue([]);
      const result = await handlers.get("list_packages")!({});
      expect(result.content[0].text).toBe("No integration packages found.");
    });

    it("passes pagination params to OData client", async () => {
      mockODataClient.getCollection.mockResolvedValue([]);
      await handlers.get("list_packages")!({ top: 10, skip: 5 });
      expect(mockODataClient.getCollection).toHaveBeenCalledWith(
        "/api/v1/IntegrationPackages",
        { $top: 10, $skip: 5 }
      );
    });

    it("returns isError on failure", async () => {
      mockODataClient.getCollection.mockRejectedValue(
        new Error("OData error (500): internal server error")
      );
      const result = await handlers.get("list_packages")!({});
      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain("OData error (500)");
    });
  });

  describe("get_package", () => {
    it("returns formatted package with all fields", async () => {
      mockODataClient.getEntity.mockResolvedValue({
        Id: "pkg1",
        Name: "My Package",
        Version: "1.0.0",
        Vendor: "SAP",
        Mode: "EDIT_ALLOWED",
        ShortText: "Short",
        Description: "A detailed description",
        SupportedPlatform: "SAP Cloud Integration",
        Products: "SAP S/4HANA",
        Keywords: "integration,iflow",
        Countries: "DE,US",
        Industries: "Manufacturing",
        LineOfBusiness: "IT",
        CreatedBy: "admin",
        CreationDate: "1711900800000",
        ModifiedBy: "dev",
        ModifiedDate: "1711987200000",
      });

      const result = await handlers.get("get_package")!({ id: "pkg1" });
      const text = result.content[0].text;
      expect(text).toContain("Id: pkg1");
      expect(text).toContain("Name: My Package");
      expect(text).toContain("Description: A detailed description");
      expect(text).toContain("Products: SAP S/4HANA");
      expect(text).toContain("Keywords: integration,iflow");
      expect(text).toContain("CreatedBy: admin");
      expect(text).toContain("ModifiedBy: dev");
    });

    it("calls correct path", async () => {
      mockODataClient.getEntity.mockResolvedValue({
        Id: "pkg1",
        Name: "My Package",
        Version: "1.0.0",
        Vendor: null,
        Mode: null,
        ShortText: "",
        Description: null,
        SupportedPlatform: null,
        Products: null,
        Keywords: null,
        Countries: null,
        Industries: null,
        LineOfBusiness: null,
        CreatedBy: null,
        CreationDate: null,
        ModifiedBy: null,
        ModifiedDate: null,
      });
      await handlers.get("get_package")!({ id: "pkg1" });
      expect(mockODataClient.getEntity).toHaveBeenCalledWith(
        "/api/v1/IntegrationPackages('pkg1')"
      );
    });

    it("returns isError on 404", async () => {
      mockODataClient.getEntity.mockRejectedValue(
        new Error("OData error (404): Resource not found")
      );
      const result = await handlers.get("get_package")!({ id: "nonexistent" });
      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain("OData error (404)");
    });
  });

  describe("create_package", () => {
    it("shows preview without confirm", async () => {
      const result = await handlers.get("create_package")!({
        id: "pkg1",
        name: "My Package",
        shortText: "A description",
        version: "1.0.0",
      });
      const text = result.content[0].text;
      expect(text).toContain("Package to create:");
      expect(text).toContain("Id: pkg1");
      expect(text).toContain("Name: My Package");
      expect(text).toContain("ShortText: A description");
      expect(text).toContain("Version: 1.0.0");
      expect(text).toContain("Set confirm to true to proceed.");
      expect(mockODataClient.post).not.toHaveBeenCalled();
    });

    it("creates package with confirm", async () => {
      mockODataClient.post.mockResolvedValue({});
      const result = await handlers.get("create_package")!({
        id: "pkg1",
        name: "My Package",
        shortText: "A description",
        version: "1.0.0",
        vendor: "SAP",
        confirm: true,
      });
      expect(mockODataClient.post).toHaveBeenCalledWith(
        "/api/v1/IntegrationPackages",
        {
          Id: "pkg1",
          Name: "My Package",
          ShortText: "A description",
          Version: "1.0.0",
          Vendor: "SAP",
        }
      );
      expect(result.content[0].text).toContain("created successfully");
    });

    it("only includes defined fields in body", async () => {
      mockODataClient.post.mockResolvedValue({});
      await handlers.get("create_package")!({
        id: "pkg1",
        name: "My Package",
        confirm: true,
      });
      expect(mockODataClient.post).toHaveBeenCalledWith(
        "/api/v1/IntegrationPackages",
        { Id: "pkg1", Name: "My Package" }
      );
    });

    it("returns isError on failure", async () => {
      mockODataClient.post.mockRejectedValue(
        new Error("OData error (409): Conflict")
      );
      const result = await handlers.get("create_package")!({
        id: "pkg1",
        name: "My Package",
        confirm: true,
      });
      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain("OData error (409)");
    });
  });

  describe("update_package", () => {
    it("shows preview without confirm", async () => {
      mockODataClient.getEntity.mockResolvedValue({
        Id: "pkg1",
        Name: "Old Name",
        Version: "1.0.0",
        Vendor: "SAP",
        Mode: "EDIT_ALLOWED",
        ShortText: "Old short text",
        Description: "Old description",
        SupportedPlatform: null,
        Products: null,
        Keywords: null,
        Countries: null,
        Industries: null,
        LineOfBusiness: null,
        CreatedBy: "admin",
        CreationDate: null,
        ModifiedBy: null,
        ModifiedDate: null,
      });

      const result = await handlers.get("update_package")!({
        id: "pkg1",
        name: "New Name",
        version: "2.0.0",
      });
      const text = result.content[0].text;
      expect(text).toContain("Package to update:");
      expect(text).toContain("Id: pkg1");
      expect(text).toContain("Proposed changes:");
      expect(text).toContain("Name: Old Name -> New Name");
      expect(text).toContain("Version: 1.0.0 -> 2.0.0");
      expect(text).toContain("Set confirm to true to proceed.");
      expect(mockODataClient.put).not.toHaveBeenCalled();
    });

    it("updates package with confirm", async () => {
      mockODataClient.put.mockResolvedValue(undefined);
      const result = await handlers.get("update_package")!({
        id: "pkg1",
        name: "New Name",
        version: "2.0.0",
        confirm: true,
      });
      expect(mockODataClient.put).toHaveBeenCalledWith(
        "/api/v1/IntegrationPackages('pkg1')",
        { Name: "New Name", Version: "2.0.0" }
      );
      expect(result.content[0].text).toContain("updated successfully");
    });

    it("returns isError when preview fetch fails", async () => {
      mockODataClient.getEntity.mockRejectedValue(
        new Error("OData error (404): Resource not found")
      );
      const result = await handlers.get("update_package")!({
        id: "nonexistent",
        name: "New Name",
      });
      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain("OData error (404)");
    });

    it("returns isError when update fails", async () => {
      mockODataClient.put.mockRejectedValue(
        new Error("OData error (403): Forbidden")
      );
      const result = await handlers.get("update_package")!({
        id: "pkg1",
        name: "New Name",
        confirm: true,
      });
      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain("OData error (403)");
    });
  });

  describe("delete_package", () => {
    it("shows preview without confirm", async () => {
      mockODataClient.getEntity.mockResolvedValue({
        Id: "pkg1",
        Name: "My Package",
        Version: "1.0.0",
        Vendor: "SAP",
        Mode: "EDIT_ALLOWED",
        ShortText: "Short",
        Description: "Description",
        SupportedPlatform: null,
        Products: null,
        Keywords: null,
        Countries: null,
        Industries: null,
        LineOfBusiness: null,
        CreatedBy: null,
        CreationDate: null,
        ModifiedBy: null,
        ModifiedDate: null,
      });

      const result = await handlers.get("delete_package")!({ id: "pkg1" });
      const text = result.content[0].text;
      expect(text).toContain("Package to delete:");
      expect(text).toContain("Id: pkg1");
      expect(text).toContain("Name: My Package");
      expect(text).toContain("Set confirm to true to proceed.");
      expect(mockODataClient.delete).not.toHaveBeenCalled();
    });

    it("deletes package with confirm", async () => {
      mockODataClient.delete.mockResolvedValue(undefined);
      const result = await handlers.get("delete_package")!({
        id: "pkg1",
        confirm: true,
      });
      expect(mockODataClient.delete).toHaveBeenCalledWith(
        "/api/v1/IntegrationPackages('pkg1')"
      );
      expect(result.content[0].text).toContain("deleted successfully");
    });

    it("returns isError when preview fetch fails", async () => {
      mockODataClient.getEntity.mockRejectedValue(
        new Error("OData error (404): Resource not found")
      );
      const result = await handlers.get("delete_package")!({
        id: "nonexistent",
      });
      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain("OData error (404)");
    });

    it("returns isError when delete fails", async () => {
      mockODataClient.delete.mockRejectedValue(
        new Error("OData error (403): Forbidden")
      );
      const result = await handlers.get("delete_package")!({
        id: "pkg1",
        confirm: true,
      });
      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain("OData error (403)");
    });
  });

  describe("download_package", () => {
    it("returns content length info", async () => {
      mockODataClient.getValue.mockResolvedValue("binary-zip-content-here");
      const result = await handlers.get("download_package")!({ id: "pkg1" });
      const text = result.content[0].text;
      expect(text).toContain("downloaded successfully");
      expect(text).toContain("Content length:");
      expect(text).toContain("binary ZIP data");
    });

    it("calls correct value path", async () => {
      mockODataClient.getValue.mockResolvedValue("data");
      await handlers.get("download_package")!({ id: "pkg1" });
      expect(mockODataClient.getValue).toHaveBeenCalledWith(
        "/api/v1/IntegrationPackages('pkg1')/$value"
      );
    });

    it("returns isError on failure", async () => {
      mockODataClient.getValue.mockRejectedValue(
        new Error("OData error (404): Resource not found")
      );
      const result = await handlers.get("download_package")!({
        id: "nonexistent",
      });
      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain("OData error (404)");
    });
  });

  describe("copy_package", () => {
    it("shows preview without confirm", async () => {
      const result = await handlers.get("copy_package")!({
        id: "pkg1",
        importMode: "CREATE_COPY",
        suffix: "_copy",
      });
      const text = result.content[0].text;
      expect(text).toContain("Package to copy:");
      expect(text).toContain("Id: pkg1");
      expect(text).toContain("ImportMode: CREATE_COPY");
      expect(text).toContain("Suffix: _copy");
      expect(text).toContain("Set confirm to true to proceed.");
      expect(mockODataClient.post).not.toHaveBeenCalled();
    });

    it("shows preview with defaults for optional params", async () => {
      const result = await handlers.get("copy_package")!({ id: "pkg1" });
      const text = result.content[0].text;
      expect(text).toContain("ImportMode: n/a");
      expect(text).toContain("Suffix: n/a");
    });

    it("copies package with confirm and all params", async () => {
      mockODataClient.post.mockResolvedValue({});
      const result = await handlers.get("copy_package")!({
        id: "pkg1",
        importMode: "OVERWRITE",
        suffix: "_v2",
        confirm: true,
      });
      expect(mockODataClient.post).toHaveBeenCalledWith(
        "/api/v1/CopyIntegrationPackage?Id='pkg1'&ImportMode=OVERWRITE&Suffix='_v2'"
      );
      expect(result.content[0].text).toContain("copied successfully");
    });

    it("copies package with confirm and only id", async () => {
      mockODataClient.post.mockResolvedValue({});
      await handlers.get("copy_package")!({
        id: "pkg1",
        confirm: true,
      });
      expect(mockODataClient.post).toHaveBeenCalledWith(
        "/api/v1/CopyIntegrationPackage?Id='pkg1'"
      );
    });

    it("returns isError on failure", async () => {
      mockODataClient.post.mockRejectedValue(
        new Error("OData error (500): internal server error")
      );
      const result = await handlers.get("copy_package")!({
        id: "pkg1",
        confirm: true,
      });
      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain("OData error (500)");
    });
  });
});
