import type { TenantManager } from "./tenant-manager.js";
import { TOOL_CLASSES } from "./tool-classes.js";

export type ToolAccessKind = "read" | "write";

export interface ToggleableTool {
  enable(): void;
  disable(): void;
}

/** Returns `undefined` for names that are not in TOOL_CLASSES. */
export function classifyTool(name: string): ToolAccessKind | undefined {
  return Object.hasOwn(TOOL_CLASSES, name) ? TOOL_CLASSES[name] : undefined;
}

/**
 * Hides write tools while the active tenant is read-only. Tools missing from
 * TOOL_CLASSES count as write (fail closed). The hard guarantee lives in
 * ODataClient; this only keeps write tools out of the tool list.
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
