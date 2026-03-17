import { getChannelStatusLabel } from "@/lib/channels/channel-store";
import type { ChannelDetail } from "@/lib/channels/types";

export function buildChannelStatusTone(status: ChannelDetail["status"]) {
  if (status === "ready") {
    return "border-[#cfe7d4] bg-[#eef8f0] text-[#23633a]";
  }

  if (status === "disconnected") {
    return "border-[#e7d9c2] bg-[#fbf6ed] text-[#8a5b16]";
  }

  if (status === "error") {
    return "border-[#f3d0cb] bg-[#fff3f1] text-[#b42318]";
  }

  return "border-line bg-surface-muted text-muted-strong";
}

export function getChannelStatusText(status: ChannelDetail["status"]) {
  return getChannelStatusLabel(status);
}

export function buildTelegramStatusSummary(
  channel: ChannelDetail,
  publicBaseUrl: string | null,
) {
  if (!channel.configSummary.hasBotToken) {
    return "还没开始连接。先填入 Bot Token，启动后 OpenCrab 会自动尝试把 Telegram 连起来。";
  }

  if (channel.status === "disconnected") {
    return "当前已经断开连接。Bot Token 还保留着，但 OpenCrab 不会继续接收 Telegram 消息。";
  }

  if (channel.configSummary.webhookConfigured) {
    return "已经连上了。现在你可以直接去 Telegram 给 bot 发消息，消息会自动进入 OpenCrab。";
  }

  if (!publicBaseUrl) {
    return "Bot Token 已保存。OpenCrab 正在自动准备公网地址并继续完成连接。";
  }

  return "Bot Token 已保存，OpenCrab 正在尝试完成 Telegram 连接。如果还没成功，可以点一次重新连接。";
}

export function buildFeishuStatusSummary(channel: ChannelDetail) {
  if (!channel.configSummary.hasAppId || !channel.configSummary.hasAppSecret) {
    return "还没开始连接。先填入 App ID 和 App Secret，OpenCrab 会自动校验飞书凭证并启动长连接。";
  }

  if (channel.configSummary.socketConnected) {
    return "已经连上了。飞书消息会通过长连接直接进入 OpenCrab，不需要再配置公网 Webhook。";
  }

  if (channel.configSummary.credentialsVerified) {
    return "应用凭证已经校验通过，OpenCrab 正在尝试建立飞书长连接。";
  }

  return "凭证已保存，OpenCrab 正在校验飞书应用并准备启动长连接。";
}

export function buildTelegramSetWebhookCommand(
  channel: ChannelDetail,
  webhookTarget: string,
) {
  const secretClause = channel.configSummary.hasWebhookSecret
    ? ', "secret_token":"$OPENCRAB_TELEGRAM_WEBHOOK_SECRET"'
    : "";

  return [
    'curl -X POST "https://api.telegram.org/bot$OPENCRAB_TELEGRAM_BOT_TOKEN/setWebhook" \\',
    '  -H "Content-Type: application/json" \\',
    `  -d '{"url":"${webhookTarget}"${secretClause}}'`,
  ].join("\n");
}
