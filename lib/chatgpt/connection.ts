import { execFile, spawn } from "node:child_process";
import { promisify } from "node:util";
import type { ChildProcess } from "node:child_process";
import type { ChatGptConnectionStatusResponse } from "@/lib/resources/opencrab-api-types";
import { buildChatGptLoginEnv, getCodexLoginStatus } from "@/lib/codex/sdk";

const execFileAsync = promisify(execFile);
const DEVICE_AUTH_URL = "https://auth.openai.com/codex/device";
const DEFAULT_BROWSER_AUTH_PATH = "http://localhost:1455";
const DEFAULT_DEVICE_CODE_TTL_MS = 15 * 60 * 1000;
const STATUS_POLL_INTERVAL_MS = 2000;

type ActiveConnection = {
  child: ChildProcess | null;
  authMode: ChatGptConnectionStatusResponse["authMode"];
  stage: ChatGptConnectionStatusResponse["stage"];
  authUrl: string | null;
  deviceCode: string | null;
  codeExpiresAt: string | null;
  startedAt: string;
  connectedAt: string | null;
  error: string | null;
  message: string;
  output: string;
  pollTimer: NodeJS.Timeout | null;
  loginStatusCheckInFlight: boolean;
};

let activeConnection: ActiveConnection | null = null;

export async function getChatGptConnectionStatus(): Promise<ChatGptConnectionStatusResponse> {
  const login = await getCodexLoginStatus();

  if (login.ok) {
    finalizeConnection({
      stage: "connected",
      connectedAt: activeConnection?.connectedAt || new Date().toISOString(),
      error: null,
      message: "ChatGPT 已连接，现在可以直接开始使用。",
    });

    return buildResponse({
      authMode: null,
      stage: "connected",
      isConnected: true,
      authUrl: null,
      deviceCode: null,
      codeExpiresAt: null,
      startedAt: activeConnection?.startedAt || null,
      connectedAt: activeConnection?.connectedAt || new Date().toISOString(),
      error: null,
      message: "ChatGPT 已连接，现在可以直接开始使用。",
    });
  }

  if (!activeConnection) {
    return buildResponse({
      authMode: null,
      stage: "not_connected",
      isConnected: false,
      authUrl: null,
      deviceCode: null,
      codeExpiresAt: null,
      startedAt: null,
      connectedAt: null,
      error: null,
      message: "连接 ChatGPT 后即可开始发送消息和使用 OpenCrab。",
    });
  }

  if (activeConnection.codeExpiresAt && Date.now() >= Date.parse(activeConnection.codeExpiresAt)) {
    finalizeConnection({
      stage: "expired",
      error: "这次连接码已经过期。",
      message: "这次连接码已经过期，请重新连接 ChatGPT。",
    });
  }

  return buildResponse({
    authMode: activeConnection.authMode,
    stage: activeConnection.stage,
    isConnected: false,
    authUrl: activeConnection.authUrl,
    deviceCode: activeConnection.deviceCode,
    codeExpiresAt: activeConnection.codeExpiresAt,
    startedAt: activeConnection.startedAt,
    connectedAt: activeConnection.connectedAt,
    error: activeConnection.error,
    message: activeConnection.message,
  });
}

export async function startChatGptConnection(): Promise<ChatGptConnectionStatusResponse> {
  const login = await getCodexLoginStatus();

  if (login.ok) {
    return buildResponse({
      authMode: null,
      stage: "connected",
      isConnected: true,
      authUrl: null,
      deviceCode: null,
      codeExpiresAt: null,
      startedAt: null,
      connectedAt: new Date().toISOString(),
      error: null,
      message: "ChatGPT 已连接，现在可以直接开始使用。",
    });
  }

  if (activeConnection && isPendingStage(activeConnection.stage)) {
    return getChatGptConnectionStatus();
  }

  finalizeConnection();

  activeConnection = {
    child: null,
    authMode: "browser",
    stage: "connecting",
    authUrl: null,
    deviceCode: null,
    codeExpiresAt: null,
    startedAt: new Date().toISOString(),
    connectedAt: null,
    error: null,
    message: "正在准备 ChatGPT 连接...",
    output: "",
    pollTimer: null,
    loginStatusCheckInFlight: false,
  };

  const child = spawn("codex", ["login"], {
    env: buildChatGptLoginEnv() as NodeJS.ProcessEnv,
    stdio: ["ignore", "pipe", "pipe"],
  });

  activeConnection.child = child;

  child.stdout.on("data", (chunk: Buffer | string) => {
    appendProcessOutput(chunk);
  });

  child.stderr.on("data", (chunk: Buffer | string) => {
    appendProcessOutput(chunk);
  });

  child.on("exit", (code, signal) => {
    if (!activeConnection) {
      return;
    }

    activeConnection.child = null;

    if (activeConnection.stage === "connected" || activeConnection.stage === "not_connected") {
      return;
    }

    if (activeConnection.codeExpiresAt && Date.now() >= Date.parse(activeConnection.codeExpiresAt)) {
      finalizeConnection({
        stage: "expired",
        error: "这次连接码已经过期。",
        message: "这次连接码已经过期，请重新连接 ChatGPT。",
      });
      return;
    }

    if (signal === "SIGTERM") {
      finalizeConnection({
        stage: "not_connected",
        error: null,
        message: "已取消这次 ChatGPT 连接。",
      });
      return;
    }

    if (code === 0) {
      return;
    }

    finalizeConnection({
      stage: "error",
      error: buildProcessErrorMessage(activeConnection.output),
      message: "这次 ChatGPT 连接没有完成，请重试。",
    });
  });

  ensureStatusPolling();
  await waitForDeviceCode();

  return getChatGptConnectionStatus();
}

export async function cancelChatGptConnection(): Promise<ChatGptConnectionStatusResponse> {
  finalizeConnection({
    stage: "not_connected",
    error: null,
    message: "已取消这次 ChatGPT 连接。",
  });

  return buildResponse({
    authMode: null,
    stage: "not_connected",
    isConnected: false,
    authUrl: null,
    deviceCode: null,
    codeExpiresAt: null,
    startedAt: null,
    connectedAt: null,
    error: null,
    message: "已取消这次 ChatGPT 连接。",
  });
}

export async function disconnectChatGptConnection(): Promise<ChatGptConnectionStatusResponse> {
  finalizeConnection({
    stage: "not_connected",
    error: null,
    message: "已断开 ChatGPT 连接。",
  });

  try {
    await execFileAsync("codex", ["logout"], {
      env: buildChatGptLoginEnv() as NodeJS.ProcessEnv,
    });
  } catch (error) {
        return buildResponse({
          authMode: null,
          stage: "error",
          isConnected: false,
      authUrl: null,
      deviceCode: null,
      codeExpiresAt: null,
      startedAt: null,
      connectedAt: null,
      error: error instanceof Error ? error.message : "断开 ChatGPT 连接失败。",
      message: "断开 ChatGPT 连接失败，请稍后重试。",
    });
  }

  return buildResponse({
    authMode: null,
    stage: "not_connected",
    isConnected: false,
    authUrl: null,
    deviceCode: null,
    codeExpiresAt: null,
    startedAt: null,
    connectedAt: null,
    error: null,
    message: "ChatGPT 已断开连接。需要时可以重新连接。",
  });
}

function appendProcessOutput(chunk: Buffer | string) {
  if (!activeConnection) {
    return;
  }

  activeConnection.output += stripAnsi(String(chunk));
  updateConnectionFromOutput();
}

function updateConnectionFromOutput() {
  if (!activeConnection) {
    return;
  }

  const authUrlMatch = activeConnection.output.match(/https:\/\/auth\.openai\.com\/oauth\/authorize\S*/i);
  const localServerMatch = activeConnection.output.match(/http:\/\/localhost:1455\S*/i);
  const codeMatch = activeConnection.output.match(
    /Enter this one-time code[\s\S]*?\n\s*([A-Z0-9]{4,}(?:-[A-Z0-9]{4,})+)\b/i,
  );
  const expiresMatch = activeConnection.output.match(/expires in (\d+) minutes/i);

  if (authUrlMatch && !activeConnection.authUrl) {
    activeConnection.authUrl = authUrlMatch[0];
  }

  if (/device-auth/i.test(activeConnection.output) && !activeConnection.authUrl) {
    activeConnection.authMode = "device_code";
    activeConnection.authUrl = DEVICE_AUTH_URL;
  }

  if (codeMatch && !activeConnection.deviceCode) {
    activeConnection.authMode = "device_code";
    activeConnection.deviceCode = codeMatch[1];
  }

  if (expiresMatch && !activeConnection.codeExpiresAt) {
    const expiresInMinutes = Number.parseInt(expiresMatch[1], 10);
    activeConnection.codeExpiresAt = new Date(
      Date.now() + expiresInMinutes * 60 * 1000,
    ).toISOString();
  }

  if (activeConnection.deviceCode && !activeConnection.codeExpiresAt) {
    activeConnection.codeExpiresAt = new Date(Date.now() + DEFAULT_DEVICE_CODE_TTL_MS).toISOString();
  }

  if (activeConnection.authUrl || activeConnection.deviceCode || localServerMatch) {
    activeConnection.stage = "waiting_browser_auth";
    activeConnection.authUrl =
      activeConnection.authUrl ||
      (activeConnection.authMode === "device_code" ? DEVICE_AUTH_URL : localServerMatch?.[0] || DEFAULT_BROWSER_AUTH_PATH);
    activeConnection.message =
      activeConnection.authMode === "device_code"
        ? "浏览器授权页已经准备好。请在打开的 ChatGPT 页面里输入一次性代码完成连接。"
        : "浏览器授权页已经准备好。请在打开的 ChatGPT 页面里完成授权。";
  }
}

function ensureStatusPolling() {
  if (!activeConnection || activeConnection.pollTimer) {
    return;
  }

  activeConnection.pollTimer = setInterval(() => {
    void refreshPendingConnection();
  }, STATUS_POLL_INTERVAL_MS);
}

async function refreshPendingConnection() {
  if (!activeConnection || activeConnection.loginStatusCheckInFlight) {
    return;
  }

  activeConnection.loginStatusCheckInFlight = true;

  try {
    const login = await getCodexLoginStatus();

    if (login.ok) {
      finalizeConnection({
        stage: "connected",
        connectedAt: new Date().toISOString(),
        error: null,
        message: "ChatGPT 已连接，现在可以直接开始使用。",
      });
      return;
    }

    if (activeConnection.codeExpiresAt && Date.now() >= Date.parse(activeConnection.codeExpiresAt)) {
      finalizeConnection({
        stage: "expired",
        error: "这次连接码已经过期。",
        message: "这次连接码已经过期，请重新连接 ChatGPT。",
      });
    }
  } finally {
    if (activeConnection) {
      activeConnection.loginStatusCheckInFlight = false;
    }
  }
}

async function waitForDeviceCode(timeoutMs = 4000) {
  const startedAt = Date.now();

  while (Date.now() - startedAt < timeoutMs) {
    if (!activeConnection) {
      return;
    }

    if (
      activeConnection.stage === "waiting_browser_auth" ||
      activeConnection.stage === "connected" ||
      activeConnection.stage === "error"
    ) {
      return;
    }

    await new Promise((resolve) => setTimeout(resolve, 120));
  }
}

function finalizeConnection(
  patch: Partial<Pick<ActiveConnection, "stage" | "connectedAt" | "error" | "message">> = {},
) {
  if (!activeConnection) {
    return;
  }

  if (activeConnection.pollTimer) {
    clearInterval(activeConnection.pollTimer);
    activeConnection.pollTimer = null;
  }

  if (activeConnection.child && !activeConnection.child.killed) {
    activeConnection.child.kill("SIGTERM");
  }

  activeConnection.child = null;
  activeConnection.stage = patch.stage || activeConnection.stage;
  activeConnection.connectedAt = patch.connectedAt ?? activeConnection.connectedAt;
  activeConnection.error = patch.error ?? activeConnection.error;
  activeConnection.message = patch.message ?? activeConnection.message;

  if (activeConnection.stage === "connected") {
    activeConnection.authUrl = null;
    activeConnection.deviceCode = null;
    activeConnection.codeExpiresAt = null;
    return;
  }

  if (activeConnection.stage === "not_connected") {
    activeConnection = null;
    return;
  }

  if (activeConnection.stage === "expired" || activeConnection.stage === "error") {
    return;
  }
}

function buildResponse(
  value: Omit<ChatGptConnectionStatusResponse, "provider">,
): ChatGptConnectionStatusResponse {
  return {
    provider: "chatgpt",
    ...value,
  };
}

function buildProcessErrorMessage(output: string) {
  const normalized = output
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

  return normalized.at(-1) || "OpenCrab 暂时无法发起 ChatGPT 连接。";
}

function isPendingStage(stage: ChatGptConnectionStatusResponse["stage"]) {
  return stage === "connecting" || stage === "waiting_browser_auth";
}

function stripAnsi(value: string) {
  return value.replace(/\u001B\[[0-9;]*m/g, "");
}
