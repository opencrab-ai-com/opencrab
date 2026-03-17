import { formatConversationTimeLabel } from "@/lib/conversations/utils";
import type { ConversationItem, ConversationMessage, FolderItem } from "@/lib/seed-data";

export type SidebarFolderViewModel = {
  id: string;
  name: string;
  isExpanded: boolean;
  conversations: ConversationItem[];
};

export type SidebarViewModel = {
  folders: SidebarFolderViewModel[];
  recentConversations: ConversationItem[];
};

export type ConversationDetailViewModel = {
  title: string;
  messages: ConversationMessage[];
};

export function buildSidebarViewModel(input: {
  folders: FolderItem[];
  conversations: ConversationItem[];
  conversationMessages: Record<string, ConversationMessage[]>;
  expandedFolders: Record<string, boolean>;
}): SidebarViewModel {
  const conversationOrder = new Map(
    input.conversations.map((conversation, index) => [conversation.id, index]),
  );
  const latestTimestampMap = new Map(
    input.conversations.map((conversation) => [
      conversation.id,
      getConversationLatestTimestamp(input.conversationMessages[conversation.id] ?? []),
    ]),
  );

  const enhanceConversation = (conversation: ConversationItem) => {
    const lastTimestamp = latestTimestampMap.get(conversation.id) ?? null;

    return {
      ...conversation,
      timeLabel: lastTimestamp
        ? formatConversationTimeLabel(lastTimestamp)
        : conversation.timeLabel,
    };
  };

  const sortByLatest = (items: ConversationItem[]) =>
    [...items].sort((left, right) => {
      const leftTimestamp = latestTimestampMap.get(left.id) ?? null;
      const rightTimestamp = latestTimestampMap.get(right.id) ?? null;
      const leftValue = leftTimestamp ? new Date(leftTimestamp).getTime() : null;
      const rightValue = rightTimestamp ? new Date(rightTimestamp).getTime() : null;

      if (leftValue !== null && rightValue !== null && leftValue !== rightValue) {
        return rightValue - leftValue;
      }

      if (leftValue !== null && rightValue === null) {
        return -1;
      }

      if (leftValue === null && rightValue !== null) {
        return 1;
      }

      return (conversationOrder.get(left.id) ?? 0) - (conversationOrder.get(right.id) ?? 0);
    });

  const recentConversations = sortByLatest(
    input.conversations.filter((item) => item.folderId === null).map(enhanceConversation),
  );
  const folders = input.folders.map((folder) => ({
    id: folder.id,
    name: folder.name,
    isExpanded: input.expandedFolders[folder.id] ?? false,
    conversations: sortByLatest(
      input.conversations.filter((item) => item.folderId === folder.id).map(enhanceConversation),
    ),
  }));

  return {
    folders,
    recentConversations,
  };
}

function getConversationLatestTimestamp(messages: ConversationMessage[]) {
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    if (messages[index]?.timestamp) {
      return messages[index].timestamp ?? null;
    }
  }

  return null;
}

export function buildConversationDetailViewModel(input: {
  title?: string;
  messages?: ConversationMessage[];
}): ConversationDetailViewModel {
  return {
    title: input.title ?? "对话",
    messages: input.messages ?? [],
  };
}
