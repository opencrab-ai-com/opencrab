import type {
  AppSettings,
  AttachmentItem,
  ConversationItem,
  ConversationMessage,
  FolderItem,
} from "@/lib/mock-data";

export type AppSnapshot = {
  folders: FolderItem[];
  conversations: ConversationItem[];
  conversationMessages: Record<string, ConversationMessage[]>;
  settings: AppSettings;
};

export type CodexReasoningEffort = "minimal" | "low" | "medium" | "high" | "xhigh";

export type CodexReasoningOption = {
  effort: CodexReasoningEffort;
  label: string;
  description: string;
};

export type CodexModelOption = {
  id: string;
  label: string;
  description: string;
  defaultReasoningEffort: CodexReasoningEffort;
  reasoningOptions: CodexReasoningOption[];
};

export type CodexOptionsResponse = {
  models: CodexModelOption[];
  defaultModel: string;
};

export type UploadedAttachment = AttachmentItem;

export type SnapshotMutationResult = {
  snapshot: AppSnapshot;
};

export type CreateConversationResult = SnapshotMutationResult & {
  conversationId: string;
};
