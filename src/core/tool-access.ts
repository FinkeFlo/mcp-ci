import type { TenantManager } from "./tenant-manager.js";

export type ToolAccessKind = "read" | "write";

export interface ToggleableTool {
  enable(): void;
  disable(): void;
}

const READ_PREFIXES = ["get_", "list_", "count_", "download_", "aggregate_", "export_"];
const WRITE_PREFIXES = [
  "create_", "update_", "delete_", "deploy_", "undeploy_", "save_", "upsert_", "import_",
  "activate_", "deactivate_", "restore_", "rename_", "generate_", "copy_", "validate_",
];

/** Exceptions win over prefixes. */
const EXPLICIT: Record<string, ToolAccessKind> = {
  // Switches the server's active tenant, never calls the tenant API.
  set_tenant: "read",
  // POST, but only runs a check; allowed on read-only tenants (see ODataClient.post).
  execute_guidelines: "read",
};

/** Returns `undefined` for names that match no known prefix. */
export function classifyTool(name: string): ToolAccessKind | undefined {
  if (EXPLICIT[name]) return EXPLICIT[name];
  if (WRITE_PREFIXES.some((prefix) => name.startsWith(prefix))) return "write";
  if (READ_PREFIXES.some((prefix) => name.startsWith(prefix))) return "read";
  return undefined;
}

/**
 * Hides write tools while the active tenant is read-only. Unclassified tools
 * count as write (fail closed). The hard guarantee lives in ODataClient; this
 * only keeps write tools out of the tool list.
 */
export class ToolAccess {
  private writeTools = new Map<string, ToggleableTool>();

  constructor(private tenantManager: TenantManager) {
    tenantManager.onActiveTenantChange(() => this.apply());
  }

  track(name: string, handle: ToggleableTool): void {
    if (classifyTool(name) === "read") return;
    this.writeTools.set(name, handle);
    this.toggle(handle);
  }

  apply(): void {
    for (const handle of this.writeTools.values()) this.toggle(handle);
  }

  private toggle(handle: ToggleableTool): void {
    if (this.tenantManager.isActiveReadOnly()) handle.disable();
    else handle.enable();
  }
}
