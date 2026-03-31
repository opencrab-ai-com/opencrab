import { execCodexCommand } from "@/lib/codex/executable";
import {
  createCodexAppServerClient,
  type CodexAppServerClient,
  type CodexAppServerNotification,
} from "@/lib/codex/app-server-client";
import { buildChatGptLoginEnv, getCodexLoginStatus } from "@/lib/codex/sdk";
import type { ChatGptConnectionStatusResponse } from "@/lib/resources/opencrab-api-types";
import { openUrlInChrome } from "@/lib/runtime/chrome";

const STATUS_POLL_INTERVAL_MS = 2000;

type LoginAccountResponse = {
  type: "chatgpt";
  loginId: string;
  authUrl: string;
};

type AccountLoginCompletedNotification = {
  loginId: string | null;
  success: boolean;
  error: string | null;
};

type ActiveConnection = {
  appServer: CodexAppServerClient | null;
  unsubscribeNotifications: (() => void) | null;
  authMode: ChatGptConnectionStatusResponse["authMode"];
  stage: ChatGptConnectionStatusResponse["stage"];
  authUrl: string | null;
  loginId: string | null;
  deviceCode: string | null;
  codeExpiresAt: string | null;
  startedAt: string;
  connectedAt: string | null;
  error: string | null;
  message: string;
  pollTimer: NodeJS.Timeout | null;
  loginStatusCheckInFlight: boolean;
  hasAttemptedBrowserOpen: boolean;
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
    appServer: null,
    unsubscribeNotifications: null,
    authMode: "browser",
    stage: "connecting",
    authUrl: null,
    loginId: null,
    deviceCode: null,
    codeExpiresAt: null,
    startedAt: new Date().toISOString(),
    connectedAt: null,
    error: null,
    message: "正在准备 ChatGPT 连接...",
    pollTimer: null,
    loginStatusCheckInFlight: false,
    hasAttemptedBrowserOpen: false,
  };

  try {
    const appServer = await createCodexAppServerClient(
      buildChatGptLoginEnv() as NodeJS.ProcessEnv,
    );

    if (!activeConnection) {
      appServer.close();
      return buildDisconnectedResponse("已取消这次 ChatGPT 连接。");
    }

    activeConnection.appServer = appServer;
    activeConnection.unsubscribeNotifications = appServer.onNotification(
      handleAppServerNotification,
    );

    const loginResponse = await appServer.request<LoginAccountResponse>(
      "account/login/start",
      { type: "chatgpt" },
    );

    if (!activeConnection) {
      return buildDisconnectedResponse("已取消这次 ChatGPT 连接。");
    }

    if (
      !loginResponse ||
      loginResponse.type !== "chatgpt" ||
      !loginResponse.loginId ||
      !loginResponse.authUrl
    ) {
      throw new Error("OpenCrab 没有拿到有效的 ChatGPT 登录地址。");
    }

    activeConnection.loginId = loginResponse.loginId;
    activeConnection.authUrl = loginResponse.authUrl;
    activeConnection.stage = "waiting_browser_auth";
    activeConnection.message =
      "Google Chrome 登录页已经准备好。请在打开的 ChatGPT 页面里完成登录。";

    ensureStatusPolling();
    await tryOpenPendingAuthUrlInChrome();

    return getChatGptConnectionStatus();
  } catch (error) {
    finalizeConnection({
      stage: "error",
      error:
        error instanceof Error
          ? error.message
          : "OpenCrab 暂时无法发起 ChatGPT 连接。",
      message: "这次 ChatGPT 连接没有完成，请重试。",
    });

    return getChatGptConnectionStatus();
  }
}

export async function cancelChatGptConnection(): Promise<ChatGptConnectionStatusResponse> {
  if (activeConnection?.appServer && activeConnection.loginId) {
    try {
      await activeConnection.appServer.request("account/login/cancel", {
        loginId: activeConnection.loginId,
      });
    } catch {
      // If cancellation fails, we still tear down the local pending session.
    }
  }

  finalizeConnection({
    stage: "not_connected",
    error: null,
    message: "已取消这次 ChatGPT 连接。",
  });

  return buildDisconnectedResponse("已取消这次 ChatGPT 连接。");
}

export async function disconnectChatGptConnection(): Promise<ChatGptConnectionStatusResponse> {
  finalizeConnection({
    stage: "not_connected",
    error: null,
    message: "已断开 ChatGPT 连接。",
  });

  try {
    await execCodexCommand(["logout"], {
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

  return buildDisconnectedResponse("ChatGPT 已断开连接。需要时可以重新连接。");
}

export async function openPendingChatGptConnectionInChrome(): Promise<ChatGptConnectionStatusResponse> {
  const status = await getChatGptConnectionStatus();

  if (status.stage !== "waiting_browser_auth" || status.isConnected) {
    return status;
  }

  if (!status.authUrl) {
    finalizeConnection({
      stage: "expired",
      error: "这次登录页已经失效，请重新连接 ChatGPT。",
      message: "这次登录页已经失效，请重新连接 ChatGPT。",
    });

    return getChatGptConnectionStatus();
  }

  const authUrl = status.authUrl;
  await openUrlInChrome(authUrl, buildChatGptLoginEnv() as NodeJS.ProcessEnv);

  if (activeConnection) {
    activeConnection.hasAttemptedBrowserOpen = true;
    activeConnection.message =
      "Google Chrome 已重新打开 ChatGPT 登录页。请在那个页面里完成登录。";
  }

  return getChatGptConnectionStatus();
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
  } finally {
    if (activeConnection) {
      activeConnection.loginStatusCheckInFlight = false;
    }
  }
}

function handleAppServerNotification(notification: CodexAppServerNotification) {
  if (notification.method !== "account/login/completed" || !activeConnection) {
    return;
  }

  const payload = notification.params as AccountLoginCompletedNotification | undefined;

  if (
    payload?.loginId &&
    activeConnection.loginId &&
    payload.loginId !== activeConnection.loginId
  ) {
    return;
  }

  if (payload?.success) {
    activeConnection.stage = "connecting";
    activeConnection.error = null;
    activeConnection.message = "已检测到 ChatGPT 网页登录完成，正在同步连接状态...";
    void refreshPendingConnection();
    return;
  }

  finalizeConnection({
    stage: "error",
    error: payload?.error || "这次 ChatGPT 连接没有完成，请重试。",
    message: "这次 ChatGPT 连接没有完成，请重试。",
  });
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

  activeConnection.unsubscribeNotifications?.();
  activeConnection.unsubscribeNotifications = null;

  activeConnection.appServer?.close();
  activeConnection.appServer = null;

  activeConnection.stage = patch.stage || activeConnection.stage;
  activeConnection.connectedAt = patch.connectedAt ?? activeConnection.connectedAt;
  activeConnection.error = patch.error ?? activeConnection.error;
  activeConnection.message = patch.message ?? activeConnection.message;

  if (activeConnection.stage === "connected") {
    activeConnection.authUrl = null;
    activeConnection.loginId = null;
    activeConnection.deviceCode = null;
    activeConnection.codeExpiresAt = null;
    return;
  }

  if (activeConnection.stage === "not_connected") {
    activeConnection = null;
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

function buildDisconnectedResponse(message: string): ChatGptConnectionStatusResponse {
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
    message,
  });
}

function isPendingStage(stage: ChatGptConnectionStatusResponse["stage"]) {
  return stage === "connecting" || stage === "waiting_browser_auth";
}

async function tryOpenPendingAuthUrlInChrome() {
  if (!activeConnection || activeConnection.hasAttemptedBrowserOpen) {
    return;
  }

  if (!activeConnection.authUrl) {
    finalizeConnection({
      stage: "expired",
      error: "这次登录页已经失效，请重新连接 ChatGPT。",
      message: "这次登录页已经失效，请重新连接 ChatGPT。",
    });
    return;
  }

  const authUrl = activeConnection.authUrl;
  activeConnection.hasAttemptedBrowserOpen = true;

  try {
    await openUrlInChrome(authUrl, buildChatGptLoginEnv() as NodeJS.ProcessEnv);
  } catch {
    if (!activeConnection || activeConnection.stage !== "waiting_browser_auth") {
      return;
    }

    activeConnection.message =
      "登录页已经准备好，但 OpenCrab 没能自动在 Google Chrome 中打开。请点击“在 Chrome 中重新打开”，然后完成登录。";
  }
}
