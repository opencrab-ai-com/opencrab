import * as Lark from "@larksuiteoapi/node-sdk";
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
  var __opencrabFeishuSocketStartPromise:
    | Promise<{
        ok: boolean;
        message: string;
      }>
    | undefined;
}

export async function ensureFeishuSocketConnection(input: { forceRestart?: boolean } = {}) {
  const secrets = getFeishuSecrets();

  if (!secrets.appId || !secrets.appSecret) {
    stopFeishuSocketConnection();

    return {
      ok: true,
      message: "还没有配置飞书 App ID 和 App Secret。",
    };
  }

  const connectionKey = `${secrets.appId}:${secrets.appSecret}`;

  if (input.forceRestart) {
    stopFeishuSocketConnection();
  }

  if (globalThis.__opencrabFeishuSocketKey === connectionKey && globalThis.__opencrabFeishuSocketClient) {
    updateFeishuSocketSummary("connected");

    return {
      ok: true,
      message: "飞书长连接已就绪。",
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

  updateChannelRecord("feishu", {
    configSummary: {
      connectionMode: "websocket",
      socketStatus: "idle",
      socketConnected: false,
      lastSocketConnectedAt: null,
    },
  });
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
      loggerLevel: Lark.LoggerLevel.warn,
    });

    await client.start({
      eventDispatcher: dispatcher,
    });

    globalThis.__opencrabFeishuSocketClient = client;
    globalThis.__opencrabFeishuSocketKey = input.connectionKey;

    updateFeishuSocketSummary("connected");

    return {
      ok: true,
      message: "飞书长连接已连接，可以直接接收事件。",
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "飞书长连接启动失败。";
    markChannelError("feishu", message);
    updateChannelRecord("feishu", {
      configSummary: {
        connectionMode: "websocket",
        socketStatus: "error",
        socketConnected: false,
      },
    });

    return {
      ok: false,
      message,
    };
  }
}

function updateFeishuSocketSummary(status: "connecting" | "connected") {
  const now = new Date().toISOString();
  const current = getChannelDetail("feishu");

  updateChannelRecord("feishu", {
    status: status === "connected" ? "ready" : current.status,
    lastError: status === "connected" ? null : current.lastError,
    configSummary: {
      connectionMode: "websocket",
      socketStatus: status,
      socketConnected: status === "connected",
      lastSocketConnectedAt: status === "connected" ? now : current.configSummary.lastSocketConnectedAt,
      credentialsVerified: status === "connected" ? true : current.configSummary.credentialsVerified,
      lastVerifiedAt: status === "connected" ? now : current.configSummary.lastVerifiedAt,
    },
  });
}
