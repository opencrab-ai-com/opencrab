import { runConversationTurn } from "@/lib/conversations/run-conversation-turn";
import {
  findBinding,
  markChannelError,
  markChannelReady,
  recordChannelEvent,
  upsertBinding,
  updateBindingActivity,
} from "@/lib/channels/channel-store";
import type { ChannelBinding, ChannelId } from "@/lib/channels/types";
import { createConversation, getSnapshot, updateConversation } from "@/lib/resources/local-store";

type HandleInboundChannelTextMessageInput = {
  channelId: ChannelId;
  dedupeKey: string;
  remoteMessageId: string;
  remoteChatId: string;
  remoteChatLabel: string;
  remoteUserId?: string | null;
  remoteUserLabel?: string | null;
  text?: string;
  attachmentIds?: string[];
};

export async function handleInboundChannelTextMessage(
  input: HandleInboundChannelTextMessageInput,
) {
  const binding = ensureBinding(input);
  const now = new Date().toISOString();

  recordChannelEvent({
    channelId: input.channelId,
    conversationId: binding.conversationId,
    bindingId: binding.id,
    direction: "inbound",
    status: "processed",
    dedupeKey: input.dedupeKey,
    remoteChatId: input.remoteChatId,
    remoteMessageId: input.remoteMessageId,
    summary: summarizeInbound(input.text, input.attachmentIds?.length || 0),
    errorMessage: null,
  });
  updateBindingActivity(binding.id, {
    lastInboundAt: now,
    remoteUserLabel: input.remoteUserLabel ?? binding.remoteUserLabel,
  });

  const settings = getSnapshot().settings;

  try {
    const result = await runConversationTurn({
      conversationId: binding.conversationId,
      content: input.text,
      attachmentIds: input.attachmentIds,
      model: settings.defaultModel,
      reasoningEffort: settings.defaultReasoningEffort,
      sandboxMode: settings.defaultSandboxMode,
      userMessageSource: input.channelId,
      remoteUserMessageId: input.remoteMessageId,
    });

    markChannelReady(input.channelId);

    return {
      binding,
      replyText: result.assistant.text,
      replyAttachments: result.assistant.attachments,
      assistantModel: result.assistant.model,
      conversationId: binding.conversationId,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "渠道消息处理失败。";

    recordChannelEvent({
      channelId: input.channelId,
      conversationId: binding.conversationId,
      bindingId: binding.id,
      direction: "system",
      status: "error",
      dedupeKey: input.dedupeKey,
      remoteChatId: input.remoteChatId,
      remoteMessageId: input.remoteMessageId,
      summary: summarizeInbound(input.text, input.attachmentIds?.length || 0),
      errorMessage: message,
    });
    markChannelError(input.channelId, message);
    throw error;
  }
}

export function recordReceivedInboundEvent(input: {
  channelId: ChannelId;
  dedupeKey: string;
  remoteChatId: string;
  remoteMessageId: string;
  summary: string;
}) {
  recordChannelEvent({
    channelId: input.channelId,
    conversationId: null,
    bindingId: null,
    direction: "inbound",
    status: "received",
    dedupeKey: input.dedupeKey,
    remoteChatId: input.remoteChatId,
    remoteMessageId: input.remoteMessageId,
    summary: input.summary,
    errorMessage: null,
  });
}

export function recordOutboundDelivery(
  input: {
    channelId: ChannelId;
    binding: ChannelBinding;
    remoteMessageId?: string | null;
    text: string;
    attachmentCount?: number;
  },
) {
  const now = new Date().toISOString();

  recordChannelEvent({
    channelId: input.channelId,
    conversationId: input.binding.conversationId,
    bindingId: input.binding.id,
    direction: "outbound",
    status: "sent",
    dedupeKey: null,
    remoteChatId: input.binding.remoteChatId,
    remoteMessageId: input.remoteMessageId || null,
    summary: summarizeInbound(input.text, input.attachmentCount || 0),
    errorMessage: null,
  });
  updateBindingActivity(input.binding.id, {
    lastOutboundAt: now,
  });
  markChannelReady(input.channelId);
}

export function recordIgnoredInboundEvent(input: {
  channelId: ChannelId;
  dedupeKey: string;
  remoteChatId?: string | null;
  remoteMessageId?: string | null;
  summary: string;
}) {
  recordChannelEvent({
    channelId: input.channelId,
    conversationId: null,
    bindingId: null,
    direction: "system",
    status: "ignored",
    dedupeKey: input.dedupeKey,
    remoteChatId: input.remoteChatId || null,
    remoteMessageId: input.remoteMessageId || null,
    summary: input.summary,
    errorMessage: null,
  });
}

function ensureBinding(input: HandleInboundChannelTextMessageInput) {
  const existing = findBinding(input.channelId, input.remoteChatId);

  if (existing) {
    updateConversation(existing.conversationId, {
      source: input.channelId,
      channelLabel: input.channelId === "telegram" ? "Telegram" : "飞书",
      remoteChatLabel: input.remoteChatLabel,
      remoteUserLabel: input.remoteUserLabel ?? existing.remoteUserLabel ?? null,
    });

    return upsertBinding({
      channelId: input.channelId,
      remoteChatId: input.remoteChatId,
      remoteChatLabel: input.remoteChatLabel,
      remoteUserId: input.remoteUserId ?? existing.remoteUserId,
      remoteUserLabel: input.remoteUserLabel ?? existing.remoteUserLabel,
      conversationId: existing.conversationId,
    });
  }

  const created = createConversation({
    title: buildConversationTitle(input.channelId, input.remoteChatLabel, input.remoteUserLabel),
    folderId: null,
    source: input.channelId,
    channelLabel: input.channelId === "telegram" ? "Telegram" : "飞书",
    remoteChatLabel: input.remoteChatLabel,
    remoteUserLabel: input.remoteUserLabel ?? null,
  });

  return upsertBinding({
    channelId: input.channelId,
    remoteChatId: input.remoteChatId,
    remoteChatLabel: input.remoteChatLabel,
    remoteUserId: input.remoteUserId ?? null,
    remoteUserLabel: input.remoteUserLabel ?? null,
    conversationId: created.conversationId,
  });
}

function buildConversationTitle(
  channelId: ChannelId,
  remoteChatLabel: string,
  remoteUserLabel?: string | null,
) {
  const prefix = channelId === "telegram" ? "Telegram" : "飞书";
  const target = remoteUserLabel || remoteChatLabel;

  return `${prefix} · ${target}`.slice(0, 80);
}

function summarizeText(text: string) {
  return text.replace(/\s+/g, " ").trim().slice(0, 120) || "空消息";
}

function summarizeInbound(text: string | undefined, attachmentCount: number) {
  const summary = text?.trim() ? summarizeText(text) : "";

  if (summary && attachmentCount > 0) {
    return `${summary} · ${attachmentCount} 个附件`;
  }

  if (summary) {
    return summary;
  }

  if (attachmentCount > 0) {
    return `${attachmentCount} 个附件`;
  }

  return "空消息";
}

export function summarizeChannelInbound(text: string | undefined, attachmentCount: number) {
  return summarizeInbound(text, attachmentCount);
}
