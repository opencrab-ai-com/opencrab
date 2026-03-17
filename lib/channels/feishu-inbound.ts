import { findEventByDedupeKey, markChannelError } from "@/lib/channels/channel-store";
import {
  handleInboundChannelTextMessage,
  recordIgnoredInboundEvent,
  recordOutboundDelivery,
  recordReceivedInboundEvent,
  summarizeChannelInbound,
} from "@/lib/channels/dispatcher";
import {
  acknowledgeFeishuInboundMessage,
  downloadFeishuAttachments,
  sendFeishuReply,
  sendFeishuTextMessage,
  type FeishuInboundMessage,
} from "@/lib/channels/feishu";

export function enqueueFeishuInboundMessage(inbound: FeishuInboundMessage) {
  if (findEventByDedupeKey("feishu", inbound.dedupeKey)) {
    recordIgnoredInboundEvent({
      channelId: "feishu",
      dedupeKey: inbound.dedupeKey,
      remoteChatId: inbound.remoteChatId,
      remoteMessageId: inbound.remoteMessageId,
      summary: "重复飞书事件，已忽略。",
    });

    return {
      ok: true,
      duplicate: true,
      message: "重复飞书事件，已忽略。",
    };
  }

  recordReceivedInboundEvent({
    channelId: "feishu",
    dedupeKey: inbound.dedupeKey,
    remoteChatId: inbound.remoteChatId,
    remoteMessageId: inbound.remoteMessageId,
    summary: summarizeChannelInbound(inbound.text, inbound.attachmentRefs.length),
  });

  void processFeishuInboundMessage(inbound);

  return {
    ok: true,
    duplicate: false,
    message: "飞书消息已接收，正在后台处理中。",
  };
}

async function processFeishuInboundMessage(inbound: FeishuInboundMessage) {
  try {
    void acknowledgeFeishuInboundMessage({
      messageId: inbound.remoteMessageId,
    });
    const attachments = await downloadFeishuAttachments(inbound.attachmentRefs);
    const handled = await handleInboundChannelTextMessage({
      channelId: "feishu",
      ...inbound,
      attachmentIds: attachments.map((attachment) => attachment.id),
    });
    const delivery = await sendFeishuReply({
      chatId: inbound.remoteChatId,
      text: handled.replyText,
      attachments: handled.replyAttachments,
    });

    recordOutboundDelivery({
      channelId: "feishu",
      binding: handled.binding,
      remoteMessageId: delivery.remoteMessageId,
      text: handled.replyText,
      attachmentCount: handled.replyAttachments.length,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "飞书消息处理失败。";
    markChannelError("feishu", message);

    try {
      await sendFeishuTextMessage(
        inbound.remoteChatId,
        `这条消息我收到了，但处理中出了点问题：${message}`,
      );
    } catch {
      return;
    }
  }
}
