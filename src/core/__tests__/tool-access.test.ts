import { describe, it, expect } from "vitest";
import { classifyTool } from "../tool-access.js";

describe("classifyTool", () => {
  it.each([
    ["get_package", "read"],
    ["list_messages", "read"],
    ["count_messages", "read"],
    ["download_log_file", "read"],
    ["aggregate_messages", "read"],
    ["export_certificate", "read"],
    ["set_tenant", "read"],
    ["execute_guidelines", "read"],
    ["create_package", "write"],
    ["update_configuration", "write"],
    ["delete_variable", "write"],
    ["deploy_value_mapping", "write"],
    ["undeploy_runtime_artifact", "write"],
    ["save_message_mapping_version", "write"],
    ["upsert_value_maps", "write"],
    ["import_keystore", "write"],
    ["activate_archiving", "write"],
    ["deactivate_external_logging", "write"],
    ["restore_history_entry", "write"],
    ["restore_or_delete_keystore", "write"],
    ["rename_keystore_entry", "write"],
    ["generate_ssh_key_pair", "write"],
    ["copy_package", "write"],
    ["validate_designtime_artifact", "write"],
  ] as const)("%s is %s", (name, kind) => {
    expect(classifyTool(name)).toBe(kind);
  });

  it("unknown prefixes return undefined", () => {
    expect(classifyTool("frobnicate_x")).toBeUndefined();
    expect(classifyTool("getpackage")).toBeUndefined();
  });
});
