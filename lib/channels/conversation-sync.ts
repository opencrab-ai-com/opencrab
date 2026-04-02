import { getAllBindings } from "@/lib/channels/channel-store";
import { syncConversationChannelMetadata } from "@/lib/resources/local-store";

const CONVERSATION_METADATA_SYNC_COOLDOWN_MS = 5 * 60_000;

declare global {
  var __opencrabConversationMetadataSyncPromise: Promise<void> | undefined;
  var __opencrabConversationMetadataSyncLastRunAt: number | undefined;
}

export function syncBoundConversationMetadata() {
  const bindings = getAllBindings();

  syncConversationChannelMetadata(
    bindings
      .filter((binding) => binding.kind === "channel_inbound")
      .map((binding) => ({
      conversationId: binding.conversationId,
      source: binding.channelId,
      channelLabel: binding.channelId === "telegram" ? "Telegram" : "飞书",
      remoteChatLabel: binding.remoteChatLabel,
      remoteUserLabel: binding.remoteUserLabel,
      ...(binding.channelId === "feishu"
        ? { feishuChatSessionId: binding.remoteChatId }
        : {}),
    })),
  );
}

export function ensureBoundConversationMetadataSync(input: { force?: boolean } = {}) {
  const lastRunAt = globalThis.__opencrabConversationMetadataSyncLastRunAt ?? 0;

  if (globalThis.__opencrabConversationMetadataSyncPromise) {
    return globalThis.__opencrabConversationMetadataSyncPromise;
  }

  if (!input.force && Date.now() - lastRunAt < CONVERSATION_METADATA_SYNC_COOLDOWN_MS) {
    return Promise.resolve();
  }

  const task = Promise.resolve()
    .then(() => {
      syncBoundConversationMetadata();
    })
    .finally(() => {
      globalThis.__opencrabConversationMetadataSyncPromise = undefined;
      globalThis.__opencrabConversationMetadataSyncLastRunAt = Date.now();
    });

  globalThis.__opencrabConversationMetadataSyncPromise = task;
  return task;
}
