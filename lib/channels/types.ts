export type ChannelId = "telegram" | "feishu";
export type ChannelBindingKind = "channel_inbound" | "product_bound";

export type ChannelStatus = "not_configured" | "connecting" | "ready" | "error" | "disconnected";

export type ChannelDirection = "inbound" | "outbound" | "system";

export type ChannelEventStatus = "received" | "processed" | "sent" | "ignored" | "error";

export type ChannelConfigSummary = {
  webhookPath: string;
  webhookUrl: string | null;
  currentWebhookUrl?: string | null;
  connectionMode?: "webhook" | "websocket";
  socketStatus?: "idle" | "connecting" | "connected" | "error";
  socketConnected?: boolean;
  lastSocketConnectedAt?: string | null;
  botUsername?: string | null;
  appId?: string | null;
  credentialsVerified?: boolean;
  lastVerifiedAt?: string | null;
  webhookConfigured?: boolean;
  webhookSetupMode?: "auto" | "pending_public_url" | "manual";
  pendingUpdateCount?: number;
  lastWebhookError?: string | null;
  hasBotToken?: boolean;
  hasWebhookSecret?: boolean;
  hasAppId?: boolean;
  hasAppSecret?: boolean;
  hasVerificationToken?: boolean;
  hasEncryptKey?: boolean;
};

export type ChannelRecord = {
  id: ChannelId;
  name: string;
  status: ChannelStatus;
  lastError: string | null;
  lastEventAt: string | null;
  lastInboundAt: string | null;
  lastOutboundAt: string | null;
  updatedAt: string;
  configSummary: ChannelConfigSummary;
};

export type ChannelBinding = {
  id: string;
  kind: ChannelBindingKind;
  channelId: ChannelId;
  remoteChatId: string;
  remoteChatLabel: string;
  remoteUserId: string | null;
  remoteUserLabel: string | null;
  conversationId: string;
  createdAt: string;
  updatedAt: string;
  lastInboundAt: string | null;
  lastOutboundAt: string | null;
};

export type ChannelEvent = {
  id: string;
  channelId: ChannelId;
  conversationId: string | null;
  bindingId: string | null;
  direction: ChannelDirection;
  status: ChannelEventStatus;
  dedupeKey: string | null;
  remoteChatId: string | null;
  remoteMessageId: string | null;
  summary: string;
  errorMessage: string | null;
  createdAt: string;
};

export type ChannelStoreState = {
  channels: ChannelRecord[];
  bindings: ChannelBinding[];
  events: ChannelEvent[];
};

export type ChannelOverview = ChannelRecord & {
  bindingCount: number;
  recentEventCount: number;
};

export type ChannelConversationLink = {
  id: string;
  title: string;
  preview: string;
  timeLabel: string;
};

export type ChannelBindingDetail = ChannelBinding & {
  conversation: ChannelConversationLink | null;
};

export type ChannelDetail = ChannelRecord & {
  bindingCount: number;
  recentEventCount: number;
  bindings: ChannelBindingDetail[];
  events: ChannelEvent[];
};

export type TelegramSecrets = {
  botToken?: string;
  webhookSecret?: string;
  enabled?: boolean;
};

export type FeishuSecrets = {
  appId?: string;
  appSecret?: string;
  verificationToken?: string;
  encryptKey?: string;
  enabled?: boolean;
};

export type ChannelSecretsStore = {
  telegram?: TelegramSecrets;
  feishu?: FeishuSecrets;
};
