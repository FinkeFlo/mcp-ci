import { escapeOData } from "../../core/odata-utils.js";

// --- User Credentials ---
export const buildUserCredentialsPath = () => "/api/v1/UserCredentials";
export const buildUserCredentialPath = (name: string) =>
  `/api/v1/UserCredentials('${escapeOData(name)}')`;

// --- Secure Parameters ---
export const buildSecureParametersPath = () => "/api/v1/SecureParameters";
export const buildSecureParameterPath = (name: string) =>
  `/api/v1/SecureParameters('${escapeOData(name)}')`;

// --- OAuth2 Client Credentials ---
export const buildOAuth2CredentialsPath = () => "/api/v1/OAuth2ClientCredentials";
export const buildOAuth2CredentialPath = (name: string) =>
  `/api/v1/OAuth2ClientCredentials('${escapeOData(name)}')`;

// --- Keystore Entries ---
export const buildKeystoreEntriesPath = () => "/api/v1/KeystoreEntries";
export const buildKeystoreEntryPath = (hexalias: string) =>
  `/api/v1/KeystoreEntries('${escapeOData(hexalias)}')`;

// --- Certificates ---
export const buildCertificateValuePath = (hexalias: string) =>
  `/api/v1/CertificateResources('${escapeOData(hexalias)}')/$value`;
export const buildExportCertificatePath = (hexalias: string) =>
  `/api/v1/KeystoreEntries('${escapeOData(hexalias)}')/Certificate/$value`;
export const buildSigningRequestPath = (hexalias: string) =>
  `/api/v1/KeystoreEntries('${escapeOData(hexalias)}')/SigningRequest/$value`;
export const buildCertificateChainValuePath = (hexalias: string) =>
  `/api/v1/CertificateChainResources('${escapeOData(hexalias)}')/$value`;
export const buildChainCertificatesPath = (hexalias: string) =>
  `/api/v1/KeystoreEntries('${escapeOData(hexalias)}')/ChainCertificates`;
export const buildChainResourceValuePath = (hexalias: string) =>
  `/api/v1/KeystoreEntries('${escapeOData(hexalias)}')/ChainResource/$value`;
export const buildSshKeyValuePath = (hexalias: string) =>
  `/api/v1/KeystoreEntries('${escapeOData(hexalias)}')/Sshkey/$value`;

// --- Key Pair Generation ---
export const buildKeyPairGenerationPath = () => "/api/v1/KeyPairGenerationRequests";
export const buildRsaKeyGenerationPath = () => "/api/v1/RSAKeyGenerationRequests";
export const buildSshKeyGenerationPath = () => "/api/v1/SSHKeyGenerationRequests";
export const buildKeyPairResourcesPath = () => "/api/v1/KeyPairResources";

// --- Keystores ---
export const buildKeystorePath = (name: string) =>
  `/api/v1/Keystores('${escapeOData(name)}')`;
export const buildKeystoreSizePath = (name: string) =>
  `/api/v1/Keystores('${escapeOData(name)}')/Size/$value`;
export const buildKeystoreResourcesPath = () => "/api/v1/KeystoreResources";
export const buildKeystoreResourcePath = (name: string) =>
  `/api/v1/KeystoreResources('${escapeOData(name)}')`;

// --- History Keystore ---
export const buildHistoryKeystoreEntriesPath = () => "/api/v1/HistoryKeystoreEntries";
export const buildHistoryKeystoreEntryPath = (hexalias: string) =>
  `/api/v1/HistoryKeystoreEntries('${escapeOData(hexalias)}')`;

// --- Certificate-to-User Mappings ---
export const buildCertUserMappingsPath = () => "/api/v1/CertificateUserMappings";
export const buildCertUserMappingPath = (id: string) =>
  `/api/v1/CertificateUserMappings('${escapeOData(id)}')`;

// --- Access Policies ---
export const buildAccessPoliciesPath = () => "/api/v1/AccessPolicies";
export const buildAccessPolicyPath = (id: string) =>
  `/api/v1/AccessPolicies(${escapeOData(id)})`;

// --- Artifact References ---
export const buildArtifactReferencesPath = () => "/api/v1/ArtifactReferences";
export const buildArtifactReferencePath = (id: string) =>
  `/api/v1/ArtifactReferences(${escapeOData(id)})`;
