import {
  clearConversationBindings,
  reconcileConversationBinding,
} from "@/lib/channels/channel-store";
import { syncBoundConversationHistory } from "@/lib/channels/bound-conversation-sync";
import {
  createConversation,
  deleteConversation,
  updateConversation,
} from "@/lib/resources/local-store";
import type { CreateConversationResult, SnapshotMutationResult } from "@/lib/resources/opencrab-api-types";
import type { ConversationItem } from "@/lib/seed-data";

export type ConversationCreator = typeof createConversation;
export type ConversationUpdater = typeof updateConversation;
export type ConversationRemover = typeof deleteConversation;

type ConversationManagementServiceDependencies = {
  create?: ConversationCreator;
  update?: ConversationUpdater;
  remove?: ConversationRemover;
};

export function createConversationManagementService(
  dependencies: ConversationManagementServiceDependencies = {},
) {
  const create = dependencies.create ?? createConversation;
  const update = dependencies.update ?? updateConversation;
  const remove = dependencies.remove ?? deleteConversation;

  return {
    async create(input?: Parameters<ConversationCreator>[0]) {
      const result = create(input);
      syncConversationFeishuBinding(findConversationFromResult(result, result.conversationId));
      const syncResult = await syncBoundConversationHistory(result.conversationId);

      return {
        ...result,
        snapshot: syncResult.snapshot,
      };
    },
    async update(conversationId: string, patch: Parameters<ConversationUpdater>[1]) {
      const snapshot = update(conversationId, patch);
      syncConversationFeishuBinding(findConversationFromResult({ snapshot }, conversationId));
      const syncResult = await syncBoundConversationHistory(conversationId);
      return syncResult.snapshot;
    },
    remove(conversationId: string) {
      clearConversationBindings(conversationId);
      return remove(conversationId);
    },
  };
}

export const conversationManagementService = createConversationManagementService();

function findConversationFromResult(
  result: CreateConversationResult | SnapshotMutationResult,
  conversationId: string,
) {
  return result.snapshot.conversations.find((conversation) => conversation.id === conversationId) ?? null;
}

function syncConversationFeishuBinding(conversation: ConversationItem | null) {
  if (!conversation) {
    return;
  }

  const remoteChatId = normalizeFeishuChatSessionId(conversation.feishuChatSessionId);

  if (!remoteChatId) {
    clearConversationBindings(conversation.id, "feishu");
    return;
  }

  reconcileConversationBinding({
    kind:
      conversation.source === "feishu"
        ? "channel_inbound"
        : "product_bound",
    channelId: "feishu",
    conversationId: conversation.id,
    remoteChatId,
    remoteChatLabel: conversation.remoteChatLabel ?? conversation.title,
    remoteUserId: null,
    remoteUserLabel: conversation.remoteUserLabel ?? null,
  });
}

function normalizeFeishuChatSessionId(value: string | null | undefined) {
  if (typeof value !== "string") {
    return null;
  }

  const normalized = value.trim();
  return normalized.length > 0 ? normalized : null;
}
