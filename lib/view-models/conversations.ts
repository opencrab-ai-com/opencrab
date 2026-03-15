import type { ConversationItem, ConversationMessage, FolderItem } from "@/lib/mock-data";

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
  expandedFolders: Record<string, boolean>;
}): SidebarViewModel {
  const recentConversations = input.conversations.filter((item) => item.folderId === null);
  const folders = input.folders.map((folder) => ({
    id: folder.id,
    name: folder.name,
    isExpanded: input.expandedFolders[folder.id] ?? false,
    conversations: input.conversations.filter((item) => item.folderId === folder.id),
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
