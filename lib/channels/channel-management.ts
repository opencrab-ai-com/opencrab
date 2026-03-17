import {
  getChannelDetail,
  getChannelWebhookUrl,
  markChannelError,
  updateChannelRecord,
} from "@/lib/channels/channel-store";
import { syncFeishuChannelState } from "@/lib/channels/feishu-channel-service";
import {
  getFeishuSecrets,
  getTelegramSecrets,
  setTelegramConnectionEnabled,
  syncAllChannelConfigsFromSecrets,
  updateChannelSecrets,
} from "@/lib/channels/secret-store";
import { syncTelegramChannelState } from "@/lib/channels/telegram-channel-service";
import { verifyTelegramBot } from "@/lib/channels/telegram";
import type { ChannelId, FeishuSecrets, TelegramSecrets } from "@/lib/channels/types";
import { ensurePublicBaseUrl } from "@/lib/tunnel/public-url-service";

export type ChannelPatchPayload = Partial<TelegramSecrets & FeishuSecrets>;

export type ChannelSyncMode =
  | "refresh"
  | "rebind"
  | "provision_public_url"
  | "disconnect";

export type ChannelVerification =
  | { ok: true; message?: string }
  | { ok: false; error: string };

export async function resolveChannelId(
  paramsPromise: Promise<{ channelId: string }>,
): Promise<ChannelId | null> {
  const { channelId } = await paramsPromise;

  if (channelId === "telegram" || channelId === "feishu") {
    return channelId;
  }

  return null;
}

export async function saveChannelConfiguration(
  channelId: ChannelId,
  body: ChannelPatchPayload,
) {
  updateChannelSecrets(channelId, body);
  syncAllChannelConfigsFromSecrets();

  let verification: ChannelVerification = { ok: true };

  try {
    if (channelId === "telegram") {
      return await saveTelegramConfiguration();
    }

    const feishuSecrets = getFeishuSecrets();

    if (!feishuSecrets.appId || !feishuSecrets.appSecret) {
      return {
        detail: getChannelDetail(channelId),
        verification,
      };
    }

    const syncResult = await syncFeishuChannelState({
      restartSocket: true,
    });
    verification = syncResult.ok
      ? { ok: true, message: syncResult.message }
      : { ok: false, error: syncResult.message };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Channel 校验失败。";
    markChannelError(channelId, message);
    verification = { ok: false, error: message };
  }

  return {
    detail: getChannelDetail(channelId),
    verification,
  };
}

export async function runChannelSyncAction(channelId: ChannelId, mode: ChannelSyncMode) {
  if (channelId === "telegram") {
    return await runTelegramSyncAction(mode);
  }

  return await runFeishuSyncAction(mode);
}

async function saveTelegramConfiguration() {
  const telegramSecrets = getTelegramSecrets();

  if (!telegramSecrets.botToken) {
    return {
      detail: getChannelDetail("telegram"),
      verification: { ok: true } satisfies ChannelVerification,
    };
  }

  setTelegramConnectionEnabled(true);
  const bot = await verifyTelegramBot();
  const expectedWebhookUrl = getChannelWebhookUrl("telegram");
  updateChannelRecord("telegram", {
    configSummary: {
      botUsername: bot.botUsername,
      credentialsVerified: true,
      lastVerifiedAt: new Date().toISOString(),
      webhookSetupMode: expectedWebhookUrl ? "auto" : "pending_public_url",
    },
  });

  if (!expectedWebhookUrl) {
    return {
      detail: getChannelDetail("telegram"),
      verification: {
        ok: true,
        message:
          "Bot Token 已验证，但当前还没有公网地址。点“一键生成公网地址”后，OpenCrab 就能自动设置 Telegram webhook。",
      } satisfies ChannelVerification,
    };
  }

  const syncResult = await syncTelegramChannelState({
    rebind: true,
  });

  return {
    detail: syncResult.detail,
    verification: syncResult.ok
      ? ({ ok: true, message: syncResult.message } satisfies ChannelVerification)
      : ({ ok: false, error: syncResult.message } satisfies ChannelVerification),
  };
}

async function runTelegramSyncAction(mode: ChannelSyncMode) {
  if (mode === "provision_public_url") {
    const publicBaseUrl = await ensurePublicBaseUrl();

    if (!getTelegramSecrets().botToken) {
      return {
        ok: true,
        detail: getChannelDetail("telegram"),
        message: `公网地址已就绪：${publicBaseUrl.publicBaseUrl}。接下来保存 Bot Token，OpenCrab 就会自动绑定 Telegram webhook。`,
      };
    }

    const syncResult = await syncTelegramChannelState({
      rebind: true,
    });

    return {
      ok: true,
      detail: syncResult.detail,
      message: syncResult.ok
        ? "公网地址已就绪，并已自动绑定 Telegram webhook。"
        : `公网地址已就绪：${publicBaseUrl.publicBaseUrl}。但 Telegram webhook 还没自动绑定成功：${syncResult.message}`,
    };
  }

  const result = await syncTelegramChannelState({
    rebind: mode === "rebind",
    disconnect: mode === "disconnect",
  });

  return {
    ok: result.ok,
    detail: result.detail,
    message: result.message,
  };
}

async function runFeishuSyncAction(mode: ChannelSyncMode) {
  if (mode === "provision_public_url") {
    return {
      ok: true,
      detail: getChannelDetail("feishu"),
      message:
        "飞书默认走长连接，不需要公网地址。只要 App ID 和 App Secret 可用，OpenCrab 会直接启动 socket。",
    };
  }

  const result = await syncFeishuChannelState({
    restartSocket: mode === "rebind",
    disconnect: mode === "disconnect",
  });

  return {
    ok: result.ok,
    detail: result.detail,
    message: result.message,
  };
}
