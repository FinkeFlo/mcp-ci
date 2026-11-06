import { describe, it, expect, vi, beforeEach } from "vitest";
import type { McpServer } from "@modelcontextprotocol/server";
import { registerCertificateTools } from "../tools/certificates.js";
import type { ModuleContext } from "../../../core/types.js";

describe("certificate and key pair tools", () => {
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

    registerCertificateTools(mockServer, context);
  });

  it("registers all 10 tools", () => {
    expect(handlers.size).toBe(10);
    expect(handlers.has("export_certificate")).toBe(true);
    expect(handlers.has("import_certificate")).toBe(true);
    expect(handlers.has("import_certificate_chain")).toBe(true);
    expect(handlers.has("generate_key_pair")).toBe(true);
    expect(handlers.has("generate_rsa_key_pair")).toBe(true);
    expect(handlers.has("generate_ssh_key_pair")).toBe(true);
    expect(handlers.has("import_key_pair")).toBe(true);
    expect(handlers.has("get_chain_certificates")).toBe(true);
    expect(handlers.has("get_signing_request")).toBe(true);
    expect(handlers.has("download_chain_resource")).toBe(true);
  });

  // --- 1. export_certificate ---
  describe("export_certificate", () => {
    it("returns certificate data with default params", async () => {
      mockODataClient.getValue.mockResolvedValue("-----BEGIN CERTIFICATE-----\nMIIC...\n-----END CERTIFICATE-----");
      const result = await handlers.get("export_certificate")!({
        hexalias: "abc123",
      });
      expect(result.content[0].text).toContain("BEGIN CERTIFICATE");
      expect(mockODataClient.getValue).toHaveBeenCalledWith(
        "/api/v1/KeystoreEntries('abc123')/Certificate/$value?keystoreName=system&rootCA=false"
      );
    });

    it("passes custom keystoreName and rootCA", async () => {
      mockODataClient.getValue.mockResolvedValue("cert-data");
      await handlers.get("export_certificate")!({
        hexalias: "abc123",
        keystoreName: "backup_admin_system",
        rootCA: true,
      });
      expect(mockODataClient.getValue).toHaveBeenCalledWith(
        "/api/v1/KeystoreEntries('abc123')/Certificate/$value?keystoreName=backup_admin_system&rootCA=true"
      );
    });

    it("returns isError on failure", async () => {
      mockODataClient.getValue.mockRejectedValue(
        new Error("OData error (404): Resource not found")
      );
      const result = await handlers.get("export_certificate")!({
        hexalias: "nonexistent",
      });
      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain("OData error (404)");
    });
  });

  // --- 2. import_certificate ---
  describe("import_certificate", () => {
    it("shows preview without confirm", async () => {
      const result = await handlers.get("import_certificate")!({
        hexalias: "abc123",
        certificate: "base64certdata",
      });
      const text = result.content[0].text;
      expect(text).toContain("Certificate to import:");
      expect(text).toContain("Hexalias: abc123");
      expect(text).toContain("14 chars, base64-encoded");
      expect(text).toContain("Set confirm to true to proceed.");
      expect(mockODataClient.put).not.toHaveBeenCalled();
    });

    it("imports certificate with confirm", async () => {
      mockODataClient.put.mockResolvedValue(undefined);
      const result = await handlers.get("import_certificate")!({
        hexalias: "abc123",
        certificate: "base64certdata",
        confirm: true,
      });
      expect(mockODataClient.put).toHaveBeenCalledWith(
        "/api/v1/CertificateResources('abc123')/$value",
        { certificate: "base64certdata" }
      );
      expect(result.content[0].text).toContain("imported successfully");
    });

    it("includes optional params in body when provided", async () => {
      mockODataClient.put.mockResolvedValue(undefined);
      await handlers.get("import_certificate")!({
        hexalias: "abc123",
        certificate: "base64certdata",
        fingerprintVerified: true,
        update: true,
        confirm: true,
      });
      expect(mockODataClient.put).toHaveBeenCalledWith(
        "/api/v1/CertificateResources('abc123')/$value",
        {
          certificate: "base64certdata",
          fingerprintVerified: true,
          update: true,
        }
      );
    });

    it("returns isError on failure", async () => {
      mockODataClient.put.mockRejectedValue(
        new Error("OData error (403): Forbidden")
      );
      const result = await handlers.get("import_certificate")!({
        hexalias: "abc123",
        certificate: "base64certdata",
        confirm: true,
      });
      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain("OData error (403)");
    });
  });

  // --- 3. import_certificate_chain ---
  describe("import_certificate_chain", () => {
    it("shows preview without confirm", async () => {
      const result = await handlers.get("import_certificate_chain")!({
        hexalias: "abc123",
        chain: "base64chaindata",
      });
      const text = result.content[0].text;
      expect(text).toContain("Certificate chain to import:");
      expect(text).toContain("Hexalias: abc123");
      expect(text).toContain("15 chars, base64-encoded");
      expect(text).toContain("Set confirm to true to proceed.");
      expect(mockODataClient.put).not.toHaveBeenCalled();
    });

    it("imports certificate chain with confirm", async () => {
      mockODataClient.put.mockResolvedValue(undefined);
      const result = await handlers.get("import_certificate_chain")!({
        hexalias: "abc123",
        chain: "base64chaindata",
        confirm: true,
      });
      expect(mockODataClient.put).toHaveBeenCalledWith(
        "/api/v1/CertificateChainResources('abc123')/$value",
        { chain: "base64chaindata" }
      );
      expect(result.content[0].text).toContain("imported successfully");
    });

    it("includes fingerprintVerified in body when provided", async () => {
      mockODataClient.put.mockResolvedValue(undefined);
      await handlers.get("import_certificate_chain")!({
        hexalias: "abc123",
        chain: "base64chaindata",
        fingerprintVerified: true,
        confirm: true,
      });
      expect(mockODataClient.put).toHaveBeenCalledWith(
        "/api/v1/CertificateChainResources('abc123')/$value",
        { chain: "base64chaindata", fingerprintVerified: true }
      );
    });

    it("returns isError on failure", async () => {
      mockODataClient.put.mockRejectedValue(
        new Error("OData error (500): Internal Server Error")
      );
      const result = await handlers.get("import_certificate_chain")!({
        hexalias: "abc123",
        chain: "base64chaindata",
        confirm: true,
      });
      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain("OData error (500)");
    });
  });

  // --- 4. generate_key_pair ---
  describe("generate_key_pair", () => {
    it("shows preview without confirm", async () => {
      const result = await handlers.get("generate_key_pair")!({
        alias: "mykey",
        commonName: "CN=Test",
        country: "DE",
      });
      const text = result.content[0].text;
      expect(text).toContain("Key pair to generate:");
      expect(text).toContain("Alias: mykey");
      expect(text).toContain("CommonName: CN=Test");
      expect(text).toContain("Country: DE");
      expect(text).toContain("Set confirm to true to proceed.");
      expect(mockODataClient.post).not.toHaveBeenCalled();
    });

    it("generates key pair with confirm (required fields only)", async () => {
      mockODataClient.post.mockResolvedValue({});
      const result = await handlers.get("generate_key_pair")!({
        alias: "mykey",
        commonName: "CN=Test",
        country: "DE",
        confirm: true,
      });
      expect(mockODataClient.post).toHaveBeenCalledWith(
        "/api/v1/KeyPairGenerationRequests",
        { Alias: "mykey", CommonName: "CN=Test", Country: "DE" }
      );
      expect(result.content[0].text).toContain("generated successfully");
    });

    it("includes all optional fields in body when provided", async () => {
      mockODataClient.post.mockResolvedValue({});
      await handlers.get("generate_key_pair")!({
        hexalias: "hex123",
        alias: "mykey",
        keyType: "RSA",
        keySize: 2048,
        signatureAlgorithm: "SHA256withRSA",
        commonName: "CN=Test",
        organizationUnit: "IT",
        organization: "ACME",
        locality: "Berlin",
        state: "Berlin",
        country: "DE",
        email: "test@acme.com",
        validNotBefore: "2026-01-01",
        validNotAfter: "2027-01-01",
        confirm: true,
      });
      expect(mockODataClient.post).toHaveBeenCalledWith(
        "/api/v1/KeyPairGenerationRequests",
        {
          Hexalias: "hex123",
          Alias: "mykey",
          KeyType: "RSA",
          KeySize: 2048,
          SignatureAlgorithm: "SHA256withRSA",
          CommonName: "CN=Test",
          OrganizationUnit: "IT",
          Organization: "ACME",
          Locality: "Berlin",
          State: "Berlin",
          Country: "DE",
          Email: "test@acme.com",
          ValidNotBefore: "2026-01-01",
          ValidNotAfter: "2027-01-01",
        }
      );
    });

    it("returns isError on failure", async () => {
      mockODataClient.post.mockRejectedValue(
        new Error("OData error (400): Bad Request")
      );
      const result = await handlers.get("generate_key_pair")!({
        alias: "mykey",
        commonName: "CN=Test",
        country: "DE",
        confirm: true,
      });
      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain("OData error (400)");
    });
  });

  // --- 5. generate_rsa_key_pair ---
  describe("generate_rsa_key_pair", () => {
    it("shows preview without confirm", async () => {
      const result = await handlers.get("generate_rsa_key_pair")!({
        alias: "rsakey",
        rsaFile: "base64rsadata",
        commonName: "CN=RSA",
        country: "DE",
      });
      const text = result.content[0].text;
      expect(text).toContain("RSA key pair to generate:");
      expect(text).toContain("Alias: rsakey");
      expect(text).toContain("13 chars, base64-encoded");
      expect(text).toContain("CommonName: CN=RSA");
      expect(text).toContain("Set confirm to true to proceed.");
      expect(mockODataClient.post).not.toHaveBeenCalled();
    });

    it("generates RSA key pair with confirm", async () => {
      mockODataClient.post.mockResolvedValue({});
      const result = await handlers.get("generate_rsa_key_pair")!({
        alias: "rsakey",
        rsaFile: "base64rsadata",
        commonName: "CN=RSA",
        country: "DE",
        confirm: true,
      });
      expect(mockODataClient.post).toHaveBeenCalledWith(
        "/api/v1/RSAKeyGenerationRequests",
        {
          Alias: "rsakey",
          RSAFile: "base64rsadata",
          CommonName: "CN=RSA",
          Country: "DE",
        }
      );
      expect(result.content[0].text).toContain("generated successfully");
    });

    it("includes optional fields in body when provided", async () => {
      mockODataClient.post.mockResolvedValue({});
      await handlers.get("generate_rsa_key_pair")!({
        hexalias: "hex456",
        alias: "rsakey",
        rsaFile: "base64rsadata",
        signatureAlgorithm: "SHA512withRSA",
        commonName: "CN=RSA",
        organizationUnit: "Dev",
        organization: "Corp",
        locality: "Munich",
        state: "Bavaria",
        country: "DE",
        email: "dev@corp.com",
        validNotBefore: "2026-01-01",
        validNotAfter: "2028-01-01",
        confirm: true,
      });
      expect(mockODataClient.post).toHaveBeenCalledWith(
        "/api/v1/RSAKeyGenerationRequests",
        {
          Hexalias: "hex456",
          Alias: "rsakey",
          RSAFile: "base64rsadata",
          SignatureAlgorithm: "SHA512withRSA",
          CommonName: "CN=RSA",
          OrganizationUnit: "Dev",
          Organization: "Corp",
          Locality: "Munich",
          State: "Bavaria",
          Country: "DE",
          Email: "dev@corp.com",
          ValidNotBefore: "2026-01-01",
          ValidNotAfter: "2028-01-01",
        }
      );
    });

    it("returns isError on failure", async () => {
      mockODataClient.post.mockRejectedValue(
        new Error("OData error (409): Conflict")
      );
      const result = await handlers.get("generate_rsa_key_pair")!({
        alias: "rsakey",
        rsaFile: "base64rsadata",
        commonName: "CN=RSA",
        country: "DE",
        confirm: true,
      });
      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain("OData error (409)");
    });
  });

  // --- 6. generate_ssh_key_pair ---
  describe("generate_ssh_key_pair", () => {
    it("shows preview without confirm", async () => {
      const result = await handlers.get("generate_ssh_key_pair")!({
        alias: "sshkey",
        sshFile: "base64sshdata",
        commonName: "CN=SSH",
        country: "DE",
      });
      const text = result.content[0].text;
      expect(text).toContain("SSH key pair to generate:");
      expect(text).toContain("Alias: sshkey");
      expect(text).toContain("13 chars, base64-encoded");
      expect(text).toContain("Password: n/a");
      expect(text).toContain("CommonName: CN=SSH");
      expect(text).toContain("Set confirm to true to proceed.");
      expect(mockODataClient.post).not.toHaveBeenCalled();
    });

    it("shows password as provided in preview when given", async () => {
      const result = await handlers.get("generate_ssh_key_pair")!({
        alias: "sshkey",
        sshFile: "base64sshdata",
        password: "secret",
        commonName: "CN=SSH",
        country: "DE",
      });
      const text = result.content[0].text;
      expect(text).toContain("Password: (provided)");
    });

    it("generates SSH key pair with confirm", async () => {
      mockODataClient.post.mockResolvedValue({});
      const result = await handlers.get("generate_ssh_key_pair")!({
        alias: "sshkey",
        sshFile: "base64sshdata",
        commonName: "CN=SSH",
        country: "DE",
        confirm: true,
      });
      expect(mockODataClient.post).toHaveBeenCalledWith(
        "/api/v1/SSHKeyGenerationRequests",
        {
          Alias: "sshkey",
          SSHFile: "base64sshdata",
          CommonName: "CN=SSH",
          Country: "DE",
        }
      );
      expect(result.content[0].text).toContain("generated successfully");
    });

    it("includes password and optional fields in body when provided", async () => {
      mockODataClient.post.mockResolvedValue({});
      await handlers.get("generate_ssh_key_pair")!({
        alias: "sshkey",
        sshFile: "base64sshdata",
        password: "secret",
        commonName: "CN=SSH",
        country: "DE",
        confirm: true,
      });
      expect(mockODataClient.post).toHaveBeenCalledWith(
        "/api/v1/SSHKeyGenerationRequests",
        {
          Alias: "sshkey",
          SSHFile: "base64sshdata",
          Password: "secret",
          CommonName: "CN=SSH",
          Country: "DE",
        }
      );
    });

    it("appends update query param when provided", async () => {
      mockODataClient.post.mockResolvedValue({});
      await handlers.get("generate_ssh_key_pair")!({
        alias: "sshkey",
        sshFile: "base64sshdata",
        commonName: "CN=SSH",
        country: "DE",
        update: true,
        confirm: true,
      });
      expect(mockODataClient.post).toHaveBeenCalledWith(
        "/api/v1/SSHKeyGenerationRequests?update=true",
        {
          Alias: "sshkey",
          SSHFile: "base64sshdata",
          CommonName: "CN=SSH",
          Country: "DE",
        }
      );
    });

    it("returns isError on failure", async () => {
      mockODataClient.post.mockRejectedValue(
        new Error("OData error (500): Internal Server Error")
      );
      const result = await handlers.get("generate_ssh_key_pair")!({
        alias: "sshkey",
        sshFile: "base64sshdata",
        commonName: "CN=SSH",
        country: "DE",
        confirm: true,
      });
      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain("OData error (500)");
    });
  });

  // --- 7. import_key_pair ---
  describe("import_key_pair", () => {
    it("shows preview without confirm", async () => {
      const result = await handlers.get("import_key_pair")!({
        alias: "imported",
        resource: "base64pkcs12data",
        password: "secret",
      });
      const text = result.content[0].text;
      expect(text).toContain("Key pair to import:");
      expect(text).toContain("Alias: imported");
      expect(text).toContain("16 chars, base64-encoded PKCS#12");
      expect(text).toContain("Password: (provided)");
      expect(text).toContain("Set confirm to true to proceed.");
      expect(mockODataClient.post).not.toHaveBeenCalled();
    });

    it("imports key pair with confirm (required fields only)", async () => {
      mockODataClient.post.mockResolvedValue({});
      const result = await handlers.get("import_key_pair")!({
        alias: "imported",
        resource: "base64pkcs12data",
        password: "secret",
        confirm: true,
      });
      expect(mockODataClient.post).toHaveBeenCalledWith(
        "/api/v1/KeyPairResources",
        {
          Alias: "imported",
          Resource: "base64pkcs12data",
          Password: "secret",
        }
      );
      expect(result.content[0].text).toContain("imported successfully");
    });

    it("includes hexalias in body when provided", async () => {
      mockODataClient.post.mockResolvedValue({});
      await handlers.get("import_key_pair")!({
        hexalias: "hex789",
        alias: "imported",
        resource: "base64pkcs12data",
        password: "secret",
        confirm: true,
      });
      expect(mockODataClient.post).toHaveBeenCalledWith(
        "/api/v1/KeyPairResources",
        {
          Hexalias: "hex789",
          Alias: "imported",
          Resource: "base64pkcs12data",
          Password: "secret",
        }
      );
    });

    it("appends query params when fingerprintVerified and update provided", async () => {
      mockODataClient.post.mockResolvedValue({});
      await handlers.get("import_key_pair")!({
        alias: "imported",
        resource: "base64pkcs12data",
        password: "secret",
        fingerprintVerified: true,
        update: true,
        confirm: true,
      });
      expect(mockODataClient.post).toHaveBeenCalledWith(
        "/api/v1/KeyPairResources?fingerprintVerified=true&update=true",
        {
          Alias: "imported",
          Resource: "base64pkcs12data",
          Password: "secret",
        }
      );
    });

    it("returns isError on failure", async () => {
      mockODataClient.post.mockRejectedValue(
        new Error("OData error (400): Bad Request")
      );
      const result = await handlers.get("import_key_pair")!({
        alias: "imported",
        resource: "base64pkcs12data",
        password: "secret",
        confirm: true,
      });
      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain("OData error (400)");
    });
  });

  // --- 8. get_chain_certificates ---
  describe("get_chain_certificates", () => {
    it("returns formatted chain certificates", async () => {
      mockODataClient.getCollection.mockResolvedValue([
        {
          Hexalias: "abc123",
          Alias: "root-ca",
          Index: 0,
          Validity: "Valid",
          KeyType: "RSA",
          KeySize: 2048,
          ValidNotBefore: "/Date(1672531200000)/",
          ValidNotAfter: "/Date(1704067200000)/",
          SubjectDN: "CN=Root CA",
          IssuerDN: "CN=Root CA",
          SerialNumber: "12345",
          SignatureAlgorithm: "SHA256withRSA",
          Version: 3,
          FingerprintSha1: "AA:BB:CC",
          FingerprintSha256: "DD:EE:FF",
          FingerprintSha512: "11:22:33",
        },
        {
          Hexalias: "abc123",
          Alias: "intermediate",
          Index: 1,
          Validity: "Valid",
          KeyType: "RSA",
          KeySize: 2048,
          ValidNotBefore: null,
          ValidNotAfter: null,
          SubjectDN: "CN=Intermediate",
          IssuerDN: "CN=Root CA",
          SerialNumber: "67890",
          SignatureAlgorithm: "SHA256withRSA",
          Version: 3,
          FingerprintSha1: null,
          FingerprintSha256: null,
          FingerprintSha512: null,
        },
      ]);

      const result = await handlers.get("get_chain_certificates")!({
        hexalias: "abc123",
      });
      const text = result.content[0].text;
      expect(text).toContain("Index: 0");
      expect(text).toContain("Alias: root-ca");
      expect(text).toContain("KeyType: RSA");
      expect(text).toContain("SubjectDN: CN=Root CA");
      expect(text).toContain("IssuerDN: CN=Root CA");
      expect(text).toContain("2023-01-01");
      expect(text).toContain("Index: 1");
      expect(text).toContain("Alias: intermediate");
      expect(text).toContain("ValidNotBefore: n/a");
      expect(text).toContain("ValidNotAfter: n/a");
    });

    it("uses default keystoreName 'system'", async () => {
      mockODataClient.getCollection.mockResolvedValue([]);
      await handlers.get("get_chain_certificates")!({
        hexalias: "abc123",
      });
      expect(mockODataClient.getCollection).toHaveBeenCalledWith(
        "/api/v1/KeystoreEntries('abc123')/ChainCertificates?keystoreName=system"
      );
    });

    it("uses provided keystoreName", async () => {
      mockODataClient.getCollection.mockResolvedValue([]);
      await handlers.get("get_chain_certificates")!({
        hexalias: "abc123",
        keystoreName: "backup_admin_system",
      });
      expect(mockODataClient.getCollection).toHaveBeenCalledWith(
        "/api/v1/KeystoreEntries('abc123')/ChainCertificates?keystoreName=backup_admin_system"
      );
    });

    it("returns empty message when no chain certificates found", async () => {
      mockODataClient.getCollection.mockResolvedValue([]);
      const result = await handlers.get("get_chain_certificates")!({
        hexalias: "abc123",
      });
      expect(result.content[0].text).toBe("No chain certificates found.");
    });

    it("returns isError on failure", async () => {
      mockODataClient.getCollection.mockRejectedValue(
        new Error("OData error (404): Resource not found")
      );
      const result = await handlers.get("get_chain_certificates")!({
        hexalias: "nonexistent",
      });
      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain("OData error (404)");
    });
  });

  // --- 9. get_signing_request ---
  describe("get_signing_request", () => {
    it("returns CSR data", async () => {
      mockODataClient.getValue.mockResolvedValue(
        "-----BEGIN CERTIFICATE REQUEST-----\nMIIC...\n-----END CERTIFICATE REQUEST-----"
      );
      const result = await handlers.get("get_signing_request")!({
        hexalias: "abc123",
      });
      expect(result.content[0].text).toContain("BEGIN CERTIFICATE REQUEST");
      expect(mockODataClient.getValue).toHaveBeenCalledWith(
        "/api/v1/KeystoreEntries('abc123')/SigningRequest/$value"
      );
    });

    it("returns isError on failure", async () => {
      mockODataClient.getValue.mockRejectedValue(
        new Error("OData error (404): Resource not found")
      );
      const result = await handlers.get("get_signing_request")!({
        hexalias: "nonexistent",
      });
      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain("OData error (404)");
    });
  });

  describe("download_chain_resource", () => {
    it("returns certificate chain resource bytes", async () => {
      mockODataClient.getValue.mockResolvedValue(
        "-----BEGIN CERTIFICATE-----\nMIIC...\n-----END CERTIFICATE-----"
      );
      const result = await handlers.get("download_chain_resource")!({
        hexalias: "abc123",
      });
      expect(result.content[0].text).toContain("BEGIN CERTIFICATE");
      expect(mockODataClient.getValue).toHaveBeenCalledWith(
        "/api/v1/KeystoreEntries('abc123')/ChainResource/$value"
      );
    });

    it("returns isError on failure", async () => {
      mockODataClient.getValue.mockRejectedValue(
        new Error("OData error (404): Resource not found")
      );
      const result = await handlers.get("download_chain_resource")!({
        hexalias: "nonexistent",
      });
      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain("OData error (404)");
    });
  });
});
