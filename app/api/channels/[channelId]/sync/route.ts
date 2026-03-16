import { NextResponse } from "next/server";
import { ensureChannelStartupSync } from "@/lib/channels/channel-startup";
import { getChannelDetail } from "@/lib/channels/channel-store";
import { getTelegramSecrets } from "@/lib/channels/secret-store";
import { syncFeishuChannelState } from "@/lib/channels/feishu-channel-service";
import { syncTelegramChannelState } from "@/lib/channels/telegram-channel-service";
import { ensurePublicBaseUrl } from "@/lib/tunnel/public-url-service";
import type { ChannelId } from "@/lib/channels/types";

export async function POST(
  request: Request,
  context: { params: Promise<{ channelId: string }> },
) {
  const channelId = await resolveChannelId(context.params);

  if (!channelId) {
    return NextResponse.json({ error: "不支持的 channel。" }, { status: 404 });
  }

  void ensureChannelStartupSync();

  const body = (await request.json().catch(() => ({}))) as {
    mode?: "refresh" | "rebind" | "provision_public_url" | "disconnect";
  };

  if (channelId === "telegram") {
    if (body.mode === "provision_public_url") {
      const publicBaseUrl = await ensurePublicBaseUrl();

      if (!getTelegramSecrets().botToken) {
        return NextResponse.json({
          ok: true,
          detail: getChannelDetail(channelId),
          message: `公网地址已就绪：${publicBaseUrl.publicBaseUrl}。接下来保存 Bot Token，OpenCrab 就会自动绑定 Telegram webhook。`,
        });
      }

      const syncResult = await syncTelegramChannelState({
        rebind: true,
      });

      return NextResponse.json({
        ok: true,
        detail: syncResult.detail,
        message: syncResult.ok
          ? `公网地址已就绪，并已自动绑定 Telegram webhook。`
          : `公网地址已就绪：${publicBaseUrl.publicBaseUrl}。但 Telegram webhook 还没自动绑定成功：${syncResult.message}`,
      });
    }

    const result = await syncTelegramChannelState({
      rebind: body.mode === "rebind",
      disconnect: body.mode === "disconnect",
    });

    return NextResponse.json({
      ok: result.ok,
      detail: result.detail,
      message: result.message,
    });
  }

  if (channelId === "feishu") {
    if (body.mode === "provision_public_url") {
      const publicBaseUrl = await ensurePublicBaseUrl();

      return NextResponse.json({
        ok: true,
        detail: getChannelDetail(channelId),
        message: `公网地址已就绪：${publicBaseUrl.publicBaseUrl}。接下来把飞书事件订阅地址指向 OpenCrab 即可。`,
      });
    }

    const result = await syncFeishuChannelState();

    return NextResponse.json({
      ok: result.ok,
      detail: result.detail,
      message: result.message,
    });
  }

  return NextResponse.json({
    ok: true,
    detail: getChannelDetail(channelId),
    message: "当前 channel 不需要额外同步动作。",
  });
}

async function resolveChannelId(paramsPromise: Promise<{ channelId: string }>): Promise<ChannelId | null> {
  const { channelId } = await paramsPromise;

  if (channelId === "telegram" || channelId === "feishu") {
    return channelId;
  }

  return null;
}
