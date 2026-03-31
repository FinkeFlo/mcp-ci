import { describe, it, expect } from "vitest";
import {
  buildUserCredentialsPath,
  buildUserCredentialPath,
  buildSecureParametersPath,
  buildSecureParameterPath,
  buildOAuth2CredentialsPath,
  buildOAuth2CredentialPath,
  buildKeystoreEntriesPath,
  buildKeystoreEntryPath,
  buildCertificateValuePath,
  buildExportCertificatePath,
  buildSigningRequestPath,
  buildCertificateChainValuePath,
  buildChainCertificatesPath,
  buildChainResourceValuePath,
  buildSshKeyValuePath,
  buildKeyPairGenerationPath,
  buildRsaKeyGenerationPath,
  buildSshKeyGenerationPath,
  buildKeyPairResourcesPath,
  buildKeystorePath,
  buildKeystoreSizePath,
  buildKeystoreResourcesPath,
  buildKeystoreResourcePath,
  buildHistoryKeystoreEntriesPath,
  buildHistoryKeystoreEntryPath,
  buildCertUserMappingsPath,
  buildCertUserMappingPath,
  buildAccessPoliciesPath,
  buildAccessPolicyPath,
  buildArtifactReferencesPath,
  buildArtifactReferencePath,
} from "../queries.js";

describe("User credential paths", () => {
  it("builds collection path", () => {
    expect(buildUserCredentialsPath()).toBe("/api/v1/UserCredentials");
  });

  it("builds single credential path", () => {
    expect(buildUserCredentialPath("MyCredential")).toBe(
      "/api/v1/UserCredentials('MyCredential')"
    );
  });

  it("escapes single quotes in credential name", () => {
    expect(buildUserCredentialPath("Cred's_Test")).toBe(
      "/api/v1/UserCredentials('Cred''s_Test')"
    );
  });
});

describe("Secure parameter paths", () => {
  it("builds collection path", () => {
    expect(buildSecureParametersPath()).toBe("/api/v1/SecureParameters");
  });

  it("builds single parameter path", () => {
    expect(buildSecureParameterPath("my_param")).toBe(
      "/api/v1/SecureParameters('my_param')"
    );
  });
});

describe("OAuth2 client credential paths", () => {
  it("builds collection path", () => {
    expect(buildOAuth2CredentialsPath()).toBe("/api/v1/OAuth2ClientCredentials");
  });

  it("builds single credential path", () => {
    expect(buildOAuth2CredentialPath("OAuthCred")).toBe(
      "/api/v1/OAuth2ClientCredentials('OAuthCred')"
    );
  });

  it("escapes single quotes in name", () => {
    expect(buildOAuth2CredentialPath("OAuth's")).toBe(
      "/api/v1/OAuth2ClientCredentials('OAuth''s')"
    );
  });
});

describe("Keystore entry paths", () => {
  it("builds collection path", () => {
    expect(buildKeystoreEntriesPath()).toBe("/api/v1/KeystoreEntries");
  });

  it("builds single entry path with hexalias", () => {
    expect(buildKeystoreEntryPath("abc123def")).toBe(
      "/api/v1/KeystoreEntries('abc123def')"
    );
  });

  it("escapes single quotes in hexalias", () => {
    expect(buildKeystoreEntryPath("hex'alias")).toBe(
      "/api/v1/KeystoreEntries('hex''alias')"
    );
  });
});

describe("Certificate paths", () => {
  it("builds certificate value path", () => {
    expect(buildCertificateValuePath("abc123")).toBe(
      "/api/v1/CertificateResources('abc123')/$value"
    );
  });

  it("builds export certificate path", () => {
    expect(buildExportCertificatePath("abc123")).toBe(
      "/api/v1/KeystoreEntries('abc123')/Certificate/$value"
    );
  });

  it("builds signing request path", () => {
    expect(buildSigningRequestPath("abc123")).toBe(
      "/api/v1/KeystoreEntries('abc123')/SigningRequest/$value"
    );
  });

  it("builds certificate chain value path", () => {
    expect(buildCertificateChainValuePath("abc123")).toBe(
      "/api/v1/CertificateChainResources('abc123')/$value"
    );
  });

  it("builds chain certificates path", () => {
    expect(buildChainCertificatesPath("abc123")).toBe(
      "/api/v1/KeystoreEntries('abc123')/ChainCertificates"
    );
  });

  it("builds chain resource value path", () => {
    expect(buildChainResourceValuePath("abc123")).toBe(
      "/api/v1/KeystoreEntries('abc123')/ChainResource/$value"
    );
  });

  it("builds SSH key value path", () => {
    expect(buildSshKeyValuePath("abc123")).toBe(
      "/api/v1/KeystoreEntries('abc123')/Sshkey/$value"
    );
  });

  it("escapes single quotes in certificate hexalias", () => {
    expect(buildCertificateValuePath("hex'id")).toBe(
      "/api/v1/CertificateResources('hex''id')/$value"
    );
  });
});

describe("Key pair generation paths", () => {
  it("builds key pair generation path", () => {
    expect(buildKeyPairGenerationPath()).toBe("/api/v1/KeyPairGenerationRequests");
  });

  it("builds RSA key generation path", () => {
    expect(buildRsaKeyGenerationPath()).toBe("/api/v1/RSAKeyGenerationRequests");
  });

  it("builds SSH key generation path", () => {
    expect(buildSshKeyGenerationPath()).toBe("/api/v1/SSHKeyGenerationRequests");
  });

  it("builds key pair resources path", () => {
    expect(buildKeyPairResourcesPath()).toBe("/api/v1/KeyPairResources");
  });
});

describe("Keystore paths", () => {
  it("builds single keystore path", () => {
    expect(buildKeystorePath("system")).toBe("/api/v1/Keystores('system')");
  });

  it("builds keystore size path", () => {
    expect(buildKeystoreSizePath("system")).toBe(
      "/api/v1/Keystores('system')/Size/$value"
    );
  });

  it("builds keystore resources collection path", () => {
    expect(buildKeystoreResourcesPath()).toBe("/api/v1/KeystoreResources");
  });

  it("builds single keystore resource path", () => {
    expect(buildKeystoreResourcePath("system")).toBe(
      "/api/v1/KeystoreResources('system')"
    );
  });
});

describe("History keystore paths", () => {
  it("builds collection path", () => {
    expect(buildHistoryKeystoreEntriesPath()).toBe("/api/v1/HistoryKeystoreEntries");
  });

  it("builds single entry path", () => {
    expect(buildHistoryKeystoreEntryPath("abc123")).toBe(
      "/api/v1/HistoryKeystoreEntries('abc123')"
    );
  });
});

describe("Certificate-to-user mapping paths", () => {
  it("builds collection path", () => {
    expect(buildCertUserMappingsPath()).toBe("/api/v1/CertificateUserMappings");
  });

  it("builds single mapping path", () => {
    expect(buildCertUserMappingPath("mapping-001")).toBe(
      "/api/v1/CertificateUserMappings('mapping-001')"
    );
  });

  it("escapes single quotes in mapping id", () => {
    expect(buildCertUserMappingPath("map'id")).toBe(
      "/api/v1/CertificateUserMappings('map''id')"
    );
  });
});

describe("Access policy paths (no quotes around ID)", () => {
  it("builds collection path", () => {
    expect(buildAccessPoliciesPath()).toBe("/api/v1/AccessPolicies");
  });

  it("builds single policy path without quotes", () => {
    expect(buildAccessPolicyPath("42")).toBe("/api/v1/AccessPolicies(42)");
  });
});

describe("Artifact reference paths (no quotes around ID)", () => {
  it("builds collection path", () => {
    expect(buildArtifactReferencesPath()).toBe("/api/v1/ArtifactReferences");
  });

  it("builds single reference path without quotes", () => {
    expect(buildArtifactReferencePath("99")).toBe("/api/v1/ArtifactReferences(99)");
  });
});
