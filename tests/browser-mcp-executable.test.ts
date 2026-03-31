import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  resolveBrowserMcpExecutablePath,
  resolveBrowserMcpInvocation,
} from "@/lib/codex/browser-mcp-executable";

describe("browser mcp executable", () => {
  it("prefers the bundled chrome-devtools-mcp script inside the app resource root", () => {
    const env = {
      OPENCRAB_RESOURCE_ROOT: path.resolve(process.cwd()),
    } as unknown as NodeJS.ProcessEnv;

    const executablePath = resolveBrowserMcpExecutablePath(env);

    expect(executablePath).toContain(
      path.join(
        "node_modules",
        "chrome-devtools-mcp",
        "build",
        "src",
        "bin",
        "chrome-devtools-mcp.js",
      ),
    );
  });

  it("launches the bundled js entry with the OpenCrab node executable", () => {
    const env = {
      OPENCRAB_RESOURCE_ROOT: path.resolve(process.cwd()),
      OPENCRAB_NODE_EXECUTABLE: "/tmp/opencrab-node",
    } as unknown as NodeJS.ProcessEnv;

    const invocation = resolveBrowserMcpInvocation(env);

    expect(invocation.command).toBe("/tmp/opencrab-node");
    expect(invocation.argsPrefix[0]).toContain("chrome-devtools-mcp.js");
  });
});
