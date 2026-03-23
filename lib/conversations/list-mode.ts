import type { ConversationItem } from "@/lib/seed-data";

export type ConversationListMode = "direct" | "agent" | "team" | "channel";

export const DEFAULT_CONVERSATION_MODE: ConversationListMode = "direct";

export function resolveConversationListMode(
  conversation: ConversationItem,
): ConversationListMode {
  if (conversation.projectId) {
    return "team";
  }

  if (conversation.agentProfileId) {
    return "agent";
  }

  if (conversation.source && conversation.source !== "local") {
    return "channel";
  }

  return "direct";
}

export function isConversationListMode(
  value: string | null,
): value is ConversationListMode {
  return value === "direct" || value === "agent" || value === "team" || value === "channel";
}
