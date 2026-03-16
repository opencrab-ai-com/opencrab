import {
  getChannelDetail,
  getChannelWebhookUrl,
  markChannelError,
  updateChannelRecord,
} from "@/lib/channels/channel-store";
import { getTelegramSecrets, setTelegramConnectionEnabled } from "@/lib/channels/secret-store";
import {
  configureTelegramWebhook,
  disconnectTelegramWebhook,
  getTelegramConnectionSummary,
} from "@/lib/channels/telegram";

type SyncTelegramChannelStateOptions = {
  rebind?: boolean;
  disconnect?: boolean;
};

export async function syncTelegramChannelState(options: SyncTelegramChannelStateOptions = {}) {
  const telegramSecrets = getTelegramSecrets();

  if (!telegramSecrets.botToken) {
    return {
      ok: true,
      detail: getChannelDetail("telegram"),
      message: "还没有配置 Telegram Bot Token。",
    };
  }

  const expectedWebhookUrl = getChannelWebhookUrl("telegram");

  try {
    const verifiedAt = new Date().toISOString();

    if (options.disconnect) {
      const summary = await disconnectTelegramWebhook();
      setTelegramConnectionEnabled(false);
      updateChannelRecord("telegram", {
        status: "disconnected",
        lastError: null,
        configSummary: {
          currentWebhookUrl: summary.currentWebhookUrl,
          webhookConfigured: false,
          webhookSetupMode: "manual",
          pendingUpdateCount: summary.pendingUpdateCount,
          lastWebhookError: summary.lastWebhookError,
          credentialsVerified: true,
          lastVerifiedAt: verifiedAt,
        },
      });

      return {
        ok: true,
        detail: getChannelDetail("telegram"),
        message: "Telegram 已断开连接。",
      };
    }

    if (options.rebind && expectedWebhookUrl) {
      setTelegramConnectionEnabled(true);
      const webhook = await configureTelegramWebhook({
        webhookUrl: expectedWebhookUrl,
        secretToken: telegramSecrets.webhookSecret,
      });

      const summary = await getTelegramConnectionSummary(expectedWebhookUrl);
      updateChannelRecord("telegram", {
        status: "ready",
        lastError: null,
        configSummary: {
          botUsername: summary.botUsername,
          credentialsVerified: true,
          lastVerifiedAt: verifiedAt,
          currentWebhookUrl: summary.currentWebhookUrl,
          webhookConfigured: summary.webhookConfigured,
          webhookSetupMode: "auto",
          pendingUpdateCount: summary.pendingUpdateCount,
          lastWebhookError: summary.lastWebhookError,
        },
      });

      return {
        ok: true,
        detail: getChannelDetail("telegram"),
        message: webhook.isConfigured
          ? "Telegram webhook 已重新绑定到 OpenCrab。"
          : "已经发起重新绑定，但 Telegram 还没有确认 webhook 生效。",
      };
    }

    if (telegramSecrets.enabled === false) {
      return {
        ok: true,
        detail: getChannelDetail("telegram"),
        message: "Telegram 当前处于断开状态。",
      };
    }

    const summary = await getTelegramConnectionSummary(expectedWebhookUrl);
    updateChannelRecord("telegram", {
      status: "ready",
      lastError: null,
      configSummary: {
        botUsername: summary.botUsername,
        credentialsVerified: true,
        lastVerifiedAt: verifiedAt,
        currentWebhookUrl: summary.currentWebhookUrl,
        webhookConfigured: summary.webhookConfigured,
        webhookSetupMode: expectedWebhookUrl ? "auto" : "pending_public_url",
        pendingUpdateCount: summary.pendingUpdateCount,
        lastWebhookError: summary.lastWebhookError,
      },
    });

    return {
      ok: true,
      detail: getChannelDetail("telegram"),
      message: summary.webhookConfigured
        ? "Telegram webhook 已连接到 OpenCrab。"
        : expectedWebhookUrl
          ? "Telegram 状态已刷新，当前 webhook 还没有对准 OpenCrab。"
          : "Telegram 状态已刷新，但还缺少公开地址，暂时无法自动设置 webhook。",
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Telegram 状态同步失败。";
    markChannelError("telegram", message);

    return {
      ok: false,
      detail: getChannelDetail("telegram"),
      message,
    };
  }
}
