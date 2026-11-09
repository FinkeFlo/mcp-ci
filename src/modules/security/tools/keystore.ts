import type { McpServer } from "@modelcontextprotocol/server";
import * as z from "zod/v4";
import type { ModuleContext } from "../../../core/types.js";
import { textTool } from "../../../core/tool.js";
import type { KeystoreEntry, HistoryKeystoreEntry, Keystore } from "../types.js";
import {
  buildKeystoreEntriesPath,
  buildKeystoreEntryPath,
  buildSshKeyValuePath,
  buildKeystorePath,
  buildKeystoreSizePath,
  buildKeystoreResourcesPath,
  buildKeystoreResourcePath,
  buildHistoryKeystoreEntriesPath,
  buildHistoryKeystoreEntryPath,
} from "../queries.js";

// OData v2 dates: /Date(ms)/, optionally with an offset in minutes (+0060) that
// does not change the instant.
const ODATA_DATE = /\/Date\((-?\d+)(?:[+-]\d{4})?\)\//;

function parseODataDate(value: string | null): string {
  if (!value) return "n/a";
  const match = value.match(ODATA_DATE);
  if (match) return new Date(parseInt(match[1])).toISOString();
  return value;
}

function notAfterMs(value: string | null): number | null {
  if (!value) return null;
  const match = value.match(ODATA_DATE);
  const ms = match ? parseInt(match[1]) : Date.parse(value);
  return Number.isNaN(ms) ? null : ms;
}

function formatKeystoreEntrySummary(e: KeystoreEntry): string {
  const lines: string[] = [];
  lines.push(`Hexalias: ${e.Hexalias ?? "n/a"}`);
  lines.push(`Alias: ${e.Alias ?? "n/a"}`);
  lines.push(`KeyType: ${e.KeyType ?? "n/a"}`);
  lines.push(`KeySize: ${e.KeySize ?? "n/a"}`);
  lines.push(`Type: ${e.Type ?? "n/a"}`);
  lines.push(`Validity: ${e.Validity ?? "n/a"}`);
  lines.push(`ValidNotBefore: ${parseODataDate(e.ValidNotBefore)}`);
  lines.push(`ValidNotAfter: ${parseODataDate(e.ValidNotAfter)}`);
  const endMs = notAfterMs(e.ValidNotAfter);
  if (endMs !== null) {
    const days = Math.floor((endMs - Date.now()) / 86_400_000);
    lines.push(
      `DaysUntilExpiry: ${days}${days < 0 ? " (expired)" : ""}`
    );
  }
  lines.push(`Owner: ${e.Owner ?? "n/a"}`);
  lines.push(`Status: ${e.Status ?? "n/a"}`);
  return lines.join("\n");
}

function formatKeystoreEntryDetail(e: KeystoreEntry): string {
  const lines: string[] = [];
  lines.push(`Hexalias: ${e.Hexalias ?? "n/a"}`);
  lines.push(`Alias: ${e.Alias ?? "n/a"}`);
  lines.push(`KeyType: ${e.KeyType ?? "n/a"}`);
  lines.push(`KeySize: ${e.KeySize ?? "n/a"}`);
  lines.push(`Type: ${e.Type ?? "n/a"}`);
  lines.push(`Validity: ${e.Validity ?? "n/a"}`);
  lines.push(`ValidNotBefore: ${parseODataDate(e.ValidNotBefore)}`);
  lines.push(`ValidNotAfter: ${parseODataDate(e.ValidNotAfter)}`);
  lines.push(`SerialNumber: ${e.SerialNumber ?? "n/a"}`);
  lines.push(`SignatureAlgorithm: ${e.SignatureAlgorithm ?? "n/a"}`);
  lines.push(`EllipticCurve: ${e.EllipticCurve ?? "n/a"}`);
  lines.push(`SubjectDN: ${e.SubjectDN ?? "n/a"}`);
  lines.push(`IssuerDN: ${e.IssuerDN ?? "n/a"}`);
  lines.push(`Version: ${e.Version ?? "n/a"}`);
  lines.push(`FingerprintSha1: ${e.FingerprintSha1 ?? "n/a"}`);
  lines.push(`FingerprintSha256: ${e.FingerprintSha256 ?? "n/a"}`);
  lines.push(`FingerprintSha512: ${e.FingerprintSha512 ?? "n/a"}`);
  lines.push(`Owner: ${e.Owner ?? "n/a"}`);
  lines.push(`LastModifiedBy: ${e.LastModifiedBy ?? "n/a"}`);
  lines.push(`LastModifiedTime: ${parseODataDate(e.LastModifiedTime)}`);
  lines.push(`CreatedBy: ${e.CreatedBy ?? "n/a"}`);
  lines.push(`CreatedTime: ${parseODataDate(e.CreatedTime)}`);
  lines.push(`Status: ${e.Status ?? "n/a"}`);
  return lines.join("\n");
}

function formatHistoryKeystoreEntry(e: HistoryKeystoreEntry): string {
  const lines: string[] = [];
  lines.push(`Hexalias: ${e.Hexalias ?? "n/a"}`);
  lines.push(`Alias: ${e.Alias ?? "n/a"}`);
  lines.push(`OriginalAlias: ${e.OriginalAlias ?? "n/a"}`);
  lines.push(`KeyType: ${e.KeyType ?? "n/a"}`);
  lines.push(`KeySize: ${e.KeySize ?? "n/a"}`);
  lines.push(`Type: ${e.Type ?? "n/a"}`);
  lines.push(`Validity: ${e.Validity ?? "n/a"}`);
  lines.push(`ValidNotBefore: ${parseODataDate(e.ValidNotBefore)}`);
  lines.push(`ValidNotAfter: ${parseODataDate(e.ValidNotAfter)}`);
  lines.push(`ActivatedBy: ${e.ActivatedBy ?? "n/a"}`);
  lines.push(`ActiveFrom: ${parseODataDate(e.ActiveFrom)}`);
  lines.push(`DeactivatedBy: ${e.DeactivatedBy ?? "n/a"}`);
  lines.push(`ActiveUntil: ${parseODataDate(e.ActiveUntil)}`);
  lines.push(`ActivationSequenceNumber: ${e.ActivationSequenceNumber ?? "n/a"}`);
  lines.push(`Owner: ${e.Owner ?? "n/a"}`);
  lines.push(`Status: ${e.Status ?? "n/a"}`);
  return lines.join("\n");
}

function formatHistoryKeystoreEntryDetail(e: HistoryKeystoreEntry): string {
  const lines: string[] = [];
  lines.push(`Hexalias: ${e.Hexalias ?? "n/a"}`);
  lines.push(`Alias: ${e.Alias ?? "n/a"}`);
  lines.push(`OriginalAlias: ${e.OriginalAlias ?? "n/a"}`);
  lines.push(`KeyType: ${e.KeyType ?? "n/a"}`);
  lines.push(`KeySize: ${e.KeySize ?? "n/a"}`);
  lines.push(`Type: ${e.Type ?? "n/a"}`);
  lines.push(`Validity: ${e.Validity ?? "n/a"}`);
  lines.push(`ValidNotBefore: ${parseODataDate(e.ValidNotBefore)}`);
  lines.push(`ValidNotAfter: ${parseODataDate(e.ValidNotAfter)}`);
  lines.push(`SerialNumber: ${e.SerialNumber ?? "n/a"}`);
  lines.push(`SignatureAlgorithm: ${e.SignatureAlgorithm ?? "n/a"}`);
  lines.push(`EllipticCurve: ${e.EllipticCurve ?? "n/a"}`);
  lines.push(`SubjectDN: ${e.SubjectDN ?? "n/a"}`);
  lines.push(`IssuerDN: ${e.IssuerDN ?? "n/a"}`);
  lines.push(`Version: ${e.Version ?? "n/a"}`);
  lines.push(`FingerprintSha1: ${e.FingerprintSha1 ?? "n/a"}`);
  lines.push(`FingerprintSha256: ${e.FingerprintSha256 ?? "n/a"}`);
  lines.push(`FingerprintSha512: ${e.FingerprintSha512 ?? "n/a"}`);
  lines.push(`Owner: ${e.Owner ?? "n/a"}`);
  lines.push(`LastModifiedBy: ${e.LastModifiedBy ?? "n/a"}`);
  lines.push(`LastModifiedTime: ${parseODataDate(e.LastModifiedTime)}`);
  lines.push(`CreatedBy: ${e.CreatedBy ?? "n/a"}`);
  lines.push(`CreatedTime: ${parseODataDate(e.CreatedTime)}`);
  lines.push(`ActivatedBy: ${e.ActivatedBy ?? "n/a"}`);
  lines.push(`ActiveFrom: ${parseODataDate(e.ActiveFrom)}`);
  lines.push(`DeactivatedBy: ${e.DeactivatedBy ?? "n/a"}`);
  lines.push(`ActiveUntil: ${parseODataDate(e.ActiveUntil)}`);
  lines.push(`ActivationSequenceNumber: ${e.ActivationSequenceNumber ?? "n/a"}`);
  lines.push(`Status: ${e.Status ?? "n/a"}`);
  return lines.join("\n");
}

function formatKeystoreSummary(k: Keystore): string {
  const lines: string[] = [];
  lines.push(`Name: ${k.Name ?? "n/a"}`);
  lines.push(`LastModifiedBy: ${k.LastModifiedBy ?? "n/a"}`);
  lines.push(`LastModifiedTime: ${parseODataDate(k.LastModifiedTime)}`);
  lines.push(`Size: ${k.Size ?? "n/a"}`);
  return lines.join("\n");
}

const keystoreNameEnum = z.enum(["system", "backup_admin_system", "KeyRenewal"]);

export function registerKeystoreTools(
  server: McpServer,
  context: ModuleContext
) {
  // ==========================================
  // Group 1: Keystore Entries
  // ==========================================

  // @api GET /KeystoreEntries
  server.registerTool(
    "list_keystore_entries",
    {
      description:
        "List keystore entries from the specified keystore on the active SAP Cloud Integration tenant. Each entry shows DaysUntilExpiry (negative = expired). Use expiringWithinDays to list only expired entries and those expiring soon, sorted by expiry.",
      inputSchema: z.object({
        keystoreName: keystoreNameEnum
          .default("system")
          .describe("Name of the keystore (default: system)"),
        select: z
          .string()
          .optional()
          .describe("Comma-separated list of fields to return"),
        expiringWithinDays: z
          .number()
          .int()
          .min(0)
          .optional()
          .describe(
            "Only return entries whose ValidNotAfter is within this many days from now, including already expired ones; sorted by expiry date"
          ),
      }),
    },
    textTool(async ({ keystoreName, select, expiringWithinDays }) => {
      // The expiry filter needs ValidNotAfter even when the caller selects fields.
      const fields =
        select && expiringWithinDays !== undefined && !select.split(",").map((f) => f.trim()).includes("ValidNotAfter")
          ? `${select},ValidNotAfter`
          : select;
      const path = `${buildKeystoreEntriesPath()}?keystoreName=${encodeURIComponent(keystoreName)}`;
      let entries =
        await context.odataClient.getCollection<KeystoreEntry>(
          path,
          fields ? { $select: fields } : undefined
        );
      if (expiringWithinDays !== undefined) {
        const limit = Date.now() + expiringWithinDays * 86_400_000;
        const dated = entries.map((e) => ({ e, end: notAfterMs(e.ValidNotAfter) }));
        const expiring = dated
          .filter((x): x is { e: KeystoreEntry; end: number } => x.end !== null && x.end <= limit)
          .sort((a, b) => a.end - b.end)
          .map((x) => x.e);
        // An entry whose date cannot be read might be expired; never drop it silently.
        const unknown = dated.filter((x) => x.end === null).map((x) => x.e);
        if (expiring.length === 0 && unknown.length === 0) {
          return `No keystore entries expire within ${expiringWithinDays} day(s).`;
        }
        return [
          ...expiring.map(formatKeystoreEntrySummary),
          ...unknown.map((e) => `${formatKeystoreEntrySummary(e)}\nDaysUntilExpiry: unknown expiry (ValidNotAfter not readable)`),
        ].join("\n\n");
      }
      if (entries.length === 0) {
        return "No keystore entries found.";
      }
      const text = entries.map(formatKeystoreEntrySummary).join("\n\n");
      return text;
    })
  );

  // @api GET /KeystoreEntries('{Hexalias}')
  server.registerTool(
    "get_keystore_entry",
    {
      description:
        "Get details of a specific keystore entry by its hex alias.",
      inputSchema: z.object({
        hexalias: z.string().describe("The hex-encoded alias of the keystore entry"),
        keystoreName: keystoreNameEnum
          .default("system")
          .describe("Name of the keystore (default: system)"),
      }),
    },
    textTool(async ({ hexalias, keystoreName }) => {
      const path = `${buildKeystoreEntryPath(hexalias)}?keystoreName=${encodeURIComponent(keystoreName)}`;
      const entry =
        await context.odataClient.getEntity<KeystoreEntry>(path);
      const text = formatKeystoreEntryDetail(entry);
      return text;
    })
  );

  // @api PUT /KeystoreEntries('{Hexalias}')
  server.registerTool(
    "rename_keystore_entry",
    {
      description:
        "Rename a keystore entry. Without confirm, shows a preview. Set confirm to true to execute.",
      inputSchema: z.object({
        hexalias: z.string().describe("The hex-encoded alias of the keystore entry to rename"),
        newAlias: z.string().describe("The new alias name"),
        confirm: z
          .boolean()
          .optional()
          .describe("Set to true to actually rename the entry"),
      }),
    },
    textTool(async ({ hexalias, newAlias, confirm }) => {
      if (!confirm) {
        const lines: string[] = [];
        lines.push("Keystore entry to rename:");
        lines.push("");
        lines.push(`Hexalias: ${hexalias}`);
        lines.push(`New alias: ${newAlias}`);
        lines.push("");
        lines.push("Set confirm to true to proceed.");
        return lines.join("\n");
      }
      const path = `${buildKeystoreEntryPath(hexalias)}?renameAlias=${encodeURIComponent(newAlias)}`;
      await context.odataClient.put(path, { Status: null });
      return `Keystore entry '${hexalias}' renamed to '${newAlias}' successfully.`;
    })
  );

  // @api DELETE /KeystoreEntries('{Hexalias}')
  server.registerTool(
    "delete_keystore_entry",
    {
      description:
        "Delete a keystore entry. Without confirm, shows a preview. Set confirm to true to execute.",
      inputSchema: z.object({
        hexalias: z.string().describe("The hex-encoded alias of the keystore entry to delete"),
        keystoreName: keystoreNameEnum
          .optional()
          .describe("Name of the keystore"),
        activate: z
          .boolean()
          .optional()
          .describe("Whether to activate changes (for KeyRenewal keystore)"),
        confirm: z
          .boolean()
          .optional()
          .describe("Set to true to actually delete the entry"),
      }),
    },
    textTool(async ({ hexalias, keystoreName, activate, confirm }) => {
      if (!confirm) {
        const lines: string[] = [];
        lines.push("Keystore entry to delete:");
        lines.push("");
        lines.push(`Hexalias: ${hexalias}`);
        lines.push(`Keystore: ${keystoreName ?? "n/a"}`);
        lines.push(`Activate: ${activate ?? "n/a"}`);
        lines.push("");
        lines.push("Set confirm to true to proceed.");
        return lines.join("\n");
      }
      let path = buildKeystoreEntryPath(hexalias);
      const queryParts: string[] = [];
      if (keystoreName !== undefined) {
        queryParts.push(`keystoreName=${encodeURIComponent(keystoreName)}`);
      }
      if (activate !== undefined) {
        queryParts.push(`activate=${activate}`);
      }
      if (queryParts.length > 0) {
        path += `?${queryParts.join("&")}`;
      }
      await context.odataClient.delete(path);
      return `Keystore entry '${hexalias}' deleted successfully.`;
    })
  );

  // @api GET /KeystoreEntries('69645F727361')/Sshkey/$value
  server.registerTool(
    "export_ssh_key",
    {
      description:
        "Export the SSH public key for a keystore entry in OpenSSH format.",
      inputSchema: z.object({
        hexalias: z.string().describe("The hex-encoded alias of the keystore entry"),
      }),
    },
    textTool(async ({ hexalias }) => {
      const content = await context.odataClient.getValue(
        buildSshKeyValuePath(hexalias)
      );
      return content;
    })
  );

  // ==========================================
  // Group 2: Keystores
  // ==========================================

  // @api GET /Keystores('{KeystoreName}')
  server.registerTool(
    "get_keystore",
    {
      description:
        "Get details of a specific keystore by name.",
      inputSchema: z.object({
        keystoreName: z
          .enum(["system", "backup_admin_system"])
          .describe("Name of the keystore"),
        expand: z
          .string()
          .optional()
          .describe("Navigation properties to expand (e.g. 'Entries')"),
        select: z
          .string()
          .optional()
          .describe("Comma-separated list of fields to return"),
      }),
    },
    textTool(async ({ keystoreName, expand, select }) => {
      const params: Record<string, string> = {};
      if (expand) params.$expand = expand;
      if (select) params.$select = select;
      const keystore =
        await context.odataClient.getEntity<Keystore>(
          buildKeystorePath(keystoreName),
          Object.keys(params).length > 0 ? params : undefined
        );
      const text = formatKeystoreSummary(keystore);
      return text;
    })
  );

  // @api GET /Keystores('{KeystoreName}')/Size/$value
  server.registerTool(
    "get_keystore_size",
    {
      description:
        "Get the size (number of entries) of a keystore.",
      inputSchema: z.object({
        keystoreName: z
          .enum(["system", "backup_admin_system"])
          .describe("Name of the keystore"),
      }),
    },
    textTool(async ({ keystoreName }) => {
      const content = await context.odataClient.getValue(
        buildKeystoreSizePath(keystoreName)
      );
      return `Keystore '${keystoreName}' size: ${content}`;
    })
  );

  // @api GET /KeystoreResources('{KeystoreName}')
  server.registerTool(
    "export_keystore",
    {
      description:
        "Export a keystore as a base64-encoded JKS/JCEKS file.",
      inputSchema: z.object({
        keystoreName: z
          .enum(["system", "backup_admin_system"])
          .describe("Name of the keystore to export"),
      }),
    },
    textTool(async ({ keystoreName }) => {
      const content = await context.odataClient.getValue(
        buildKeystoreResourcePath(keystoreName)
      );
      return `Keystore '${keystoreName}' exported successfully. Content length: ${content.length} bytes (base64-encoded JKS/JCEKS data).`;
    })
  );

  // @api POST /KeystoreResources
  server.registerTool(
    "import_keystore",
    {
      description:
        "Import a keystore from base64-encoded content. Without confirm, shows a preview. Set confirm to true to execute.",
      inputSchema: z.object({
        resource: z.string().describe("Base64-encoded keystore content"),
        password: z.string().describe("Password for the keystore file"),
        importOption: z
          .enum(["replace", "merge", "overwrite"])
          .optional()
          .describe("Import option: replace, merge, or overwrite"),
        confirm: z
          .boolean()
          .optional()
          .describe("Set to true to actually import the keystore"),
      }),
    },
    textTool(async ({ resource, password, importOption, confirm }) => {
      if (!confirm) {
        const lines: string[] = [];
        lines.push("Keystore to import:");
        lines.push("");
        lines.push(`Resource length: ${resource.length} characters`);
        lines.push(`Import option: ${importOption ?? "n/a"}`);
        lines.push("");
        lines.push("Set confirm to true to proceed.");
        return lines.join("\n");
      }
      let path = buildKeystoreResourcesPath();
      if (importOption !== undefined) {
        path += `?importOption=${encodeURIComponent(importOption)}`;
      }
      await context.odataClient.post(path, {
        Name: "system",
        Resource: resource,
        Password: password,
      });
      return "Keystore imported successfully.";
    })
  );

  // @api PUT /KeystoreResources('system')
  server.registerTool(
    "restore_or_delete_keystore",
    {
      description:
        "Restore the system keystore from backup or delete specific entries. Without confirm, shows a preview. Set confirm to true to execute.",
      inputSchema: z.object({
        operation: z
          .enum(["restore", "delete"])
          .describe("Operation mode: 'restore' restores from backup, 'delete' removes specific entries"),
        aliases: z
          .string()
          .optional()
          .describe("Semicolon-separated list of aliases to delete (required for delete operation)"),
        confirm: z
          .boolean()
          .optional()
          .describe("Set to true to actually execute the operation"),
      }),
    },
    textTool(async ({ operation, aliases, confirm }) => {
      if (!confirm) {
        const lines: string[] = [];
        if (operation === "restore") {
          lines.push("Keystore operation: RESTORE from backup");
          lines.push("");
          lines.push("This will restore the system keystore from backup_admin_system.");
        } else {
          lines.push("Keystore operation: DELETE entries");
          lines.push("");
          lines.push(`Aliases to delete: ${aliases ?? "n/a"}`);
        }
        lines.push("");
        lines.push("Set confirm to true to proceed.");
        return lines.join("\n");
      }
      const path = buildKeystoreResourcePath("system");
      if (operation === "restore") {
        await context.odataClient.put(
          `${path}?retrieveBackup=backup_admin_system`,
          { Resource: null }
        );
        return "System keystore restored from backup successfully.";
      } else {
        if (!aliases) {
          throw new Error("Aliases parameter is required for delete operation.");
        }
        await context.odataClient.put(
          `${path}?deleteEntries=true`,
          { Aliases: aliases }
        );
        return `Keystore entries '${aliases}' deleted successfully.`;
      }
    })
  );

  // ==========================================
  // Group 3: Keystore History
  // ==========================================

  // @api GET /HistoryKeystoreEntries
  server.registerTool(
    "list_history_keystore_entries",
    {
      description:
        "List historical keystore entries on the active SAP Cloud Integration tenant.",
      inputSchema: z.object({
        select: z
          .string()
          .optional()
          .describe("Comma-separated list of fields to return"),
      }),
    },
    textTool(async ({ select }) => {
      const entries =
        await context.odataClient.getCollection<HistoryKeystoreEntry>(
          buildHistoryKeystoreEntriesPath(),
          select ? { $select: select } : undefined
        );
      if (entries.length === 0) {
        return "No history keystore entries found.";
      }
      const text = entries.map(formatHistoryKeystoreEntry).join("\n\n");
      return text;
    })
  );

  // @api GET /HistoryKeystoreEntries('{Hexalias}')
  server.registerTool(
    "get_history_keystore_entry",
    {
      description:
        "Get details of a specific historical keystore entry by its hex alias.",
      inputSchema: z.object({
        hexalias: z.string().describe("The hex-encoded alias of the history keystore entry"),
      }),
    },
    textTool(async ({ hexalias }) => {
      const entry =
        await context.odataClient.getEntity<HistoryKeystoreEntry>(
          buildHistoryKeystoreEntryPath(hexalias)
        );
      const text = formatHistoryKeystoreEntryDetail(entry);
      return text;
    })
  );

  // @api GET /HistoryKeystoreEntries('{Hexalias}')
  // @api PUT /HistoryKeystoreEntries('{Hexalias}')
  server.registerTool(
    "restore_history_entry",
    {
      description:
        "Restore a historical keystore entry to the active keystore. Without confirm, shows a preview. Set confirm to true to execute.",
      inputSchema: z.object({
        hexalias: z.string().describe("The hex-encoded alias of the history entry to restore"),
        destinationAlias: z
          .string()
          .optional()
          .describe("Optional destination alias for the restored entry"),
        confirm: z
          .boolean()
          .optional()
          .describe("Set to true to actually restore the entry"),
      }),
    },
    textTool(async ({ hexalias, destinationAlias, confirm }) => {
      if (!confirm) {
        const lines: string[] = [];
        lines.push("History keystore entry to restore:");
        lines.push("");
        lines.push(`Hexalias: ${hexalias}`);
        lines.push(`Destination alias: ${destinationAlias ?? "n/a (original alias)"}`);
        lines.push("");
        lines.push("Set confirm to true to proceed.");
        return lines.join("\n");
      }
      let path = `${buildHistoryKeystoreEntryPath(hexalias)}?copy=true`;
      if (destinationAlias !== undefined) {
        path += `&destinationAlias=${encodeURIComponent(destinationAlias)}`;
      }
      await context.odataClient.put(path, { Status: null });
      return `History keystore entry '${hexalias}' restored successfully.`;
    })
  );
}
