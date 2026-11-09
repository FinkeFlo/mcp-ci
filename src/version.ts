import { readFileSync } from "node:fs";

/**
 * Version from a package.json, or "unknown" when it cannot be read, so a
 * broken install still starts and says so.
 */
export function readVersion(packageJson: URL): string {
  try {
    const version = JSON.parse(readFileSync(packageJson, "utf-8")).version;
    return typeof version === "string" && version ? version : "unknown";
  } catch {
    return "unknown";
  }
}

// The path is the same from src/ (tsx) and dist/ (installed package), since
// both sit next to package.json.
export const SERVER_VERSION = readVersion(new URL("../package.json", import.meta.url));
