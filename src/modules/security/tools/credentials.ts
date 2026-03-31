import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import * as z from "zod/v4";
import type { ModuleContext } from "../../../core/types.js";
import type {
  UserCredential,
  SecureParameter,
  OAuth2ClientCredential,
} from "../types.js";
import {
  buildUserCredentialsPath,
  buildUserCredentialPath,
  buildSecureParametersPath,
  buildSecureParameterPath,
  buildOAuth2CredentialsPath,
  buildOAuth2CredentialPath,
} from "../queries.js";

function parseODataDate(value: string | null): string {
  if (!value) return "n/a";
  const match = value.match(/\/Date\((\d+)\)\//);
  if (match) return new Date(parseInt(match[1])).toISOString();
  return value;
}

function formatUserCredentialSummary(c: UserCredential): string {
  const lines: string[] = [];
  lines.push(`Name: ${c.Name ?? "n/a"}`);
  lines.push(`Kind: ${c.Kind ?? "n/a"}`);
  lines.push(`User: ${c.User ?? "n/a"}`);
  lines.push(
    `Status: ${c.SecurityArtifactDescriptor?.Status ?? "n/a"}`
  );
  lines.push(
    `DeployedOn: ${parseODataDate(c.SecurityArtifactDescriptor?.DeployedOn ?? null)}`
  );
  return lines.join("\n");
}

function formatUserCredentialDetail(c: UserCredential): string {
  const lines: string[] = [];
  lines.push(`Name: ${c.Name ?? "n/a"}`);
  lines.push(`Kind: ${c.Kind ?? "n/a"}`);
  lines.push(`Description: ${c.Description ?? "n/a"}`);
  lines.push(`User: ${c.User ?? "n/a"}`);
  lines.push(`CompanyId: ${c.CompanyId ?? "n/a"}`);
  lines.push(
    `Status: ${c.SecurityArtifactDescriptor?.Status ?? "n/a"}`
  );
  lines.push(
    `DeployedBy: ${c.SecurityArtifactDescriptor?.DeployedBy ?? "n/a"}`
  );
  lines.push(
    `DeployedOn: ${parseODataDate(c.SecurityArtifactDescriptor?.DeployedOn ?? null)}`
  );
  return lines.join("\n");
}

function formatSecureParameterSummary(p: SecureParameter): string {
  const lines: string[] = [];
  lines.push(`Name: ${p.Name ?? "n/a"}`);
  lines.push(`Description: ${p.Description ?? "n/a"}`);
  lines.push(`Status: ${p.Status ?? "n/a"}`);
  lines.push(`DeployedBy: ${p.DeployedBy ?? "n/a"}`);
  lines.push(`DeployedOn: ${parseODataDate(p.DeployedOn ?? null)}`);
  return lines.join("\n");
}

function formatSecureParameterDetail(p: SecureParameter): string {
  const lines: string[] = [];
  lines.push(`Name: ${p.Name ?? "n/a"}`);
  lines.push(`Description: ${p.Description ?? "n/a"}`);
  lines.push(`Status: ${p.Status ?? "n/a"}`);
  lines.push(`DeployedBy: ${p.DeployedBy ?? "n/a"}`);
  lines.push(`DeployedOn: ${parseODataDate(p.DeployedOn ?? null)}`);
  return lines.join("\n");
}

function formatOAuth2CredentialSummary(c: OAuth2ClientCredential): string {
  const lines: string[] = [];
  lines.push(`Name: ${c.Name ?? "n/a"}`);
  lines.push(`TokenServiceUrl: ${c.TokenServiceUrl ?? "n/a"}`);
  lines.push(`ClientId: ${c.ClientId ?? "n/a"}`);
  lines.push(
    `Status: ${c.SecurityArtifactDescriptor?.Status ?? "n/a"}`
  );
  lines.push(
    `DeployedOn: ${parseODataDate(c.SecurityArtifactDescriptor?.DeployedOn ?? null)}`
  );
  return lines.join("\n");
}

function formatOAuth2CredentialDetail(c: OAuth2ClientCredential): string {
  const lines: string[] = [];
  lines.push(`Name: ${c.Name ?? "n/a"}`);
  lines.push(`Description: ${c.Description ?? "n/a"}`);
  lines.push(`TokenServiceUrl: ${c.TokenServiceUrl ?? "n/a"}`);
  lines.push(`ClientId: ${c.ClientId ?? "n/a"}`);
  lines.push(`ClientAuthentication: ${c.ClientAuthentication ?? "n/a"}`);
  lines.push(`Scope: ${c.Scope ?? "n/a"}`);
  lines.push(`ScopeContentType: ${c.ScopeContentType ?? "n/a"}`);
  lines.push(`Resource: ${c.Resource ?? "n/a"}`);
  lines.push(`Audience: ${c.Audience ?? "n/a"}`);
  lines.push(
    `Status: ${c.SecurityArtifactDescriptor?.Status ?? "n/a"}`
  );
  lines.push(
    `DeployedBy: ${c.SecurityArtifactDescriptor?.DeployedBy ?? "n/a"}`
  );
  lines.push(
    `DeployedOn: ${parseODataDate(c.SecurityArtifactDescriptor?.DeployedOn ?? null)}`
  );
  return lines.join("\n");
}

export function registerCredentialTools(
  server: McpServer,
  context: ModuleContext
) {
  // ─── User Credentials ───────────────────────────────────────────────

  server.registerTool(
    "list_user_credentials",
    {
      description:
        "List user credentials on the active SAP Cloud Integration tenant.",
      inputSchema: z.object({}),
    },
    async () => {
      try {
        const credentials =
          await context.odataClient.getCollection<UserCredential>(
            buildUserCredentialsPath()
          );
        if (credentials.length === 0) {
          return {
            content: [
              { type: "text" as const, text: "No user credentials found." },
            ],
          };
        }
        const text = credentials.map(formatUserCredentialSummary).join("\n\n");
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

  server.registerTool(
    "get_user_credential",
    {
      description:
        "Get details of a specific user credential by name.",
      inputSchema: z.object({
        name: z.string().describe("The user credential name"),
      }),
    },
    async ({ name }) => {
      try {
        const credential =
          await context.odataClient.getEntity<UserCredential>(
            buildUserCredentialPath(name)
          );
        const text = formatUserCredentialDetail(credential);
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

  server.registerTool(
    "create_user_credential",
    {
      description:
        "Create a new user credential. Without confirm, shows a preview. Set confirm to true to execute.",
      inputSchema: z.object({
        name: z.string().describe("The credential name"),
        kind: z
          .enum(["default", "successfactors", "openconnectors"])
          .describe("The credential kind"),
        user: z.string().describe("The user name"),
        password: z.string().describe("The password"),
        description: z
          .string()
          .optional()
          .describe("Description of the credential"),
        companyId: z
          .string()
          .optional()
          .describe("Company ID (for SuccessFactors)"),
        confirm: z
          .boolean()
          .optional()
          .describe("Set to true to actually create the credential"),
      }),
    },
    async ({ name, kind, user, password, description, companyId, confirm }) => {
      try {
        if (!confirm) {
          const lines: string[] = [];
          lines.push("User credential to create:");
          lines.push("");
          lines.push(`Name: ${name}`);
          lines.push(`Kind: ${kind}`);
          lines.push(`User: ${user}`);
          lines.push(`Description: ${description ?? "n/a"}`);
          lines.push(`CompanyId: ${companyId ?? "n/a"}`);
          lines.push("");
          lines.push("Set confirm to true to proceed.");
          return {
            content: [{ type: "text" as const, text: lines.join("\n") }],
          };
        }
        const body: Record<string, unknown> = {
          Name: name,
          Kind: kind,
          User: user,
          Password: password,
        };
        if (description !== undefined) body.Description = description;
        if (companyId !== undefined) body.CompanyId = companyId;
        await context.odataClient.post(buildUserCredentialsPath(), body);
        return {
          content: [
            {
              type: "text" as const,
              text: `User credential '${name}' created successfully.`,
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

  server.registerTool(
    "update_user_credential",
    {
      description:
        "Update an existing user credential. Without confirm, shows a preview of changes. Set confirm to true to execute.",
      inputSchema: z.object({
        name: z.string().describe("The credential name"),
        kind: z
          .enum(["default", "successfactors", "openconnectors"])
          .optional()
          .describe("The credential kind"),
        user: z.string().optional().describe("New user name"),
        password: z.string().optional().describe("New password"),
        description: z
          .string()
          .optional()
          .describe("New description"),
        companyId: z
          .string()
          .optional()
          .describe("New company ID"),
        confirm: z
          .boolean()
          .optional()
          .describe("Set to true to actually update the credential"),
      }),
    },
    async ({ name, kind, user, password, description, companyId, confirm }) => {
      try {
        if (!confirm) {
          const credential =
            await context.odataClient.getEntity<UserCredential>(
              buildUserCredentialPath(name)
            );
          const lines: string[] = [];
          lines.push("User credential to update:");
          lines.push("");
          lines.push(formatUserCredentialDetail(credential));
          lines.push("");
          lines.push("Proposed changes:");
          if (kind !== undefined)
            lines.push(`  Kind: ${credential.Kind} -> ${kind}`);
          if (user !== undefined)
            lines.push(`  User: ${credential.User} -> ${user}`);
          if (password !== undefined) lines.push("  Password: ***");
          if (description !== undefined)
            lines.push(
              `  Description: ${credential.Description} -> ${description}`
            );
          if (companyId !== undefined)
            lines.push(
              `  CompanyId: ${credential.CompanyId} -> ${companyId}`
            );
          lines.push("");
          lines.push("Set confirm to true to proceed.");
          return {
            content: [{ type: "text" as const, text: lines.join("\n") }],
          };
        }
        const body: Record<string, unknown> = {};
        if (kind !== undefined) body.Kind = kind;
        if (user !== undefined) body.User = user;
        if (password !== undefined) body.Password = password;
        if (description !== undefined) body.Description = description;
        if (companyId !== undefined) body.CompanyId = companyId;
        await context.odataClient.put(buildUserCredentialPath(name), body);
        return {
          content: [
            {
              type: "text" as const,
              text: `User credential '${name}' updated successfully.`,
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

  server.registerTool(
    "delete_user_credential",
    {
      description:
        "Delete a user credential. Without confirm, shows a preview. Set confirm to true to execute.",
      inputSchema: z.object({
        name: z.string().describe("The credential name to delete"),
        confirm: z
          .boolean()
          .optional()
          .describe("Set to true to actually delete the credential"),
      }),
    },
    async ({ name, confirm }) => {
      try {
        if (!confirm) {
          const credential =
            await context.odataClient.getEntity<UserCredential>(
              buildUserCredentialPath(name)
            );
          const preview = formatUserCredentialDetail(credential);
          return {
            content: [
              {
                type: "text" as const,
                text: `User credential to delete:\n\n${preview}\n\nSet confirm to true to proceed.`,
              },
            ],
          };
        }
        await context.odataClient.delete(buildUserCredentialPath(name));
        return {
          content: [
            {
              type: "text" as const,
              text: `User credential '${name}' deleted successfully.`,
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

  // ─── Secure Parameters ──────────────────────────────────────────────

  server.registerTool(
    "list_secure_parameters",
    {
      description:
        "List secure parameters on the active SAP Cloud Integration tenant. Neo environment only.",
      inputSchema: z.object({}),
    },
    async () => {
      try {
        const params =
          await context.odataClient.getCollection<SecureParameter>(
            buildSecureParametersPath()
          );
        if (params.length === 0) {
          return {
            content: [
              { type: "text" as const, text: "No secure parameters found." },
            ],
          };
        }
        const text = params.map(formatSecureParameterSummary).join("\n\n");
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

  server.registerTool(
    "get_secure_parameter",
    {
      description:
        "Get details of a specific secure parameter by name. Neo environment only.",
      inputSchema: z.object({
        name: z.string().describe("The secure parameter name"),
      }),
    },
    async ({ name }) => {
      try {
        const param =
          await context.odataClient.getEntity<SecureParameter>(
            buildSecureParameterPath(name)
          );
        const text = formatSecureParameterDetail(param);
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

  server.registerTool(
    "create_secure_parameter",
    {
      description:
        "Create a new secure parameter. Without confirm, shows a preview. Set confirm to true to execute. Neo environment only.",
      inputSchema: z.object({
        name: z.string().describe("The secure parameter name"),
        secureParam: z.string().describe("The secure parameter value"),
        description: z
          .string()
          .optional()
          .describe("Description of the secure parameter"),
        confirm: z
          .boolean()
          .optional()
          .describe("Set to true to actually create the secure parameter"),
      }),
    },
    async ({ name, secureParam, description, confirm }) => {
      try {
        if (!confirm) {
          const lines: string[] = [];
          lines.push("Secure parameter to create:");
          lines.push("");
          lines.push(`Name: ${name}`);
          lines.push(`Description: ${description ?? "n/a"}`);
          lines.push("");
          lines.push("Set confirm to true to proceed.");
          return {
            content: [{ type: "text" as const, text: lines.join("\n") }],
          };
        }
        const body: Record<string, unknown> = {
          Name: name,
          SecureParam: secureParam,
        };
        if (description !== undefined) body.Description = description;
        await context.odataClient.post(buildSecureParametersPath(), body);
        return {
          content: [
            {
              type: "text" as const,
              text: `Secure parameter '${name}' created successfully.`,
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

  server.registerTool(
    "update_secure_parameter",
    {
      description:
        "Update an existing secure parameter. Without confirm, shows a preview of changes. Set confirm to true to execute. Neo environment only.",
      inputSchema: z.object({
        name: z.string().describe("The secure parameter name"),
        secureParam: z
          .string()
          .optional()
          .describe("New secure parameter value"),
        description: z
          .string()
          .optional()
          .describe("New description"),
        confirm: z
          .boolean()
          .optional()
          .describe("Set to true to actually update the secure parameter"),
      }),
    },
    async ({ name, secureParam, description, confirm }) => {
      try {
        if (!confirm) {
          const param =
            await context.odataClient.getEntity<SecureParameter>(
              buildSecureParameterPath(name)
            );
          const lines: string[] = [];
          lines.push("Secure parameter to update:");
          lines.push("");
          lines.push(formatSecureParameterDetail(param));
          lines.push("");
          lines.push("Proposed changes:");
          if (secureParam !== undefined) lines.push("  SecureParam: ***");
          if (description !== undefined)
            lines.push(
              `  Description: ${param.Description} -> ${description}`
            );
          lines.push("");
          lines.push("Set confirm to true to proceed.");
          return {
            content: [{ type: "text" as const, text: lines.join("\n") }],
          };
        }
        const body: Record<string, unknown> = {};
        if (secureParam !== undefined) body.SecureParam = secureParam;
        if (description !== undefined) body.Description = description;
        await context.odataClient.put(buildSecureParameterPath(name), body);
        return {
          content: [
            {
              type: "text" as const,
              text: `Secure parameter '${name}' updated successfully.`,
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

  server.registerTool(
    "delete_secure_parameter",
    {
      description:
        "Delete a secure parameter. Without confirm, shows a preview. Set confirm to true to execute. Neo environment only.",
      inputSchema: z.object({
        name: z.string().describe("The secure parameter name to delete"),
        confirm: z
          .boolean()
          .optional()
          .describe("Set to true to actually delete the secure parameter"),
      }),
    },
    async ({ name, confirm }) => {
      try {
        if (!confirm) {
          const param =
            await context.odataClient.getEntity<SecureParameter>(
              buildSecureParameterPath(name)
            );
          const preview = formatSecureParameterDetail(param);
          return {
            content: [
              {
                type: "text" as const,
                text: `Secure parameter to delete:\n\n${preview}\n\nSet confirm to true to proceed.`,
              },
            ],
          };
        }
        await context.odataClient.delete(buildSecureParameterPath(name));
        return {
          content: [
            {
              type: "text" as const,
              text: `Secure parameter '${name}' deleted successfully.`,
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

  // ─── OAuth2 Client Credentials ──────────────────────────────────────

  server.registerTool(
    "list_oauth2_credentials",
    {
      description:
        "List OAuth2 client credentials on the active SAP Cloud Integration tenant.",
      inputSchema: z.object({
        expandCustomParameters: z
          .boolean()
          .optional()
          .describe("Set to true to expand CustomParameters"),
      }),
    },
    async ({ expandCustomParameters }) => {
      try {
        const params: Record<string, string | number | undefined> = {};
        if (expandCustomParameters) params.$expand = "CustomParameters";
        const credentials =
          await context.odataClient.getCollection<OAuth2ClientCredential>(
            buildOAuth2CredentialsPath(),
            params
          );
        if (credentials.length === 0) {
          return {
            content: [
              {
                type: "text" as const,
                text: "No OAuth2 client credentials found.",
              },
            ],
          };
        }
        const text = credentials
          .map(formatOAuth2CredentialSummary)
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

  server.registerTool(
    "get_oauth2_credential",
    {
      description:
        "Get details of a specific OAuth2 client credential by name.",
      inputSchema: z.object({
        name: z.string().describe("The OAuth2 client credential name"),
        expandCustomParameters: z
          .boolean()
          .optional()
          .describe("Set to true to expand CustomParameters"),
      }),
    },
    async ({ name, expandCustomParameters }) => {
      try {
        const params: Record<string, string | number | undefined> = {};
        if (expandCustomParameters) params.$expand = "CustomParameters";
        const credential =
          await context.odataClient.getEntity<OAuth2ClientCredential>(
            buildOAuth2CredentialPath(name),
            params
          );
        const text = formatOAuth2CredentialDetail(credential);
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

  server.registerTool(
    "create_oauth2_credential",
    {
      description:
        "Create a new OAuth2 client credential. Without confirm, shows a preview. Set confirm to true to execute.",
      inputSchema: z.object({
        name: z.string().describe("The credential name"),
        tokenServiceUrl: z
          .string()
          .describe("The token service URL"),
        clientId: z.string().describe("The client ID"),
        clientSecret: z.string().describe("The client secret"),
        clientAuthentication: z
          .string()
          .optional()
          .describe("Client authentication method"),
        scope: z.string().optional().describe("OAuth2 scope"),
        scopeContentType: z
          .string()
          .optional()
          .describe("Scope content type"),
        resource: z.string().optional().describe("OAuth2 resource"),
        audience: z.string().optional().describe("OAuth2 audience"),
        description: z
          .string()
          .optional()
          .describe("Description of the credential"),
        confirm: z
          .boolean()
          .optional()
          .describe("Set to true to actually create the credential"),
      }),
    },
    async ({
      name,
      tokenServiceUrl,
      clientId,
      clientSecret,
      clientAuthentication,
      scope,
      scopeContentType,
      resource,
      audience,
      description,
      confirm,
    }) => {
      try {
        if (!confirm) {
          const lines: string[] = [];
          lines.push("OAuth2 client credential to create:");
          lines.push("");
          lines.push(`Name: ${name}`);
          lines.push(`TokenServiceUrl: ${tokenServiceUrl}`);
          lines.push(`ClientId: ${clientId}`);
          lines.push(
            `ClientAuthentication: ${clientAuthentication ?? "n/a"}`
          );
          lines.push(`Scope: ${scope ?? "n/a"}`);
          lines.push(`ScopeContentType: ${scopeContentType ?? "n/a"}`);
          lines.push(`Resource: ${resource ?? "n/a"}`);
          lines.push(`Audience: ${audience ?? "n/a"}`);
          lines.push(`Description: ${description ?? "n/a"}`);
          lines.push("");
          lines.push("Set confirm to true to proceed.");
          return {
            content: [{ type: "text" as const, text: lines.join("\n") }],
          };
        }
        const body: Record<string, unknown> = {
          Name: name,
          TokenServiceUrl: tokenServiceUrl,
          ClientId: clientId,
          ClientSecret: clientSecret,
        };
        if (clientAuthentication !== undefined)
          body.ClientAuthentication = clientAuthentication;
        if (scope !== undefined) body.Scope = scope;
        if (scopeContentType !== undefined)
          body.ScopeContentType = scopeContentType;
        if (resource !== undefined) body.Resource = resource;
        if (audience !== undefined) body.Audience = audience;
        if (description !== undefined) body.Description = description;
        await context.odataClient.post(buildOAuth2CredentialsPath(), body);
        return {
          content: [
            {
              type: "text" as const,
              text: `OAuth2 client credential '${name}' created successfully.`,
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

  server.registerTool(
    "update_oauth2_credential",
    {
      description:
        "Update an existing OAuth2 client credential. Without confirm, shows a preview of changes. Set confirm to true to execute.",
      inputSchema: z.object({
        name: z.string().describe("The credential name"),
        tokenServiceUrl: z
          .string()
          .optional()
          .describe("New token service URL"),
        clientId: z.string().optional().describe("New client ID"),
        clientSecret: z
          .string()
          .optional()
          .describe("New client secret"),
        clientAuthentication: z
          .string()
          .optional()
          .describe("New client authentication method"),
        scope: z.string().optional().describe("New OAuth2 scope"),
        scopeContentType: z
          .string()
          .optional()
          .describe("New scope content type"),
        resource: z.string().optional().describe("New OAuth2 resource"),
        audience: z.string().optional().describe("New OAuth2 audience"),
        description: z
          .string()
          .optional()
          .describe("New description"),
        confirm: z
          .boolean()
          .optional()
          .describe("Set to true to actually update the credential"),
      }),
    },
    async ({
      name,
      tokenServiceUrl,
      clientId,
      clientSecret,
      clientAuthentication,
      scope,
      scopeContentType,
      resource,
      audience,
      description,
      confirm,
    }) => {
      try {
        if (!confirm) {
          const credential =
            await context.odataClient.getEntity<OAuth2ClientCredential>(
              buildOAuth2CredentialPath(name)
            );
          const lines: string[] = [];
          lines.push("OAuth2 client credential to update:");
          lines.push("");
          lines.push(formatOAuth2CredentialDetail(credential));
          lines.push("");
          lines.push("Proposed changes:");
          if (tokenServiceUrl !== undefined)
            lines.push(
              `  TokenServiceUrl: ${credential.TokenServiceUrl} -> ${tokenServiceUrl}`
            );
          if (clientId !== undefined)
            lines.push(
              `  ClientId: ${credential.ClientId} -> ${clientId}`
            );
          if (clientSecret !== undefined) lines.push("  ClientSecret: ***");
          if (clientAuthentication !== undefined)
            lines.push(
              `  ClientAuthentication: ${credential.ClientAuthentication} -> ${clientAuthentication}`
            );
          if (scope !== undefined)
            lines.push(`  Scope: ${credential.Scope} -> ${scope}`);
          if (scopeContentType !== undefined)
            lines.push(
              `  ScopeContentType: ${credential.ScopeContentType} -> ${scopeContentType}`
            );
          if (resource !== undefined)
            lines.push(
              `  Resource: ${credential.Resource} -> ${resource}`
            );
          if (audience !== undefined)
            lines.push(
              `  Audience: ${credential.Audience} -> ${audience}`
            );
          if (description !== undefined)
            lines.push(
              `  Description: ${credential.Description} -> ${description}`
            );
          lines.push("");
          lines.push("Set confirm to true to proceed.");
          return {
            content: [{ type: "text" as const, text: lines.join("\n") }],
          };
        }
        const body: Record<string, unknown> = {};
        if (tokenServiceUrl !== undefined)
          body.TokenServiceUrl = tokenServiceUrl;
        if (clientId !== undefined) body.ClientId = clientId;
        if (clientSecret !== undefined) body.ClientSecret = clientSecret;
        if (clientAuthentication !== undefined)
          body.ClientAuthentication = clientAuthentication;
        if (scope !== undefined) body.Scope = scope;
        if (scopeContentType !== undefined)
          body.ScopeContentType = scopeContentType;
        if (resource !== undefined) body.Resource = resource;
        if (audience !== undefined) body.Audience = audience;
        if (description !== undefined) body.Description = description;
        await context.odataClient.put(
          buildOAuth2CredentialPath(name),
          body
        );
        return {
          content: [
            {
              type: "text" as const,
              text: `OAuth2 client credential '${name}' updated successfully.`,
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

  server.registerTool(
    "delete_oauth2_credential",
    {
      description:
        "Delete an OAuth2 client credential. Without confirm, shows a preview. Set confirm to true to execute.",
      inputSchema: z.object({
        name: z.string().describe("The credential name to delete"),
        confirm: z
          .boolean()
          .optional()
          .describe("Set to true to actually delete the credential"),
      }),
    },
    async ({ name, confirm }) => {
      try {
        if (!confirm) {
          const credential =
            await context.odataClient.getEntity<OAuth2ClientCredential>(
              buildOAuth2CredentialPath(name)
            );
          const preview = formatOAuth2CredentialDetail(credential);
          return {
            content: [
              {
                type: "text" as const,
                text: `OAuth2 client credential to delete:\n\n${preview}\n\nSet confirm to true to proceed.`,
              },
            ],
          };
        }
        await context.odataClient.delete(buildOAuth2CredentialPath(name));
        return {
          content: [
            {
              type: "text" as const,
              text: `OAuth2 client credential '${name}' deleted successfully.`,
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
