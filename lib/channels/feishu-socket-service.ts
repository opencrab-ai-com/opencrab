import * as Lark from "@larksuiteoapi/node-sdk";
import type { HttpInstance } from "@larksuiteoapi/node-sdk";
import {
  getChannelDetail,
  markChannelError,
  updateChannelRecord,
} from "@/lib/channels/channel-store";
import { enqueueFeishuInboundMessage } from "@/lib/channels/feishu-inbound";
import { parseFeishuEventMessage } from "@/lib/channels/feishu";
import { getFeishuSecrets } from "@/lib/channels/secret-store";

declare global {
  var __opencrabFeishuSocketClient: Lark.WSClient | undefined;
  var __opencrabFeishuSocketKey: string | undefined;
  var __opencrabFeishuSocketMonitorTimer: ReturnType<typeof setTimeout> | undefined;
  var __opencrabFeishuSocketStartPromise:
    | Promise<{
        ok: boolean;
        connected: boolean;
        message: string;
      }>
    | undefined;
}

const FEISHU_SOCKET_CONNECT_TIMEOUT_MS = 8_000;
const FEISHU_SOCKET_MONITOR_INTERVAL_MS = 1_000;

type FeishuSocketLogger = {
  error: (...messages: unknown[]) => void;
  warn: (...messages: unknown[]) => void;
  info: (...messages: unknown[]) => void;
  debug: (...messages: unknown[]) => void;
  trace: (...messages: unknown[]) => void;
};

export async function ensureFeishuSocketConnection(input: { forceRestart?: boolean } = {}) {
  const secrets = getFeishuSecrets();

  if (!secrets.appId || !secrets.appSecret) {
    stopFeishuSocketConnection();

    return {
      ok: true,
      connected: false,
      message: "还没有配置飞书 App ID 和 App Secret。",
    };
  }

  const connectionKey = `${secrets.appId}:${secrets.appSecret}`;

  if (input.forceRestart) {
    stopFeishuSocketConnection();
  }

  if (
    globalThis.__opencrabFeishuSocketKey === connectionKey &&
    globalThis.__opencrabFeishuSocketClient
  ) {
    const connected = isFeishuSocketOpen(globalThis.__opencrabFeishuSocketClient);
    updateFeishuSocketSummary(connected ? "connected" : "connecting");

    return {
      ok: true,
      connected,
      message: connected
        ? "飞书长连接已就绪。"
        : "飞书长连接正在恢复，请保持 OpenCrab 运行后稍等几秒。",
    };
  }

  if (globalThis.__opencrabFeishuSocketStartPromise) {
    return globalThis.__opencrabFeishuSocketStartPromise;
  }

  updateFeishuSocketSummary("connecting");

  const task = startFeishuSocketConnection({
    appId: secrets.appId,
    appSecret: secrets.appSecret,
    connectionKey,
  }).finally(() => {
    globalThis.__opencrabFeishuSocketStartPromise = undefined;
  });

  globalThis.__opencrabFeishuSocketStartPromise = task;

  return task;
}

export function stopFeishuSocketConnection() {
  globalThis.__opencrabFeishuSocketStartPromise = undefined;
  globalThis.__opencrabFeishuSocketKey = undefined;

  const client = globalThis.__opencrabFeishuSocketClient;
  globalThis.__opencrabFeishuSocketClient = undefined;

  if (client) {
    client.close({ force: true });
  }

  stopFeishuSocketMonitor();
  updateFeishuSocketSummary("idle");
}

async function startFeishuSocketConnection(input: {
  appId: string;
  appSecret: string;
  connectionKey: string;
}) {
  try {
    const dispatcher = new Lark.EventDispatcher({}).register({
      "im.message.receive_v1": async (data) => {
        const parsed = parseFeishuEventMessage(
          data as Parameters<typeof parseFeishuEventMessage>[0],
        );

        if (!parsed) {
          return;
        }

        enqueueFeishuInboundMessage(parsed);
      },
    });

    const client = new Lark.WSClient({
      appId: input.appId,
      appSecret: input.appSecret,
      httpInstance: createFeishuSdkHttpInstance(),
      loggerLevel: Lark.LoggerLevel.debug,
      logger: createFeishuSocketLogger(),
    });

    await client.start({
      eventDispatcher: dispatcher,
    });

    globalThis.__opencrabFeishuSocketClient = client;
    globalThis.__opencrabFeishuSocketKey = input.connectionKey;
    startFeishuSocketMonitor(client, input.connectionKey);
    const connected = await waitForFeishuSocketConnection(client, input.connectionKey);

    if (!connected) {
      updateFeishuSocketSummary("connecting");

      return {
        ok: true,
        connected: false,
        message:
          "飞书凭证已通过，但飞书平台还没有确认长连接成功。请保持 OpenCrab 运行，然后回到飞书开放平台点一次保存。",
      };
    }

    updateFeishuSocketSummary("connected");

    return {
      ok: true,
      connected: true,
      message: "飞书长连接已连接，可以直接接收事件。",
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "飞书长连接启动失败。";
    markChannelError("feishu", message);
    stopFeishuSocketMonitor();
    updateFeishuSocketSummary("error");

    return {
      ok: false,
      connected: false,
      message,
    };
  }
}

function updateFeishuSocketSummary(status: "idle" | "connecting" | "connected" | "error") {
  const now = new Date().toISOString();
  const current = getChannelDetail("feishu");

  updateChannelRecord("feishu", {
    status:
      status === "connected"
        ? "ready"
        : status === "connecting"
          ? "connecting"
          : status === "error"
            ? "error"
            : "disconnected",
    lastError: status === "connected" || status === "connecting" || status === "idle" ? null : current.lastError,
    configSummary: {
      connectionMode: "websocket",
      socketStatus: status,
      socketConnected: status === "connected",
      lastSocketConnectedAt:
        status === "connected" ? now : status === "idle" ? null : current.configSummary.lastSocketConnectedAt,
      credentialsVerified:
        status === "connected" || status === "connecting"
          ? true
          : current.configSummary.credentialsVerified,
      lastVerifiedAt:
        status === "connected" || status === "connecting"
          ? now
          : current.configSummary.lastVerifiedAt,
    },
  });
}

function startFeishuSocketMonitor(client: Lark.WSClient, connectionKey: string) {
  stopFeishuSocketMonitor();

  const tick = () => {
    if (
      globalThis.__opencrabFeishuSocketClient !== client ||
      globalThis.__opencrabFeishuSocketKey !== connectionKey
    ) {
      return;
    }

    updateFeishuSocketSummary(isFeishuSocketOpen(client) ? "connected" : "connecting");
    globalThis.__opencrabFeishuSocketMonitorTimer = setTimeout(
      tick,
      FEISHU_SOCKET_MONITOR_INTERVAL_MS,
    );
  };

  tick();
}

function stopFeishuSocketMonitor() {
  if (globalThis.__opencrabFeishuSocketMonitorTimer) {
    clearTimeout(globalThis.__opencrabFeishuSocketMonitorTimer);
    globalThis.__opencrabFeishuSocketMonitorTimer = undefined;
  }
}

async function waitForFeishuSocketConnection(client: Lark.WSClient, connectionKey: string) {
  const startedAt = Date.now();

  while (Date.now() - startedAt < FEISHU_SOCKET_CONNECT_TIMEOUT_MS) {
    if (
      globalThis.__opencrabFeishuSocketClient !== client ||
      globalThis.__opencrabFeishuSocketKey !== connectionKey
    ) {
      return false;
    }

    if (isFeishuSocketOpen(client)) {
      return true;
    }

    await new Promise((resolve) => setTimeout(resolve, 200));
  }

  return isFeishuSocketOpen(client);
}

function isFeishuSocketOpen(client: Lark.WSClient) {
  const wsConfig = (client as unknown as {
    wsConfig?: {
      getWSInstance?: () => { readyState?: number } | null;
    };
  }).wsConfig;

  return wsConfig?.getWSInstance?.()?.readyState === 1;
}

function createFeishuSocketLogger(): FeishuSocketLogger {
  const syncFromLog = (level: "error" | "warn" | "info" | "debug" | "trace", messages: unknown[]) => {
    const text = messages
      .map((item) => (typeof item === "string" ? item : String(item)))
      .join(" ")
      .toLowerCase();

    if (text.includes("ws connect success") || text.includes("reconnect success")) {
      updateFeishuSocketSummary("connected");
      return;
    }

    if (text.includes("client closed")) {
      updateFeishuSocketSummary("connecting");
      return;
    }

    if (level === "error" && (text.includes("connect failed") || text.includes("[ws]"))) {
      updateFeishuSocketSummary("connecting");
    }
  };

  return {
    error: (...messages) => syncFromLog("error", messages),
    warn: (...messages) => syncFromLog("warn", messages),
    info: (...messages) => syncFromLog("info", messages),
    debug: (...messages) => syncFromLog("debug", messages),
    trace: (...messages) => syncFromLog("trace", messages),
  };
}

function createFeishuSdkHttpInstance(): HttpInstance {
  return {
    async request(input: {
      method?: string;
      url: string;
      data?: unknown;
      headers?: Record<string, string>;
      timeout?: number;
    }) {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), input.timeout ?? 15_000);

      try {
        const response = await fetch(input.url, {
          method: input.method?.toUpperCase() || "GET",
          headers: {
            "Content-Type": "application/json; charset=utf-8",
            ...(input.headers || {}),
          },
          body: input.data == null ? undefined : JSON.stringify(input.data),
          signal: controller.signal,
          redirect: "follow",
        });

        const text = await response.text();
        let payload: unknown = {};

        try {
          payload = text ? JSON.parse(text) : {};
        } catch {
          payload = { code: response.status, msg: text };
        }

        return payload;
      } finally {
        clearTimeout(timer);
      }
    },
  } as unknown as HttpInstance;
}
