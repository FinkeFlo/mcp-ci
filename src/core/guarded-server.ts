import type { McpServer, RegisteredTool } from "@modelcontextprotocol/server";
import type { ToolAccess } from "./tool-access.js";

/**
 * Returns a view of `server` whose `registerTool` hands every tool to `access`
 * and wraps its handler: a tool the active tenant does not allow is refused at
 * call time, and an allowed restricted call stays pinned to that tenant.
 */
export function createGuardedServer(server: McpServer, access: ToolAccess): McpServer {
  return new Proxy(server, {
    get(target, property, receiver) {
      if (property === "registerTool") {
        const original = target.registerTool.bind(target) as (
          name: string,
          ...rest: unknown[]
        ) => RegisteredTool;
        const registerTool = (name: string, ...rest: unknown[]): RegisteredTool => {
          const handler = rest.at(-1);
          if (typeof handler === "function") {
            rest[rest.length - 1] = (...args: unknown[]) =>
              access.call(
                name,
                () => handler(...args),
                (tenantKey) => ({
                  content: [{ type: "text", text: `Tool '${name}' is not allowed on tenant '${tenantKey}'.` }],
                  isError: true,
                })
              );
          }
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
