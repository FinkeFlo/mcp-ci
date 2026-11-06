import type { McpServer } from "@modelcontextprotocol/server";
import * as z from "zod/v4";
import type { ModuleContext, Module } from "../../core/types.js";

export const tenantModule: Module = {
  name: "tenant",
  register(server: McpServer, context: ModuleContext) {
    // @api none
    server.registerTool(
      "get_tenant",
      {
        description:
          "Show the currently active SAP CPI tenant and list all available tenants",
        inputSchema: z.object({}),
      },
      async () => {
        try {
          const active = context.tenantManager.getActiveTenantKey();
          const all = context.tenantManager.listTenants();
          const tenant = context.tenantManager.getActiveTenant();
          return {
            content: [
              {
                type: "text" as const,
                text: `Active tenant: ${active} (${tenant.name})\nAPI URL: ${tenant.apiUrl}\nAvailable tenants: ${all.join(", ")}`,
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

    // @api none
    server.registerTool(
      "set_tenant",
      {
        description: "Switch the active SAP CPI tenant",
        inputSchema: z.object({
          tenant: z
            .string()
            .describe(
              `Tenant key to switch to (available: ${context.tenantManager.listTenants().join(", ")})`
            ),
        }),
      },
      async ({ tenant }) => {
        try {
          context.tenantManager.setActiveTenant(tenant);
          const active = context.tenantManager.getActiveTenant();
          return {
            content: [
              {
                type: "text" as const,
                text: `Switched to tenant: ${tenant} (${active.name})\nAPI URL: ${active.apiUrl}`,
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
  },
};
