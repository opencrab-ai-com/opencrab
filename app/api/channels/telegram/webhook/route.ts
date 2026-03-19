import {
  findEventByDedupeKey,
  markChannelError,
} from "@/lib/channels/channel-store";
import {
  handleInboundChannelTextMessage,
  recordReceivedInboundEvent,
  recordIgnoredInboundEvent,
  recordOutboundDelivery,
  summarizeChannelInbound,
} from "@/lib/channels/dispatcher";
import {
  acknowledgeTelegramInboundMessage,
  assertTelegramWebhookAuth,
  downloadTelegramAttachments,
  parseTelegramInboundMessage,
  sendTelegramReply,
} from "@/lib/channels/telegram";
import { errorResponse, json, readJsonBody } from "@/lib/server/api-route";

export async function POST(request: Request) {
  try {
    assertTelegramWebhookAuth(request);

    const body = await readJsonBody<Record<string, unknown>>(request, {});
    const inbound = parseTelegramInboundMessage(body);

    if (!inbound) {
      return json({ ok: true, ignored: true });
    }

    if (findEventByDedupeKey("telegram", inbound.dedupeKey)) {
      recordIgnoredInboundEvent({
        channelId: "telegram",
        dedupeKey: inbound.dedupeKey,
        remoteChatId: inbound.remoteChatId,
        remoteMessageId: inbound.remoteMessageId,
        summary: "重复 Telegram webhook，已忽略。",
      });

      return json({ ok: true, duplicate: true });
    }

    recordReceivedInboundEvent({
      channelId: "telegram",
      dedupeKey: inbound.dedupeKey,
      remoteChatId: inbound.remoteChatId,
      remoteMessageId: inbound.remoteMessageId,
      summary: summarizeChannelInbound(
        inbound.text,
        inbound.attachmentRefs.length,
      ),
    });

    await acknowledgeTelegramInboundMessage({
      chatId: inbound.remoteChatId,
      messageId: inbound.remoteMessageId,
    });

    void processTelegramInbound(inbound);

    return json({ ok: true });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Telegram webhook 处理失败。";
    markChannelError("telegram", message);

    return errorResponse(error, "Telegram webhook 处理失败。");
  }
}

async function processTelegramInbound(
  inbound: NonNullable<ReturnType<typeof parseTelegramInboundMessage>>,
) {
  try {
    const handled = await handleInboundChannelTextMessage({
      channelId: "telegram",
      ...inbound,
      attachmentIds: (
        await downloadTelegramAttachments(inbound.attachmentRefs)
      ).map((attachment) => attachment.id),
    });
    const delivery = await sendTelegramReply({
      chatId: inbound.remoteChatId,
      text: handled.replyText,
      attachments: handled.replyAttachments,
    });

    recordOutboundDelivery({
      channelId: "telegram",
      binding: handled.binding,
      remoteMessageId: delivery.remoteMessageId,
      text: handled.replyText,
      attachmentCount: handled.replyAttachments.length,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Telegram 消息处理失败。";
    markChannelError("telegram", message);

    try {
      await sendTelegramReply({
        chatId: inbound.remoteChatId,
        text: `这条消息我收到了，但处理中出了点问题：${message}`,
      });
    } catch {
      return;
    }
  }
}
