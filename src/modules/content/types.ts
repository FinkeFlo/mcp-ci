export interface IntegrationRuntimeArtifact {
  Id: string | null;
  Version: string | null;
  Name: string | null;
  Type: string | null;
  DeployedBy: string | null;
  DeployedOn: string | null;
  Status: string | null;
}

export interface IntegrationPackage {
  Id: string;
  Name: string;
  Description: string | null;
  ShortText: string;
  Version: string | null;
  Vendor: string | null;
  Mode: string | null;
  SupportedPlatform: string | null;
  ModifiedBy: string | null;
  CreationDate: string | null;
  ModifiedDate: string | null;
  CreatedBy: string | null;
  Products: string | null;
  Keywords: string | null;
  Countries: string | null;
  Industries: string | null;
  LineOfBusiness: string | null;
}

export interface IntegrationDesigntimeArtifact {
  Id: string | null;
  Version: string | null;
  PackageId: string | null;
  Name: string | null;
  Description: string | null;
  ArtifactContent: string | null;
}

export interface Configuration {
  ParameterKey: string;
  ParameterValue: string;
  DataType: string;
  Description: string;
}

export interface Resource {
  Name: string;
  ResourceType: string;
  ReferencedResourceType: string | null;
  ResourceContent: string | null;
}

export interface ServiceEndpoint {
  Name: string | null;
  Id: string;
  Title: string;
  Version: string;
  Summary: string;
  Description: string;
  LastUpdated: string | null;
  Protocol: string;
}

export interface EntryPoint {
  Name: string;
  Url: string;
  Type: string | null;
  AdditionalInformation: string | null;
}

export interface ApiDefinition {
  Url: string;
  Name: string;
}

export interface BuildAndDeployStatus {
  TaskId: string;
  Status: string;
}

export interface ValueMappingDesigntimeArtifact {
  Id: string;
  Version: string;
  PackageId: string;
  Name: string;
  Description: string;
  ArtifactContent: string | null;
}

export interface ValMapSchema {
  SrcAgency: string;
  SrcId: string;
  TgtAgency: string;
  TgtId: string;
  State: string | null;
}

export interface MessageMappingDesigntimeArtifact {
  Id: string | null;
  Version: string | null;
  PackageId: string | null;
  Name: string | null;
  Description: string | null;
  ArtifactContent: string | null;
}

export interface ScriptCollectionDesigntimeArtifact {
  Id: string | null;
  Version: string | null;
  PackageId: string | null;
  Name: string | null;
  Description: string | null;
  ArtifactContent: string | null;
}

export interface CustomTagsConfigEntry {
  tagName: string;
  isMandatory: boolean;
  permittedValues?: string[];
}

export interface MessageTypeDesigntimeArtifact {
  Id: string | null;
  Version: string | null;
  PackageId: string | null;
  Name: string | null;
  Description: string | null;
  Namespace: string | null;
}

export interface DataTypeDesigntimeArtifact {
  Id: string | null;
  Version: string | null;
  PackageId: string | null;
  Name: string | null;
  Description: string | null;
  Namespace: string | null;
}

export interface FaultMessageTypeDesigntimeArtifact {
  Id: string | null;
  Version: string | null;
  PackageId: string | null;
  Name: string | null;
  Description: string | null;
  Namespace: string | null;
}

export interface ServiceInterfaceDesigntimeArtifact {
  Id: string | null;
  Version: string | null;
  PackageId: string | null;
  Name: string | null;
  Description: string | null;
  Namespace: string | null;
}

export interface DesignGuidelineExecutionResult {
  ExecutionId: string;
  ExecutionStatus: string;
  ExecutionTime: string | null;
  ArtifactVersion: string | null;
  GuidelineId: string | null;
  GuidelineName: string | null;
  Category: string | null;
  Severity: string | null;
  Applicability: string | null;
  Compliance: string | null;
}

export interface MdiDeltaToken {
  Operation: string;
  Entity: string;
  Version: string;
  DeltaToken: string | null;
  LastUpdateTimestamp: string | null;
}
