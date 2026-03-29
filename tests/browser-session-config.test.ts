import { afterEach, describe, expect, it, vi } from "vitest";

describe("browser session desktop config", () => {
  const originalAppOrigin = process.env.OPENCRAB_APP_ORIGIN;
  const originalElectronRunAsNode = process.env.ELECTRON_RUN_AS_NODE;

  afterEach(() => {
    if (typeof originalAppOrigin === "string") {
      process.env.OPENCRAB_APP_ORIGIN = originalAppOrigin;
    } else {
      delete process.env.OPENCRAB_APP_ORIGIN;
    }

    if (typeof originalElectronRunAsNode === "string") {
      process.env.ELECTRON_RUN_AS_NODE = originalElectronRunAsNode;
    } else {
      delete process.env.ELECTRON_RUN_AS_NODE;
    }

    vi.resetModules();
  });

  it("builds the chrome devtools MCP proxy config with the desktop bridge URL", async () => {
    process.env.OPENCRAB_APP_ORIGIN = "http://127.0.0.1:4312";
    process.env.ELECTRON_RUN_AS_NODE = "1";

    const { buildChromeDevtoolsMcpConfig } = await import("@/lib/codex/browser-session");
    const config = buildChromeDevtoolsMcpConfig()["chrome-devtools"];

    expect(config.command).toBe(process.execPath);
    expect(config.args[0]).toMatch(/scripts[/\\]browser_mcp_stdio_proxy\.mjs$/);
    expect(config.env.OPENCRAB_BROWSER_MCP_URL).toBe(
      "http://127.0.0.1:4312/api/codex/browser-mcp",
    );
    expect(config.env.ELECTRON_RUN_AS_NODE).toBe("1");
  });
});
