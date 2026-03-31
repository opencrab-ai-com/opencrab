import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const clientState = vi.hoisted(() => ({
  instances: [] as unknown[],
  connect: vi.fn(async () => undefined),
  listTools: vi.fn(async () => ({
    tools: [
      {
        name: "list_pages",
        inputSchema: {},
      },
    ],
  })),
  callTool: vi.fn(),
  close: vi.fn(async () => undefined),
}));

const transportState = vi.hoisted(() => ({
  options: [] as unknown[],
  stderrOn: vi.fn(),
}));

vi.mock("@modelcontextprotocol/sdk/client", () => ({
  Client: class FakeClient {
    constructor() {
      clientState.instances.push(this);
    }

    connect = clientState.connect;
    listTools = clientState.listTools;
    callTool = clientState.callTool;
    close = clientState.close;
  },
}));

vi.mock("@modelcontextprotocol/sdk/client/stdio.js", () => ({
  StdioClientTransport: class FakeStdioClientTransport {
    stderr = {
      on: transportState.stderrOn,
    };

    constructor(options: unknown) {
      transportState.options.push(options);
    }
  },
}));

vi.mock("@modelcontextprotocol/sdk/server", () => ({
  Server: class FakeServer {
    setRequestHandler() {}
    async connect() {}
    async close() {}
  },
}));

vi.mock("@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js", () => ({
  WebStandardStreamableHTTPServerTransport: class FakeTransport {
    async handleRequest() {
      return new Response("{}", {
        status: 200,
        headers: {
          "Content-Type": "application/json; charset=utf-8",
        },
      });
    }
  },
}));

vi.mock("@modelcontextprotocol/sdk/types.js", () => ({
  CallToolRequestSchema: {},
  ListToolsRequestSchema: {},
}));

vi.mock("@/lib/resources/local-store", () => ({
  getSnapshot: () => ({
    settings: {
      browserConnectionMode: "current-browser",
    },
  }),
}));

vi.mock("@/lib/runtime/chrome", () => ({
  getChromeInstallationStatus: vi.fn(async () => ({
    ok: true,
    chromePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    message: "Chrome ready",
  })),
  resolveChromeExecutable: vi.fn(async () => "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"),
}));

vi.mock("@/lib/runtime/node-exec", () => ({
  buildOpenCrabNodeEnv: vi.fn((overrides = {}, baseEnv = {}) => ({
    ...(baseEnv as Record<string, string>),
    ...(overrides as Record<string, string>),
    ELECTRON_RUN_AS_NODE: "1",
  })),
  getOpenCrabNodeExecutable: vi.fn(() => "node"),
}));

vi.mock("@/lib/runtime/app-resource-paths", () => ({
  resolveOpenCrabResourcePath: vi.fn((...parts: string[]) => `/tmp/${parts.join("/")}`),
}));

vi.mock("@/lib/codex/browser-mcp-executable", () => ({
  resolveBrowserMcpInvocation: vi.fn(() => ({
    executablePath: "/tmp/chrome-devtools-mcp.js",
    command: "node",
    argsPrefix: ["/tmp/chrome-devtools-mcp.js"],
  })),
}));

function resetBrowserBridgeGlobals() {
  delete globalThis.__opencrabBrowserBridge;
  delete globalThis.__opencrabBrowserBridgePromise;
  delete globalThis.__opencrabBrowserBridgeLastError;
  delete globalThis.__opencrabManagedChromePath;
  delete globalThis.__opencrabManagedChromeWasLaunched;
  delete globalThis.__opencrabBrowserWarmupPromise;
  delete globalThis.__opencrabBrowserWarmupLastRunAt;
}

describe("browser session current-browser bridge", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.resetModules();
    resetBrowserBridgeGlobals();
    clientState.instances.length = 0;
    transportState.options.length = 0;
    transportState.stderrOn.mockReset();
    clientState.connect.mockReset().mockResolvedValue(undefined);
    clientState.listTools.mockReset().mockResolvedValue({
      tools: [
        {
          name: "list_pages",
          inputSchema: {},
        },
      ],
    });
    clientState.callTool.mockReset();
    clientState.close.mockReset().mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.useRealTimers();
    resetBrowserBridgeGlobals();
  });

  it("keeps the first current-browser bridge alive while the authorization probe is still pending", async () => {
    const pendingProbe = new Promise(() => undefined);
    clientState.callTool
      .mockImplementationOnce(() => pendingProbe)
      .mockResolvedValue({
        content: [],
      });

    const { ensureBrowserSessionWarmup, getBrowserSessionStatus } = await import(
      "@/lib/codex/browser-session"
    );

    const warmupPromise = ensureBrowserSessionWarmup({ force: true });
    await vi.advanceTimersByTimeAsync(8_000);
    await warmupPromise;

    expect(clientState.instances).toHaveLength(1);
    expect(clientState.close).not.toHaveBeenCalled();

    const status = await getBrowserSessionStatus();

    expect(status.status).toBe("ready");
    expect(clientState.instances).toHaveLength(1);
    expect(clientState.connect).toHaveBeenCalledTimes(1);
  });

  it("reuses the pending current-browser bridge when a conversation later waits for readiness", async () => {
    const pendingProbe = new Promise(() => undefined);
    clientState.callTool
      .mockImplementationOnce(() => pendingProbe)
      .mockResolvedValue({
        content: [],
      });

    const { ensureBrowserSessionWarmup, ensureBrowserSession } = await import(
      "@/lib/codex/browser-session"
    );

    const warmupPromise = ensureBrowserSessionWarmup({ force: true });
    await vi.advanceTimersByTimeAsync(8_000);
    await warmupPromise;

    const status = await ensureBrowserSession();

    expect(status.status).toBe("ready");
    expect(clientState.instances).toHaveLength(1);
    expect(clientState.connect).toHaveBeenCalledTimes(1);
  });
});
