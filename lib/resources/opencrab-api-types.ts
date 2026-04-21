import type {
  AppSettings,
  AttachmentItem,
  ConversationItem,
  ConversationMessage,
  ConversationPlanStep,
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

export type ChatGptConnectionStage =
  | "not_connected"
  | "connecting"
  | "waiting_browser_auth"
  | "connected"
  | "expired"
  | "error";

export type ChatGptConnectionStatusResponse = {
  provider: "chatgpt";
  authMode: "browser" | "device_code" | null;
  stage: ChatGptConnectionStage;
  isConnected: boolean;
  authUrl: string | null;
  deviceCode: string | null;
  codeExpiresAt: string | null;
  startedAt: string | null;
  connectedAt: string | null;
  error: string | null;
  message: string;
};

export type RuntimeReadinessResponse = {
  ready: boolean;
  requiredBrowser: "chrome";
  recommendedAction: "install_chrome" | "repair_codex" | "connect_chatgpt" | null;
  chrome: {
    ok: boolean;
    chromePath: string | null;
    message: string;
  };
  codex: {
    ok: boolean;
    executablePath: string | null;
    message: string;
  };
  chatgpt: {
    ok: boolean;
    stage: ChatGptConnectionStage;
    message: string;
  };
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

export type RuntimeConnectionSnapshotResponse = {
  codexStatus: CodexStatusResponse;
  chatGptConnectionStatus: ChatGptConnectionStatusResponse;
  browserSessionStatus: CodexBrowserSessionStatus;
  runtimeReadiness: RuntimeReadinessResponse;
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
      type: "plan";
      steps: ConversationPlanStep[];
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
        planSteps: ConversationPlanStep[];
      };
    }
  | {
      type: "error";
      error: string;
    };

export type SkillStatus = "available" | "installed" | "disabled";
export type SkillOrigin = "codex" | "recommended" | "custom";
export type SkillAction = "install" | "disable" | "enable" | "uninstall";
export type SkillCategory =
  | "marketing-social"
  | "sales-growth"
  | "finance-analysis"
  | "writing-knowledge"
  | "creative-media"
  | "business-ops"
  | "product-tech"
  | "general";

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
  category: SkillCategory;
  categoryLabel: string;
  status: SkillStatus;
  statusLabel: string;
  origin: SkillOrigin;
  originLabel: string;
  icon: SkillIconName;
  sourceUrl: string | null;
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
  intervalMinutes?: number | null;
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
  projectId: string | null;
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
  projectId: string | null;
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
  project: import("@/lib/projects/types").ProjectRoomRecord | null;
  runs: TaskRunRecord[];
};

export type TaskListResponse = {
  tasks: TaskRecord[];
};

export type TaskDetailResponse = {
  task: TaskDetail | null;
};

export type WorkflowOwnerType = "person" | "team";
export type WorkflowStatus = "draft" | "active" | "paused" | "archived";
export type WorkflowVersionStatus = "draft" | "published";
export type WorkflowReviewState = "pending_review" | "up_to_date";
export type WorkflowTriggerType = "manual" | "schedule";
export type WorkflowSchedulePreset = "daily" | "weekdays" | "weekly" | "interval";
export type WorkflowSchedule = {
  preset: WorkflowSchedulePreset;
  time?: string | null;
  weekday?: number | null;
  intervalMinutes?: number | null;
  intervalHours?: number | null;
};

export type WorkflowDeliveryDestination =
  | { kind: "none" }
  | { kind: "review_center" }
  | { kind: "pending_publish" }
  | { kind: "conversation"; conversationId: string | null }
  | { kind: "channel"; channelId: string | null };

export type WorkflowNodePosition = {
  x: number;
  y: number;
};

export type WorkflowStartNode = {
  id: string;
  type: "start";
  name: string;
  config: {
    trigger: WorkflowTriggerType;
    schedule?: WorkflowSchedule | null;
  };
  uiPosition: WorkflowNodePosition;
};

export type WorkflowScriptNode = {
  id: string;
  type: "script";
  name: string;
  config: {
    scriptId: string | null;
    source?: string | null;
  };
  uiPosition: WorkflowNodePosition;
};

export type WorkflowAgentNode = {
  id: string;
  type: "agent";
  name: string;
  config: {
    agentId: string | null;
    prompt: string | null;
  };
  uiPosition: WorkflowNodePosition;
};

export type WorkflowEndNode = {
  id: string;
  type: "end";
  name: string;
  config: {
    deliveryTarget: "conversation" | "channel" | "pending_publish" | "none";
    primaryDestination?: WorkflowDeliveryDestination | null;
    mirroredDestinations?: WorkflowDeliveryDestination[];
  };
  uiPosition: WorkflowNodePosition;
};

export type WorkflowNodeRecord =
  | WorkflowStartNode
  | WorkflowScriptNode
  | WorkflowAgentNode
  | WorkflowEndNode;

export type WorkflowEdgeRecord = {
  id: string;
  sourceNodeId: string;
  targetNodeId: string;
  condition: string | null;
  label: string | null;
};

export type WorkflowGraph = {
  nodes: WorkflowNodeRecord[];
  edges: WorkflowEdgeRecord[];
  layout: {
    viewport: {
      x: number;
      y: number;
      zoom: number;
    };
  };
  defaults: {
    timezone: string | null;
  };
};

export type WorkflowVersionRecord = {
  id: string;
  workflowId: string;
  versionNumber: number;
  status: WorkflowVersionStatus;
  graph: WorkflowGraph;
  createdAt: string;
  updatedAt: string;
  publishedAt: string | null;
};

export type WorkflowRecord = {
  id: string;
  name: string;
  description: string | null;
  ownerType: WorkflowOwnerType;
  ownerId: string;
  status: WorkflowStatus;
  activeVersionId: string;
  createdAt: string;
  updatedAt: string;
};

export type WorkflowOverviewCard = {
  id: string;
  name: string;
  description: string | null;
  status: WorkflowStatus;
  ownerType: WorkflowOwnerType;
  ownerId: string;
  updatedAt: string;
  draftVersionNumber: number | null;
  publishedVersionNumber: number | null;
  reviewState: WorkflowReviewState;
};

export type WorkflowReviewCounters = {
  total: number;
  pendingReview: number;
  upToDate: number;
  neverPublished: number;
};

export type WorkflowDetailRecord = {
  workflow: WorkflowRecord;
  versions: WorkflowVersionRecord[];
  reviewState: WorkflowReviewState;
  nodeCount: number;
  edgeCount: number;
  latestDraftVersionNumber: number | null;
  latestPublishedVersionNumber: number | null;
};

export type WorkflowRunRecord = {
  id: string;
  workflowId: string;
  status: "accepted";
  startedAt: string;
  message: string;
};

export type WorkflowListResponse = {
  workflows: WorkflowOverviewCard[];
  reviewCounters: WorkflowReviewCounters;
};

export type WorkflowDetailResponse = {
  workflow: WorkflowDetailRecord | null;
};

export type WorkflowRunResponse = {
  workflow: WorkflowDetailRecord | null;
  run: WorkflowRunRecord | null;
};

export type WorkflowReviewSurface = "general" | "pending_publish";
export type WorkflowReviewStatus = "open" | "resolved";
export type WorkflowReviewView = "all" | "pending_publish";

export type WorkflowReviewItemRecord = {
  id: string;
  workflowId: string;
  workflowName: string;
  workflowStatus: WorkflowStatus;
  workflowVersionId: string;
  runId: string;
  runStatus: "running" | "success" | "error" | "waiting_for_human" | null;
  runStartedAt: string | null;
  sourceNodeId: string;
  sourceNodeName: string;
  sourceNodeType: WorkflowNodeRecord["type"];
  surface: WorkflowReviewSurface;
  status: WorkflowReviewStatus;
  summary: string;
  threadPreview: string | null;
  createdAt: string;
  updatedAt: string;
};

export type WorkflowReviewItemsResponse = {
  view: WorkflowReviewView;
  items: WorkflowReviewItemRecord[];
};

export type WorkflowReviewActionResponse = {
  item: WorkflowReviewItemRecord | null;
  workflow: WorkflowDetailRecord | null;
  result:
    | {
        status: "retried";
        reviewItemId: string;
        runId: string;
        nodeId: string;
        staleNodeRunIds: string[];
      }
    | {
        status: "saved_to_draft";
        reviewItemId: string;
      }
    | null;
};
