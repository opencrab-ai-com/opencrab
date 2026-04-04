import { findEventByDedupeKey, markChannelError } from "@/lib/channels/channel-store";
import { syncBoundConversationHistory } from "@/lib/channels/bound-conversation-sync";
import {
  handleInboundChannelTextMessage,
  recordIgnoredInboundEvent,
  recordReceivedInboundEvent,
  summarizeChannelInbound,
} from "@/lib/channels/dispatcher";
import {
  acknowledgeFeishuInboundMessage,
  downloadFeishuAttachments,
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
    await syncBoundConversationHistory(handled.conversationId, {
      throwOnError: true,
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
