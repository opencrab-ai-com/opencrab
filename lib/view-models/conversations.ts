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
  const enhanceConversation = (conversation: ConversationItem) => {
    const messages = input.conversationMessages[conversation.id] ?? [];
    const lastTimestamp = [...messages]
      .reverse()
      .find((message) => Boolean(message.timestamp))?.timestamp;

    return {
      ...conversation,
      timeLabel: lastTimestamp
        ? formatConversationTimeLabel(lastTimestamp)
        : conversation.timeLabel,
    };
  };

  const sortByLatest = (items: ConversationItem[]) =>
    [...items].sort((left, right) => {
      const leftMessages = input.conversationMessages[left.id] ?? [];
      const rightMessages = input.conversationMessages[right.id] ?? [];
      const leftTimestamp = [...leftMessages].reverse().find((message) => Boolean(message.timestamp))?.timestamp;
      const rightTimestamp = [...rightMessages].reverse().find((message) => Boolean(message.timestamp))?.timestamp;
      const leftValue = leftTimestamp ? new Date(leftTimestamp).getTime() : 0;
      const rightValue = rightTimestamp ? new Date(rightTimestamp).getTime() : 0;

      return rightValue - leftValue;
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

export function buildConversationDetailViewModel(input: {
  title?: string;
  messages?: ConversationMessage[];
}): ConversationDetailViewModel {
  return {
    title: input.title ?? "对话",
    messages: input.messages ?? [],
  };
}
