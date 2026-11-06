import type { McpServer } from "@modelcontextprotocol/server";
import * as z from "zod/v4";
import type { ModuleContext } from "../../../core/types.js";
import { textTool } from "../../../core/tool.js";
import type { NumberRange } from "../types.js";
import { buildNumberRangesPath, buildNumberRangePath } from "../queries.js";

function formatNumberRange(nr: NumberRange): string {
  return [
    `Name: ${nr.Name ?? "n/a"}`,
    `Description: ${nr.Description ?? "n/a"}`,
    `MaxValue: ${nr.MaxValue ?? "n/a"}`,
    `MinValue: ${nr.MinValue ?? "n/a"}`,
    `Rotate: ${nr.Rotate ?? "n/a"}`,
    `CurrentValue: ${nr.CurrentValue ?? "n/a"}`,
    `FieldLength: ${nr.FieldLength ?? "n/a"}`,
    `DeployedBy: ${nr.DeployedBy ?? "n/a"}`,
    `DeployedOn: ${nr.DeployedOn ?? "n/a"}`,
  ].join("\n");
}

export function registerNumberRangeTools(
  server: McpServer,
  context: ModuleContext
) {
  // @api GET /NumberRanges
  server.registerTool(
    "list_number_ranges",
    {
      description:
        "List all number ranges on the active SAP Cloud Integration tenant.",
      inputSchema: z.object({}),
    },
    textTool(async () => {
      const ranges =
        await context.odataClient.getCollection<NumberRange>(
          buildNumberRangesPath()
        );
      if (ranges.length === 0) {
        return "No number ranges found.";
      }
      const text = ranges.map(formatNumberRange).join("\n\n");
      return text;
    })
  );

  // @api GET /NumberRanges('{objectName}')
  server.registerTool(
    "get_number_range",
    {
      description: "Get a specific number range by its name.",
      inputSchema: z.object({
        name: z.string().describe("The number range name"),
      }),
    },
    textTool(async ({ name }) => {
      const nr = await context.odataClient.getEntity<NumberRange>(
        buildNumberRangePath(name)
      );
      const text = formatNumberRange(nr);
      return text;
    })
  );

  // @api POST /NumberRanges
  server.registerTool(
    "create_number_range",
    {
      description:
        "Create a new number range. Without confirm, shows a preview. Set confirm to true to execute.",
      inputSchema: z.object({
        name: z.string().describe("The number range name"),
        description: z.string().describe("Description of the number range"),
        maxValue: z.string().describe("Maximum value"),
        minValue: z.string().describe("Minimum value"),
        rotate: z.string().describe("Whether to rotate ('true' or 'false')"),
        currentValue: z.string().describe("Current value"),
        fieldLength: z.string().describe("Field length"),
        confirm: z
          .boolean()
          .optional()
          .describe("Set to true to actually create the number range"),
      }),
    },
    textTool(async ({
      name,
      description,
      maxValue,
      minValue,
      rotate,
      currentValue,
      fieldLength,
      confirm,
    }) => {
      if (!confirm) {
        const lines: string[] = [];
        lines.push("Number range to create:");
        lines.push("");
        lines.push(`Name: ${name}`);
        lines.push(`Description: ${description}`);
        lines.push(`MaxValue: ${maxValue}`);
        lines.push(`MinValue: ${minValue}`);
        lines.push(`Rotate: ${rotate}`);
        lines.push(`CurrentValue: ${currentValue}`);
        lines.push(`FieldLength: ${fieldLength}`);
        lines.push("");
        lines.push("Set confirm to true to proceed.");
        return lines.join("\n");
      }
      const body: Record<string, unknown> = {
        Name: name,
        Description: description,
        MaxValue: maxValue,
        MinValue: minValue,
        Rotate: rotate,
        CurrentValue: currentValue,
        FieldLength: fieldLength,
      };
      await context.odataClient.post(buildNumberRangesPath(), body);
      return `Number range '${name}' created successfully.`;
    })
  );

  // @api GET /NumberRanges('{objectName}')
  // @api PUT /NumberRanges('{objectName}')
  server.registerTool(
    "update_number_range",
    {
      description:
        "Update an existing number range. All fields are required per API spec. Without confirm, shows a preview. Set confirm to true to execute.",
      inputSchema: z.object({
        name: z
          .string()
          .describe("The number range name (must match the existing name)"),
        description: z.string().describe("Description of the number range"),
        maxValue: z.string().describe("Maximum value"),
        minValue: z.string().describe("Minimum value"),
        rotate: z.string().describe("Whether to rotate ('true' or 'false')"),
        currentValue: z.string().describe("Current value"),
        fieldLength: z.string().describe("Field length"),
        confirm: z
          .boolean()
          .optional()
          .describe("Set to true to actually update the number range"),
      }),
    },
    textTool(async ({
      name,
      description,
      maxValue,
      minValue,
      rotate,
      currentValue,
      fieldLength,
      confirm,
    }) => {
      if (!confirm) {
        const existing = await context.odataClient.getEntity<NumberRange>(
          buildNumberRangePath(name)
        );
        const lines: string[] = [];
        lines.push("Number range to update:");
        lines.push("");
        lines.push(formatNumberRange(existing));
        lines.push("");
        lines.push("New values:");
        lines.push(`  Description: ${description}`);
        lines.push(`  MaxValue: ${maxValue}`);
        lines.push(`  MinValue: ${minValue}`);
        lines.push(`  Rotate: ${rotate}`);
        lines.push(`  CurrentValue: ${currentValue}`);
        lines.push(`  FieldLength: ${fieldLength}`);
        lines.push("");
        lines.push("Set confirm to true to proceed.");
        return lines.join("\n");
      }
      const body: Record<string, unknown> = {
        Name: name,
        Description: description,
        MaxValue: maxValue,
        MinValue: minValue,
        Rotate: rotate,
        CurrentValue: currentValue,
        FieldLength: fieldLength,
      };
      await context.odataClient.put(buildNumberRangePath(name), body);
      return `Number range '${name}' updated successfully.`;
    })
  );

  // @api GET /NumberRanges('{objectName}')
  // @api DELETE /NumberRanges('{objectName}')
  server.registerTool(
    "delete_number_range",
    {
      description:
        "Delete a number range by name. Without confirm, shows a preview. Set confirm to true to execute.",
      inputSchema: z.object({
        name: z.string().describe("The number range name to delete"),
        confirm: z
          .boolean()
          .optional()
          .describe("Set to true to actually delete the number range"),
      }),
    },
    textTool(async ({ name, confirm }) => {
      if (!confirm) {
        const nr = await context.odataClient.getEntity<NumberRange>(
          buildNumberRangePath(name)
        );
        const preview = formatNumberRange(nr);
        return `Number range to delete:\n\n${preview}\n\nSet confirm to true to proceed.`;
      }
      await context.odataClient.delete(buildNumberRangePath(name));
      return `Number range '${name}' deleted successfully.`;
    })
  );
}
