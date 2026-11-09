import type { TenantManager } from "./tenant-manager.js";
import { TOOL_CLASSES } from "./tool-classes.js";

/** `payload` tools only read, but return message, store or log content. */
export type ToolAccessKind = "read" | "payload" | "write";

export interface ToggleableTool {
  enable(): void;
  disable(): void;
}

/** Returns `undefined` for names that are not in TOOL_CLASSES. */
export function classifyTool(name: string): ToolAccessKind | undefined {
  return Object.hasOwn(TOOL_CLASSES, name) ? TOOL_CLASSES[name] : undefined;
}

/**
 * Hides tools the active tenant does not allow: write tools on read-only
 * tenants, payload tools unless `allowPayloads` is set. Tools missing from
 * TOOL_CLASSES count as write (fail closed). The guarded server also checks
 * `isAllowed` on every call; for writes, ODataClient is the final guard.
 */
export class ToolAccess {
  private restricted = new Map<string, ToggleableTool>();

  constructor(private tenantManager: TenantManager) {
    tenantManager.onActiveTenantChange(() => this.apply());
  }

  track(name: string, handle: ToggleableTool): void {
    if (classifyTool(name) === "read") return;
    this.restricted.set(name, handle);
    this.toggle(name, handle);
  }

  apply(): void {
    for (const [name, handle] of this.restricted) this.toggle(name, handle);
  }

  isAllowed(name: string): boolean {
    const kind = classifyTool(name) ?? "write";
    if (kind === "read") return true;
    if (kind === "payload") return this.tenantManager.isActivePayloadAllowed();
    return !this.tenantManager.isActiveReadOnly();
  }

  /**
   * Runs a tool call pinned to the active tenant, so the access check and
   * every request the handler makes use the same tenant.
   */
  call<T>(name: string, handler: () => T, refuse: (tenantKey: string) => T): T {
    if (classifyTool(name) === "read") return handler();
    return this.tenantManager.runPinned(() =>
      this.isAllowed(name) ? handler() : refuse(this.tenantManager.getActiveTenantKey())
    );
  }

  private toggle(name: string, handle: ToggleableTool): void {
    if (this.isAllowed(name)) handle.enable();
    else handle.disable();
  }
}
