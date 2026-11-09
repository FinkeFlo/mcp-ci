import type { McpServer, RegisteredTool } from "@modelcontextprotocol/server";
import type { ToolAccess } from "./tool-access.js";

/** Returns a view of `server` whose `registerTool` hands every tool to `access`. */
export function createGuardedServer(server: McpServer, access: ToolAccess): McpServer {
  return new Proxy(server, {
    get(target, property, receiver) {
      if (property === "registerTool") {
        const original = target.registerTool.bind(target) as (
          name: string,
          ...rest: unknown[]
        ) => RegisteredTool;
        const registerTool = (name: string, ...rest: unknown[]): RegisteredTool => {
          const handle = original(name, ...rest);
          access.track(name, handle);
          return handle;
        };
        return registerTool as McpServer["registerTool"];
      }
      const value = Reflect.get(target, property, receiver);
      return typeof value === "function" ? value.bind(target) : value;
    },
  });
}
