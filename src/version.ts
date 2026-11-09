import { readFileSync } from "node:fs";

/**
 * Version from package.json, read at runtime. The path is the same from src/
 * (tsx) and dist/ (installed package), since both sit next to package.json.
 */
export const SERVER_VERSION: string = JSON.parse(
  readFileSync(new URL("../package.json", import.meta.url), "utf-8")
).version;
