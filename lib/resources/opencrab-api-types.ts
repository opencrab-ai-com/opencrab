import type {
  AppSettings,
  AttachmentItem,
  ConversationItem,
  ConversationMessage,
  FolderItem,
} from "@/lib/seed-data";

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
      type: "thread";
      threadId: string | null;
    }
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

export type SkillStatus = "available" | "installed" | "disabled";
export type SkillOrigin = "codex" | "recommended" | "custom";
export type SkillAction = "install" | "disable" | "enable" | "uninstall";

export type SkillIconName =
  | "image"
  | "book"
  | "pdf"
  | "playwright"
  | "camera"
  | "puzzle"
  | "mic"
  | "sora"
  | "dotnet"
  | "cloud"
  | "doc"
  | "figma"
  | "cube"
  | "gamepad"
  | "github";

export type SkillRecord = {
  id: string;
  name: string;
  summary: string;
  status: SkillStatus;
  statusLabel: string;
  origin: SkillOrigin;
  originLabel: string;
  icon: SkillIconName;
  sourcePath: string | null;
  detailsMarkdown: string | null;
  note: string;
  updatedAt: string | null;
  isCustom: boolean;
};

export type SkillsCatalogResponse = {
  skills: SkillRecord[];
};

export type SkillDetailResponse = {
  skill: SkillRecord | null;
};

export type TaskSchedulePreset = "daily" | "weekdays" | "weekly" | "interval";
export type TaskStatus = "active" | "paused";
export type TaskRunStatus = "running" | "success" | "error";

export type TaskSchedule = {
  preset: TaskSchedulePreset;
  time?: string | null;
  weekday?: number | null;
  intervalHours?: number | null;
};

export type TaskRunRecord = {
  id: string;
  taskId: string;
  status: TaskRunStatus;
  startedAt: string;
  finishedAt: string | null;
  summary: string | null;
  errorMessage: string | null;
  conversationId: string | null;
};

export type TaskRecord = {
  id: string;
  name: string;
  prompt: string;
  schedule: TaskSchedule;
  status: TaskStatus;
  isRunning: boolean;
  timezone: string | null;
  conversationId: string | null;
  nextRunAt: string | null;
  lastRunAt: string | null;
  lastRunStatus: TaskRunStatus | null;
  lastRunPreview: string | null;
  lastError: string | null;
  createdAt: string;
  updatedAt: string;
  scheduleLabel: string;
  nextRunLabel: string;
  lastRunLabel: string;
  runCount: number;
};

export type TaskDetail = TaskRecord & {
  conversation: ConversationItem | null;
  runs: TaskRunRecord[];
};

export type TaskListResponse = {
  tasks: TaskRecord[];
};

export type TaskDetailResponse = {
  task: TaskDetail | null;
};
