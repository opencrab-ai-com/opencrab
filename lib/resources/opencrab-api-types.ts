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
export type CodexSandboxMode = "read-only" | "workspace-write" | "danger-full-access";
export type BrowserConnectionMode = "current-browser" | "managed-browser";

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

export type CodexStatusResponse =
  | {
      ok: true;
      model: string;
      reasoningEffort: CodexReasoningEffort;
      sandboxMode: CodexSandboxMode;
      networkAccessEnabled: boolean;
      approvalPolicy: string;
      reply: string;
      threadId: string | null;
      usage: {
        input_tokens: number;
        cached_input_tokens: number;
        output_tokens: number;
      } | null;
      loginStatus: "logged_in";
      loginMethod: "chatgpt";
    }
  | {
      ok: false;
      error: string;
      loginStatus: "missing";
      loginMethod: "chatgpt";
    };

export type CodexBrowserSessionStatus = {
  ok: boolean;
  status: "ready" | "launching" | "missing_browser" | "unreachable";
  mode: BrowserConnectionMode;
  browserUrl: string | null;
  userDataDir: string | null;
  launchedByOpenCrab: boolean;
  chromePath: string | null;
  message: string;
};

export type UploadedAttachment = AttachmentItem;

export type SnapshotMutationResult = {
  snapshot: AppSnapshot;
};

export type CreateConversationResult = SnapshotMutationResult & {
  conversationId: string;
};

export type ReplyStreamEvent =
  | {
      type: "thinking";
      entries: string[];
    }
  | {
      type: "assistant";
      text: string;
    }
  | {
      type: "done";
      snapshot: AppSnapshot;
      assistant: {
        text: string;
        model: string;
        threadId: string | null;
        usage: {
          input_tokens: number;
          cached_input_tokens: number;
          output_tokens: number;
        } | null;
        thinking: string[];
      };
    }
  | {
      type: "error";
      error: string;
    };
