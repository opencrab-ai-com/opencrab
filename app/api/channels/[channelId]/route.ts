import { NextResponse } from "next/server";
import { ensureChannelStartupSync } from "@/lib/channels/channel-startup";
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
import type { ChannelId } from "@/lib/channels/types";

export async function GET(
  _request: Request,
  context: { params: Promise<{ channelId: string }> },
) {
  const channelId = await resolveChannelId(context.params);

  if (!channelId) {
    return NextResponse.json({ error: "不支持的 channel。" }, { status: 404 });
  }

  syncAllChannelConfigsFromSecrets();
  void ensureChannelStartupSync();

  return NextResponse.json({
    detail: getChannelDetail(channelId),
  });
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ channelId: string }> },
) {
  const channelId = await resolveChannelId(context.params);

  if (!channelId) {
    return NextResponse.json({ error: "不支持的 channel。" }, { status: 404 });
  }

  const body = (await request.json()) as {
    botToken?: string;
    webhookSecret?: string;
    appId?: string;
    appSecret?: string;
    verificationToken?: string;
  };

  updateChannelSecrets(channelId, body);
  syncAllChannelConfigsFromSecrets();

  let verification:
    | { ok: true; message?: string }
    | { ok: false; error: string } = { ok: true };

  try {
    if (channelId === "telegram") {
      const telegramSecrets = getTelegramSecrets();

      if (!telegramSecrets.botToken) {
        return NextResponse.json({
          detail: getChannelDetail(channelId),
          verification,
        });
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
        return NextResponse.json({
          detail: getChannelDetail(channelId),
          verification: {
            ok: true,
            message:
              "Bot Token 已验证，但当前还没有公网地址。点“一键生成公网地址”后，OpenCrab 就能自动设置 Telegram webhook。",
          },
        });
      }

      const syncResult = await syncTelegramChannelState({
        rebind: true,
      });
      verification = syncResult.ok
        ? {
            ok: true,
            message: syncResult.message,
          }
        : {
            ok: false,
            error: syncResult.message,
          };

      return NextResponse.json({
        detail: syncResult.detail,
        verification,
      });
    } else {
      const feishuSecrets = getFeishuSecrets();

      if (!feishuSecrets.appId || !feishuSecrets.appSecret) {
        return NextResponse.json({
          detail: getChannelDetail(channelId),
          verification,
        });
      }

      const syncResult = await syncFeishuChannelState();
      verification = syncResult.ok
        ? {
            ok: true,
            message: syncResult.message,
          }
        : {
            ok: false,
            error: syncResult.message,
          };
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "Channel 校验失败。";
    markChannelError(channelId, message);
    verification = {
      ok: false,
      error: message,
    };
  }

  return NextResponse.json({
    detail: getChannelDetail(channelId),
    verification,
  });
}

async function resolveChannelId(paramsPromise: Promise<{ channelId: string }>): Promise<ChannelId | null> {
  const { channelId } = await paramsPromise;

  if (channelId === "telegram" || channelId === "feishu") {
    return channelId;
  }

  return null;
}
