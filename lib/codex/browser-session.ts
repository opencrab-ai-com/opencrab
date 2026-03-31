import { access, mkdir } from "node:fs/promises";
import http from "node:http";
import path from "node:path";
import { spawn } from "node:child_process";
import { Client } from "@modelcontextprotocol/sdk/client";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { Server } from "@modelcontextprotocol/sdk/server";
import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { getSnapshot } from "@/lib/resources/local-store";
import { OPENCRAB_CHROME_PROFILE_DIR } from "@/lib/resources/runtime-paths";
import type {
  BrowserConnectionMode,
  CodexBrowserSessionStatus,
} from "@/lib/resources/opencrab-api-types";

const DEFAULT_MANAGED_DEBUG_PORT = Number.parseInt(
  process.env.OPENCRAB_CHROME_DEBUG_PORT || "9333",
  10,
);
const MANAGED_DEBUG_PORT = Number.isFinite(DEFAULT_MANAGED_DEBUG_PORT)
  ? DEFAULT_MANAGED_DEBUG_PORT
  : 9333;
const MANAGED_BROWSER_URL = `http://127.0.0.1:${MANAGED_DEBUG_PORT}`;
const MANAGED_USER_DATA_DIR = OPENCRAB_CHROME_PROFILE_DIR;
const APP_ORIGIN = process.env.OPENCRAB_APP_ORIGIN || "http://127.0.0.1:3000";
const MCP_PROXY_URL = `${APP_ORIGIN}/api/codex/browser-mcp`;
const CHROME_CANDIDATES = [
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  path.join(process.env.HOME || "", "Applications/Google Chrome.app/Contents/MacOS/Google Chrome"),
];
const BROWSER_WARMUP_COOLDOWN_MS = 5 * 60_000;
const BROWSER_TOOL_PROBE_TIMEOUT_MS = 8_000;
const WAIT_TIMEOUT_MS = 12_000;
const POLL_INTERVAL_MS = 400;

type BrowserVersionPayload = {
  Browser?: string;
  webSocketDebuggerUrl?: string;
};

type BrowserTool = {
  name: string;
  description?: string;
  inputSchema: Record<string, unknown>;
  outputSchema?: Record<string, unknown>;
  annotations?: Record<string, unknown>;
};

type BrowserBridge = {
  mode: BrowserConnectionMode;
  client: Client;
  transport: StdioClientTransport;
  tools: BrowserTool[];
  chromePath: string | null;
  browserUrl: string | null;
  userDataDir: string | null;
  launchedByOpenCrab: boolean;
};

declare global {
  var __opencrabBrowserBridge: BrowserBridge | undefined;
  var __opencrabBrowserBridgePromise: Promise<BrowserBridge> | undefined;
  var __opencrabManagedChromePath: string | null | undefined;
  var __opencrabManagedChromeWasLaunched: boolean | undefined;
  var __opencrabBrowserWarmupPromise: Promise<void> | undefined;
  var __opencrabBrowserWarmupLastRunAt: number | undefined;
}

export function buildChromeDevtoolsMcpConfig() {
  return {
    "chrome-devtools": {
      command: process.execPath,
      args: [path.join(process.cwd(), "scripts", "browser_mcp_stdio_proxy.mjs")],
      env: {
        OPENCRAB_BROWSER_MCP_URL: MCP_PROXY_URL,
      },
    },
  };
}

export async function getBrowserSessionStatus(): Promise<CodexBrowserSessionStatus> {
  const mode = getPreferredBrowserConnectionMode();
  const bridge = globalThis.__opencrabBrowserBridge;

  if (bridge && bridge.mode === mode) {
    try {
      const toolsResult = await bridge.client.listTools();
      bridge.tools = normalizeTools(toolsResult.tools);
      return createStatus({
        ok: true,
        status: "ready",
        mode,
        message:
          mode === "current-browser"
            ? "OpenCrab 已连接你当前正在使用的 Chrome，会在同一服务进程内持续复用这条连接。"
            : "OpenCrab 已连接独立浏览器，会在同一服务进程内持续复用这条连接。",
      });
    } catch {
      await closeBrowserBridge();
    }
  }

  if (globalThis.__opencrabBrowserBridgePromise) {
    return createStatus({
      ok: false,
      status: "launching",
      mode,
      message:
        mode === "current-browser"
          ? "OpenCrab 正在连接你当前的 Chrome。首次连接需要你在浏览器里点击一次允许。"
          : "OpenCrab 正在启动并连接独立浏览器。",
    });
  }

  if (mode === "managed-browser") {
    const chromePath = await resolveChromeExecutable();

    if (!chromePath) {
      return createStatus({
        ok: false,
        status: "missing_browser",
        mode,
        chromePath: null,
        message: "没有找到可用的 Google Chrome，暂时无法启动独立浏览器。",
      });
    }
  }

  return createStatus({
    ok: false,
    status: "unreachable",
    mode,
    message:
      mode === "current-browser"
        ? "OpenCrab 会在启动时连接你当前正在使用的 Chrome。首次连接需要你允许一次，之后当前服务进程内会持续复用。"
        : "OpenCrab 会在启动时拉起独立浏览器并保持连接常驻。",
  });
}

export async function ensureBrowserSession(): Promise<CodexBrowserSessionStatus> {
  const mode = getPreferredBrowserConnectionMode();
  await ensureBrowserBridge(mode);
  return createStatus({
    ok: true,
    status: "ready",
    mode,
    message:
      mode === "current-browser"
        ? "OpenCrab 已连接你当前正在使用的 Chrome，会在当前服务进程内持续复用这条连接。"
        : "OpenCrab 已连接独立浏览器，会在当前服务进程内持续复用这条连接。",
  });
}

export function ensureBrowserSessionWarmup(input: { force?: boolean } = {}) {
  const lastRunAt = globalThis.__opencrabBrowserWarmupLastRunAt ?? 0;

  if (globalThis.__opencrabBrowserWarmupPromise) {
    return globalThis.__opencrabBrowserWarmupPromise;
  }

  if (!input.force && Date.now() - lastRunAt < BROWSER_WARMUP_COOLDOWN_MS) {
    return Promise.resolve();
  }

  globalThis.__opencrabBrowserWarmupLastRunAt = Date.now();

  const task = ensureBrowserSession()
    .then(() => probeBrowserToolAccess())
    .then(() => undefined)
    .catch(() => undefined)
    .finally(() => {
      globalThis.__opencrabBrowserWarmupPromise = undefined;
    });

  globalThis.__opencrabBrowserWarmupPromise = task;
  return task;
}

async function probeBrowserToolAccess() {
  const bridge = globalThis.__opencrabBrowserBridge;

  if (!bridge) {
    return;
  }

  const probeTool = bridge.tools.find((tool) => tool.name === "list_pages");

  if (!probeTool) {
    return;
  }

  await promiseWithTimeout(
    bridge.client.callTool({
      name: probeTool.name,
      arguments: {},
    }),
    BROWSER_TOOL_PROBE_TIMEOUT_MS,
  );
}

export async function handleBrowserMcpRequest(request: Request) {
  await ensureBrowserBridge(getPreferredBrowserConnectionMode());
  const bridge = globalThis.__opencrabBrowserBridge;

  if (!bridge) {
    return new Response(JSON.stringify({ error: "浏览器连接尚未就绪。" }), {
      status: 503,
      headers: {
        "Content-Type": "application/json; charset=utf-8",
      },
    });
  }

  const server = new Server(
    {
      name: "opencrab-browser-bridge",
      version: "0.1.0",
    },
    {
      capabilities: {
        tools: {},
      },
    },
  );

  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: bridge.tools,
  }));

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const result = await bridge.client.callTool({
      name: request.params.name,
      arguments: isPlainObject(request.params.arguments) ? request.params.arguments : {},
    });

    return result;
  });

  const transport = new WebStandardStreamableHTTPServerTransport({
    sessionIdGenerator: undefined,
    enableJsonResponse: true,
  });

  await server.connect(transport);

  try {
    return await transport.handleRequest(request);
  } finally {
    await server.close().catch(() => undefined);
  }
}

async function ensureBrowserBridge(mode: BrowserConnectionMode) {
  const existingBridge = globalThis.__opencrabBrowserBridge;

  if (existingBridge?.mode === mode) {
    try {
      const toolsResult = await existingBridge.client.listTools();
      existingBridge.tools = normalizeTools(toolsResult.tools);
      return existingBridge;
    } catch {
      await closeBrowserBridge();
    }
  } else if (existingBridge) {
    await closeBrowserBridge();
  }

  if (globalThis.__opencrabBrowserBridgePromise) {
    return globalThis.__opencrabBrowserBridgePromise;
  }

  const bridgePromise = createBrowserBridge(mode).finally(() => {
    globalThis.__opencrabBrowserBridgePromise = undefined;
  });
  globalThis.__opencrabBrowserBridgePromise = bridgePromise;
  const bridge = await bridgePromise;
  globalThis.__opencrabBrowserBridge = bridge;
  return bridge;
}

async function createBrowserBridge(mode: BrowserConnectionMode): Promise<BrowserBridge> {
  if (mode === "managed-browser") {
    await ensureManagedBrowserInstance();
  }

  const transport = new StdioClientTransport({
    command: "npx",
    args:
      mode === "current-browser"
        ? ["-y", "chrome-devtools-mcp@latest", "--autoConnect", "--channel=stable", "--no-usage-statistics"]
        : ["-y", "chrome-devtools-mcp@latest", `--browserUrl=${MANAGED_BROWSER_URL}`, "--no-usage-statistics"],
    env: buildBrowserBridgeEnv(),
    stderr: "pipe",
  });

  transport.stderr?.on("data", () => {
    // keep stderr attached so early diagnostics are not dropped
  });

  const client = new Client({
    name: "opencrab-browser-bridge",
    version: "0.1.0",
  });

  await client.connect(transport);
  const toolsResult = await client.listTools();

  return {
    mode,
    client,
    transport,
    tools: normalizeTools(toolsResult.tools),
    chromePath:
      mode === "managed-browser" ? globalThis.__opencrabManagedChromePath ?? null : null,
    browserUrl: mode === "managed-browser" ? MANAGED_BROWSER_URL : null,
    userDataDir: mode === "managed-browser" ? MANAGED_USER_DATA_DIR : null,
    launchedByOpenCrab: mode === "managed-browser" ? Boolean(globalThis.__opencrabManagedChromeWasLaunched) : false,
  };
}

async function closeBrowserBridge() {
  const bridge = globalThis.__opencrabBrowserBridge;
  globalThis.__opencrabBrowserBridge = undefined;

  if (!bridge) {
    return;
  }

  try {
    await bridge.client.close();
  } catch {
    // ignore close noise during reconnects
  }
}

function getPreferredBrowserConnectionMode(): BrowserConnectionMode {
  return getSnapshot().settings.browserConnectionMode || "current-browser";
}

async function ensureManagedBrowserInstance() {
  const current = await fetchBrowserVersion();

  if (current) {
    return;
  }

  await mkdir(MANAGED_USER_DATA_DIR, { recursive: true });
  const chromePath = await resolveChromeExecutable();

  if (!chromePath) {
    throw new Error("没有找到可用的 Google Chrome。");
  }

  globalThis.__opencrabManagedChromePath = chromePath;
  launchManagedChrome();
  globalThis.__opencrabManagedChromeWasLaunched = true;

  const ready = await waitForBrowserVersion();

  if (!ready) {
    throw new Error("Chrome 已尝试启动，但还没有暴露远程调试端口。");
  }
}

async function resolveChromeExecutable() {
  for (const candidate of CHROME_CANDIDATES) {
    if (!candidate) {
      continue;
    }

    try {
      await access(candidate);
      return candidate;
    } catch {
      continue;
    }
  }

  return null;
}

function launchManagedChrome() {
  const child = spawn(
    "open",
    [
      "-na",
      "Google Chrome",
      "--args",
      `--remote-debugging-port=${MANAGED_DEBUG_PORT}`,
      `--user-data-dir=${MANAGED_USER_DATA_DIR}`,
      "--no-first-run",
      "--no-default-browser-check",
      "--new-window",
      "about:blank",
    ],
    {
      detached: true,
      stdio: "ignore",
    },
  );

  child.unref();
}

async function waitForBrowserVersion() {
  const start = Date.now();

  while (Date.now() - start < WAIT_TIMEOUT_MS) {
    const version = await fetchBrowserVersion();

    if (version) {
      return version;
    }

    await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
  }

  return null;
}

async function fetchBrowserVersion() {
  return new Promise<BrowserVersionPayload | null>((resolve) => {
    const request = http.request(
      {
        host: "127.0.0.1",
        port: MANAGED_DEBUG_PORT,
        path: "/json/version",
        method: "GET",
      },
      (response) => {
        if (response.statusCode !== 200) {
          response.resume();
          resolve(null);
          return;
        }

        let raw = "";
        response.setEncoding("utf8");
        response.on("data", (chunk) => {
          raw += chunk;
        });
        response.on("end", () => {
          try {
            resolve(JSON.parse(raw) as BrowserVersionPayload);
          } catch {
            resolve(null);
          }
        });
      },
    );

    request.setTimeout(1500, () => {
      request.destroy();
      resolve(null);
    });
    request.on("error", () => {
      resolve(null);
    });
    request.end();
  });
}

function buildBrowserBridgeEnv() {
  const env: Record<string, string> = {};

  for (const key of [
    "PATH",
    "HOME",
    "USER",
    "LOGNAME",
    "SHELL",
    "TMPDIR",
    "LANG",
    "LC_ALL",
    "LC_CTYPE",
  ]) {
    const value = process.env[key];

    if (typeof value === "string") {
      env[key] = value;
    }
  }

  return env;
}

function createStatus(input: {
  ok: boolean;
  status: CodexBrowserSessionStatus["status"];
  mode: BrowserConnectionMode;
  message: string;
  chromePath?: string | null;
}): CodexBrowserSessionStatus {
  const bridge = globalThis.__opencrabBrowserBridge;

  return {
    ok: input.ok,
    status: input.status,
    mode: input.mode,
    browserUrl:
      input.mode === "managed-browser"
        ? bridge?.browserUrl ?? MANAGED_BROWSER_URL
        : null,
    userDataDir:
      input.mode === "managed-browser"
        ? bridge?.userDataDir ?? MANAGED_USER_DATA_DIR
        : null,
    launchedByOpenCrab:
      input.mode === "managed-browser"
        ? bridge?.launchedByOpenCrab ?? Boolean(globalThis.__opencrabManagedChromeWasLaunched)
        : false,
    chromePath:
      input.mode === "managed-browser"
        ? input.chromePath ?? bridge?.chromePath ?? globalThis.__opencrabManagedChromePath ?? null
        : null,
    message: input.message,
  };
}

function normalizeTools(tools: BrowserTool[]) {
  return tools.map((tool) => ({
    name: tool.name,
    description: tool.description,
    inputSchema: tool.inputSchema,
    outputSchema: tool.outputSchema,
    annotations: tool.annotations,
  }));
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function promiseWithTimeout<T>(promise: Promise<T>, timeoutMs: number) {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error("Browser MCP probe timed out."));
    }, timeoutMs);

    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error) => {
        clearTimeout(timer);
        reject(error);
      },
    );
  });
}
