export type NavKey =
  | "conversations"
  | "agents"
  | "projects"
  | "channels"
  | "tasks"
  | "skills"
  | "about"
  | "settings";
export type AppLanguage = "zh-Hans" | "en";

export type FolderItem = {
  id: string;
  name: string;
};

export type ConversationSource = "local" | "telegram" | "feishu" | "task";

export type AttachmentItem = {
  id: string;
  name: string;
  kind: "image" | "text" | "file";
  size: number;
  mimeType: string;
  wasUsedInReply?: boolean;
};

export type ConversationItem = {
  id: string;
  title: string;
  timeLabel: string;
  preview: string;
  folderId: string | null;
  hidden?: boolean;
  projectId?: string | null;
  source?: ConversationSource | null;
  channelLabel?: string | null;
  remoteChatLabel?: string | null;
  remoteUserLabel?: string | null;
  codexThreadId?: string | null;
  lastAssistantModel?: string | null;
  agentProfileId?: string | null;
};

export type ChannelItem = {
  id: string;
  name: string;
  status: string;
  type: string;
};

export type TaskItem = {
  id: string;
  name: string;
  nextRun: string;
  status: string;
};

export type SkillItem = {
  id: string;
  name: string;
  status: string;
  description: string;
};

export type ConversationMessage = {
  id: string;
  role: "user" | "assistant";
  actorLabel?: string;
  content: string;
  timestamp?: string;
  source?: ConversationSource | null;
  remoteMessageId?: string | null;
  attachments?: AttachmentItem[];
  usedAttachmentNames?: string[];
  thinking?: string[];
  meta?: string;
  status?: "pending" | "done" | "stopped";
};

export type AppSettings = {
  defaultModel: string;
  defaultReasoningEffort: "minimal" | "low" | "medium" | "high" | "xhigh";
  defaultSandboxMode: "read-only" | "workspace-write" | "danger-full-access";
  browserConnectionMode: "current-browser" | "managed-browser";
  defaultLanguage: AppLanguage;
  userDisplayName: string;
  userAvatarDataUrl: string | null;
  thinkingModeEnabled: boolean;
  allowOpenAiApiKeyForCommands: boolean;
};

export const folders: FolderItem[] = [
  { id: "product", name: "产品讨论" },
  { id: "weekly", name: "每周回顾" },
];

export const conversations: ConversationItem[] = [
  {
    id: "opencrab-home",
    title: "opencrab 首页结构整理",
    timeLabel: "刚刚",
    preview: "整理首页结构，收紧空态和输入区。",
    folderId: "product",
    agentProfileId: null,
  },
  {
    id: "task-center",
    title: "任务中心信息架构",
    timeLabel: "今天",
    preview: "梳理任务列表、执行记录和回流结果。",
    folderId: null,
    agentProfileId: null,
  },
  {
    id: "channel-flow",
    title: "Channel 绑定流程",
    timeLabel: "昨天",
    preview: "整理完整远程对话入口和连接引导。",
    folderId: "weekly",
    agentProfileId: null,
  },
  {
    id: "skills-empty",
    title: "Skills 首页空态",
    timeLabel: "昨天",
    preview: "保持技能页轻量，不做市场化结构。",
    folderId: null,
    agentProfileId: null,
  },
];

export const conversationMessages: Record<string, ConversationMessage[]> = {
  "opencrab-home": [
    {
      id: "m1",
      role: "user",
      content: "先把 opencrab 的首页搭成更接近 ChatGPT 的极简结构。",
      meta: "今天 00:14",
      status: "done",
    },
    {
      id: "m2",
      role: "assistant",
      content:
        "已经把首页收成左侧导航、中央标题和底部输入框三层结构，同时保留对话、Channels、任务、Skills 四个一级入口。",
      meta: "生成完成",
      status: "done",
    },
    {
      id: "m3",
      role: "user",
      content: "顶部不要模型选择，首页也不要快捷入口。",
      meta: "今天 00:17",
      status: "done",
    },
    {
      id: "m4",
      role: "assistant",
      content:
        "已更新为只显示 OpenCrab 标题，去掉顶部模型选择、右上角按钮、语音输入和首页快捷入口。",
      meta: "生成完成",
      status: "done",
    },
  ],
};

export const channels: ChannelItem[] = [
  { id: "telegram", name: "Telegram", status: "已连接", type: "telegram" },
  { id: "mail", name: "Email", status: "已连接", type: "email" },
  { id: "wechat", name: "WeChat", status: "待接入", type: "wechat" },
];

export const tasks: TaskItem[] = [
  { id: "weekly-report", name: "每周产品回顾", nextRun: "周一 09:00", status: "运行中" },
  { id: "daily-summary", name: "日报整理", nextRun: "今天 18:30", status: "运行中" },
  { id: "follow-up", name: "客户跟进提醒", nextRun: "已暂停", status: "暂停中" },
];

export const skills: SkillItem[] = [
  {
    id: "doc-structuring",
    name: "文档结构整理",
    status: "已启用",
    description: "帮助用户把需求、规划和说明文档整理成清晰结构。",
  },
  {
    id: "task-automation",
    name: "任务自动化",
    status: "已启用",
    description: "适合提醒、整理、回顾和固定时间执行的任务。",
  },
  {
    id: "channel-assistant",
    name: "远程对话助手",
    status: "未启用",
    description: "把网页里的会话带到外部渠道，并保持结果回流。",
  },
];

export const currentUser = {
  name: "OpenCrab User",
  initial: "O",
};

export const appSettings: AppSettings = {
  defaultModel: "gpt-5.4",
  defaultReasoningEffort: "medium",
  defaultSandboxMode: "workspace-write",
  browserConnectionMode: "current-browser",
  defaultLanguage: "zh-Hans",
  userDisplayName: "我",
  userAvatarDataUrl: null,
  thinkingModeEnabled: true,
  allowOpenAiApiKeyForCommands: false,
};
