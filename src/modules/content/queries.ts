import { escapeOData } from "../../core/odata-utils.js";

// --- Runtime Artifacts ---
export const buildRuntimeArtifactsPath = () =>
  "/api/v1/IntegrationRuntimeArtifacts";
export const buildRuntimeArtifactPath = (id: string) =>
  `/api/v1/IntegrationRuntimeArtifacts('${escapeOData(id)}')`;
export const buildRuntimeArtifactsCountPath = () =>
  "/api/v1/IntegrationRuntimeArtifacts/$count";
export const buildRuntimeArtifactErrorPath = (id: string) =>
  `/api/v1/IntegrationRuntimeArtifacts('${escapeOData(id)}')/ErrorInformation/$value`;

// --- Integration Packages ---
export const buildPackagesPath = () =>
  "/api/v1/IntegrationPackages";
export const buildPackagePath = (id: string) =>
  `/api/v1/IntegrationPackages('${escapeOData(id)}')`;
export const buildPackageValuePath = (id: string) =>
  `/api/v1/IntegrationPackages('${escapeOData(id)}')/$value`;
export const buildPackageArtifactsPath = (id: string, artifactType: string) =>
  `/api/v1/IntegrationPackages('${escapeOData(id)}')/${artifactType}`;
export const buildCopyPackagePath = () =>
  "/api/v1/CopyIntegrationPackage";

// --- Designtime Artifacts (IFlows) ---
export const buildPackageDesigntimeArtifactsPath = (packageId: string) =>
  `/api/v1/IntegrationPackages('${escapeOData(packageId)}')/IntegrationDesigntimeArtifacts`;
export const buildDesigntimeArtifactsPath = () =>
  "/api/v1/IntegrationDesigntimeArtifacts";
export const buildDesigntimeArtifactPath = (id: string, version = "active") =>
  `/api/v1/IntegrationDesigntimeArtifacts(Id='${escapeOData(id)}',Version='${escapeOData(version)}')`;
export const buildDesigntimeArtifactValuePath = (id: string, version = "active") =>
  `/api/v1/IntegrationDesigntimeArtifacts(Id='${escapeOData(id)}',Version='${escapeOData(version)}')/$value`;
export const buildDeployDesigntimeArtifactPath = () =>
  "/api/v1/DeployIntegrationDesigntimeArtifact";
export const buildValidateDesigntimeArtifactPath = () =>
  "/api/v1/ValidateIntegrationDesigntimeArtifact";
export const buildSaveDesigntimeArtifactVersionPath = () =>
  "/api/v1/IntegrationDesigntimeArtifactSaveAsVersion";

// --- Configurations ---
export const buildConfigurationsPath = (id: string, version = "active") =>
  `/api/v1/IntegrationDesigntimeArtifacts(Id='${escapeOData(id)}',Version='${escapeOData(version)}')/Configurations`;
export const buildConfigurationLinkPath = (id: string, version: string, paramKey: string) =>
  `/api/v1/IntegrationDesigntimeArtifacts(Id='${escapeOData(id)}',Version='${escapeOData(version)}')/$links/Configurations('${escapeOData(paramKey)}')`;

// --- Resources ---
export const buildResourcesPath = (id: string, version = "active") =>
  `/api/v1/IntegrationDesigntimeArtifacts(Id='${escapeOData(id)}',Version='${escapeOData(version)}')/Resources`;
export const buildResourcePath = (id: string, version: string, name: string, resourceType: string) =>
  `/api/v1/IntegrationDesigntimeArtifacts(Id='${escapeOData(id)}',Version='${escapeOData(version)}')/Resources(Name='${escapeOData(name)}',ResourceType='${escapeOData(resourceType)}')`;
export const buildResourceValuePath = (id: string, version: string, name: string, resourceType: string) =>
  `/api/v1/IntegrationDesigntimeArtifacts(Id='${escapeOData(id)}',Version='${escapeOData(version)}')/Resources(Name='${escapeOData(name)}',ResourceType='${escapeOData(resourceType)}')/$value`;

// --- Service Endpoints ---
export const buildServiceEndpointsPath = () => "/api/v1/ServiceEndpoints";
export const buildServiceEndpointsCountPath = () => "/api/v1/ServiceEndpoints/$count";

// --- Build & Deploy Status ---
export const buildDeployStatusPath = (taskId: string) =>
  `/api/v1/BuildAndDeployStatus(TaskId='${escapeOData(taskId)}')`;

// --- Value Mappings ---
export const buildValueMappingsPath = () => "/api/v1/ValueMappingDesigntimeArtifacts";
export const buildValueMappingPath = (id: string, version = "active") =>
  `/api/v1/ValueMappingDesigntimeArtifacts(Id='${escapeOData(id)}',Version='${escapeOData(version)}')`;
export const buildValueMappingValuePath = (id: string, version = "active") =>
  `/api/v1/ValueMappingDesigntimeArtifacts(Id='${escapeOData(id)}',Version='${escapeOData(version)}')/$value`;
export const buildValueMappingSchemaPath = (id: string, version = "active") =>
  `/api/v1/ValueMappingDesigntimeArtifacts(Id='${escapeOData(id)}',Version='${escapeOData(version)}')/ValMapSchema`;
export const buildDeployValueMappingPath = () => "/api/v1/DeployValueMappingDesigntimeArtifact";
export const buildSaveValueMappingVersionPath = () => "/api/v1/ValueMappingDesigntimeArtifactSaveAsVersion";
export const buildUpsertValMapsPath = () => "/api/v1/UpsertValMaps";
export const buildUpdateDefaultValMapPath = () => "/api/v1/UpdateDefaultValMap";
export const buildDeleteValMapsPath = () => "/api/v1/DeleteValMaps";

// --- Message Mappings ---
export const buildMessageMappingsPath = () => "/api/v1/MessageMappingDesigntimeArtifacts";
export const buildMessageMappingPath = (id: string, version = "active") =>
  `/api/v1/MessageMappingDesigntimeArtifacts(Id='${escapeOData(id)}',Version='${escapeOData(version)}')`;
export const buildMessageMappingValuePath = (id: string, version = "active") =>
  `/api/v1/MessageMappingDesigntimeArtifacts(Id='${escapeOData(id)}',Version='${escapeOData(version)}')/$value`;
export const buildDeployMessageMappingPath = () => "/api/v1/DeployMessageMappingDesigntimeArtifact";
export const buildSaveMessageMappingVersionPath = () => "/api/v1/MessageMappingDesigntimeArtifactSaveAsVersion";

// --- Script Collections ---
export const buildPackageScriptCollectionsPath = (packageId: string) =>
  `/api/v1/IntegrationPackages('${escapeOData(packageId)}')/ScriptCollectionDesigntimeArtifacts`;
export const buildScriptCollectionPath = (id: string, version = "active") =>
  `/api/v1/ScriptCollectionDesigntimeArtifacts(Id='${escapeOData(id)}',Version='${escapeOData(version)}')`;
export const buildScriptCollectionValuePath = (id: string, version = "active") =>
  `/api/v1/ScriptCollectionDesigntimeArtifacts(Id='${escapeOData(id)}',Version='${escapeOData(version)}')/$value`;
export const buildDeployScriptCollectionPath = () => "/api/v1/DeployScriptCollectionDesigntimeArtifact";
export const buildSaveScriptCollectionVersionPath = () => "/api/v1/ScriptCollectionDesigntimeArtifactSaveAsVersion";

// --- Design Guidelines ---
export const buildGuidelineResultsPath = (artifactType: "iflow" | "script_collection", id: string, version = "active") => {
  const entity = artifactType === "iflow" ? "IntegrationDesigntimeArtifacts" : "ScriptCollectionDesigntimeArtifacts";
  return `/api/v1/${entity}(Id='${escapeOData(id)}',Version='${escapeOData(version)}')/DesignGuidelineExecutionResults`;
};
export const buildGuidelineResultPath = (artifactType: "iflow" | "script_collection", id: string, version: string, executionId: string) => {
  const entity = artifactType === "iflow" ? "IntegrationDesigntimeArtifacts" : "ScriptCollectionDesigntimeArtifacts";
  return `/api/v1/${entity}(Id='${escapeOData(id)}',Version='${escapeOData(version)}')/DesignGuidelineExecutionResults('${escapeOData(executionId)}')`;
};
export const buildGuidelineResultValuePath = (id: string, version: string, executionId: string) =>
  `/api/v1/IntegrationDesigntimeArtifacts(Id='${escapeOData(id)}',Version='${escapeOData(version)}')/DesignGuidelineExecutionResults('${escapeOData(executionId)}')/$value`;
export const buildScriptCollectionGuidelineResultValuePath = (id: string, version: string, executionId: string) =>
  `/api/v1/ScriptCollectionDesigntimeArtifacts(Id='${escapeOData(id)}',Version='${escapeOData(version)}')/DesignGuidelineExecutionResults('${escapeOData(executionId)}')/$value`;
export const buildExecuteGuidelinesPath = (artifactType: "iflow" | "script_collection") =>
  artifactType === "iflow"
    ? "/api/v1/ExecuteIntegrationDesigntimeArtifactsGuidelines"
    : "/api/v1/ExecuteScriptCollectionDesigntimeArtifactsGuidelines";

// --- Custom Tags ---
export const buildCustomTagsConfigValuePath = () =>
  "/api/v1/CustomTagConfigurations('CustomTags')/$value";
export const buildCustomTagsConfigsPath = () =>
  "/api/v1/CustomTagConfigurations";

// --- Configurations Count ---
export const buildConfigurationsCountPath = (id: string, version = "active") =>
  `/api/v1/IntegrationDesigntimeArtifacts(Id='${escapeOData(id)}',Version='${escapeOData(version)}')/Configurations/$count`;

// --- Resources Count ---
export const buildResourcesCountPath = (id: string, version = "active") =>
  `/api/v1/IntegrationDesigntimeArtifacts(Id='${escapeOData(id)}',Version='${escapeOData(version)}')/Resources/$count`;

// --- Type Artifacts (shared pattern) ---
export const buildTypeArtifactsPath = (artifactType: string) =>
  `/api/v1/${artifactType}`;
export const buildTypeArtifactPath = (artifactType: string, id: string, version = "active") =>
  `/api/v1/${artifactType}(Id='${escapeOData(id)}',Version='${escapeOData(version)}')`;
export const buildTypeArtifactValuePath = (artifactType: string, id: string, version = "active") =>
  `/api/v1/${artifactType}(Id='${escapeOData(id)}',Version='${escapeOData(version)}')/$value`;

// --- Integration Adapters ---
export const buildAdaptersPath = () => "/api/v1/IntegrationAdapterDesigntimeArtifacts";
export const buildAdapterPath = (id: string) =>
  `/api/v1/IntegrationAdapterDesigntimeArtifacts(Id='${escapeOData(id)}')`;
export const buildDeployAdapterPath = () => "/api/v1/DeployIntegrationAdapterDesigntimeArtifact";

// --- Package Artifact Navigation ---
export const buildPackageDesigntimeArtifactPath = (packageId: string, artifactId: string, version = "active") =>
  `/api/v1/IntegrationPackages('${escapeOData(packageId)}')/IntegrationDesigntimeArtifacts(Id='${escapeOData(artifactId)}',Version='${escapeOData(version)}')`;
export const buildPackageMessageMappingsPath = (packageId: string) =>
  `/api/v1/IntegrationPackages('${escapeOData(packageId)}')/MessageMappingDesigntimeArtifacts`;
export const buildPackageMessageMappingPath = (packageId: string, artifactId: string, version = "active") =>
  `/api/v1/IntegrationPackages('${escapeOData(packageId)}')/MessageMappingDesigntimeArtifacts(Id='${escapeOData(artifactId)}',Version='${escapeOData(version)}')`;
export const buildPackageValueMappingsPath = (packageId: string) =>
  `/api/v1/IntegrationPackages('${escapeOData(packageId)}')/ValueMappingDesigntimeArtifacts`;
export const buildPackageValueMappingPath = (packageId: string, artifactId: string, version = "active") =>
  `/api/v1/IntegrationPackages('${escapeOData(packageId)}')/ValueMappingDesigntimeArtifacts(Id='${escapeOData(artifactId)}',Version='${escapeOData(version)}')`;
export const buildPackageScriptCollectionPath = (packageId: string, artifactId: string, version = "active") =>
  `/api/v1/IntegrationPackages('${escapeOData(packageId)}')/ScriptCollectionDesigntimeArtifacts(Id='${escapeOData(artifactId)}',Version='${escapeOData(version)}')`;
export const buildPackageCustomTagsPath = (packageId: string) =>
  `/api/v1/IntegrationPackages('${escapeOData(packageId)}')/CustomTags`;
export const buildPackageMessageTypesPath = (packageId: string) =>
  `/api/v1/IntegrationPackages('${escapeOData(packageId)}')/MessageTypeDesigntimeArtifacts`;
export const buildPackageFaultMessageTypesPath = (packageId: string) =>
  `/api/v1/IntegrationPackages('${escapeOData(packageId)}')/FaultMessageTypeDesigntimeArtifacts`;
export const buildPackageDataTypesPath = (packageId: string) =>
  `/api/v1/IntegrationPackages('${escapeOData(packageId)}')/DataTypeDesigntimeArtifacts`;
export const buildPackageServiceInterfacesPath = (packageId: string) =>
  `/api/v1/IntegrationPackages('${escapeOData(packageId)}')/ServiceInterfaceDesigntimeArtifacts`;

// --- MDI Delta Token ---
export const buildMdiDeltaTokenPath = (operation: string, entity: string, version: string) =>
  `/api/v1/MDIDeltaToken(Operation='${escapeOData(operation)}',Entity='${escapeOData(entity)}',Version='${escapeOData(version)}')`;
