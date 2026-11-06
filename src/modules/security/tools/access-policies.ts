import type { McpServer } from "@modelcontextprotocol/server";
import * as z from "zod/v4";
import type { ModuleContext } from "../../../core/types.js";
import type {
  CertificateUserMapping,
  AccessPolicy,
  ArtifactReference,
} from "../types.js";
import {
  buildCertUserMappingsPath,
  buildCertUserMappingPath,
  buildAccessPoliciesPath,
  buildAccessPolicyPath,
  buildArtifactReferencesPath,
  buildArtifactReferencePath,
} from "../queries.js";

function parseODataDate(value: string | null): string {
  if (!value) return "n/a";
  const match = value.match(/\/Date\((\d+)\)\//);
  if (match) return new Date(parseInt(match[1])).toISOString();
  return value;
}

function formatCertUserMappingSummary(m: CertificateUserMapping): string {
  const cert = m.Certificate
    ? m.Certificate.length > 50
      ? m.Certificate.slice(0, 50) + "..."
      : m.Certificate
    : "n/a";
  const lines: string[] = [];
  lines.push(`Id: ${m.Id ?? "n/a"}`);
  lines.push(`User: ${m.User ?? "n/a"}`);
  lines.push(`Certificate: ${cert}`);
  lines.push(`LastModifiedBy: ${m.LastModifiedBy ?? "n/a"}`);
  lines.push(`LastModifiedTime: ${parseODataDate(m.LastModifiedTime)}`);
  return lines.join("\n");
}

function formatCertUserMappingDetail(m: CertificateUserMapping): string {
  const cert = m.Certificate
    ? m.Certificate.length > 50
      ? m.Certificate.slice(0, 50) + "..."
      : m.Certificate
    : "n/a";
  const lines: string[] = [];
  lines.push(`Id: ${m.Id ?? "n/a"}`);
  lines.push(`User: ${m.User ?? "n/a"}`);
  lines.push(`Certificate: ${cert}`);
  lines.push(`LastModifiedBy: ${m.LastModifiedBy ?? "n/a"}`);
  lines.push(`LastModifiedTime: ${parseODataDate(m.LastModifiedTime)}`);
  lines.push(`CreatedBy: ${m.CreatedBy ?? "n/a"}`);
  lines.push(`CreatedTime: ${parseODataDate(m.CreatedTime)}`);
  lines.push(`ValidUntil: ${parseODataDate(m.ValidUntil)}`);
  return lines.join("\n");
}

function formatAccessPolicySummary(p: AccessPolicy): string {
  const lines: string[] = [];
  lines.push(`Id: ${p.Id ?? "n/a"}`);
  lines.push(`RoleName: ${p.RoleName ?? "n/a"}`);
  lines.push(`Description: ${p.Description ?? "n/a"}`);
  return lines.join("\n");
}

function formatArtifactReferenceSummary(r: ArtifactReference): string {
  const lines: string[] = [];
  lines.push(`Id: ${r.Id ?? "n/a"}`);
  lines.push(`Name: ${r.Name ?? "n/a"}`);
  lines.push(`Description: ${r.Description ?? "n/a"}`);
  lines.push(`Type: ${r.Type ?? "n/a"}`);
  lines.push(`ConditionAttribute: ${r.ConditionAttribute ?? "n/a"}`);
  lines.push(`ConditionValue: ${r.ConditionValue ?? "n/a"}`);
  lines.push(`ConditionType: ${r.ConditionType ?? "n/a"}`);
  return lines.join("\n");
}

export function registerAccessPolicyTools(
  server: McpServer,
  context: ModuleContext
) {
  // ─── Certificate-to-User Mappings (Neo only) ───

  // @api GET /CertificateUserMappings
  server.registerTool(
    "list_cert_user_mappings",
    {
      description:
        "List certificate-to-user mappings on the active SAP Cloud Integration tenant. Neo environment only.",
      inputSchema: z.object({
        filter: z
          .string()
          .optional()
          .describe("OData $filter expression, e.g. \"User eq 'supplier1'\""),
        orderby: z
          .string()
          .optional()
          .describe("OData $orderby expression"),
        select: z
          .string()
          .optional()
          .describe("OData $select expression"),
      }),
    },
    async ({ filter, orderby, select }) => {
      try {
        const mappings =
          await context.odataClient.getCollection<CertificateUserMapping>(
            buildCertUserMappingsPath(),
            { $filter: filter, $orderby: orderby, $select: select }
          );
        if (mappings.length === 0) {
          return {
            content: [
              {
                type: "text" as const,
                text: "No certificate-to-user mappings found.",
              },
            ],
          };
        }
        const text = mappings.map(formatCertUserMappingSummary).join("\n\n");
        return {
          content: [{ type: "text" as const, text }],
        };
      } catch (error) {
        return {
          isError: true,
          content: [
            { type: "text" as const, text: (error as Error).message },
          ],
        };
      }
    }
  );

  // @api GET /CertificateUserMappings('{Id}')
  server.registerTool(
    "get_cert_user_mapping",
    {
      description:
        "Get details of a specific certificate-to-user mapping by its ID. Neo environment only.",
      inputSchema: z.object({
        id: z.string().describe("The certificate-to-user mapping ID"),
      }),
    },
    async ({ id }) => {
      try {
        const mapping =
          await context.odataClient.getEntity<CertificateUserMapping>(
            buildCertUserMappingPath(id)
          );
        const text = formatCertUserMappingDetail(mapping);
        return {
          content: [{ type: "text" as const, text }],
        };
      } catch (error) {
        return {
          isError: true,
          content: [
            { type: "text" as const, text: (error as Error).message },
          ],
        };
      }
    }
  );

  // @api POST /CertificateUserMappings
  server.registerTool(
    "create_cert_user_mapping",
    {
      description:
        "Create a certificate-to-user mapping. Neo environment only. Without confirm, shows a preview. Set confirm to true to execute.",
      inputSchema: z.object({
        user: z.string().describe("The user to map the certificate to"),
        certificate: z
          .string()
          .describe("Base64-encoded PEM-DER certificate"),
        confirm: z
          .boolean()
          .optional()
          .describe(
            "Set to true to actually create the certificate-to-user mapping"
          ),
      }),
    },
    async ({ user, certificate, confirm }) => {
      try {
        if (!confirm) {
          const certPreview =
            certificate.length > 50
              ? certificate.slice(0, 50) + "..."
              : certificate;
          const lines: string[] = [];
          lines.push("Certificate-to-user mapping to create:");
          lines.push("");
          lines.push(`User: ${user}`);
          lines.push(`Certificate: ${certPreview}`);
          lines.push("");
          lines.push("Set confirm to true to proceed.");
          return {
            content: [{ type: "text" as const, text: lines.join("\n") }],
          };
        }
        await context.odataClient.post(buildCertUserMappingsPath(), {
          User: user,
          Certificate: certificate,
        });
        return {
          content: [
            {
              type: "text" as const,
              text: `Certificate-to-user mapping for user '${user}' created successfully.`,
            },
          ],
        };
      } catch (error) {
        return {
          isError: true,
          content: [
            { type: "text" as const, text: (error as Error).message },
          ],
        };
      }
    }
  );

  // @api GET /CertificateUserMappings('{Id}')
  // @api DELETE /CertificateUserMappings('{Id}')
  server.registerTool(
    "delete_cert_user_mapping",
    {
      description:
        "Delete a certificate-to-user mapping. Neo environment only. Without confirm, shows a preview. Set confirm to true to execute.",
      inputSchema: z.object({
        id: z
          .string()
          .describe("The certificate-to-user mapping ID to delete"),
        confirm: z
          .boolean()
          .optional()
          .describe(
            "Set to true to actually delete the certificate-to-user mapping"
          ),
      }),
    },
    async ({ id, confirm }) => {
      try {
        if (!confirm) {
          const mapping =
            await context.odataClient.getEntity<CertificateUserMapping>(
              buildCertUserMappingPath(id)
            );
          const preview = formatCertUserMappingDetail(mapping);
          return {
            content: [
              {
                type: "text" as const,
                text: `Certificate-to-user mapping to delete:\n\n${preview}\n\nSet confirm to true to proceed.`,
              },
            ],
          };
        }
        await context.odataClient.delete(buildCertUserMappingPath(id));
        return {
          content: [
            {
              type: "text" as const,
              text: `Certificate-to-user mapping '${id}' deleted successfully.`,
            },
          ],
        };
      } catch (error) {
        return {
          isError: true,
          content: [
            { type: "text" as const, text: (error as Error).message },
          ],
        };
      }
    }
  );

  // ─── Access Policies ───

  // @api GET /AccessPolicies
  server.registerTool(
    "list_access_policies",
    {
      description:
        "List access policies on the active SAP Cloud Integration tenant.",
      inputSchema: z.object({
        filter: z
          .string()
          .optional()
          .describe("OData $filter expression"),
        orderby: z
          .string()
          .optional()
          .describe("OData $orderby expression"),
        select: z
          .string()
          .optional()
          .describe("OData $select expression"),
        expand: z
          .string()
          .optional()
          .describe(
            "OData $expand expression, e.g. 'ArtifactReferences'"
          ),
        top: z
          .number()
          .optional()
          .describe("Maximum number of results to return"),
        skip: z
          .number()
          .optional()
          .describe("Number of results to skip (for pagination)"),
        inlinecount: z
          .string()
          .optional()
          .describe(
            "OData $inlinecount option, e.g. 'allpages' to include total count"
          ),
      }),
    },
    async ({ filter, orderby, select, expand, top, skip, inlinecount }) => {
      try {
        const policies =
          await context.odataClient.getCollection<AccessPolicy>(
            buildAccessPoliciesPath(),
            {
              $filter: filter,
              $orderby: orderby,
              $select: select,
              $expand: expand,
              $top: top,
              $skip: skip,
              $inlinecount: inlinecount,
            }
          );
        if (policies.length === 0) {
          return {
            content: [
              { type: "text" as const, text: "No access policies found." },
            ],
          };
        }
        const text = policies.map(formatAccessPolicySummary).join("\n\n");
        return {
          content: [{ type: "text" as const, text }],
        };
      } catch (error) {
        return {
          isError: true,
          content: [
            { type: "text" as const, text: (error as Error).message },
          ],
        };
      }
    }
  );

  // @api POST /AccessPolicies
  server.registerTool(
    "create_access_policy",
    {
      description:
        "Create an access policy. Without confirm, shows a preview. Set confirm to true to execute.",
      inputSchema: z.object({
        roleName: z.string().describe("The role name for the access policy"),
        description: z
          .string()
          .optional()
          .describe("Description of the access policy"),
        artifactReferences: z
          .array(
            z.object({
              Name: z.string().describe("Artifact reference name"),
              Description: z
                .string()
                .optional()
                .describe("Artifact reference description"),
              Type: z.string().describe("Artifact type"),
              ConditionAttribute: z
                .string()
                .describe("Condition attribute"),
              ConditionValue: z.string().describe("Condition value"),
              ConditionType: z.string().describe("Condition type"),
            })
          )
          .optional()
          .describe("Array of artifact references to include"),
        confirm: z
          .boolean()
          .optional()
          .describe("Set to true to actually create the access policy"),
      }),
    },
    async ({ roleName, description, artifactReferences, confirm }) => {
      try {
        if (!confirm) {
          const lines: string[] = [];
          lines.push("Access policy to create:");
          lines.push("");
          lines.push(`RoleName: ${roleName}`);
          lines.push(`Description: ${description ?? "n/a"}`);
          if (artifactReferences && artifactReferences.length > 0) {
            lines.push(`ArtifactReferences: ${artifactReferences.length} reference(s)`);
            for (const ref of artifactReferences) {
              lines.push(`  - Name: ${ref.Name}, Type: ${ref.Type}, ConditionValue: ${ref.ConditionValue}`);
            }
          } else {
            lines.push("ArtifactReferences: none");
          }
          lines.push("");
          lines.push("Set confirm to true to proceed.");
          return {
            content: [{ type: "text" as const, text: lines.join("\n") }],
          };
        }
        const body: Record<string, unknown> = { RoleName: roleName };
        if (description !== undefined) body.Description = description;
        if (artifactReferences !== undefined)
          body.ArtifactReferences = artifactReferences;
        await context.odataClient.post(buildAccessPoliciesPath(), body);
        return {
          content: [
            {
              type: "text" as const,
              text: `Access policy '${roleName}' created successfully.`,
            },
          ],
        };
      } catch (error) {
        return {
          isError: true,
          content: [
            { type: "text" as const, text: (error as Error).message },
          ],
        };
      }
    }
  );

  // @api GET /AccessPolicies({Id})
  // @api PATCH /AccessPolicies({Id})
  server.registerTool(
    "update_access_policy",
    {
      description:
        "Update an existing access policy. Without confirm, shows a preview of changes. Set confirm to true to execute.",
      inputSchema: z.object({
        id: z.string().describe("The access policy ID (numeric)"),
        roleName: z
          .string()
          .optional()
          .describe("New role name for the access policy"),
        description: z
          .string()
          .optional()
          .describe("New description for the access policy"),
        confirm: z
          .boolean()
          .optional()
          .describe("Set to true to actually update the access policy"),
      }),
    },
    async ({ id, roleName, description, confirm }) => {
      try {
        if (!confirm) {
          const policy =
            await context.odataClient.getEntity<AccessPolicy>(
              buildAccessPolicyPath(id)
            );
          const lines: string[] = [];
          lines.push("Access policy to update:");
          lines.push("");
          lines.push(formatAccessPolicySummary(policy));
          lines.push("");
          lines.push("Proposed changes:");
          if (roleName !== undefined)
            lines.push(`  RoleName: ${policy.RoleName} -> ${roleName}`);
          if (description !== undefined)
            lines.push(
              `  Description: ${policy.Description} -> ${description}`
            );
          lines.push("");
          lines.push("Set confirm to true to proceed.");
          return {
            content: [{ type: "text" as const, text: lines.join("\n") }],
          };
        }
        const body: Record<string, unknown> = {};
        if (roleName !== undefined) body.RoleName = roleName;
        if (description !== undefined) body.Description = description;
        await context.odataClient.put(buildAccessPolicyPath(id), body);
        return {
          content: [
            {
              type: "text" as const,
              text: `Access policy '${id}' updated successfully.`,
            },
          ],
        };
      } catch (error) {
        return {
          isError: true,
          content: [
            { type: "text" as const, text: (error as Error).message },
          ],
        };
      }
    }
  );

  // @api GET /AccessPolicies({Id})
  // @api DELETE /AccessPolicies({Id})
  server.registerTool(
    "delete_access_policy",
    {
      description:
        "Delete an access policy. Without confirm, shows a preview. Set confirm to true to execute.",
      inputSchema: z.object({
        id: z.string().describe("The access policy ID (numeric) to delete"),
        confirm: z
          .boolean()
          .optional()
          .describe("Set to true to actually delete the access policy"),
      }),
    },
    async ({ id, confirm }) => {
      try {
        if (!confirm) {
          const policy =
            await context.odataClient.getEntity<AccessPolicy>(
              buildAccessPolicyPath(id)
            );
          const preview = formatAccessPolicySummary(policy);
          return {
            content: [
              {
                type: "text" as const,
                text: `Access policy to delete:\n\n${preview}\n\nSet confirm to true to proceed.`,
              },
            ],
          };
        }
        await context.odataClient.delete(buildAccessPolicyPath(id));
        return {
          content: [
            {
              type: "text" as const,
              text: `Access policy '${id}' deleted successfully.`,
            },
          ],
        };
      } catch (error) {
        return {
          isError: true,
          content: [
            { type: "text" as const, text: (error as Error).message },
          ],
        };
      }
    }
  );

  // ─── Artifact References ───

  // @api GET /ArtifactReferences
  server.registerTool(
    "list_artifact_references",
    {
      description:
        "List artifact references on the active SAP Cloud Integration tenant.",
      inputSchema: z.object({
        filter: z
          .string()
          .optional()
          .describe("OData $filter expression"),
        orderby: z
          .string()
          .optional()
          .describe("OData $orderby expression"),
        select: z
          .string()
          .optional()
          .describe("OData $select expression"),
        top: z
          .number()
          .optional()
          .describe("Maximum number of results to return"),
        skip: z
          .number()
          .optional()
          .describe("Number of results to skip (for pagination)"),
        inlinecount: z
          .string()
          .optional()
          .describe(
            "OData $inlinecount option, e.g. 'allpages' to include total count"
          ),
      }),
    },
    async ({ filter, orderby, select, top, skip, inlinecount }) => {
      try {
        const references =
          await context.odataClient.getCollection<ArtifactReference>(
            buildArtifactReferencesPath(),
            {
              $filter: filter,
              $orderby: orderby,
              $select: select,
              $top: top,
              $skip: skip,
              $inlinecount: inlinecount,
            }
          );
        if (references.length === 0) {
          return {
            content: [
              {
                type: "text" as const,
                text: "No artifact references found.",
              },
            ],
          };
        }
        const text = references
          .map(formatArtifactReferenceSummary)
          .join("\n\n");
        return {
          content: [{ type: "text" as const, text }],
        };
      } catch (error) {
        return {
          isError: true,
          content: [
            { type: "text" as const, text: (error as Error).message },
          ],
        };
      }
    }
  );

  // @api POST /ArtifactReferences
  server.registerTool(
    "create_artifact_reference",
    {
      description:
        "Create an artifact reference. Without confirm, shows a preview. Set confirm to true to execute.",
      inputSchema: z.object({
        name: z.string().describe("Artifact reference name"),
        description: z
          .string()
          .optional()
          .describe("Artifact reference description"),
        type: z.string().describe("Artifact type"),
        conditionAttribute: z.string().describe("Condition attribute"),
        conditionValue: z.string().describe("Condition value"),
        conditionType: z.string().describe("Condition type"),
        confirm: z
          .boolean()
          .optional()
          .describe(
            "Set to true to actually create the artifact reference"
          ),
      }),
    },
    async ({
      name,
      description,
      type,
      conditionAttribute,
      conditionValue,
      conditionType,
      confirm,
    }) => {
      try {
        if (!confirm) {
          const lines: string[] = [];
          lines.push("Artifact reference to create:");
          lines.push("");
          lines.push(`Name: ${name}`);
          lines.push(`Description: ${description ?? "n/a"}`);
          lines.push(`Type: ${type}`);
          lines.push(`ConditionAttribute: ${conditionAttribute}`);
          lines.push(`ConditionValue: ${conditionValue}`);
          lines.push(`ConditionType: ${conditionType}`);
          lines.push("");
          lines.push("Set confirm to true to proceed.");
          return {
            content: [{ type: "text" as const, text: lines.join("\n") }],
          };
        }
        const body: Record<string, unknown> = {
          Name: name,
          Type: type,
          ConditionAttribute: conditionAttribute,
          ConditionValue: conditionValue,
          ConditionType: conditionType,
        };
        if (description !== undefined) body.Description = description;
        await context.odataClient.post(buildArtifactReferencesPath(), body);
        return {
          content: [
            {
              type: "text" as const,
              text: `Artifact reference '${name}' created successfully.`,
            },
          ],
        };
      } catch (error) {
        return {
          isError: true,
          content: [
            { type: "text" as const, text: (error as Error).message },
          ],
        };
      }
    }
  );

  // @api GET /ArtifactReferences({Id})
  // @api DELETE /ArtifactReferences({Id})
  server.registerTool(
    "delete_artifact_reference",
    {
      description:
        "Delete an artifact reference. Without confirm, shows a preview. Set confirm to true to execute.",
      inputSchema: z.object({
        id: z
          .string()
          .describe("The artifact reference ID (numeric) to delete"),
        confirm: z
          .boolean()
          .optional()
          .describe(
            "Set to true to actually delete the artifact reference"
          ),
      }),
    },
    async ({ id, confirm }) => {
      try {
        if (!confirm) {
          const reference =
            await context.odataClient.getEntity<ArtifactReference>(
              buildArtifactReferencePath(id)
            );
          const preview = formatArtifactReferenceSummary(reference);
          return {
            content: [
              {
                type: "text" as const,
                text: `Artifact reference to delete:\n\n${preview}\n\nSet confirm to true to proceed.`,
              },
            ],
          };
        }
        await context.odataClient.delete(buildArtifactReferencePath(id));
        return {
          content: [
            {
              type: "text" as const,
              text: `Artifact reference '${id}' deleted successfully.`,
            },
          ],
        };
      } catch (error) {
        return {
          isError: true,
          content: [
            { type: "text" as const, text: (error as Error).message },
          ],
        };
      }
    }
  );
}
