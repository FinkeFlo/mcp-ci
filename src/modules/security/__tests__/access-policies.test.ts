import { describe, it, expect, vi, beforeEach } from "vitest";
import type { McpServer } from "@modelcontextprotocol/server";
import { registerAccessPolicyTools } from "../tools/access-policies.js";
import type { ModuleContext } from "../../../core/types.js";

describe("access policy tools", () => {
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

    registerAccessPolicyTools(mockServer, context);
  });

  it("registers all 11 tools", () => {
    expect(handlers.size).toBe(11);
    expect(handlers.has("list_cert_user_mappings")).toBe(true);
    expect(handlers.has("get_cert_user_mapping")).toBe(true);
    expect(handlers.has("create_cert_user_mapping")).toBe(true);
    expect(handlers.has("delete_cert_user_mapping")).toBe(true);
    expect(handlers.has("list_access_policies")).toBe(true);
    expect(handlers.has("create_access_policy")).toBe(true);
    expect(handlers.has("update_access_policy")).toBe(true);
    expect(handlers.has("delete_access_policy")).toBe(true);
    expect(handlers.has("list_artifact_references")).toBe(true);
    expect(handlers.has("create_artifact_reference")).toBe(true);
    expect(handlers.has("delete_artifact_reference")).toBe(true);
  });

  // ─── Certificate-to-User Mappings ───

  describe("list_cert_user_mappings", () => {
    it("returns formatted mappings", async () => {
      mockODataClient.getCollection.mockResolvedValue([
        {
          Id: "map1",
          User: "supplier1",
          Certificate: "MIIC" + "A".repeat(100),
          LastModifiedBy: "admin",
          LastModifiedTime: "/Date(1711900800000)/",
        },
        {
          Id: "map2",
          User: "supplier2",
          Certificate: "SHORT",
          LastModifiedBy: null,
          LastModifiedTime: null,
        },
      ]);

      const result = await handlers.get("list_cert_user_mappings")!({});
      const text = result.content[0].text;
      expect(text).toContain("Id: map1");
      expect(text).toContain("User: supplier1");
      expect(text).toContain("..."); // certificate truncated
      expect(text).toContain("Id: map2");
      expect(text).toContain("User: supplier2");
      expect(text).toContain("Certificate: SHORT");
    });

    it("returns empty message when no mappings found", async () => {
      mockODataClient.getCollection.mockResolvedValue([]);
      const result = await handlers.get("list_cert_user_mappings")!({});
      expect(result.content[0].text).toBe(
        "No certificate-to-user mappings found."
      );
    });

    it("passes query params to OData client", async () => {
      mockODataClient.getCollection.mockResolvedValue([]);
      await handlers.get("list_cert_user_mappings")!({
        filter: "User eq 'supplier1'",
        orderby: "User",
        select: "Id,User",
      });
      expect(mockODataClient.getCollection).toHaveBeenCalledWith(
        "/api/v1/CertificateUserMappings",
        {
          $filter: "User eq 'supplier1'",
          $orderby: "User",
          $select: "Id,User",
        }
      );
    });

    it("returns isError on failure", async () => {
      mockODataClient.getCollection.mockRejectedValue(
        new Error("OData error (500): internal server error")
      );
      const result = await handlers.get("list_cert_user_mappings")!({});
      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain("OData error (500)");
    });
  });

  describe("get_cert_user_mapping", () => {
    it("returns formatted mapping detail", async () => {
      mockODataClient.getEntity.mockResolvedValue({
        Id: "map1",
        User: "supplier1",
        Certificate: "MIIC" + "A".repeat(100),
        LastModifiedBy: "admin",
        LastModifiedTime: "/Date(1711900800000)/",
        CreatedBy: "system",
        CreatedTime: "/Date(1711814400000)/",
        ValidUntil: "/Date(1743436800000)/",
      });

      const result = await handlers.get("get_cert_user_mapping")!({
        id: "map1",
      });
      const text = result.content[0].text;
      expect(text).toContain("Id: map1");
      expect(text).toContain("User: supplier1");
      expect(text).toContain("..."); // truncated cert
      expect(text).toContain("LastModifiedBy: admin");
      expect(text).toContain("CreatedBy: system");
      expect(text).toContain("ValidUntil:");
      // Verify OData date parsing
      expect(text).toContain("2024-03-31");
    });

    it("calls correct path", async () => {
      mockODataClient.getEntity.mockResolvedValue({
        Id: "map1",
        User: "supplier1",
        Certificate: null,
        LastModifiedBy: null,
        LastModifiedTime: null,
        CreatedBy: null,
        CreatedTime: null,
        ValidUntil: null,
      });
      await handlers.get("get_cert_user_mapping")!({ id: "map1" });
      expect(mockODataClient.getEntity).toHaveBeenCalledWith(
        "/api/v1/CertificateUserMappings('map1')"
      );
    });

    it("returns isError on 404", async () => {
      mockODataClient.getEntity.mockRejectedValue(
        new Error("OData error (404): Resource not found")
      );
      const result = await handlers.get("get_cert_user_mapping")!({
        id: "nonexistent",
      });
      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain("OData error (404)");
    });
  });

  describe("create_cert_user_mapping", () => {
    it("shows preview without confirm", async () => {
      const result = await handlers.get("create_cert_user_mapping")!({
        user: "supplier1",
        certificate: "MIICbase64encodedcert",
      });
      const text = result.content[0].text;
      expect(text).toContain("Certificate-to-user mapping to create:");
      expect(text).toContain("User: supplier1");
      expect(text).toContain("Certificate: MIICbase64encodedcert");
      expect(text).toContain("Set confirm to true to proceed.");
      expect(mockODataClient.post).not.toHaveBeenCalled();
    });

    it("truncates long certificate in preview", async () => {
      const longCert = "A".repeat(100);
      const result = await handlers.get("create_cert_user_mapping")!({
        user: "supplier1",
        certificate: longCert,
      });
      const text = result.content[0].text;
      expect(text).toContain("A".repeat(50) + "...");
      expect(text).not.toContain("A".repeat(100));
    });

    it("creates mapping with confirm", async () => {
      mockODataClient.post.mockResolvedValue({});
      const result = await handlers.get("create_cert_user_mapping")!({
        user: "supplier1",
        certificate: "MIICbase64encodedcert",
        confirm: true,
      });
      expect(mockODataClient.post).toHaveBeenCalledWith(
        "/api/v1/CertificateUserMappings",
        {
          User: "supplier1",
          Certificate: "MIICbase64encodedcert",
        }
      );
      expect(result.content[0].text).toContain("created successfully");
    });

    it("returns isError on failure", async () => {
      mockODataClient.post.mockRejectedValue(
        new Error("OData error (409): Conflict")
      );
      const result = await handlers.get("create_cert_user_mapping")!({
        user: "supplier1",
        certificate: "cert",
        confirm: true,
      });
      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain("OData error (409)");
    });
  });

  describe("delete_cert_user_mapping", () => {
    it("shows preview without confirm", async () => {
      mockODataClient.getEntity.mockResolvedValue({
        Id: "map1",
        User: "supplier1",
        Certificate: "SHORT",
        LastModifiedBy: "admin",
        LastModifiedTime: "/Date(1711900800000)/",
        CreatedBy: "system",
        CreatedTime: "/Date(1711814400000)/",
        ValidUntil: null,
      });

      const result = await handlers.get("delete_cert_user_mapping")!({
        id: "map1",
      });
      const text = result.content[0].text;
      expect(text).toContain("Certificate-to-user mapping to delete:");
      expect(text).toContain("Id: map1");
      expect(text).toContain("User: supplier1");
      expect(text).toContain("Set confirm to true to proceed.");
      expect(mockODataClient.delete).not.toHaveBeenCalled();
    });

    it("deletes mapping with confirm", async () => {
      mockODataClient.delete.mockResolvedValue(undefined);
      const result = await handlers.get("delete_cert_user_mapping")!({
        id: "map1",
        confirm: true,
      });
      expect(mockODataClient.delete).toHaveBeenCalledWith(
        "/api/v1/CertificateUserMappings('map1')"
      );
      expect(result.content[0].text).toContain("deleted successfully");
    });

    it("returns isError when preview fetch fails", async () => {
      mockODataClient.getEntity.mockRejectedValue(
        new Error("OData error (404): Resource not found")
      );
      const result = await handlers.get("delete_cert_user_mapping")!({
        id: "nonexistent",
      });
      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain("OData error (404)");
    });

    it("returns isError when delete fails", async () => {
      mockODataClient.delete.mockRejectedValue(
        new Error("OData error (403): Forbidden")
      );
      const result = await handlers.get("delete_cert_user_mapping")!({
        id: "map1",
        confirm: true,
      });
      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain("OData error (403)");
    });
  });

  // ─── Access Policies ───

  describe("list_access_policies", () => {
    it("returns formatted policies", async () => {
      mockODataClient.getCollection.mockResolvedValue([
        {
          Id: "101",
          RoleName: "ESBMessaging.send",
          Description: "Send messages",
        },
        {
          Id: "102",
          RoleName: "AuthGroup_Administrator",
          Description: null,
        },
      ]);

      const result = await handlers.get("list_access_policies")!({});
      const text = result.content[0].text;
      expect(text).toContain("Id: 101");
      expect(text).toContain("RoleName: ESBMessaging.send");
      expect(text).toContain("Description: Send messages");
      expect(text).toContain("Id: 102");
      expect(text).toContain("Description: n/a");
    });

    it("returns empty message when no policies found", async () => {
      mockODataClient.getCollection.mockResolvedValue([]);
      const result = await handlers.get("list_access_policies")!({});
      expect(result.content[0].text).toBe("No access policies found.");
    });

    it("passes all query params to OData client", async () => {
      mockODataClient.getCollection.mockResolvedValue([]);
      await handlers.get("list_access_policies")!({
        filter: "RoleName eq 'ESBMessaging.send'",
        orderby: "RoleName",
        select: "Id,RoleName",
        expand: "ArtifactReferences",
        top: 10,
        skip: 5,
        inlinecount: "allpages",
      });
      expect(mockODataClient.getCollection).toHaveBeenCalledWith(
        "/api/v1/AccessPolicies",
        {
          $filter: "RoleName eq 'ESBMessaging.send'",
          $orderby: "RoleName",
          $select: "Id,RoleName",
          $expand: "ArtifactReferences",
          $top: 10,
          $skip: 5,
          $inlinecount: "allpages",
        }
      );
    });

    it("returns isError on failure", async () => {
      mockODataClient.getCollection.mockRejectedValue(
        new Error("OData error (500): internal server error")
      );
      const result = await handlers.get("list_access_policies")!({});
      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain("OData error (500)");
    });
  });

  describe("create_access_policy", () => {
    it("shows preview without confirm", async () => {
      const result = await handlers.get("create_access_policy")!({
        roleName: "ESBMessaging.send",
        description: "Send messages",
        artifactReferences: [
          {
            Name: "ref1",
            Type: "INTEGRATION_FLOW",
            ConditionAttribute: "Name",
            ConditionValue: "MyFlow",
            ConditionType: "EQUALS",
          },
        ],
      });
      const text = result.content[0].text;
      expect(text).toContain("Access policy to create:");
      expect(text).toContain("RoleName: ESBMessaging.send");
      expect(text).toContain("Description: Send messages");
      expect(text).toContain("1 reference(s)");
      expect(text).toContain("Name: ref1");
      expect(text).toContain("Set confirm to true to proceed.");
      expect(mockODataClient.post).not.toHaveBeenCalled();
    });

    it("shows preview with no artifact references", async () => {
      const result = await handlers.get("create_access_policy")!({
        roleName: "TestRole",
      });
      const text = result.content[0].text;
      expect(text).toContain("ArtifactReferences: none");
    });

    it("creates policy with confirm", async () => {
      mockODataClient.post.mockResolvedValue({});
      const refs = [
        {
          Name: "ref1",
          Type: "INTEGRATION_FLOW",
          ConditionAttribute: "Name",
          ConditionValue: "MyFlow",
          ConditionType: "EQUALS",
        },
      ];
      const result = await handlers.get("create_access_policy")!({
        roleName: "ESBMessaging.send",
        description: "Send messages",
        artifactReferences: refs,
        confirm: true,
      });
      expect(mockODataClient.post).toHaveBeenCalledWith(
        "/api/v1/AccessPolicies",
        {
          RoleName: "ESBMessaging.send",
          Description: "Send messages",
          ArtifactReferences: refs,
        }
      );
      expect(result.content[0].text).toContain("created successfully");
    });

    it("only includes defined fields in body", async () => {
      mockODataClient.post.mockResolvedValue({});
      await handlers.get("create_access_policy")!({
        roleName: "TestRole",
        confirm: true,
      });
      expect(mockODataClient.post).toHaveBeenCalledWith(
        "/api/v1/AccessPolicies",
        { RoleName: "TestRole" }
      );
    });

    it("returns isError on failure", async () => {
      mockODataClient.post.mockRejectedValue(
        new Error("OData error (409): Conflict")
      );
      const result = await handlers.get("create_access_policy")!({
        roleName: "TestRole",
        confirm: true,
      });
      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain("OData error (409)");
    });
  });

  describe("update_access_policy", () => {
    it("shows preview without confirm", async () => {
      mockODataClient.getEntity.mockResolvedValue({
        Id: "101",
        RoleName: "OldRole",
        Description: "Old description",
      });

      const result = await handlers.get("update_access_policy")!({
        id: "101",
        roleName: "NewRole",
        description: "New description",
      });
      const text = result.content[0].text;
      expect(text).toContain("Access policy to update:");
      expect(text).toContain("Id: 101");
      expect(text).toContain("Proposed changes:");
      expect(text).toContain("RoleName: OldRole -> NewRole");
      expect(text).toContain(
        "Description: Old description -> New description"
      );
      expect(text).toContain("Set confirm to true to proceed.");
      expect(mockODataClient.put).not.toHaveBeenCalled();
    });

    it("updates policy with confirm using put", async () => {
      mockODataClient.put.mockResolvedValue(undefined);
      const result = await handlers.get("update_access_policy")!({
        id: "101",
        roleName: "NewRole",
        description: "New description",
        confirm: true,
      });
      expect(mockODataClient.put).toHaveBeenCalledWith(
        "/api/v1/AccessPolicies(101)",
        { RoleName: "NewRole", Description: "New description" }
      );
      expect(result.content[0].text).toContain("updated successfully");
    });

    it("returns isError when preview fetch fails", async () => {
      mockODataClient.getEntity.mockRejectedValue(
        new Error("OData error (404): Resource not found")
      );
      const result = await handlers.get("update_access_policy")!({
        id: "999",
        roleName: "NewRole",
      });
      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain("OData error (404)");
    });

    it("returns isError when update fails", async () => {
      mockODataClient.put.mockRejectedValue(
        new Error("OData error (403): Forbidden")
      );
      const result = await handlers.get("update_access_policy")!({
        id: "101",
        roleName: "NewRole",
        confirm: true,
      });
      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain("OData error (403)");
    });
  });

  describe("delete_access_policy", () => {
    it("shows preview without confirm", async () => {
      mockODataClient.getEntity.mockResolvedValue({
        Id: "101",
        RoleName: "ESBMessaging.send",
        Description: "Send messages",
      });

      const result = await handlers.get("delete_access_policy")!({
        id: "101",
      });
      const text = result.content[0].text;
      expect(text).toContain("Access policy to delete:");
      expect(text).toContain("Id: 101");
      expect(text).toContain("RoleName: ESBMessaging.send");
      expect(text).toContain("Set confirm to true to proceed.");
      expect(mockODataClient.delete).not.toHaveBeenCalled();
    });

    it("deletes policy with confirm", async () => {
      mockODataClient.delete.mockResolvedValue(undefined);
      const result = await handlers.get("delete_access_policy")!({
        id: "101",
        confirm: true,
      });
      expect(mockODataClient.delete).toHaveBeenCalledWith(
        "/api/v1/AccessPolicies(101)"
      );
      expect(result.content[0].text).toContain("deleted successfully");
    });

    it("returns isError when preview fetch fails", async () => {
      mockODataClient.getEntity.mockRejectedValue(
        new Error("OData error (404): Resource not found")
      );
      const result = await handlers.get("delete_access_policy")!({
        id: "999",
      });
      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain("OData error (404)");
    });

    it("returns isError when delete fails", async () => {
      mockODataClient.delete.mockRejectedValue(
        new Error("OData error (403): Forbidden")
      );
      const result = await handlers.get("delete_access_policy")!({
        id: "101",
        confirm: true,
      });
      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain("OData error (403)");
    });
  });

  // ─── Artifact References ───

  describe("list_artifact_references", () => {
    it("returns formatted references", async () => {
      mockODataClient.getCollection.mockResolvedValue([
        {
          Id: "201",
          Name: "MyFlow",
          Description: "Integration flow reference",
          Type: "INTEGRATION_FLOW",
          ConditionAttribute: "Name",
          ConditionValue: "MyFlow",
          ConditionType: "EQUALS",
        },
        {
          Id: "202",
          Name: "AllFlows",
          Description: null,
          Type: "INTEGRATION_FLOW",
          ConditionAttribute: "Name",
          ConditionValue: "*",
          ConditionType: "ALL",
        },
      ]);

      const result = await handlers.get("list_artifact_references")!({});
      const text = result.content[0].text;
      expect(text).toContain("Id: 201");
      expect(text).toContain("Name: MyFlow");
      expect(text).toContain("Type: INTEGRATION_FLOW");
      expect(text).toContain("ConditionAttribute: Name");
      expect(text).toContain("ConditionValue: MyFlow");
      expect(text).toContain("ConditionType: EQUALS");
      expect(text).toContain("Id: 202");
      expect(text).toContain("Description: n/a");
    });

    it("returns empty message when no references found", async () => {
      mockODataClient.getCollection.mockResolvedValue([]);
      const result = await handlers.get("list_artifact_references")!({});
      expect(result.content[0].text).toBe("No artifact references found.");
    });

    it("passes all query params to OData client", async () => {
      mockODataClient.getCollection.mockResolvedValue([]);
      await handlers.get("list_artifact_references")!({
        filter: "Type eq 'INTEGRATION_FLOW'",
        orderby: "Name",
        select: "Id,Name",
        top: 5,
        skip: 0,
        inlinecount: "allpages",
      });
      expect(mockODataClient.getCollection).toHaveBeenCalledWith(
        "/api/v1/ArtifactReferences",
        {
          $filter: "Type eq 'INTEGRATION_FLOW'",
          $orderby: "Name",
          $select: "Id,Name",
          $top: 5,
          $skip: 0,
          $inlinecount: "allpages",
        }
      );
    });

    it("returns isError on failure", async () => {
      mockODataClient.getCollection.mockRejectedValue(
        new Error("OData error (500): internal server error")
      );
      const result = await handlers.get("list_artifact_references")!({});
      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain("OData error (500)");
    });
  });

  describe("create_artifact_reference", () => {
    it("shows preview without confirm", async () => {
      const result = await handlers.get("create_artifact_reference")!({
        name: "MyFlow",
        description: "Flow reference",
        type: "INTEGRATION_FLOW",
        conditionAttribute: "Name",
        conditionValue: "MyFlow",
        conditionType: "EQUALS",
      });
      const text = result.content[0].text;
      expect(text).toContain("Artifact reference to create:");
      expect(text).toContain("Name: MyFlow");
      expect(text).toContain("Description: Flow reference");
      expect(text).toContain("Type: INTEGRATION_FLOW");
      expect(text).toContain("ConditionAttribute: Name");
      expect(text).toContain("ConditionValue: MyFlow");
      expect(text).toContain("ConditionType: EQUALS");
      expect(text).toContain("Set confirm to true to proceed.");
      expect(mockODataClient.post).not.toHaveBeenCalled();
    });

    it("shows n/a for optional description in preview", async () => {
      const result = await handlers.get("create_artifact_reference")!({
        name: "MyFlow",
        type: "INTEGRATION_FLOW",
        conditionAttribute: "Name",
        conditionValue: "MyFlow",
        conditionType: "EQUALS",
      });
      const text = result.content[0].text;
      expect(text).toContain("Description: n/a");
    });

    it("creates reference with confirm", async () => {
      mockODataClient.post.mockResolvedValue({});
      const result = await handlers.get("create_artifact_reference")!({
        name: "MyFlow",
        description: "Flow reference",
        type: "INTEGRATION_FLOW",
        conditionAttribute: "Name",
        conditionValue: "MyFlow",
        conditionType: "EQUALS",
        confirm: true,
      });
      expect(mockODataClient.post).toHaveBeenCalledWith(
        "/api/v1/ArtifactReferences",
        {
          Name: "MyFlow",
          Description: "Flow reference",
          Type: "INTEGRATION_FLOW",
          ConditionAttribute: "Name",
          ConditionValue: "MyFlow",
          ConditionType: "EQUALS",
        }
      );
      expect(result.content[0].text).toContain("created successfully");
    });

    it("only includes defined fields in body", async () => {
      mockODataClient.post.mockResolvedValue({});
      await handlers.get("create_artifact_reference")!({
        name: "MyFlow",
        type: "INTEGRATION_FLOW",
        conditionAttribute: "Name",
        conditionValue: "MyFlow",
        conditionType: "EQUALS",
        confirm: true,
      });
      expect(mockODataClient.post).toHaveBeenCalledWith(
        "/api/v1/ArtifactReferences",
        {
          Name: "MyFlow",
          Type: "INTEGRATION_FLOW",
          ConditionAttribute: "Name",
          ConditionValue: "MyFlow",
          ConditionType: "EQUALS",
        }
      );
    });

    it("returns isError on failure", async () => {
      mockODataClient.post.mockRejectedValue(
        new Error("OData error (409): Conflict")
      );
      const result = await handlers.get("create_artifact_reference")!({
        name: "MyFlow",
        type: "INTEGRATION_FLOW",
        conditionAttribute: "Name",
        conditionValue: "MyFlow",
        conditionType: "EQUALS",
        confirm: true,
      });
      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain("OData error (409)");
    });
  });

  describe("delete_artifact_reference", () => {
    it("shows preview without confirm", async () => {
      mockODataClient.getEntity.mockResolvedValue({
        Id: "201",
        Name: "MyFlow",
        Description: "Flow reference",
        Type: "INTEGRATION_FLOW",
        ConditionAttribute: "Name",
        ConditionValue: "MyFlow",
        ConditionType: "EQUALS",
      });

      const result = await handlers.get("delete_artifact_reference")!({
        id: "201",
      });
      const text = result.content[0].text;
      expect(text).toContain("Artifact reference to delete:");
      expect(text).toContain("Id: 201");
      expect(text).toContain("Name: MyFlow");
      expect(text).toContain("Type: INTEGRATION_FLOW");
      expect(text).toContain("Set confirm to true to proceed.");
      expect(mockODataClient.delete).not.toHaveBeenCalled();
    });

    it("deletes reference with confirm", async () => {
      mockODataClient.delete.mockResolvedValue(undefined);
      const result = await handlers.get("delete_artifact_reference")!({
        id: "201",
        confirm: true,
      });
      expect(mockODataClient.delete).toHaveBeenCalledWith(
        "/api/v1/ArtifactReferences(201)"
      );
      expect(result.content[0].text).toContain("deleted successfully");
    });

    it("returns isError when preview fetch fails", async () => {
      mockODataClient.getEntity.mockRejectedValue(
        new Error("OData error (404): Resource not found")
      );
      const result = await handlers.get("delete_artifact_reference")!({
        id: "999",
      });
      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain("OData error (404)");
    });

    it("returns isError when delete fails", async () => {
      mockODataClient.delete.mockRejectedValue(
        new Error("OData error (403): Forbidden")
      );
      const result = await handlers.get("delete_artifact_reference")!({
        id: "201",
        confirm: true,
      });
      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain("OData error (403)");
    });
  });
});
