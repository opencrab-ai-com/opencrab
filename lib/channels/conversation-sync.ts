import { getAllBindings } from "@/lib/channels/channel-store";
import { findConversation, updateConversation } from "@/lib/resources/local-store";

export function syncBoundConversationMetadata() {
  const bindings = getAllBindings();

  for (const binding of bindings) {
    const conversation = findConversation(binding.conversationId);

    if (!conversation) {
      continue;
    }

    const nextSource = binding.channelId;
    const nextChannelLabel = binding.channelId === "telegram" ? "Telegram" : "飞书";

    if (
      conversation.source === nextSource &&
      conversation.channelLabel === nextChannelLabel &&
      conversation.remoteChatLabel === binding.remoteChatLabel &&
      conversation.remoteUserLabel === binding.remoteUserLabel
    ) {
      continue;
    }

    updateConversation(binding.conversationId, {
      source: nextSource,
      channelLabel: nextChannelLabel,
      remoteChatLabel: binding.remoteChatLabel,
      remoteUserLabel: binding.remoteUserLabel,
    });
  }
}

