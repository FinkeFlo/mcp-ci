import { describe, it, expect, vi, beforeEach } from "vitest";
import type { McpServer } from "@modelcontextprotocol/server";
import { registerDataStoreTools } from "../tools/data-stores.js";
import type { ModuleContext } from "../../../core/types.js";

describe("data store tools", () => {
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

    registerDataStoreTools(mockServer, context);
  });

  it("registers all 8 tools", () => {
    expect(handlers.size).toBe(8);
    expect(handlers.has("list_data_stores")).toBe(true);
    expect(handlers.has("get_data_store")).toBe(true);
    expect(handlers.has("delete_data_store")).toBe(true);
    expect(handlers.has("list_data_store_entries")).toBe(true);
    expect(handlers.has("list_data_store_entries_by_store")).toBe(true);
    expect(handlers.has("get_data_store_entry")).toBe(true);
    expect(handlers.has("delete_data_store_entry")).toBe(true);
    expect(handlers.has("download_data_store_entry")).toBe(true);
  });

  describe("list_data_stores", () => {
    it("returns formatted data stores", async () => {
      mockODataClient.getCollection.mockResolvedValue([
        {
          DataStoreName: "MyStore",
          IntegrationFlow: "Flow1",
          Type: "",
          Visibility: "Integration Flow",
          NumberOfMessages: "3",
          NumberOfOverdueMessages: "1",
        },
      ]);

      const result = await handlers.get("list_data_stores")!({});
      const text = result.content[0].text;
      expect(text).toContain("DataStoreName: MyStore");
      expect(text).toContain("IntegrationFlow: Flow1");
      expect(text).toContain("NumberOfMessages: 3");
    });

    it("returns empty message when no stores found", async () => {
      mockODataClient.getCollection.mockResolvedValue([]);
      const result = await handlers.get("list_data_stores")!({});
      expect(result.content[0].text).toBe("No data stores found.");
    });

    it("appends overdueonly parameter", async () => {
      mockODataClient.getCollection.mockResolvedValue([]);
      await handlers.get("list_data_stores")!({ overdueonly: "true" });
      expect(mockODataClient.getCollection).toHaveBeenCalledWith(
        "/api/v1/DataStores?overdueonly=true"
      );
    });

    it("returns isError on failure", async () => {
      mockODataClient.getCollection.mockRejectedValue(
        new Error("OData error (500): internal")
      );
      const result = await handlers.get("list_data_stores")!({});
      expect(result.isError).toBe(true);
    });
  });

  describe("get_data_store", () => {
    it("returns formatted data store", async () => {
      mockODataClient.getEntity.mockResolvedValue({
        DataStoreName: "MyStore",
        IntegrationFlow: "Flow1",
        Type: "XI",
        Visibility: "Integration Flow",
        NumberOfMessages: "19",
        NumberOfOverdueMessages: "5",
      });

      const result = await handlers.get("get_data_store")!({
        dataStoreName: "MyStore",
        integrationFlow: "Flow1",
        type: "XI",
      });
      const text = result.content[0].text;
      expect(text).toContain("DataStoreName: MyStore");
      expect(text).toContain("Type: XI");
    });

    it("calls correct composite key path", async () => {
      mockODataClient.getEntity.mockResolvedValue({
        DataStoreName: "Store",
        IntegrationFlow: "Flow",
        Type: "",
        Visibility: "Global",
        NumberOfMessages: "0",
        NumberOfOverdueMessages: "0",
      });
      await handlers.get("get_data_store")!({
        dataStoreName: "Store",
        integrationFlow: "Flow",
        type: "",
      });
      expect(mockODataClient.getEntity).toHaveBeenCalledWith(
        "/api/v1/DataStores(DataStoreName='Store',IntegrationFlow='Flow',Type='')"
      );
    });

    it("returns isError on 404", async () => {
      mockODataClient.getEntity.mockRejectedValue(
        new Error("OData error (404): Not found")
      );
      const result = await handlers.get("get_data_store")!({
        dataStoreName: "x",
        integrationFlow: "y",
        type: "z",
      });
      expect(result.isError).toBe(true);
    });
  });

  describe("delete_data_store", () => {
    it("shows preview without confirm", async () => {
      mockODataClient.getEntity.mockResolvedValue({
        DataStoreName: "MyStore",
        IntegrationFlow: "Flow1",
        Type: "",
        Visibility: "Global",
        NumberOfMessages: "5",
        NumberOfOverdueMessages: "2",
      });

      const result = await handlers.get("delete_data_store")!({
        dataStoreName: "MyStore",
        integrationFlow: "Flow1",
        type: "",
      });
      const text = result.content[0].text;
      expect(text).toContain("Data store to delete:");
      expect(text).toContain("DataStoreName: MyStore");
      expect(text).toContain("Set confirm to true to proceed.");
      expect(mockODataClient.delete).not.toHaveBeenCalled();
    });

    it("deletes data store with confirm", async () => {
      mockODataClient.delete.mockResolvedValue(undefined);
      const result = await handlers.get("delete_data_store")!({
        dataStoreName: "MyStore",
        integrationFlow: "Flow1",
        type: "",
        confirm: true,
      });
      expect(mockODataClient.delete).toHaveBeenCalledWith(
        "/api/v1/DataStores(DataStoreName='MyStore',IntegrationFlow='Flow1',Type='')"
      );
      expect(result.content[0].text).toContain("deleted successfully");
    });

    it("returns isError when preview fetch fails", async () => {
      mockODataClient.getEntity.mockRejectedValue(
        new Error("OData error (404): Not found")
      );
      const result = await handlers.get("delete_data_store")!({
        dataStoreName: "x",
        integrationFlow: "y",
        type: "z",
      });
      expect(result.isError).toBe(true);
    });

    it("returns isError when delete fails", async () => {
      mockODataClient.delete.mockRejectedValue(
        new Error("OData error (403): Forbidden")
      );
      const result = await handlers.get("delete_data_store")!({
        dataStoreName: "MyStore",
        integrationFlow: "Flow1",
        type: "",
        confirm: true,
      });
      expect(result.isError).toBe(true);
    });
  });

  describe("list_data_store_entries", () => {
    it("returns formatted entries", async () => {
      mockODataClient.getCollection.mockResolvedValue([
        {
          Id: "id-1",
          DataStoreName: "Store",
          IntegrationFlow: "Flow1",
          Type: "",
          Status: "Overdue",
          MessageId: "msg-1",
          DueAt: "2021-02-15T16:06:34.08",
          CreatedAt: "2021-02-15T16:06:34.08",
          RetainUntil: "2021-05-15T16:06:34.08",
        },
      ]);

      const result = await handlers.get("list_data_store_entries")!({});
      const text = result.content[0].text;
      expect(text).toContain("Id: id-1");
      expect(text).toContain("Status: Overdue");
      expect(text).toContain("MessageId: msg-1");
    });

    it("returns empty message when no entries", async () => {
      mockODataClient.getCollection.mockResolvedValue([]);
      const result = await handlers.get("list_data_store_entries")!({});
      expect(result.content[0].text).toBe("No data store entries found.");
    });

    it("appends overdueonly and messageid params", async () => {
      mockODataClient.getCollection.mockResolvedValue([]);
      await handlers.get("list_data_store_entries")!({
        overdueonly: "true",
        messageid: "msg-1",
      });
      expect(mockODataClient.getCollection).toHaveBeenCalledWith(
        "/api/v1/DataStoreEntries?overdueonly=true&messageid=msg-1"
      );
    });

    it("returns isError on failure", async () => {
      mockODataClient.getCollection.mockRejectedValue(
        new Error("OData error (500): internal")
      );
      const result = await handlers.get("list_data_store_entries")!({});
      expect(result.isError).toBe(true);
    });
  });

  describe("list_data_store_entries_by_store", () => {
    it("returns formatted entries for a store", async () => {
      mockODataClient.getCollection.mockResolvedValue([
        {
          Id: "id-1",
          DataStoreName: "Store",
          IntegrationFlow: "Flow1",
          Type: "",
          Status: "Waiting",
          MessageId: "msg-1",
          DueAt: "2021-02-15T16:06:34.08",
          CreatedAt: "2021-02-15T16:06:34.08",
          RetainUntil: "2021-05-15T16:06:34.08",
        },
      ]);

      const result = await handlers.get("list_data_store_entries_by_store")!({
        dataStoreName: "Store",
        integrationFlow: "Flow1",
        type: "",
      });
      const text = result.content[0].text;
      expect(text).toContain("Id: id-1");
      expect(text).toContain("Status: Waiting");
    });

    it("calls correct path", async () => {
      mockODataClient.getCollection.mockResolvedValue([]);
      await handlers.get("list_data_store_entries_by_store")!({
        dataStoreName: "Store",
        integrationFlow: "Flow1",
        type: "XI",
      });
      expect(mockODataClient.getCollection).toHaveBeenCalledWith(
        "/api/v1/DataStores(DataStoreName='Store',IntegrationFlow='Flow1',Type='XI')/Entries"
      );
    });

    it("returns empty message when no entries", async () => {
      mockODataClient.getCollection.mockResolvedValue([]);
      const result = await handlers.get("list_data_store_entries_by_store")!({
        dataStoreName: "Store",
        integrationFlow: "Flow1",
        type: "",
      });
      expect(result.content[0].text).toBe("No data store entries found.");
    });

    it("returns isError on failure", async () => {
      mockODataClient.getCollection.mockRejectedValue(
        new Error("OData error (500): fail")
      );
      const result = await handlers.get("list_data_store_entries_by_store")!({
        dataStoreName: "Store",
        integrationFlow: "Flow1",
        type: "",
      });
      expect(result.isError).toBe(true);
    });
  });

  describe("get_data_store_entry", () => {
    it("returns formatted entry", async () => {
      mockODataClient.getEntity.mockResolvedValue({
        Id: "id-1",
        DataStoreName: "Store",
        IntegrationFlow: "Flow1",
        Type: "",
        Status: "Overdue",
        MessageId: "msg-1",
        DueAt: "2021-02-15T16:06:34.08",
        CreatedAt: "2021-02-15T16:06:34.08",
        RetainUntil: "2021-05-15T16:06:34.08",
      });

      const result = await handlers.get("get_data_store_entry")!({
        id: "id-1",
        dataStoreName: "Store",
        integrationFlow: "Flow1",
        type: "",
      });
      const text = result.content[0].text;
      expect(text).toContain("Id: id-1");
      expect(text).toContain("Status: Overdue");
    });

    it("calls correct 4-part composite key path", async () => {
      mockODataClient.getEntity.mockResolvedValue({
        Id: "id-1",
        DataStoreName: "Store",
        IntegrationFlow: "Flow",
        Type: "XI",
        Status: "OK",
        MessageId: "m",
        DueAt: null,
        CreatedAt: null,
        RetainUntil: null,
      });
      await handlers.get("get_data_store_entry")!({
        id: "id-1",
        dataStoreName: "Store",
        integrationFlow: "Flow",
        type: "XI",
      });
      expect(mockODataClient.getEntity).toHaveBeenCalledWith(
        "/api/v1/DataStoreEntries(Id='id-1',DataStoreName='Store',IntegrationFlow='Flow',Type='XI')"
      );
    });

    it("returns isError on 404", async () => {
      mockODataClient.getEntity.mockRejectedValue(
        new Error("OData error (404): Not found")
      );
      const result = await handlers.get("get_data_store_entry")!({
        id: "x",
        dataStoreName: "y",
        integrationFlow: "z",
        type: "",
      });
      expect(result.isError).toBe(true);
    });
  });

  describe("delete_data_store_entry", () => {
    it("shows preview without confirm", async () => {
      mockODataClient.getEntity.mockResolvedValue({
        Id: "id-1",
        DataStoreName: "Store",
        IntegrationFlow: "Flow1",
        Type: "",
        Status: "Overdue",
        MessageId: "msg-1",
        DueAt: "2021-02-15T16:06:34.08",
        CreatedAt: "2021-02-15T16:06:34.08",
        RetainUntil: "2021-05-15T16:06:34.08",
      });

      const result = await handlers.get("delete_data_store_entry")!({
        id: "id-1",
        dataStoreName: "Store",
        integrationFlow: "Flow1",
        type: "",
      });
      const text = result.content[0].text;
      expect(text).toContain("Data store entry to delete:");
      expect(text).toContain("Id: id-1");
      expect(text).toContain("Set confirm to true to proceed.");
      expect(mockODataClient.delete).not.toHaveBeenCalled();
    });

    it("deletes entry with confirm", async () => {
      mockODataClient.delete.mockResolvedValue(undefined);
      const result = await handlers.get("delete_data_store_entry")!({
        id: "id-1",
        dataStoreName: "Store",
        integrationFlow: "Flow1",
        type: "",
        confirm: true,
      });
      expect(mockODataClient.delete).toHaveBeenCalledWith(
        "/api/v1/DataStoreEntries(Id='id-1',DataStoreName='Store',IntegrationFlow='Flow1',Type='')"
      );
      expect(result.content[0].text).toContain("deleted successfully");
    });

    it("returns isError when preview fetch fails", async () => {
      mockODataClient.getEntity.mockRejectedValue(
        new Error("OData error (404): Not found")
      );
      const result = await handlers.get("delete_data_store_entry")!({
        id: "x",
        dataStoreName: "y",
        integrationFlow: "z",
        type: "",
      });
      expect(result.isError).toBe(true);
    });

    it("returns isError when delete fails", async () => {
      mockODataClient.delete.mockRejectedValue(
        new Error("OData error (403): Forbidden")
      );
      const result = await handlers.get("delete_data_store_entry")!({
        id: "id-1",
        dataStoreName: "Store",
        integrationFlow: "Flow1",
        type: "",
        confirm: true,
      });
      expect(result.isError).toBe(true);
    });
  });

  describe("download_data_store_entry", () => {
    it("returns entry content", async () => {
      mockODataClient.getValue.mockResolvedValue("<data>content</data>");
      const result = await handlers.get("download_data_store_entry")!({
        id: "id-1",
        dataStoreName: "Store",
        integrationFlow: "Flow1",
        type: "",
      });
      expect(result.content[0].text).toBe("<data>content</data>");
    });

    it("returns no content message for empty result", async () => {
      mockODataClient.getValue.mockResolvedValue("");
      const result = await handlers.get("download_data_store_entry")!({
        id: "id-1",
        dataStoreName: "Store",
        integrationFlow: "Flow1",
        type: "",
      });
      expect(result.content[0].text).toBe("No content available.");
    });

    it("calls correct value path", async () => {
      mockODataClient.getValue.mockResolvedValue("data");
      await handlers.get("download_data_store_entry")!({
        id: "id-1",
        dataStoreName: "Store",
        integrationFlow: "Flow",
        type: "XI",
      });
      expect(mockODataClient.getValue).toHaveBeenCalledWith(
        "/api/v1/DataStoreEntries(Id='id-1',DataStoreName='Store',IntegrationFlow='Flow',Type='XI')/$value"
      );
    });

    it("returns isError on failure", async () => {
      mockODataClient.getValue.mockRejectedValue(
        new Error("OData error (404): Not found")
      );
      const result = await handlers.get("download_data_store_entry")!({
        id: "x",
        dataStoreName: "y",
        integrationFlow: "z",
        type: "",
      });
      expect(result.isError).toBe(true);
    });
  });
});
