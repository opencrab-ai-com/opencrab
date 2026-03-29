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
  lastActivityAt?: string | null;
  preview: string;
  folderId: string | null;
  workspaceDir?: string | null;
  sandboxMode?: "read-only" | "workspace-write" | "danger-full-access" | null;
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

export const folders: FolderItem[] = [];

export const conversations: ConversationItem[] = [];

export const conversationMessages: Record<string, ConversationMessage[]> = {};

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
