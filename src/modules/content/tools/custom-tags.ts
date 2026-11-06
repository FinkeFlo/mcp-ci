import type { McpServer } from "@modelcontextprotocol/server";
import * as z from "zod/v4";
import type { ModuleContext } from "../../../core/types.js";
import { textTool } from "../../../core/tool.js";
import {
  buildCustomTagsConfigValuePath,
  buildCustomTagsConfigsPath,
} from "../queries.js";

export function registerCustomTagTools(
  server: McpServer,
  context: ModuleContext
) {
  // 1. get_custom_tags_config
  // @api GET /CustomTagConfigurations('CustomTags')/$value
  server.registerTool(
    "get_custom_tags_config",
    {
      description:
        "Get the custom tags configuration. Returns the JSON definition of all custom tags.",
      inputSchema: z.object({}),
    },
    textTool(async () => {
      const content = await context.odataClient.getValue(
        buildCustomTagsConfigValuePath()
      );
      return content;
    })
  );

  // 2. update_custom_tags_config
  // @api POST /CustomTagConfigurations
  server.registerTool(
    "update_custom_tags_config",
    {
      description:
        "Update the custom tags configuration. Without confirm, shows a preview. Set confirm to true to execute.",
      inputSchema: z.object({
        content: z
          .string()
          .describe(
            "Base64-encoded JSON of the custom tags configuration"
          ),
        confirm: z
          .boolean()
          .optional()
          .describe(
            "Set to true to actually update the custom tags configuration"
          ),
      }),
    },
    textTool(async ({ content, confirm }) => {
      if (!confirm) {
        const lines: string[] = [];
        lines.push("Custom tags configuration to update:");
        lines.push("");
        lines.push(`Content: ${content}`);
        lines.push("");
        lines.push("Set confirm to true to proceed.");
        return lines.join("\n");
      }
      await context.odataClient.post(buildCustomTagsConfigsPath(), {
        customTagsConfiguration: content,
      });
      return "Custom tags configuration updated successfully.";
    })
  );
}
