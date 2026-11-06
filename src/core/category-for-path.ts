import type { RateCategory } from "./rate-limiter.js";

/**
 * Maps a top-level OData entity (the segment after `/api/v1/`) to the SAP
 * rate-limit category that governs it. The mapping is derived from an inventory
 * of every `/api/v1/...` path used across the modules.
 *
 * Anything not listed here falls back to `"default"` (the smallest limit), so a
 * newly added, un-inventoried path is never accidentally left ungoverned.
 *
 * NOTE: SAP's public rate-limit table is coarse and does not enumerate every
 * entity. Monitoring-domain reads (message store, data store, variables, logs,
 * ID mapper, idempotent repo, archiving, B2B monitoring) are grouped under
 * `"mpl"` as a best-effort assumption; the reactive 429 handling in ODataClient
 * is the safety net should any of these be throttled more tightly server-side.
 */
const ENTITY_CATEGORY: Record<string, RateCategory> = {
  // --- Message Processing Logs / monitoring / tracing (MPL, 100/s per user) ---
  MessageProcessingLogs: "mpl",
  MessageProcessingLogRuns: "mpl",
  MessageProcessingLogRunSteps: "mpl",
  TraceMessages: "mpl",
  // Message store
  MessageStoreEntries: "mpl",
  MessageStoreEntryAttachments: "mpl",
  MessageStoreEntryAttachmentProperties: "mpl",
  MessageStoreEntryProperties: "mpl",
  // Data store & variables
  DataStores: "mpl",
  DataStoreEntries: "mpl",
  Variables: "mpl",
  JmsBrokers: "mpl",
  // ID mapper
  IdMapFromIds: "mpl",
  IdMapToIds: "mpl",
  // Idempotent repository
  GenericIdempotentRepositoryEntries: "mpl",
  IdempotentRepositoryEntries: "mpl",
  // External logging
  ExternalLoggingActivationStatus: "mpl",
  activateExternalLogging: "mpl",
  deactivateExternalLogging: "mpl",
  // Message-level archiving
  ArchivingConfigurations: "mpl",
  ArchivingKeyPerformanceIndicators: "mpl",
  activateArchivingConfiguration: "mpl",
  // Log files
  LogFiles: "mpl",
  LogFileArchives: "mpl",
  // B2B monitoring & archiving
  OrphanedInterchanges: "mpl",
  BusinessDocuments: "mpl",
  BusinessDocumentPayloads: "mpl",
  TechnicalAcknowledgements: "mpl",
  FunctionalAcknowledgements: "mpl",
  B2BArchivingConfigurations: "mpl",
  B2BArchivingKeyPerformanceIndicators: "mpl",
  activateB2BArchivingConfiguration: "mpl",

  // --- Design time artifacts (10/s per user) ---
  IntegrationPackages: "designtime",
  CopyIntegrationPackage: "designtime",
  IntegrationDesigntimeArtifacts: "designtime",
  IntegrationDesigntimeArtifactSaveAsVersion: "designtime",
  IntegrationAdapterDesigntimeArtifacts: "designtime",
  MessageMappingDesigntimeArtifacts: "designtime",
  MessageMappingDesigntimeArtifactSaveAsVersion: "designtime",
  ValueMappingDesigntimeArtifacts: "designtime",
  ValueMappingDesigntimeArtifactSaveAsVersion: "designtime",
  ScriptCollectionDesigntimeArtifacts: "designtime",
  ScriptCollectionDesigntimeArtifactSaveAsVersion: "designtime",
  DeployIntegrationDesigntimeArtifact: "designtime",
  DeployIntegrationAdapterDesigntimeArtifact: "designtime",
  DeployMessageMappingDesigntimeArtifact: "designtime",
  DeployScriptCollectionDesigntimeArtifact: "designtime",
  DeployValueMappingDesigntimeArtifact: "designtime",
  ValidateIntegrationDesigntimeArtifact: "designtime",
  ExecuteIntegrationDesigntimeArtifactsGuidelines: "designtime",
  ExecuteScriptCollectionDesigntimeArtifactsGuidelines: "designtime",
  CustomTagConfigurations: "designtime",
  ArtifactReferences: "designtime",
  MDIDeltaToken: "designtime",
  DeleteValMaps: "designtime",
  UpsertValMaps: "designtime",
  UpdateDefaultValMap: "designtime",

  // --- Runtime artifacts (50/s per user) ---
  IntegrationRuntimeArtifacts: "runtime",
  BuildAndDeployStatus: "runtime",
  ServiceEndpoints: "runtime",

  // --- Security content (10/s per user) ---
  UserCredentials: "security",
  OAuth2ClientCredentials: "security",
  SecureParameters: "security",
  Keystores: "security",
  KeystoreEntries: "security",
  KeystoreResources: "security",
  HistoryKeystoreEntries: "security",
  CertificateResources: "security",
  CertificateChainResources: "security",
  KeyPairGenerationRequests: "security",
  KeyPairResources: "security",
  RSAKeyGenerationRequests: "security",
  SSHKeyGenerationRequests: "security",
  CertificateUserMappings: "security",
  AccessPolicies: "security",

  // --- Number range (5/s per user) ---
  NumberRanges: "numberRange",
};

const ENTITY_RE = /\/api\/v1\/([A-Za-z0-9_]+)/;

/**
 * Determines the rate-limit category for an OData request path.
 * The CSRF-token fetch (`GET /api/v1/`) has no entity segment and is
 * categorised by the caller as `"csrf"`; here it falls back to `"default"`.
 */
export function categoryForPath(path: string): RateCategory {
  const entity = ENTITY_RE.exec(path)?.[1];
  if (!entity) return "default";
  return ENTITY_CATEGORY[entity] ?? "default";
}
