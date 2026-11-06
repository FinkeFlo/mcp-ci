import type { McpServer } from "@modelcontextprotocol/server";
import * as z from "zod/v4";
import type { ModuleContext } from "../../../core/types.js";
import { textTool } from "../../../core/tool.js";
import type { ChainCertificate } from "../types.js";
import {
  buildCertificateValuePath,
  buildExportCertificatePath,
  buildCertificateChainValuePath,
  buildKeyPairGenerationPath,
  buildRsaKeyGenerationPath,
  buildSshKeyGenerationPath,
  buildKeyPairResourcesPath,
  buildChainCertificatesPath,
  buildSigningRequestPath,
  buildChainResourceValuePath,
} from "../queries.js";

function parseODataDate(value: string | null): string {
  if (!value) return "n/a";
  const match = value.match(/\/Date\((\d+)\)\//);
  if (match) return new Date(parseInt(match[1])).toISOString();
  return value;
}

function formatChainCertificate(c: ChainCertificate): string {
  const lines: string[] = [];
  lines.push(`Index: ${c.Index ?? "n/a"}`);
  lines.push(`Alias: ${c.Alias ?? "n/a"}`);
  lines.push(`KeyType: ${c.KeyType ?? "n/a"}`);
  lines.push(`SubjectDN: ${c.SubjectDN ?? "n/a"}`);
  lines.push(`IssuerDN: ${c.IssuerDN ?? "n/a"}`);
  lines.push(`ValidNotBefore: ${parseODataDate(c.ValidNotBefore)}`);
  lines.push(`ValidNotAfter: ${parseODataDate(c.ValidNotAfter)}`);
  return lines.join("\n");
}

export function registerCertificateTools(
  server: McpServer,
  context: ModuleContext
) {
  // --- Group 1: Certificates ---

  // 1. export_certificate
  // @api GET /KeystoreEntries('{Hexalias}')/Certificate/$value
  server.registerTool(
    "export_certificate",
    {
      description:
        "Export a certificate from the keystore in DER-encoded format.",
      inputSchema: z.object({
        hexalias: z
          .string()
          .describe("Hex-encoded alias of the keystore entry"),
        keystoreName: z
          .enum([
            "system",
            "backup_admin_system",
            "KeyRenewal",
            "KeyHistory",
          ])
          .optional()
          .describe("Name of the keystore (default: 'system')"),
        rootCA: z
          .boolean()
          .optional()
          .describe(
            "Whether to include the root CA certificate (default: false)"
          ),
      }),
    },
    textTool(async ({ hexalias, keystoreName, rootCA }) => {
      const ks = keystoreName ?? "system";
      const rc = rootCA ?? false;
      const path = `${buildExportCertificatePath(hexalias)}?keystoreName=${ks}&rootCA=${rc}`;
      const content = await context.odataClient.getValue(path);
      return content;
    })
  );

  // 2. import_certificate
  // @api PUT /CertificateResources('{Hexalias}')/$value
  server.registerTool(
    "import_certificate",
    {
      description:
        "Import a certificate into the keystore. The certificate should be base64-encoded DER format. Note: the actual SAP API expects raw binary/base64 DER data. Without confirm, shows a preview. Set confirm to true to execute.",
      inputSchema: z.object({
        hexalias: z
          .string()
          .describe("Hex-encoded alias for the certificate"),
        certificate: z
          .string()
          .describe("Base64-encoded certificate data (DER format)"),
        fingerprintVerified: z
          .boolean()
          .optional()
          .describe("Whether the fingerprint has been verified"),
        update: z
          .boolean()
          .optional()
          .describe("Whether to update an existing certificate"),
        confirm: z
          .boolean()
          .optional()
          .describe("Set to true to actually import the certificate"),
      }),
    },
    textTool(async ({ hexalias, certificate, fingerprintVerified, update, confirm }) => {
      if (!confirm) {
        const lines: string[] = [];
        lines.push("Certificate to import:");
        lines.push("");
        lines.push(`Hexalias: ${hexalias}`);
        lines.push(
          `Certificate: (${certificate.length} chars, base64-encoded)`
        );
        lines.push(
          `FingerprintVerified: ${fingerprintVerified ?? "n/a"}`
        );
        lines.push(`Update: ${update ?? "n/a"}`);
        lines.push("");
        lines.push("Set confirm to true to proceed.");
        return lines.join("\n");
      }
      const body: Record<string, unknown> = { certificate };
      if (fingerprintVerified !== undefined)
        body.fingerprintVerified = fingerprintVerified;
      if (update !== undefined) body.update = update;
      await context.odataClient.put(
        buildCertificateValuePath(hexalias),
        body
      );
      return `Certificate '${hexalias}' imported successfully.`;
    })
  );

  // 3. import_certificate_chain
  // @api PUT /CertificateChainResources('{Hexalias}')/$value
  server.registerTool(
    "import_certificate_chain",
    {
      description:
        "Import a certificate chain into the keystore. The chain should be base64-encoded. Note: the actual SAP API expects raw binary/base64 data. Without confirm, shows a preview. Set confirm to true to execute.",
      inputSchema: z.object({
        hexalias: z
          .string()
          .describe("Hex-encoded alias for the certificate chain"),
        chain: z.string().describe("Base64-encoded certificate chain data"),
        fingerprintVerified: z
          .boolean()
          .optional()
          .describe("Whether the fingerprint has been verified"),
        confirm: z
          .boolean()
          .optional()
          .describe("Set to true to actually import the certificate chain"),
      }),
    },
    textTool(async ({ hexalias, chain, fingerprintVerified, confirm }) => {
      if (!confirm) {
        const lines: string[] = [];
        lines.push("Certificate chain to import:");
        lines.push("");
        lines.push(`Hexalias: ${hexalias}`);
        lines.push(`Chain: (${chain.length} chars, base64-encoded)`);
        lines.push(
          `FingerprintVerified: ${fingerprintVerified ?? "n/a"}`
        );
        lines.push("");
        lines.push("Set confirm to true to proceed.");
        return lines.join("\n");
      }
      const body: Record<string, unknown> = { chain };
      if (fingerprintVerified !== undefined)
        body.fingerprintVerified = fingerprintVerified;
      await context.odataClient.put(
        buildCertificateChainValuePath(hexalias),
        body
      );
      return `Certificate chain '${hexalias}' imported successfully.`;
    })
  );

  // --- Group 2: Key Pair Operations ---

  // 4. generate_key_pair
  // @api POST /KeyPairGenerationRequests
  server.registerTool(
    "generate_key_pair",
    {
      description:
        "Generate a new key pair in the keystore. Without confirm, shows a preview. Set confirm to true to execute.",
      inputSchema: z.object({
        hexalias: z
          .string()
          .optional()
          .describe("Hex-encoded alias for the key pair"),
        alias: z.string().describe("Human-readable alias for the key pair"),
        keyType: z
          .string()
          .optional()
          .describe("Key type, e.g. 'RSA'"),
        keySize: z
          .number()
          .optional()
          .describe("Key size in bits, e.g. 2048, 4096"),
        signatureAlgorithm: z
          .string()
          .optional()
          .describe("Signature algorithm, e.g. 'SHA256withRSA'"),
        commonName: z.string().describe("Common name (CN) for the certificate"),
        organizationUnit: z
          .string()
          .optional()
          .describe("Organization unit (OU)"),
        organization: z.string().optional().describe("Organization (O)"),
        locality: z.string().optional().describe("Locality (L)"),
        state: z.string().optional().describe("State (ST)"),
        country: z.string().describe("Country code (C), e.g. 'DE'"),
        email: z.string().optional().describe("Email address"),
        validNotBefore: z
          .string()
          .optional()
          .describe("Validity start date (ISO format)"),
        validNotAfter: z
          .string()
          .optional()
          .describe("Validity end date (ISO format)"),
        confirm: z
          .boolean()
          .optional()
          .describe("Set to true to actually generate the key pair"),
      }),
    },
    textTool(async ({
      hexalias,
      alias,
      keyType,
      keySize,
      signatureAlgorithm,
      commonName,
      organizationUnit,
      organization,
      locality,
      state,
      country,
      email,
      validNotBefore,
      validNotAfter,
      confirm,
    }) => {
      if (!confirm) {
        const lines: string[] = [];
        lines.push("Key pair to generate:");
        lines.push("");
        lines.push(`Alias: ${alias}`);
        lines.push(`Hexalias: ${hexalias ?? "n/a"}`);
        lines.push(`KeyType: ${keyType ?? "n/a"}`);
        lines.push(`KeySize: ${keySize ?? "n/a"}`);
        lines.push(`SignatureAlgorithm: ${signatureAlgorithm ?? "n/a"}`);
        lines.push(`CommonName: ${commonName}`);
        lines.push(`Country: ${country}`);
        lines.push(`OrganizationUnit: ${organizationUnit ?? "n/a"}`);
        lines.push(`Organization: ${organization ?? "n/a"}`);
        lines.push(`Locality: ${locality ?? "n/a"}`);
        lines.push(`State: ${state ?? "n/a"}`);
        lines.push(`Email: ${email ?? "n/a"}`);
        lines.push(`ValidNotBefore: ${validNotBefore ?? "n/a"}`);
        lines.push(`ValidNotAfter: ${validNotAfter ?? "n/a"}`);
        lines.push("");
        lines.push("Set confirm to true to proceed.");
        return lines.join("\n");
      }
      const body: Record<string, unknown> = {
        Alias: alias,
        CommonName: commonName,
        Country: country,
      };
      if (hexalias !== undefined) body.Hexalias = hexalias;
      if (keyType !== undefined) body.KeyType = keyType;
      if (keySize !== undefined) body.KeySize = keySize;
      if (signatureAlgorithm !== undefined)
        body.SignatureAlgorithm = signatureAlgorithm;
      if (organizationUnit !== undefined)
        body.OrganizationUnit = organizationUnit;
      if (organization !== undefined) body.Organization = organization;
      if (locality !== undefined) body.Locality = locality;
      if (state !== undefined) body.State = state;
      if (email !== undefined) body.Email = email;
      if (validNotBefore !== undefined) body.ValidNotBefore = validNotBefore;
      if (validNotAfter !== undefined) body.ValidNotAfter = validNotAfter;
      await context.odataClient.post(buildKeyPairGenerationPath(), body);
      return `Key pair '${alias}' generated successfully.`;
    })
  );

  // 5. generate_rsa_key_pair
  // @api POST /RSAKeyGenerationRequests
  server.registerTool(
    "generate_rsa_key_pair",
    {
      description:
        "Generate a key pair from an existing RSA private key. Without confirm, shows a preview. Set confirm to true to execute.",
      inputSchema: z.object({
        hexalias: z
          .string()
          .optional()
          .describe("Hex-encoded alias for the key pair"),
        alias: z.string().describe("Human-readable alias for the key pair"),
        rsaFile: z
          .string()
          .describe("Base64-encoded RSA private key file"),
        signatureAlgorithm: z
          .string()
          .optional()
          .describe("Signature algorithm, e.g. 'SHA256withRSA'"),
        commonName: z.string().describe("Common name (CN) for the certificate"),
        organizationUnit: z
          .string()
          .optional()
          .describe("Organization unit (OU)"),
        organization: z.string().optional().describe("Organization (O)"),
        locality: z.string().optional().describe("Locality (L)"),
        state: z.string().optional().describe("State (ST)"),
        country: z.string().describe("Country code (C), e.g. 'DE'"),
        email: z.string().optional().describe("Email address"),
        validNotBefore: z
          .string()
          .optional()
          .describe("Validity start date (ISO format)"),
        validNotAfter: z
          .string()
          .optional()
          .describe("Validity end date (ISO format)"),
        confirm: z
          .boolean()
          .optional()
          .describe("Set to true to actually generate the key pair"),
      }),
    },
    textTool(async ({
      hexalias,
      alias,
      rsaFile,
      signatureAlgorithm,
      commonName,
      organizationUnit,
      organization,
      locality,
      state,
      country,
      email,
      validNotBefore,
      validNotAfter,
      confirm,
    }) => {
      if (!confirm) {
        const lines: string[] = [];
        lines.push("RSA key pair to generate:");
        lines.push("");
        lines.push(`Alias: ${alias}`);
        lines.push(`Hexalias: ${hexalias ?? "n/a"}`);
        lines.push(
          `RSAFile: (${rsaFile.length} chars, base64-encoded)`
        );
        lines.push(`SignatureAlgorithm: ${signatureAlgorithm ?? "n/a"}`);
        lines.push(`CommonName: ${commonName}`);
        lines.push(`Country: ${country}`);
        lines.push(`OrganizationUnit: ${organizationUnit ?? "n/a"}`);
        lines.push(`Organization: ${organization ?? "n/a"}`);
        lines.push(`Locality: ${locality ?? "n/a"}`);
        lines.push(`State: ${state ?? "n/a"}`);
        lines.push(`Email: ${email ?? "n/a"}`);
        lines.push(`ValidNotBefore: ${validNotBefore ?? "n/a"}`);
        lines.push(`ValidNotAfter: ${validNotAfter ?? "n/a"}`);
        lines.push("");
        lines.push("Set confirm to true to proceed.");
        return lines.join("\n");
      }
      const body: Record<string, unknown> = {
        Alias: alias,
        RSAFile: rsaFile,
        CommonName: commonName,
        Country: country,
      };
      if (hexalias !== undefined) body.Hexalias = hexalias;
      if (signatureAlgorithm !== undefined)
        body.SignatureAlgorithm = signatureAlgorithm;
      if (organizationUnit !== undefined)
        body.OrganizationUnit = organizationUnit;
      if (organization !== undefined) body.Organization = organization;
      if (locality !== undefined) body.Locality = locality;
      if (state !== undefined) body.State = state;
      if (email !== undefined) body.Email = email;
      if (validNotBefore !== undefined) body.ValidNotBefore = validNotBefore;
      if (validNotAfter !== undefined) body.ValidNotAfter = validNotAfter;
      await context.odataClient.post(buildRsaKeyGenerationPath(), body);
      return `RSA key pair '${alias}' generated successfully.`;
    })
  );

  // 6. generate_ssh_key_pair
  // @api POST /SSHKeyGenerationRequests
  server.registerTool(
    "generate_ssh_key_pair",
    {
      description:
        "Generate an SSH key pair from an existing private key. Without confirm, shows a preview. Set confirm to true to execute.",
      inputSchema: z.object({
        alias: z.string().describe("Human-readable alias for the SSH key pair"),
        sshFile: z.string().describe("Base64-encoded SSH private key file"),
        password: z
          .string()
          .optional()
          .describe("Password for the private key (if encrypted)"),
        commonName: z.string().describe("Common name (CN) for the certificate"),
        organizationUnit: z
          .string()
          .optional()
          .describe("Organization unit (OU)"),
        organization: z.string().optional().describe("Organization (O)"),
        locality: z.string().optional().describe("Locality (L)"),
        state: z.string().optional().describe("State (ST)"),
        country: z.string().describe("Country code (C), e.g. 'DE'"),
        email: z.string().optional().describe("Email address"),
        validNotBefore: z
          .string()
          .optional()
          .describe("Validity start date (ISO format)"),
        validNotAfter: z
          .string()
          .optional()
          .describe("Validity end date (ISO format)"),
        update: z
          .boolean()
          .optional()
          .describe("Whether to update an existing SSH key pair"),
        confirm: z
          .boolean()
          .optional()
          .describe("Set to true to actually generate the SSH key pair"),
      }),
    },
    textTool(async ({
      alias,
      sshFile,
      password,
      commonName,
      organizationUnit,
      organization,
      locality,
      state,
      country,
      email,
      validNotBefore,
      validNotAfter,
      update,
      confirm,
    }) => {
      if (!confirm) {
        const lines: string[] = [];
        lines.push("SSH key pair to generate:");
        lines.push("");
        lines.push(`Alias: ${alias}`);
        lines.push(
          `SSHFile: (${sshFile.length} chars, base64-encoded)`
        );
        lines.push(`Password: ${password !== undefined ? "(provided)" : "n/a"}`);
        lines.push(`CommonName: ${commonName}`);
        lines.push(`Country: ${country}`);
        lines.push(`OrganizationUnit: ${organizationUnit ?? "n/a"}`);
        lines.push(`Organization: ${organization ?? "n/a"}`);
        lines.push(`Locality: ${locality ?? "n/a"}`);
        lines.push(`State: ${state ?? "n/a"}`);
        lines.push(`Email: ${email ?? "n/a"}`);
        lines.push(`ValidNotBefore: ${validNotBefore ?? "n/a"}`);
        lines.push(`ValidNotAfter: ${validNotAfter ?? "n/a"}`);
        lines.push(`Update: ${update ?? "n/a"}`);
        lines.push("");
        lines.push("Set confirm to true to proceed.");
        return lines.join("\n");
      }
      const body: Record<string, unknown> = {
        Alias: alias,
        SSHFile: sshFile,
        CommonName: commonName,
        Country: country,
      };
      if (password !== undefined) body.Password = password;
      if (organizationUnit !== undefined)
        body.OrganizationUnit = organizationUnit;
      if (organization !== undefined) body.Organization = organization;
      if (locality !== undefined) body.Locality = locality;
      if (state !== undefined) body.State = state;
      if (email !== undefined) body.Email = email;
      if (validNotBefore !== undefined) body.ValidNotBefore = validNotBefore;
      if (validNotAfter !== undefined) body.ValidNotAfter = validNotAfter;
      let path = buildSshKeyGenerationPath();
      if (update !== undefined) path += `?update=${update}`;
      await context.odataClient.post(path, body);
      return `SSH key pair '${alias}' generated successfully.`;
    })
  );

  // 7. import_key_pair
  // @api POST /KeyPairResources
  server.registerTool(
    "import_key_pair",
    {
      description:
        "Import a key pair (PKCS#12) into the keystore. Without confirm, shows a preview. Set confirm to true to execute.",
      inputSchema: z.object({
        hexalias: z
          .string()
          .optional()
          .describe("Hex-encoded alias for the key pair"),
        alias: z.string().describe("Human-readable alias for the key pair"),
        resource: z
          .string()
          .describe("Base64-encoded PKCS#12 key pair resource"),
        password: z.string().describe("Password for the PKCS#12 file"),
        fingerprintVerified: z
          .boolean()
          .optional()
          .describe("Whether the fingerprint has been verified"),
        update: z
          .boolean()
          .optional()
          .describe("Whether to update an existing key pair"),
        confirm: z
          .boolean()
          .optional()
          .describe("Set to true to actually import the key pair"),
      }),
    },
    textTool(async ({
      hexalias,
      alias,
      resource,
      password,
      fingerprintVerified,
      update,
      confirm,
    }) => {
      if (!confirm) {
        const lines: string[] = [];
        lines.push("Key pair to import:");
        lines.push("");
        lines.push(`Alias: ${alias}`);
        lines.push(`Hexalias: ${hexalias ?? "n/a"}`);
        lines.push(
          `Resource: (${resource.length} chars, base64-encoded PKCS#12)`
        );
        lines.push(`Password: (provided)`);
        lines.push(
          `FingerprintVerified: ${fingerprintVerified ?? "n/a"}`
        );
        lines.push(`Update: ${update ?? "n/a"}`);
        lines.push("");
        lines.push("Set confirm to true to proceed.");
        return lines.join("\n");
      }
      const body: Record<string, unknown> = {
        Alias: alias,
        Resource: resource,
        Password: password,
      };
      if (hexalias !== undefined) body.Hexalias = hexalias;
      const queryParams: string[] = [];
      if (fingerprintVerified !== undefined)
        queryParams.push(`fingerprintVerified=${fingerprintVerified}`);
      if (update !== undefined) queryParams.push(`update=${update}`);
      let path = buildKeyPairResourcesPath();
      if (queryParams.length > 0) path += `?${queryParams.join("&")}`;
      await context.odataClient.post(path, body);
      return `Key pair '${alias}' imported successfully.`;
    })
  );

  // --- Group 3: Certificate Chain & CSR ---

  // 8. get_chain_certificates
  // @api GET /KeystoreEntries('{Hexalias}')/ChainCertificates
  server.registerTool(
    "get_chain_certificates",
    {
      description:
        "Get the certificate chain for a keystore entry.",
      inputSchema: z.object({
        hexalias: z
          .string()
          .describe("Hex-encoded alias of the keystore entry"),
        keystoreName: z
          .string()
          .optional()
          .describe("Name of the keystore (default: 'system')"),
      }),
    },
    textTool(async ({ hexalias, keystoreName }) => {
      const ks = keystoreName ?? "system";
      const path = `${buildChainCertificatesPath(hexalias)}?keystoreName=${ks}`;
      const certs =
        await context.odataClient.getCollection<ChainCertificate>(path);
      if (certs.length === 0) {
        return "No chain certificates found.";
      }
      const text = certs.map(formatChainCertificate).join("\n\n");
      return text;
    })
  );

  // 9. get_signing_request
  // @api GET /KeystoreEntries('{Hexalias}')/SigningRequest/$value
  server.registerTool(
    "get_signing_request",
    {
      description:
        "Get the PKCS#10 certificate signing request (CSR) for a keystore entry.",
      inputSchema: z.object({
        hexalias: z
          .string()
          .describe("Hex-encoded alias of the keystore entry"),
      }),
    },
    textTool(async ({ hexalias }) => {
      const content = await context.odataClient.getValue(
        buildSigningRequestPath(hexalias)
      );
      return content;
    })
  );

  // 10. download_chain_resource
  // @api GET /KeystoreEntries('{Hexalias}')/ChainResource/$value
  server.registerTool(
    "download_chain_resource",
    {
      description:
        "Download the certificate chain resource bytes for a keystore entry.",
      inputSchema: z.object({
        hexalias: z
          .string()
          .describe("Hex-encoded alias of the keystore entry"),
      }),
    },
    textTool(async ({ hexalias }) => {
      const content = await context.odataClient.getValue(
        buildChainResourceValuePath(hexalias)
      );
      return content;
    })
  );
}
