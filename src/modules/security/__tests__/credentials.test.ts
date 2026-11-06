import { describe, it, expect, vi, beforeEach } from "vitest";
import type { McpServer } from "@modelcontextprotocol/server";
import { registerCredentialTools } from "../tools/credentials.js";
import type { ModuleContext } from "../../../core/types.js";

describe("credential tools", () => {
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

    registerCredentialTools(mockServer, context);
  });

  it("registers all 15 tools", () => {
    expect(handlers.size).toBe(15);
    expect(handlers.has("list_user_credentials")).toBe(true);
    expect(handlers.has("get_user_credential")).toBe(true);
    expect(handlers.has("create_user_credential")).toBe(true);
    expect(handlers.has("update_user_credential")).toBe(true);
    expect(handlers.has("delete_user_credential")).toBe(true);
    expect(handlers.has("list_secure_parameters")).toBe(true);
    expect(handlers.has("get_secure_parameter")).toBe(true);
    expect(handlers.has("create_secure_parameter")).toBe(true);
    expect(handlers.has("update_secure_parameter")).toBe(true);
    expect(handlers.has("delete_secure_parameter")).toBe(true);
    expect(handlers.has("list_oauth2_credentials")).toBe(true);
    expect(handlers.has("get_oauth2_credential")).toBe(true);
    expect(handlers.has("create_oauth2_credential")).toBe(true);
    expect(handlers.has("update_oauth2_credential")).toBe(true);
    expect(handlers.has("delete_oauth2_credential")).toBe(true);
  });

  // ─── User Credentials ────────────────────────────────────────────────

  describe("list_user_credentials", () => {
    it("returns formatted credentials", async () => {
      mockODataClient.getCollection.mockResolvedValue([
        {
          Name: "cred1",
          Kind: "default",
          User: "admin",
          SecurityArtifactDescriptor: {
            Status: "DEPLOYED",
            DeployedOn: "/Date(1711900800000)/",
            DeployedBy: "admin",
          },
        },
        {
          Name: "cred2",
          Kind: "successfactors",
          User: "sfuser",
          SecurityArtifactDescriptor: {
            Status: "ERROR",
            DeployedOn: null,
            DeployedBy: null,
          },
        },
      ]);

      const result = await handlers.get("list_user_credentials")!({});
      const text = result.content[0].text;
      expect(text).toContain("Name: cred1");
      expect(text).toContain("Kind: default");
      expect(text).toContain("User: admin");
      expect(text).toContain("Status: DEPLOYED");
      expect(text).toContain("Name: cred2");
      expect(text).toContain("Kind: successfactors");
      expect(text).toContain("User: sfuser");
      expect(text).toContain("Status: ERROR");
    });

    it("parses OData date in DeployedOn", async () => {
      mockODataClient.getCollection.mockResolvedValue([
        {
          Name: "cred1",
          Kind: "default",
          User: "admin",
          SecurityArtifactDescriptor: {
            Status: "DEPLOYED",
            DeployedOn: "/Date(1711900800000)/",
            DeployedBy: "admin",
          },
        },
      ]);

      const result = await handlers.get("list_user_credentials")!({});
      const text = result.content[0].text;
      expect(text).toContain("DeployedOn: 2024-03-31T16:00:00.000Z");
    });

    it("returns empty message when no credentials found", async () => {
      mockODataClient.getCollection.mockResolvedValue([]);
      const result = await handlers.get("list_user_credentials")!({});
      expect(result.content[0].text).toBe("No user credentials found.");
    });

    it("returns isError on failure", async () => {
      mockODataClient.getCollection.mockRejectedValue(
        new Error("OData error (500): internal server error")
      );
      const result = await handlers.get("list_user_credentials")!({});
      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain("OData error (500)");
    });
  });

  describe("get_user_credential", () => {
    it("returns formatted credential detail", async () => {
      mockODataClient.getEntity.mockResolvedValue({
        Name: "cred1",
        Kind: "default",
        Description: "Test credential",
        User: "admin",
        CompanyId: "COMP1",
        SecurityArtifactDescriptor: {
          Status: "DEPLOYED",
          DeployedBy: "admin",
          DeployedOn: "/Date(1711900800000)/",
        },
      });

      const result = await handlers.get("get_user_credential")!({
        name: "cred1",
      });
      const text = result.content[0].text;
      expect(text).toContain("Name: cred1");
      expect(text).toContain("Kind: default");
      expect(text).toContain("Description: Test credential");
      expect(text).toContain("User: admin");
      expect(text).toContain("CompanyId: COMP1");
      expect(text).toContain("Status: DEPLOYED");
      expect(text).toContain("DeployedBy: admin");
    });

    it("calls correct path", async () => {
      mockODataClient.getEntity.mockResolvedValue({
        Name: "cred1",
        Kind: "default",
        Description: null,
        User: "admin",
        CompanyId: null,
        SecurityArtifactDescriptor: null,
      });
      await handlers.get("get_user_credential")!({ name: "cred1" });
      expect(mockODataClient.getEntity).toHaveBeenCalledWith(
        "/api/v1/UserCredentials('cred1')"
      );
    });

    it("returns isError on failure", async () => {
      mockODataClient.getEntity.mockRejectedValue(
        new Error("OData error (404): Resource not found")
      );
      const result = await handlers.get("get_user_credential")!({
        name: "nonexistent",
      });
      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain("OData error (404)");
    });
  });

  describe("create_user_credential", () => {
    it("shows preview without confirm", async () => {
      const result = await handlers.get("create_user_credential")!({
        name: "cred1",
        kind: "default",
        user: "admin",
        password: "secret",
        description: "Test",
      });
      const text = result.content[0].text;
      expect(text).toContain("User credential to create:");
      expect(text).toContain("Name: cred1");
      expect(text).toContain("Kind: default");
      expect(text).toContain("User: admin");
      expect(text).toContain("Description: Test");
      expect(text).toContain("Set confirm to true to proceed.");
      expect(mockODataClient.post).not.toHaveBeenCalled();
    });

    it("creates credential with confirm", async () => {
      mockODataClient.post.mockResolvedValue({});
      const result = await handlers.get("create_user_credential")!({
        name: "cred1",
        kind: "default",
        user: "admin",
        password: "secret",
        description: "Test",
        companyId: "COMP1",
        confirm: true,
      });
      expect(mockODataClient.post).toHaveBeenCalledWith(
        "/api/v1/UserCredentials",
        {
          Name: "cred1",
          Kind: "default",
          User: "admin",
          Password: "secret",
          Description: "Test",
          CompanyId: "COMP1",
        }
      );
      expect(result.content[0].text).toContain("created successfully");
    });

    it("only includes defined fields in body", async () => {
      mockODataClient.post.mockResolvedValue({});
      await handlers.get("create_user_credential")!({
        name: "cred1",
        kind: "default",
        user: "admin",
        password: "secret",
        confirm: true,
      });
      expect(mockODataClient.post).toHaveBeenCalledWith(
        "/api/v1/UserCredentials",
        {
          Name: "cred1",
          Kind: "default",
          User: "admin",
          Password: "secret",
        }
      );
    });

    it("returns isError on failure", async () => {
      mockODataClient.post.mockRejectedValue(
        new Error("OData error (409): Conflict")
      );
      const result = await handlers.get("create_user_credential")!({
        name: "cred1",
        kind: "default",
        user: "admin",
        password: "secret",
        confirm: true,
      });
      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain("OData error (409)");
    });
  });

  describe("update_user_credential", () => {
    it("shows preview without confirm", async () => {
      mockODataClient.getEntity.mockResolvedValue({
        Name: "cred1",
        Kind: "default",
        Description: "Old description",
        User: "admin",
        CompanyId: null,
        SecurityArtifactDescriptor: {
          Status: "DEPLOYED",
          DeployedBy: "admin",
          DeployedOn: "/Date(1711900800000)/",
        },
      });

      const result = await handlers.get("update_user_credential")!({
        name: "cred1",
        user: "newuser",
      });
      const text = result.content[0].text;
      expect(text).toContain("User credential to update:");
      expect(text).toContain("Name: cred1");
      expect(text).toContain("Proposed changes:");
      expect(text).toContain("User: admin -> newuser");
      expect(text).toContain("Set confirm to true to proceed.");
      expect(mockODataClient.put).not.toHaveBeenCalled();
    });

    it("updates credential with confirm", async () => {
      mockODataClient.put.mockResolvedValue(undefined);
      const result = await handlers.get("update_user_credential")!({
        name: "cred1",
        user: "newuser",
        password: "newpass",
        confirm: true,
      });
      expect(mockODataClient.put).toHaveBeenCalledWith(
        "/api/v1/UserCredentials('cred1')",
        { User: "newuser", Password: "newpass" }
      );
      expect(result.content[0].text).toContain("updated successfully");
    });

    it("returns isError when preview fetch fails", async () => {
      mockODataClient.getEntity.mockRejectedValue(
        new Error("OData error (404): Resource not found")
      );
      const result = await handlers.get("update_user_credential")!({
        name: "nonexistent",
        user: "newuser",
      });
      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain("OData error (404)");
    });

    it("returns isError when update fails", async () => {
      mockODataClient.put.mockRejectedValue(
        new Error("OData error (403): Forbidden")
      );
      const result = await handlers.get("update_user_credential")!({
        name: "cred1",
        user: "newuser",
        confirm: true,
      });
      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain("OData error (403)");
    });
  });

  describe("delete_user_credential", () => {
    it("shows preview without confirm", async () => {
      mockODataClient.getEntity.mockResolvedValue({
        Name: "cred1",
        Kind: "default",
        Description: "Test",
        User: "admin",
        CompanyId: null,
        SecurityArtifactDescriptor: {
          Status: "DEPLOYED",
          DeployedBy: "admin",
          DeployedOn: "/Date(1711900800000)/",
        },
      });

      const result = await handlers.get("delete_user_credential")!({
        name: "cred1",
      });
      const text = result.content[0].text;
      expect(text).toContain("User credential to delete:");
      expect(text).toContain("Name: cred1");
      expect(text).toContain("Set confirm to true to proceed.");
      expect(mockODataClient.delete).not.toHaveBeenCalled();
    });

    it("deletes credential with confirm", async () => {
      mockODataClient.delete.mockResolvedValue(undefined);
      const result = await handlers.get("delete_user_credential")!({
        name: "cred1",
        confirm: true,
      });
      expect(mockODataClient.delete).toHaveBeenCalledWith(
        "/api/v1/UserCredentials('cred1')"
      );
      expect(result.content[0].text).toContain("deleted successfully");
    });

    it("returns isError when preview fetch fails", async () => {
      mockODataClient.getEntity.mockRejectedValue(
        new Error("OData error (404): Resource not found")
      );
      const result = await handlers.get("delete_user_credential")!({
        name: "nonexistent",
      });
      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain("OData error (404)");
    });

    it("returns isError when delete fails", async () => {
      mockODataClient.delete.mockRejectedValue(
        new Error("OData error (403): Forbidden")
      );
      const result = await handlers.get("delete_user_credential")!({
        name: "cred1",
        confirm: true,
      });
      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain("OData error (403)");
    });
  });

  // ─── Secure Parameters ───────────────────────────────────────────────

  describe("list_secure_parameters", () => {
    it("returns formatted parameters", async () => {
      mockODataClient.getCollection.mockResolvedValue([
        {
          Name: "param1",
          Description: "Secret key",
          Status: "DEPLOYED",
          DeployedBy: "admin",
          DeployedOn: "/Date(1711900800000)/",
        },
        {
          Name: "param2",
          Description: null,
          Status: "ERROR",
          DeployedBy: null,
          DeployedOn: null,
        },
      ]);

      const result = await handlers.get("list_secure_parameters")!({});
      const text = result.content[0].text;
      expect(text).toContain("Name: param1");
      expect(text).toContain("Description: Secret key");
      expect(text).toContain("Status: DEPLOYED");
      expect(text).toContain("Name: param2");
      expect(text).toContain("Status: ERROR");
    });

    it("returns empty message when no parameters found", async () => {
      mockODataClient.getCollection.mockResolvedValue([]);
      const result = await handlers.get("list_secure_parameters")!({});
      expect(result.content[0].text).toBe("No secure parameters found.");
    });

    it("returns isError on failure", async () => {
      mockODataClient.getCollection.mockRejectedValue(
        new Error("OData error (500): internal server error")
      );
      const result = await handlers.get("list_secure_parameters")!({});
      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain("OData error (500)");
    });
  });

  describe("get_secure_parameter", () => {
    it("returns formatted parameter detail", async () => {
      mockODataClient.getEntity.mockResolvedValue({
        Name: "param1",
        Description: "Secret key",
        Status: "DEPLOYED",
        DeployedBy: "admin",
        DeployedOn: "/Date(1711900800000)/",
      });

      const result = await handlers.get("get_secure_parameter")!({
        name: "param1",
      });
      const text = result.content[0].text;
      expect(text).toContain("Name: param1");
      expect(text).toContain("Description: Secret key");
      expect(text).toContain("Status: DEPLOYED");
      expect(text).toContain("DeployedBy: admin");
    });

    it("calls correct path", async () => {
      mockODataClient.getEntity.mockResolvedValue({
        Name: "param1",
        Description: null,
        Status: null,
        DeployedBy: null,
        DeployedOn: null,
      });
      await handlers.get("get_secure_parameter")!({ name: "param1" });
      expect(mockODataClient.getEntity).toHaveBeenCalledWith(
        "/api/v1/SecureParameters('param1')"
      );
    });

    it("returns isError on failure", async () => {
      mockODataClient.getEntity.mockRejectedValue(
        new Error("OData error (404): Resource not found")
      );
      const result = await handlers.get("get_secure_parameter")!({
        name: "nonexistent",
      });
      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain("OData error (404)");
    });
  });

  describe("create_secure_parameter", () => {
    it("shows preview without confirm", async () => {
      const result = await handlers.get("create_secure_parameter")!({
        name: "param1",
        secureParam: "secret-value",
        description: "A secret",
      });
      const text = result.content[0].text;
      expect(text).toContain("Secure parameter to create:");
      expect(text).toContain("Name: param1");
      expect(text).toContain("Description: A secret");
      expect(text).toContain("Set confirm to true to proceed.");
      expect(mockODataClient.post).not.toHaveBeenCalled();
    });

    it("creates parameter with confirm", async () => {
      mockODataClient.post.mockResolvedValue({});
      const result = await handlers.get("create_secure_parameter")!({
        name: "param1",
        secureParam: "secret-value",
        description: "A secret",
        confirm: true,
      });
      expect(mockODataClient.post).toHaveBeenCalledWith(
        "/api/v1/SecureParameters",
        {
          Name: "param1",
          SecureParam: "secret-value",
          Description: "A secret",
        }
      );
      expect(result.content[0].text).toContain("created successfully");
    });

    it("only includes defined fields in body", async () => {
      mockODataClient.post.mockResolvedValue({});
      await handlers.get("create_secure_parameter")!({
        name: "param1",
        secureParam: "secret-value",
        confirm: true,
      });
      expect(mockODataClient.post).toHaveBeenCalledWith(
        "/api/v1/SecureParameters",
        {
          Name: "param1",
          SecureParam: "secret-value",
        }
      );
    });

    it("returns isError on failure", async () => {
      mockODataClient.post.mockRejectedValue(
        new Error("OData error (409): Conflict")
      );
      const result = await handlers.get("create_secure_parameter")!({
        name: "param1",
        secureParam: "secret-value",
        confirm: true,
      });
      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain("OData error (409)");
    });
  });

  describe("update_secure_parameter", () => {
    it("shows preview without confirm", async () => {
      mockODataClient.getEntity.mockResolvedValue({
        Name: "param1",
        Description: "Old description",
        Status: "DEPLOYED",
        DeployedBy: "admin",
        DeployedOn: "/Date(1711900800000)/",
      });

      const result = await handlers.get("update_secure_parameter")!({
        name: "param1",
        description: "New description",
      });
      const text = result.content[0].text;
      expect(text).toContain("Secure parameter to update:");
      expect(text).toContain("Name: param1");
      expect(text).toContain("Proposed changes:");
      expect(text).toContain(
        "Description: Old description -> New description"
      );
      expect(text).toContain("Set confirm to true to proceed.");
      expect(mockODataClient.put).not.toHaveBeenCalled();
    });

    it("updates parameter with confirm", async () => {
      mockODataClient.put.mockResolvedValue(undefined);
      const result = await handlers.get("update_secure_parameter")!({
        name: "param1",
        secureParam: "new-secret",
        description: "Updated",
        confirm: true,
      });
      expect(mockODataClient.put).toHaveBeenCalledWith(
        "/api/v1/SecureParameters('param1')",
        { SecureParam: "new-secret", Description: "Updated" }
      );
      expect(result.content[0].text).toContain("updated successfully");
    });

    it("returns isError when preview fetch fails", async () => {
      mockODataClient.getEntity.mockRejectedValue(
        new Error("OData error (404): Resource not found")
      );
      const result = await handlers.get("update_secure_parameter")!({
        name: "nonexistent",
        description: "New",
      });
      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain("OData error (404)");
    });

    it("returns isError when update fails", async () => {
      mockODataClient.put.mockRejectedValue(
        new Error("OData error (403): Forbidden")
      );
      const result = await handlers.get("update_secure_parameter")!({
        name: "param1",
        secureParam: "new-secret",
        confirm: true,
      });
      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain("OData error (403)");
    });
  });

  describe("delete_secure_parameter", () => {
    it("shows preview without confirm", async () => {
      mockODataClient.getEntity.mockResolvedValue({
        Name: "param1",
        Description: "A secret",
        Status: "DEPLOYED",
        DeployedBy: "admin",
        DeployedOn: "/Date(1711900800000)/",
      });

      const result = await handlers.get("delete_secure_parameter")!({
        name: "param1",
      });
      const text = result.content[0].text;
      expect(text).toContain("Secure parameter to delete:");
      expect(text).toContain("Name: param1");
      expect(text).toContain("Set confirm to true to proceed.");
      expect(mockODataClient.delete).not.toHaveBeenCalled();
    });

    it("deletes parameter with confirm", async () => {
      mockODataClient.delete.mockResolvedValue(undefined);
      const result = await handlers.get("delete_secure_parameter")!({
        name: "param1",
        confirm: true,
      });
      expect(mockODataClient.delete).toHaveBeenCalledWith(
        "/api/v1/SecureParameters('param1')"
      );
      expect(result.content[0].text).toContain("deleted successfully");
    });

    it("returns isError when preview fetch fails", async () => {
      mockODataClient.getEntity.mockRejectedValue(
        new Error("OData error (404): Resource not found")
      );
      const result = await handlers.get("delete_secure_parameter")!({
        name: "nonexistent",
      });
      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain("OData error (404)");
    });

    it("returns isError when delete fails", async () => {
      mockODataClient.delete.mockRejectedValue(
        new Error("OData error (403): Forbidden")
      );
      const result = await handlers.get("delete_secure_parameter")!({
        name: "param1",
        confirm: true,
      });
      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain("OData error (403)");
    });
  });

  // ─── OAuth2 Client Credentials ───────────────────────────────────────

  describe("list_oauth2_credentials", () => {
    it("returns formatted credentials", async () => {
      mockODataClient.getCollection.mockResolvedValue([
        {
          Name: "oauth1",
          TokenServiceUrl: "https://token.example.com",
          ClientId: "client1",
          SecurityArtifactDescriptor: {
            Status: "DEPLOYED",
            DeployedOn: "/Date(1711900800000)/",
            DeployedBy: "admin",
          },
        },
        {
          Name: "oauth2",
          TokenServiceUrl: "https://token2.example.com",
          ClientId: "client2",
          SecurityArtifactDescriptor: null,
        },
      ]);

      const result = await handlers.get("list_oauth2_credentials")!({});
      const text = result.content[0].text;
      expect(text).toContain("Name: oauth1");
      expect(text).toContain("TokenServiceUrl: https://token.example.com");
      expect(text).toContain("ClientId: client1");
      expect(text).toContain("Status: DEPLOYED");
      expect(text).toContain("Name: oauth2");
    });

    it("passes $expand when expandCustomParameters is true", async () => {
      mockODataClient.getCollection.mockResolvedValue([]);
      await handlers.get("list_oauth2_credentials")!({
        expandCustomParameters: true,
      });
      expect(mockODataClient.getCollection).toHaveBeenCalledWith(
        "/api/v1/OAuth2ClientCredentials",
        { $expand: "CustomParameters" }
      );
    });

    it("returns empty message when no credentials found", async () => {
      mockODataClient.getCollection.mockResolvedValue([]);
      const result = await handlers.get("list_oauth2_credentials")!({});
      expect(result.content[0].text).toBe(
        "No OAuth2 client credentials found."
      );
    });

    it("returns isError on failure", async () => {
      mockODataClient.getCollection.mockRejectedValue(
        new Error("OData error (500): internal server error")
      );
      const result = await handlers.get("list_oauth2_credentials")!({});
      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain("OData error (500)");
    });
  });

  describe("get_oauth2_credential", () => {
    it("returns formatted credential detail", async () => {
      mockODataClient.getEntity.mockResolvedValue({
        Name: "oauth1",
        Description: "OAuth credential",
        TokenServiceUrl: "https://token.example.com",
        ClientId: "client1",
        ClientAuthentication: "body",
        Scope: "read write",
        ScopeContentType: "form",
        Resource: "https://api.example.com",
        Audience: "https://audience.example.com",
        SecurityArtifactDescriptor: {
          Status: "DEPLOYED",
          DeployedBy: "admin",
          DeployedOn: "/Date(1711900800000)/",
        },
      });

      const result = await handlers.get("get_oauth2_credential")!({
        name: "oauth1",
      });
      const text = result.content[0].text;
      expect(text).toContain("Name: oauth1");
      expect(text).toContain("Description: OAuth credential");
      expect(text).toContain("TokenServiceUrl: https://token.example.com");
      expect(text).toContain("ClientId: client1");
      expect(text).toContain("ClientAuthentication: body");
      expect(text).toContain("Scope: read write");
      expect(text).toContain("Resource: https://api.example.com");
      expect(text).toContain("Audience: https://audience.example.com");
      expect(text).toContain("Status: DEPLOYED");
    });

    it("passes $expand when expandCustomParameters is true", async () => {
      mockODataClient.getEntity.mockResolvedValue({
        Name: "oauth1",
        Description: null,
        TokenServiceUrl: null,
        ClientId: null,
        ClientAuthentication: null,
        Scope: null,
        ScopeContentType: null,
        Resource: null,
        Audience: null,
        SecurityArtifactDescriptor: null,
      });
      await handlers.get("get_oauth2_credential")!({
        name: "oauth1",
        expandCustomParameters: true,
      });
      expect(mockODataClient.getEntity).toHaveBeenCalledWith(
        "/api/v1/OAuth2ClientCredentials('oauth1')",
        { $expand: "CustomParameters" }
      );
    });

    it("returns isError on failure", async () => {
      mockODataClient.getEntity.mockRejectedValue(
        new Error("OData error (404): Resource not found")
      );
      const result = await handlers.get("get_oauth2_credential")!({
        name: "nonexistent",
      });
      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain("OData error (404)");
    });
  });

  describe("create_oauth2_credential", () => {
    it("shows preview without confirm", async () => {
      const result = await handlers.get("create_oauth2_credential")!({
        name: "oauth1",
        tokenServiceUrl: "https://token.example.com",
        clientId: "client1",
        clientSecret: "secret",
        scope: "read",
        description: "Test OAuth",
      });
      const text = result.content[0].text;
      expect(text).toContain("OAuth2 client credential to create:");
      expect(text).toContain("Name: oauth1");
      expect(text).toContain("TokenServiceUrl: https://token.example.com");
      expect(text).toContain("ClientId: client1");
      expect(text).toContain("Scope: read");
      expect(text).toContain("Description: Test OAuth");
      expect(text).toContain("Set confirm to true to proceed.");
      expect(mockODataClient.post).not.toHaveBeenCalled();
    });

    it("creates credential with confirm", async () => {
      mockODataClient.post.mockResolvedValue({});
      const result = await handlers.get("create_oauth2_credential")!({
        name: "oauth1",
        tokenServiceUrl: "https://token.example.com",
        clientId: "client1",
        clientSecret: "secret",
        scope: "read",
        description: "Test OAuth",
        clientAuthentication: "body",
        scopeContentType: "form",
        resource: "https://api.example.com",
        audience: "https://audience.example.com",
        confirm: true,
      });
      expect(mockODataClient.post).toHaveBeenCalledWith(
        "/api/v1/OAuth2ClientCredentials",
        {
          Name: "oauth1",
          TokenServiceUrl: "https://token.example.com",
          ClientId: "client1",
          ClientSecret: "secret",
          Scope: "read",
          Description: "Test OAuth",
          ClientAuthentication: "body",
          ScopeContentType: "form",
          Resource: "https://api.example.com",
          Audience: "https://audience.example.com",
        }
      );
      expect(result.content[0].text).toContain("created successfully");
    });

    it("only includes defined fields in body", async () => {
      mockODataClient.post.mockResolvedValue({});
      await handlers.get("create_oauth2_credential")!({
        name: "oauth1",
        tokenServiceUrl: "https://token.example.com",
        clientId: "client1",
        clientSecret: "secret",
        confirm: true,
      });
      expect(mockODataClient.post).toHaveBeenCalledWith(
        "/api/v1/OAuth2ClientCredentials",
        {
          Name: "oauth1",
          TokenServiceUrl: "https://token.example.com",
          ClientId: "client1",
          ClientSecret: "secret",
        }
      );
    });

    it("returns isError on failure", async () => {
      mockODataClient.post.mockRejectedValue(
        new Error("OData error (409): Conflict")
      );
      const result = await handlers.get("create_oauth2_credential")!({
        name: "oauth1",
        tokenServiceUrl: "https://token.example.com",
        clientId: "client1",
        clientSecret: "secret",
        confirm: true,
      });
      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain("OData error (409)");
    });
  });

  describe("update_oauth2_credential", () => {
    it("shows preview without confirm", async () => {
      mockODataClient.getEntity.mockResolvedValue({
        Name: "oauth1",
        Description: "Old desc",
        TokenServiceUrl: "https://old-token.example.com",
        ClientId: "old-client",
        ClientAuthentication: "body",
        Scope: "read",
        ScopeContentType: "form",
        Resource: null,
        Audience: null,
        SecurityArtifactDescriptor: {
          Status: "DEPLOYED",
          DeployedBy: "admin",
          DeployedOn: "/Date(1711900800000)/",
        },
      });

      const result = await handlers.get("update_oauth2_credential")!({
        name: "oauth1",
        tokenServiceUrl: "https://new-token.example.com",
        scope: "read write",
      });
      const text = result.content[0].text;
      expect(text).toContain("OAuth2 client credential to update:");
      expect(text).toContain("Name: oauth1");
      expect(text).toContain("Proposed changes:");
      expect(text).toContain(
        "TokenServiceUrl: https://old-token.example.com -> https://new-token.example.com"
      );
      expect(text).toContain("Scope: read -> read write");
      expect(text).toContain("Set confirm to true to proceed.");
      expect(mockODataClient.put).not.toHaveBeenCalled();
    });

    it("updates credential with confirm", async () => {
      mockODataClient.put.mockResolvedValue(undefined);
      const result = await handlers.get("update_oauth2_credential")!({
        name: "oauth1",
        tokenServiceUrl: "https://new-token.example.com",
        clientId: "new-client",
        confirm: true,
      });
      expect(mockODataClient.put).toHaveBeenCalledWith(
        "/api/v1/OAuth2ClientCredentials('oauth1')",
        {
          TokenServiceUrl: "https://new-token.example.com",
          ClientId: "new-client",
        }
      );
      expect(result.content[0].text).toContain("updated successfully");
    });

    it("returns isError when preview fetch fails", async () => {
      mockODataClient.getEntity.mockRejectedValue(
        new Error("OData error (404): Resource not found")
      );
      const result = await handlers.get("update_oauth2_credential")!({
        name: "nonexistent",
        scope: "new",
      });
      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain("OData error (404)");
    });

    it("returns isError when update fails", async () => {
      mockODataClient.put.mockRejectedValue(
        new Error("OData error (403): Forbidden")
      );
      const result = await handlers.get("update_oauth2_credential")!({
        name: "oauth1",
        scope: "new",
        confirm: true,
      });
      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain("OData error (403)");
    });
  });

  describe("delete_oauth2_credential", () => {
    it("shows preview without confirm", async () => {
      mockODataClient.getEntity.mockResolvedValue({
        Name: "oauth1",
        Description: "OAuth credential",
        TokenServiceUrl: "https://token.example.com",
        ClientId: "client1",
        ClientAuthentication: "body",
        Scope: "read",
        ScopeContentType: null,
        Resource: null,
        Audience: null,
        SecurityArtifactDescriptor: {
          Status: "DEPLOYED",
          DeployedBy: "admin",
          DeployedOn: "/Date(1711900800000)/",
        },
      });

      const result = await handlers.get("delete_oauth2_credential")!({
        name: "oauth1",
      });
      const text = result.content[0].text;
      expect(text).toContain("OAuth2 client credential to delete:");
      expect(text).toContain("Name: oauth1");
      expect(text).toContain("Set confirm to true to proceed.");
      expect(mockODataClient.delete).not.toHaveBeenCalled();
    });

    it("deletes credential with confirm", async () => {
      mockODataClient.delete.mockResolvedValue(undefined);
      const result = await handlers.get("delete_oauth2_credential")!({
        name: "oauth1",
        confirm: true,
      });
      expect(mockODataClient.delete).toHaveBeenCalledWith(
        "/api/v1/OAuth2ClientCredentials('oauth1')"
      );
      expect(result.content[0].text).toContain("deleted successfully");
    });

    it("returns isError when preview fetch fails", async () => {
      mockODataClient.getEntity.mockRejectedValue(
        new Error("OData error (404): Resource not found")
      );
      const result = await handlers.get("delete_oauth2_credential")!({
        name: "nonexistent",
      });
      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain("OData error (404)");
    });

    it("returns isError when delete fails", async () => {
      mockODataClient.delete.mockRejectedValue(
        new Error("OData error (403): Forbidden")
      );
      const result = await handlers.get("delete_oauth2_credential")!({
        name: "oauth1",
        confirm: true,
      });
      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain("OData error (403)");
    });
  });
});
