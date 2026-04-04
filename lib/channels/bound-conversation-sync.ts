import {
  findBindingByConversationId,
  getAllBindings,
  markChannelError,
} from "@/lib/channels/channel-store";
import { formatChannelReplyText } from "@/lib/channels/message-format";
import { recordOutboundDelivery } from "@/lib/channels/dispatcher";
import type { ChannelBinding } from "@/lib/channels/types";
import { sendFeishuReply } from "@/lib/channels/feishu";
import { sendTelegramReply } from "@/lib/channels/telegram";
import {
  getSnapshot,
  updateMessageRemoteDelivery,
} from "@/lib/resources/local-store";
import type {
  AppSnapshot,
  UploadedAttachment,
} from "@/lib/resources/opencrab-api-types";
import type {
  ConversationMessage,
} from "@/lib/seed-data";

const CONVERSATION_HISTORY_SYNC_COOLDOWN_MS = 5 * 60_000;

declare global {
  var __opencrabBoundConversationHistorySyncPromise: Promise<void> | undefined;
  var __opencrabBoundConversationHistorySyncLastRunAt: number | undefined;
  var __opencrabBoundConversationSyncQueue:
    | Map<string, Promise<SyncBoundConversationHistoryResult>>
    | undefined;
}

export type SyncBoundConversationHistoryResult = {
  snapshot: AppSnapshot;
  binding: ChannelBinding | null;
  deliveredCount: number;
  pendingCount: number;
  errorMessage: string | null;
};

export async function syncBoundConversationHistory(
  conversationId: string,
  options: {
    throwOnError?: boolean;
  } = {},
): Promise<SyncBoundConversationHistoryResult> {
  const snapshot = getSnapshot();
  const conversation =
    snapshot.conversations.find((item) => item.id === conversationId) ?? null;
  const binding = findBindingByConversationId(conversationId);

  if (!conversation || !binding) {
    return {
      snapshot,
      binding: null,
      deliveredCount: 0,
      pendingCount: 0,
      errorMessage: null,
    };
  }

  const pendingMessages = (snapshot.conversationMessages[conversationId] ?? []).filter(
    (message) => shouldSyncMessage(message, binding.remoteChatId),
  );

  let deliveredCount = 0;
  let errorMessage: string | null = null;

  for (const message of pendingMessages) {
    try {
      const delivery = await deliverMessageToBoundChannel({
        binding,
        message,
        userDisplayName: snapshot.settings.userDisplayName,
      });

      updateMessageRemoteDelivery(conversationId, message.id, {
        remoteMessageId: delivery.remoteMessageId,
        remoteChatId: binding.remoteChatId,
      });

      recordOutboundDelivery({
        channelId: binding.channelId,
        binding,
        remoteMessageId: delivery.remoteMessageId,
        text: delivery.summaryText,
        attachmentCount: message.attachments?.length ?? 0,
      });

      deliveredCount += 1;
    } catch (error) {
      errorMessage =
        error instanceof Error ? error.message : "渠道消息同步失败。";
      markChannelError(binding.channelId, errorMessage);

      if (options.throwOnError) {
        throw error instanceof Error ? error : new Error(errorMessage);
      }

      break;
    }
  }

  return {
    snapshot: getSnapshot(),
    binding,
    deliveredCount,
    pendingCount: Math.max(pendingMessages.length - deliveredCount, 0),
    errorMessage,
  };
}

export function scheduleBoundConversationHistorySync(conversationId: string) {
  const queue = (globalThis.__opencrabBoundConversationSyncQueue ??= new Map());
  const existing = queue.get(conversationId);

  if (existing) {
    return existing;
  }

  const task = syncBoundConversationHistory(conversationId).finally(() => {
    queue.delete(conversationId);
  });

  queue.set(conversationId, task);
  return task;
}

export function ensureBoundConversationHistorySync(
  input: { force?: boolean } = {},
) {
  const lastRunAt =
    globalThis.__opencrabBoundConversationHistorySyncLastRunAt ?? 0;

  if (globalThis.__opencrabBoundConversationHistorySyncPromise) {
    return globalThis.__opencrabBoundConversationHistorySyncPromise;
  }

  if (
    !input.force &&
    Date.now() - lastRunAt < CONVERSATION_HISTORY_SYNC_COOLDOWN_MS
  ) {
    return Promise.resolve();
  }

  const task = Promise.resolve()
    .then(() => syncAllBoundConversationHistories())
    .finally(() => {
      globalThis.__opencrabBoundConversationHistorySyncPromise = undefined;
      globalThis.__opencrabBoundConversationHistorySyncLastRunAt = Date.now();
    });

  globalThis.__opencrabBoundConversationHistorySyncPromise = task;
  return task;
}

async function syncAllBoundConversationHistories() {
  const snapshot = getSnapshot();
  const conversationIds = new Set<string>();

  getAllBindings().forEach((binding) => {
    conversationIds.add(binding.conversationId);
  });

  snapshot.conversations.forEach((conversation) => {
    if (conversation.feishuChatSessionId) {
      conversationIds.add(conversation.id);
    }
  });

  for (const conversationId of conversationIds) {
    await syncBoundConversationHistory(conversationId);
  }
}

function shouldSyncMessage(
  message: ConversationMessage,
  remoteChatId: string,
) {
  if (message.status && message.status !== "done") {
    return false;
  }

  const renderedText = formatChannelReplyText(message.content).trim();
  const attachmentCount = message.attachments?.length ?? 0;

  if (!renderedText && attachmentCount === 0) {
    return false;
  }

  if (
    message.remoteMessageId &&
    (!message.remoteChatId || message.remoteChatId === remoteChatId)
  ) {
    return false;
  }

  return true;
}

async function deliverMessageToBoundChannel(input: {
  binding: ChannelBinding;
  message: ConversationMessage;
  userDisplayName: string;
}) {
  const summaryText = buildMirroredMessageText(
    input.message,
    input.userDisplayName,
  );
  const attachments = (input.message.attachments ?? []) as UploadedAttachment[];

  const delivery =
    input.binding.channelId === "telegram"
      ? await sendTelegramReply({
          chatId: input.binding.remoteChatId,
          text: summaryText,
          attachments,
        })
      : await sendFeishuReply({
          chatId: input.binding.remoteChatId,
          text: summaryText,
          attachments,
        });

  return {
    remoteMessageId: delivery.remoteMessageId ?? null,
    summaryText,
  };
}

function buildMirroredMessageText(
  message: ConversationMessage,
  userDisplayName: string,
) {
  const rendered = formatChannelReplyText(message.content).trim();

  if (!rendered) {
    return "";
  }

  const actorLabel =
    message.role === "user"
      ? normalizeLabel(userDisplayName) ?? "我"
      : normalizeLabel(message.actorLabel);

  if (!actorLabel) {
    return rendered;
  }

  return `${actorLabel}：\n${rendered}`;
}

function normalizeLabel(value: string | null | undefined) {
  if (typeof value !== "string") {
    return null;
  }

  const normalized = value.trim();
  return normalized.length > 0 ? normalized : null;
}
