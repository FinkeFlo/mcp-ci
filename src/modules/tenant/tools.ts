import type { McpServer } from "@modelcontextprotocol/server";
import * as z from "zod/v4";
import type { ModuleContext, Module } from "../../core/types.js";
import { textTool } from "../../core/tool.js";

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
      textTool(async () => {
        const active = context.tenantManager.getActiveTenantKey();
        const all = context.tenantManager.listTenants();
        const tenant = context.tenantManager.getActiveTenant();
        return `Active tenant: ${active} (${tenant.name})\nAPI URL: ${tenant.apiUrl}\nAvailable tenants: ${all.join(", ")}`;
      })
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
      textTool(async ({ tenant }) => {
        context.tenantManager.setActiveTenant(tenant);
        const active = context.tenantManager.getActiveTenant();
        return `Switched to tenant: ${tenant} (${active.name})\nAPI URL: ${active.apiUrl}`;
      })
    );
  },
};
