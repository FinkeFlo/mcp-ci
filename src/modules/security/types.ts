export interface SecurityArtifactDescriptor {
  Type: string | null;
  DeployedBy: string | null;
  DeployedOn: string | null;
  Status: string | null;
}

export interface UserCredential {
  Name: string | null;
  Kind: string | null;
  Description: string | null;
  User: string | null;
  Password: string | null;
  CompanyId: string | null;
  SecurityArtifactDescriptor: SecurityArtifactDescriptor | null;
}

export interface SecureParameter {
  Name: string | null;
  Description: string | null;
  SecureParam: string | null;
  DeployedBy: string | null;
  DeployedOn: string | null;
  Status: string | null;
}

export interface OAuth2ClientCredential {
  Name: string | null;
  Description: string | null;
  TokenServiceUrl: string | null;
  ClientId: string | null;
  ClientSecret: string | null;
  ClientAuthentication: string | null;
  Scope: string | null;
  ScopeContentType: string | null;
  Resource: string | null;
  Audience: string | null;
  SecurityArtifactDescriptor: SecurityArtifactDescriptor | null;
}

export interface KeystoreEntry {
  Hexalias: string | null;
  Alias: string | null;
  KeyType: string | null;
  KeySize: number | null;
  ValidNotBefore: string | null;
  ValidNotAfter: string | null;
  SerialNumber: string | null;
  SignatureAlgorithm: string | null;
  EllipticCurve: string | null;
  Validity: string | null;
  SubjectDN: string | null;
  IssuerDN: string | null;
  Version: number | null;
  FingerprintSha1: string | null;
  FingerprintSha256: string | null;
  FingerprintSha512: string | null;
  Type: string | null;
  Owner: string | null;
  LastModifiedBy: string | null;
  LastModifiedTime: string | null;
  CreatedBy: string | null;
  CreatedTime: string | null;
  Status: string | null;
}

export interface HistoryKeystoreEntry extends KeystoreEntry {
  ActivatedBy: string | null;
  ActiveFrom: string | null;
  DeactivatedBy: string | null;
  ActiveUntil: string | null;
  ActivationSequenceNumber: number | null;
  OriginalAlias: string | null;
}

export interface ChainCertificate {
  Hexalias: string | null;
  Alias: string | null;
  Index: number | null;
  Validity: string | null;
  KeyType: string | null;
  KeySize: number | null;
  ValidNotBefore: string | null;
  ValidNotAfter: string | null;
  SubjectDN: string | null;
  IssuerDN: string | null;
  SerialNumber: string | null;
  SignatureAlgorithm: string | null;
  Version: number | null;
  FingerprintSha1: string | null;
  FingerprintSha256: string | null;
  FingerprintSha512: string | null;
}

export interface Keystore {
  Name: string | null;
  LastModifiedBy: string | null;
  LastModifiedTime: string | null;
  Size: number | null;
}

export interface CertificateUserMapping {
  Id: string | null;
  User: string | null;
  Certificate: string | null;
  LastModifiedBy: string | null;
  LastModifiedTime: string | null;
  CreatedBy: string | null;
  CreatedTime: string | null;
  ValidUntil: string | null;
}

export interface AccessPolicy {
  Id: string | null;
  RoleName: string | null;
  Description: string | null;
}

export interface ArtifactReference {
  Id: string | null;
  Name: string | null;
  Description: string | null;
  Type: string | null;
  ConditionAttribute: string | null;
  ConditionValue: string | null;
  ConditionType: string | null;
}
