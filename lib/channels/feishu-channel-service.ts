import {
  getChannelDetail,
  markChannelError,
  updateChannelRecord,
} from "@/lib/channels/channel-store";
import { verifyFeishuApp } from "@/lib/channels/feishu";
import {
  ensureFeishuSocketConnection,
  stopFeishuSocketConnection,
} from "@/lib/channels/feishu-socket-service";
import { getFeishuSecrets } from "@/lib/channels/secret-store";

export async function syncFeishuChannelState(input: { restartSocket?: boolean; disconnect?: boolean } = {}) {
  const feishuSecrets = getFeishuSecrets();

  if (!feishuSecrets.appId || !feishuSecrets.appSecret) {
    return {
      ok: true,
      detail: getChannelDetail("feishu"),
      message: "还没有配置飞书 App ID 和 App Secret。",
    };
  }

  try {
    if (input.disconnect) {
      stopFeishuSocketConnection();
      updateChannelRecord("feishu", {
        status: "disconnected",
        lastError: null,
        configSummary: {
          connectionMode: "websocket",
          socketStatus: "idle",
          socketConnected: false,
        },
      });

      return {
        ok: true,
        detail: getChannelDetail("feishu"),
        message: "飞书长连接已断开。",
      };
    }

    const app = await verifyFeishuApp();
    const socket = await ensureFeishuSocketConnection({
      forceRestart: input.restartSocket,
    });
    const now = new Date().toISOString();

    updateChannelRecord("feishu", {
      status: socket.ok
        ? socket.connected
          ? "ready"
          : "connecting"
        : "error",
      lastError: socket.ok ? null : socket.message,
      configSummary: {
        appId: app.appId,
        credentialsVerified: true,
        lastVerifiedAt: now,
        connectionMode: "websocket",
        socketStatus: socket.ok ? (socket.connected ? "connected" : "connecting") : "error",
        socketConnected: socket.connected,
        lastSocketConnectedAt: socket.connected ? now : null,
      },
    });

    return {
      ok: socket.ok,
      detail: getChannelDetail("feishu"),
      message: socket.ok
        ? socket.connected
          ? "飞书配置已校验通过，长连接也已经连上。"
          : socket.message
        : socket.message,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "飞书状态同步失败。";
    markChannelError("feishu", message);
    updateChannelRecord("feishu", {
      configSummary: {
        connectionMode: "websocket",
        socketStatus: "error",
        socketConnected: false,
        credentialsVerified: false,
      },
    });

    return {
      ok: false,
      detail: getChannelDetail("feishu"),
      message,
    };
  }
}
