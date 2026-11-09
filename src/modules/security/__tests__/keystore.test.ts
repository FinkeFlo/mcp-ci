import { describe, it, expect, vi, beforeEach } from "vitest";
import type { McpServer } from "@modelcontextprotocol/server";
import { registerKeystoreTools } from "../tools/keystore.js";
import type { ModuleContext } from "../../../core/types.js";

describe("keystore tools", () => {
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

    registerKeystoreTools(mockServer, context);
  });

  it("registers all 13 tools", () => {
    expect(handlers.size).toBe(13);
    expect(handlers.has("list_keystore_entries")).toBe(true);
    expect(handlers.has("get_keystore_entry")).toBe(true);
    expect(handlers.has("rename_keystore_entry")).toBe(true);
    expect(handlers.has("delete_keystore_entry")).toBe(true);
    expect(handlers.has("export_ssh_key")).toBe(true);
    expect(handlers.has("get_keystore")).toBe(true);
    expect(handlers.has("get_keystore_size")).toBe(true);
    expect(handlers.has("export_keystore")).toBe(true);
    expect(handlers.has("import_keystore")).toBe(true);
    expect(handlers.has("restore_or_delete_keystore")).toBe(true);
    expect(handlers.has("list_history_keystore_entries")).toBe(true);
    expect(handlers.has("get_history_keystore_entry")).toBe(true);
    expect(handlers.has("restore_history_entry")).toBe(true);
  });

  // ==========================================
  // Group 1: Keystore Entries
  // ==========================================

  describe("list_keystore_entries", () => {
    it("returns formatted keystore entries", async () => {
      mockODataClient.getCollection.mockResolvedValue([
        {
          Hexalias: "6162636431",
          Alias: "mykey",
          KeyType: "RSA",
          KeySize: 2048,
          Type: "Certificate",
          Validity: "Valid",
          ValidNotBefore: "/Date(1711900800000)/",
          ValidNotAfter: "/Date(1743436800000)/",
          Owner: "admin",
          Status: "DEPLOYED",
        },
      ]);

      const result = await handlers.get("list_keystore_entries")!({
        keystoreName: "system",
      });
      const text = result.content[0].text;
      expect(text).toContain("Hexalias: 6162636431");
      expect(text).toContain("Alias: mykey");
      expect(text).toContain("KeyType: RSA");
      expect(text).toContain("KeySize: 2048");
      expect(text).toContain("Type: Certificate");
      expect(text).toContain("Validity: Valid");
      expect(text).toContain("Owner: admin");
      expect(text).toContain("Status: DEPLOYED");
    });

    it("parses OData date format", async () => {
      mockODataClient.getCollection.mockResolvedValue([
        {
          Hexalias: "abc",
          Alias: "test",
          KeyType: null,
          KeySize: null,
          Type: null,
          Validity: null,
          ValidNotBefore: "/Date(1711900800000)/",
          ValidNotAfter: null,
          Owner: null,
          Status: null,
        },
      ]);

      const result = await handlers.get("list_keystore_entries")!({
        keystoreName: "system",
      });
      const text = result.content[0].text;
      expect(text).toContain("ValidNotBefore: 2024-03-31");
      expect(text).toContain("ValidNotAfter: n/a");
    });

    it("filters by expiringWithinDays, includes expired, sorts by expiry", async () => {
      const day = 86_400_000;
      const now = Date.now();
      const mk = (alias: string, offsetDays: number) => ({
        Hexalias: alias,
        Alias: alias,
        ValidNotAfter: `/Date(${now + offsetDays * day})/`,
      });
      mockODataClient.getCollection.mockResolvedValue([
        // Half days keep the floored day count stable however long the test takes.
        mk("soon", 10.5),
        mk("far", 400),
        mk("expired", -5.5),
      ]);
      const result = await handlers.get("list_keystore_entries")!({
        keystoreName: "system",
        expiringWithinDays: 60,
      });
      const text = result.content[0].text;
      expect(text).not.toContain("Alias: far");
      expect(text.indexOf("Alias: expired")).toBeGreaterThanOrEqual(0);
      expect(text.indexOf("Alias: expired")).toBeLessThan(
        text.indexOf("Alias: soon")
      );
      expect(text).toContain("(expired)");
      expect(text).toContain("DaysUntilExpiry: 10");
      expect(text).toContain("DaysUntilExpiry: -6 (expired)");
    });

    it("adds ValidNotAfter to a custom select when filtering by expiry", async () => {
      mockODataClient.getCollection.mockResolvedValue([]);
      await handlers.get("list_keystore_entries")!({
        keystoreName: "system",
        select: "Alias",
        expiringWithinDays: 30,
      });
      expect(mockODataClient.getCollection).toHaveBeenCalledWith(
        "/api/v1/KeystoreEntries?keystoreName=system",
        { $select: "Alias,ValidNotAfter" }
      );
    });

    it("parses dates with a time zone offset and keeps unparseable entries", async () => {
      const day = 86_400_000;
      mockODataClient.getCollection.mockResolvedValue([
        { Hexalias: "a", Alias: "offset", ValidNotAfter: `/Date(${Date.now() + 5.5 * day}+0060)/` },
        { Hexalias: "b", Alias: "broken", ValidNotAfter: "not a date" },
        { Hexalias: "c", Alias: "far", ValidNotAfter: `/Date(${Date.now() + 400 * day})/` },
      ]);
      const result = await handlers.get("list_keystore_entries")!({
        keystoreName: "system",
        expiringWithinDays: 30,
      });
      const text = result.content[0].text;
      expect(text).toContain("Alias: offset");
      expect(text).toContain("DaysUntilExpiry: 5");
      expect(text).toContain("Alias: broken");
      expect(text).toContain("unknown expiry");
      expect(text).not.toContain("Alias: far");
      expect(text.indexOf("Alias: offset")).toBeLessThan(text.indexOf("Alias: broken"));
    });

    it("reports when nothing expires within the window", async () => {
      mockODataClient.getCollection.mockResolvedValue([
        { Hexalias: "a", Alias: "far", ValidNotAfter: `/Date(${Date.now() + 400 * 86_400_000})/` },
      ]);
      const result = await handlers.get("list_keystore_entries")!({
        keystoreName: "system",
        expiringWithinDays: 30,
      });
      expect(result.content[0].text).toContain("No keystore entries expire within 30 day(s)");
    });

    it("returns empty message when no entries found", async () => {
      mockODataClient.getCollection.mockResolvedValue([]);
      const result = await handlers.get("list_keystore_entries")!({
        keystoreName: "system",
      });
      expect(result.content[0].text).toBe("No keystore entries found.");
    });

    it("passes keystoreName and select in one query string", async () => {
      mockODataClient.getCollection.mockResolvedValue([]);
      await handlers.get("list_keystore_entries")!({
        keystoreName: "backup_admin_system",
        select: "Alias,KeyType",
      });
      expect(mockODataClient.getCollection).toHaveBeenCalledWith(
        "/api/v1/KeystoreEntries?keystoreName=backup_admin_system",
        { $select: "Alias,KeyType" }
      );
    });

    it("returns isError on failure", async () => {
      mockODataClient.getCollection.mockRejectedValue(
        new Error("OData error (500): internal server error")
      );
      const result = await handlers.get("list_keystore_entries")!({
        keystoreName: "system",
      });
      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain("OData error (500)");
    });
  });

  describe("get_keystore_entry", () => {
    it("returns formatted entry detail", async () => {
      mockODataClient.getEntity.mockResolvedValue({
        Hexalias: "6162636431",
        Alias: "mykey",
        KeyType: "RSA",
        KeySize: 2048,
        Type: "Certificate",
        Validity: "Valid",
        ValidNotBefore: "/Date(1711900800000)/",
        ValidNotAfter: "/Date(1743436800000)/",
        SerialNumber: "12345",
        SignatureAlgorithm: "SHA256withRSA",
        EllipticCurve: null,
        SubjectDN: "CN=test",
        IssuerDN: "CN=issuer",
        Version: 3,
        FingerprintSha1: "AA:BB:CC",
        FingerprintSha256: "DD:EE:FF",
        FingerprintSha512: "11:22:33",
        Owner: "admin",
        LastModifiedBy: "dev",
        LastModifiedTime: "/Date(1711900800000)/",
        CreatedBy: "admin",
        CreatedTime: "/Date(1711900800000)/",
        Status: "DEPLOYED",
      });

      const result = await handlers.get("get_keystore_entry")!({
        hexalias: "6162636431",
        keystoreName: "system",
      });
      const text = result.content[0].text;
      expect(text).toContain("Hexalias: 6162636431");
      expect(text).toContain("SubjectDN: CN=test");
      expect(text).toContain("IssuerDN: CN=issuer");
      expect(text).toContain("FingerprintSha256: DD:EE:FF");
      expect(text).toContain("SignatureAlgorithm: SHA256withRSA");
      expect(text).toContain("CreatedBy: admin");
    });

    it("calls correct path with keystoreName query param", async () => {
      mockODataClient.getEntity.mockResolvedValue({
        Hexalias: "abc",
        Alias: "test",
        KeyType: null,
        KeySize: null,
        Type: null,
        Validity: null,
        ValidNotBefore: null,
        ValidNotAfter: null,
        SerialNumber: null,
        SignatureAlgorithm: null,
        EllipticCurve: null,
        SubjectDN: null,
        IssuerDN: null,
        Version: null,
        FingerprintSha1: null,
        FingerprintSha256: null,
        FingerprintSha512: null,
        Owner: null,
        LastModifiedBy: null,
        LastModifiedTime: null,
        CreatedBy: null,
        CreatedTime: null,
        Status: null,
      });
      await handlers.get("get_keystore_entry")!({
        hexalias: "abc",
        keystoreName: "system",
      });
      expect(mockODataClient.getEntity).toHaveBeenCalledWith(
        "/api/v1/KeystoreEntries('abc')?keystoreName=system"
      );
    });

    it("returns isError on 404", async () => {
      mockODataClient.getEntity.mockRejectedValue(
        new Error("OData error (404): Resource not found")
      );
      const result = await handlers.get("get_keystore_entry")!({
        hexalias: "notfound",
        keystoreName: "system",
      });
      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain("OData error (404)");
    });
  });

  describe("rename_keystore_entry", () => {
    it("shows preview without confirm", async () => {
      const result = await handlers.get("rename_keystore_entry")!({
        hexalias: "abc123",
        newAlias: "my-new-alias",
      });
      const text = result.content[0].text;
      expect(text).toContain("Keystore entry to rename:");
      expect(text).toContain("Hexalias: abc123");
      expect(text).toContain("New alias: my-new-alias");
      expect(text).toContain("Set confirm to true to proceed.");
      expect(mockODataClient.put).not.toHaveBeenCalled();
    });

    it("renames entry with confirm", async () => {
      mockODataClient.put.mockResolvedValue(undefined);
      const result = await handlers.get("rename_keystore_entry")!({
        hexalias: "abc123",
        newAlias: "my-new-alias",
        confirm: true,
      });
      expect(mockODataClient.put).toHaveBeenCalledWith(
        "/api/v1/KeystoreEntries('abc123')?renameAlias=my-new-alias",
        { Status: null }
      );
      expect(result.content[0].text).toContain("renamed to 'my-new-alias' successfully");
    });

    it("returns isError on failure", async () => {
      mockODataClient.put.mockRejectedValue(
        new Error("OData error (403): Forbidden")
      );
      const result = await handlers.get("rename_keystore_entry")!({
        hexalias: "abc123",
        newAlias: "new",
        confirm: true,
      });
      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain("OData error (403)");
    });
  });

  describe("delete_keystore_entry", () => {
    it("shows preview without confirm", async () => {
      const result = await handlers.get("delete_keystore_entry")!({
        hexalias: "abc123",
        keystoreName: "system",
      });
      const text = result.content[0].text;
      expect(text).toContain("Keystore entry to delete:");
      expect(text).toContain("Hexalias: abc123");
      expect(text).toContain("Set confirm to true to proceed.");
      expect(mockODataClient.delete).not.toHaveBeenCalled();
    });

    it("deletes entry with confirm", async () => {
      mockODataClient.delete.mockResolvedValue(undefined);
      const result = await handlers.get("delete_keystore_entry")!({
        hexalias: "abc123",
        confirm: true,
      });
      expect(mockODataClient.delete).toHaveBeenCalledWith(
        "/api/v1/KeystoreEntries('abc123')"
      );
      expect(result.content[0].text).toContain("deleted successfully");
    });

    it("passes keystoreName and activate as query params", async () => {
      mockODataClient.delete.mockResolvedValue(undefined);
      await handlers.get("delete_keystore_entry")!({
        hexalias: "abc123",
        keystoreName: "KeyRenewal",
        activate: true,
        confirm: true,
      });
      expect(mockODataClient.delete).toHaveBeenCalledWith(
        "/api/v1/KeystoreEntries('abc123')?keystoreName=KeyRenewal&activate=true"
      );
    });

    it("returns isError on failure", async () => {
      mockODataClient.delete.mockRejectedValue(
        new Error("OData error (403): Forbidden")
      );
      const result = await handlers.get("delete_keystore_entry")!({
        hexalias: "abc123",
        confirm: true,
      });
      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain("OData error (403)");
    });
  });

  describe("export_ssh_key", () => {
    it("returns SSH public key content", async () => {
      mockODataClient.getValue.mockResolvedValue(
        "ssh-rsa AAAAB3NzaC1yc2EAAA... user@host"
      );
      const result = await handlers.get("export_ssh_key")!({
        hexalias: "abc123",
      });
      expect(result.content[0].text).toContain("ssh-rsa AAAAB3NzaC1yc2EAAA");
    });

    it("calls correct path", async () => {
      mockODataClient.getValue.mockResolvedValue("ssh-rsa ...");
      await handlers.get("export_ssh_key")!({ hexalias: "abc123" });
      expect(mockODataClient.getValue).toHaveBeenCalledWith(
        "/api/v1/KeystoreEntries('abc123')/Sshkey/$value"
      );
    });

    it("returns isError on failure", async () => {
      mockODataClient.getValue.mockRejectedValue(
        new Error("OData error (404): Resource not found")
      );
      const result = await handlers.get("export_ssh_key")!({
        hexalias: "notfound",
      });
      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain("OData error (404)");
    });
  });

  // ==========================================
  // Group 2: Keystores
  // ==========================================

  describe("get_keystore", () => {
    it("returns formatted keystore details", async () => {
      mockODataClient.getEntity.mockResolvedValue({
        Name: "system",
        LastModifiedBy: "admin",
        LastModifiedTime: "/Date(1711900800000)/",
        Size: 42,
      });
      const result = await handlers.get("get_keystore")!({
        keystoreName: "system",
      });
      const text = result.content[0].text;
      expect(text).toContain("Name: system");
      expect(text).toContain("LastModifiedBy: admin");
      expect(text).toContain("Size: 42");
    });

    it("calls correct path with expand and select", async () => {
      mockODataClient.getEntity.mockResolvedValue({
        Name: "system",
        LastModifiedBy: null,
        LastModifiedTime: null,
        Size: null,
      });
      await handlers.get("get_keystore")!({
        keystoreName: "system",
        expand: "Entries",
        select: "Name,Size",
      });
      expect(mockODataClient.getEntity).toHaveBeenCalledWith(
        "/api/v1/Keystores('system')",
        { $expand: "Entries", $select: "Name,Size" }
      );
    });

    it("calls without params when no expand/select", async () => {
      mockODataClient.getEntity.mockResolvedValue({
        Name: "system",
        LastModifiedBy: null,
        LastModifiedTime: null,
        Size: null,
      });
      await handlers.get("get_keystore")!({ keystoreName: "system" });
      expect(mockODataClient.getEntity).toHaveBeenCalledWith(
        "/api/v1/Keystores('system')",
        undefined
      );
    });

    it("returns isError on failure", async () => {
      mockODataClient.getEntity.mockRejectedValue(
        new Error("OData error (404): Resource not found")
      );
      const result = await handlers.get("get_keystore")!({
        keystoreName: "system",
      });
      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain("OData error (404)");
    });
  });

  describe("get_keystore_size", () => {
    it("returns keystore size", async () => {
      mockODataClient.getValue.mockResolvedValue("42");
      const result = await handlers.get("get_keystore_size")!({
        keystoreName: "system",
      });
      expect(result.content[0].text).toBe("Keystore 'system' size: 42");
    });

    it("calls correct path", async () => {
      mockODataClient.getValue.mockResolvedValue("10");
      await handlers.get("get_keystore_size")!({
        keystoreName: "backup_admin_system",
      });
      expect(mockODataClient.getValue).toHaveBeenCalledWith(
        "/api/v1/Keystores('backup_admin_system')/Size/$value"
      );
    });

    it("returns isError on failure", async () => {
      mockODataClient.getValue.mockRejectedValue(
        new Error("OData error (500): internal server error")
      );
      const result = await handlers.get("get_keystore_size")!({
        keystoreName: "system",
      });
      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain("OData error (500)");
    });
  });

  describe("export_keystore", () => {
    it("returns content length info", async () => {
      mockODataClient.getValue.mockResolvedValue("base64encodeddata...");
      const result = await handlers.get("export_keystore")!({
        keystoreName: "system",
      });
      const text = result.content[0].text;
      expect(text).toContain("exported successfully");
      expect(text).toContain("Content length:");
      expect(text).toContain("base64-encoded JKS/JCEKS data");
    });

    it("calls correct path", async () => {
      mockODataClient.getValue.mockResolvedValue("data");
      await handlers.get("export_keystore")!({
        keystoreName: "system",
      });
      expect(mockODataClient.getValue).toHaveBeenCalledWith(
        "/api/v1/KeystoreResources('system')"
      );
    });

    it("returns isError on failure", async () => {
      mockODataClient.getValue.mockRejectedValue(
        new Error("OData error (404): Resource not found")
      );
      const result = await handlers.get("export_keystore")!({
        keystoreName: "system",
      });
      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain("OData error (404)");
    });
  });

  describe("import_keystore", () => {
    it("shows preview without confirm", async () => {
      const result = await handlers.get("import_keystore")!({
        resource: "base64content",
        password: "secret",
        importOption: "merge",
      });
      const text = result.content[0].text;
      expect(text).toContain("Keystore to import:");
      expect(text).toContain("Resource length: 13 characters");
      expect(text).toContain("Import option: merge");
      expect(text).toContain("Set confirm to true to proceed.");
      expect(mockODataClient.post).not.toHaveBeenCalled();
    });

    it("imports keystore with confirm", async () => {
      mockODataClient.post.mockResolvedValue({});
      const result = await handlers.get("import_keystore")!({
        resource: "base64content",
        password: "secret",
        confirm: true,
      });
      expect(mockODataClient.post).toHaveBeenCalledWith(
        "/api/v1/KeystoreResources",
        {
          Name: "system",
          Resource: "base64content",
          Password: "secret",
        }
      );
      expect(result.content[0].text).toContain("imported successfully");
    });

    it("passes importOption as query param", async () => {
      mockODataClient.post.mockResolvedValue({});
      await handlers.get("import_keystore")!({
        resource: "data",
        password: "pass",
        importOption: "replace",
        confirm: true,
      });
      expect(mockODataClient.post).toHaveBeenCalledWith(
        "/api/v1/KeystoreResources?importOption=replace",
        {
          Name: "system",
          Resource: "data",
          Password: "pass",
        }
      );
    });

    it("returns isError on failure", async () => {
      mockODataClient.post.mockRejectedValue(
        new Error("OData error (400): Bad request")
      );
      const result = await handlers.get("import_keystore")!({
        resource: "data",
        password: "pass",
        confirm: true,
      });
      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain("OData error (400)");
    });
  });

  describe("restore_or_delete_keystore", () => {
    it("shows restore preview without confirm", async () => {
      const result = await handlers.get("restore_or_delete_keystore")!({
        operation: "restore",
      });
      const text = result.content[0].text;
      expect(text).toContain("Keystore operation: RESTORE from backup");
      expect(text).toContain("restore the system keystore from backup_admin_system");
      expect(text).toContain("Set confirm to true to proceed.");
      expect(mockODataClient.put).not.toHaveBeenCalled();
    });

    it("shows delete preview without confirm", async () => {
      const result = await handlers.get("restore_or_delete_keystore")!({
        operation: "delete",
        aliases: "alias1;alias2",
      });
      const text = result.content[0].text;
      expect(text).toContain("Keystore operation: DELETE entries");
      expect(text).toContain("Aliases to delete: alias1;alias2");
      expect(text).toContain("Set confirm to true to proceed.");
      expect(mockODataClient.put).not.toHaveBeenCalled();
    });

    it("restores keystore from backup with confirm", async () => {
      mockODataClient.put.mockResolvedValue(undefined);
      const result = await handlers.get("restore_or_delete_keystore")!({
        operation: "restore",
        confirm: true,
      });
      expect(mockODataClient.put).toHaveBeenCalledWith(
        "/api/v1/KeystoreResources('system')?retrieveBackup=backup_admin_system",
        { Resource: null }
      );
      expect(result.content[0].text).toContain("restored from backup successfully");
    });

    it("deletes entries with confirm", async () => {
      mockODataClient.put.mockResolvedValue(undefined);
      const result = await handlers.get("restore_or_delete_keystore")!({
        operation: "delete",
        aliases: "alias1;alias2",
        confirm: true,
      });
      expect(mockODataClient.put).toHaveBeenCalledWith(
        "/api/v1/KeystoreResources('system')?deleteEntries=true",
        { Aliases: "alias1;alias2" }
      );
      expect(result.content[0].text).toContain("deleted successfully");
    });

    it("returns isError when delete without aliases", async () => {
      const result = await handlers.get("restore_or_delete_keystore")!({
        operation: "delete",
        confirm: true,
      });
      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain("Aliases parameter is required");
    });

    it("returns isError on failure", async () => {
      mockODataClient.put.mockRejectedValue(
        new Error("OData error (500): internal server error")
      );
      const result = await handlers.get("restore_or_delete_keystore")!({
        operation: "restore",
        confirm: true,
      });
      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain("OData error (500)");
    });
  });

  // ==========================================
  // Group 3: Keystore History
  // ==========================================

  describe("list_history_keystore_entries", () => {
    it("returns formatted history entries", async () => {
      mockODataClient.getCollection.mockResolvedValue([
        {
          Hexalias: "hist1",
          Alias: "old-key",
          OriginalAlias: "original-key",
          KeyType: "RSA",
          KeySize: 2048,
          Type: "Certificate",
          Validity: "Expired",
          ValidNotBefore: "/Date(1711900800000)/",
          ValidNotAfter: "/Date(1743436800000)/",
          ActivatedBy: "admin",
          ActiveFrom: "/Date(1711900800000)/",
          DeactivatedBy: "dev",
          ActiveUntil: "/Date(1743436800000)/",
          ActivationSequenceNumber: 3,
          Owner: "admin",
          Status: "DEACTIVATED",
        },
      ]);

      const result = await handlers.get("list_history_keystore_entries")!({});
      const text = result.content[0].text;
      expect(text).toContain("Hexalias: hist1");
      expect(text).toContain("Alias: old-key");
      expect(text).toContain("OriginalAlias: original-key");
      expect(text).toContain("ActivatedBy: admin");
      expect(text).toContain("DeactivatedBy: dev");
      expect(text).toContain("ActivationSequenceNumber: 3");
    });

    it("returns empty message when no entries found", async () => {
      mockODataClient.getCollection.mockResolvedValue([]);
      const result = await handlers.get("list_history_keystore_entries")!({});
      expect(result.content[0].text).toBe(
        "No history keystore entries found."
      );
    });

    it("passes select param", async () => {
      mockODataClient.getCollection.mockResolvedValue([]);
      await handlers.get("list_history_keystore_entries")!({
        select: "Alias,KeyType",
      });
      expect(mockODataClient.getCollection).toHaveBeenCalledWith(
        "/api/v1/HistoryKeystoreEntries",
        { $select: "Alias,KeyType" }
      );
    });

    it("returns isError on failure", async () => {
      mockODataClient.getCollection.mockRejectedValue(
        new Error("OData error (500): internal server error")
      );
      const result = await handlers.get("list_history_keystore_entries")!({});
      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain("OData error (500)");
    });
  });

  describe("get_history_keystore_entry", () => {
    it("returns formatted history entry detail", async () => {
      mockODataClient.getEntity.mockResolvedValue({
        Hexalias: "hist1",
        Alias: "old-key",
        OriginalAlias: "original-key",
        KeyType: "RSA",
        KeySize: 2048,
        Type: "Certificate",
        Validity: "Expired",
        ValidNotBefore: "/Date(1711900800000)/",
        ValidNotAfter: "/Date(1743436800000)/",
        SerialNumber: "99999",
        SignatureAlgorithm: "SHA256withRSA",
        EllipticCurve: null,
        SubjectDN: "CN=subject",
        IssuerDN: "CN=issuer",
        Version: 3,
        FingerprintSha1: "AA:BB",
        FingerprintSha256: "CC:DD",
        FingerprintSha512: "EE:FF",
        Owner: "admin",
        LastModifiedBy: "dev",
        LastModifiedTime: "/Date(1711900800000)/",
        CreatedBy: "admin",
        CreatedTime: "/Date(1711900800000)/",
        ActivatedBy: "admin",
        ActiveFrom: "/Date(1711900800000)/",
        DeactivatedBy: "dev",
        ActiveUntil: "/Date(1743436800000)/",
        ActivationSequenceNumber: 5,
        Status: "DEACTIVATED",
      });

      const result = await handlers.get("get_history_keystore_entry")!({
        hexalias: "hist1",
      });
      const text = result.content[0].text;
      expect(text).toContain("Hexalias: hist1");
      expect(text).toContain("OriginalAlias: original-key");
      expect(text).toContain("SubjectDN: CN=subject");
      expect(text).toContain("ActivatedBy: admin");
      expect(text).toContain("DeactivatedBy: dev");
      expect(text).toContain("ActivationSequenceNumber: 5");
      expect(text).toContain("FingerprintSha256: CC:DD");
    });

    it("calls correct path", async () => {
      mockODataClient.getEntity.mockResolvedValue({
        Hexalias: "hist1",
        Alias: null,
        OriginalAlias: null,
        KeyType: null,
        KeySize: null,
        Type: null,
        Validity: null,
        ValidNotBefore: null,
        ValidNotAfter: null,
        SerialNumber: null,
        SignatureAlgorithm: null,
        EllipticCurve: null,
        SubjectDN: null,
        IssuerDN: null,
        Version: null,
        FingerprintSha1: null,
        FingerprintSha256: null,
        FingerprintSha512: null,
        Owner: null,
        LastModifiedBy: null,
        LastModifiedTime: null,
        CreatedBy: null,
        CreatedTime: null,
        ActivatedBy: null,
        ActiveFrom: null,
        DeactivatedBy: null,
        ActiveUntil: null,
        ActivationSequenceNumber: null,
        Status: null,
      });
      await handlers.get("get_history_keystore_entry")!({ hexalias: "hist1" });
      expect(mockODataClient.getEntity).toHaveBeenCalledWith(
        "/api/v1/HistoryKeystoreEntries('hist1')"
      );
    });

    it("returns isError on 404", async () => {
      mockODataClient.getEntity.mockRejectedValue(
        new Error("OData error (404): Resource not found")
      );
      const result = await handlers.get("get_history_keystore_entry")!({
        hexalias: "notfound",
      });
      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain("OData error (404)");
    });
  });

  describe("restore_history_entry", () => {
    it("shows preview without confirm", async () => {
      const result = await handlers.get("restore_history_entry")!({
        hexalias: "hist1",
        destinationAlias: "restored-key",
      });
      const text = result.content[0].text;
      expect(text).toContain("History keystore entry to restore:");
      expect(text).toContain("Hexalias: hist1");
      expect(text).toContain("Destination alias: restored-key");
      expect(text).toContain("Set confirm to true to proceed.");
      expect(mockODataClient.put).not.toHaveBeenCalled();
    });

    it("shows default destination alias when not provided", async () => {
      const result = await handlers.get("restore_history_entry")!({
        hexalias: "hist1",
      });
      const text = result.content[0].text;
      expect(text).toContain("Destination alias: n/a (original alias)");
    });

    it("restores entry with confirm", async () => {
      mockODataClient.put.mockResolvedValue(undefined);
      const result = await handlers.get("restore_history_entry")!({
        hexalias: "hist1",
        confirm: true,
      });
      expect(mockODataClient.put).toHaveBeenCalledWith(
        "/api/v1/HistoryKeystoreEntries('hist1')?copy=true",
        { Status: null }
      );
      expect(result.content[0].text).toContain("restored successfully");
    });

    it("passes destinationAlias as query param", async () => {
      mockODataClient.put.mockResolvedValue(undefined);
      await handlers.get("restore_history_entry")!({
        hexalias: "hist1",
        destinationAlias: "new-alias",
        confirm: true,
      });
      expect(mockODataClient.put).toHaveBeenCalledWith(
        "/api/v1/HistoryKeystoreEntries('hist1')?copy=true&destinationAlias=new-alias",
        { Status: null }
      );
    });

    it("returns isError on failure", async () => {
      mockODataClient.put.mockRejectedValue(
        new Error("OData error (500): internal server error")
      );
      const result = await handlers.get("restore_history_entry")!({
        hexalias: "hist1",
        confirm: true,
      });
      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain("OData error (500)");
    });
  });
});
