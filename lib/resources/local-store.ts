import {
  appSettings as seedAppSettings,
  conversationMessages as seedConversationMessages,
  conversations as seedConversations,
  folders as seedFolders,
} from "@/lib/seed-data";
import {
  OPENCRAB_LOCAL_STORE_PATH,
} from "@/lib/resources/runtime-paths";
import { normalizeConversationWorkspaceDir } from "@/lib/resources/workspace-directories";
import type {
  AppSettings,
  ConversationItem,
  ConversationMessage,
  ConversationSource,
} from "@/lib/seed-data";
import type {
  AppSnapshot,
  CodexSandboxMode,
} from "@/lib/resources/opencrab-api-types";
import { createSyncJsonFileStore } from "@/lib/infrastructure/json-store/sync-json-file-store";

export function getSnapshot(): AppSnapshot {
  return cloneSnapshot(readState());
}

export function getVisibleSnapshot(): AppSnapshot {
  const state = readState();
  const visibleConversationIds = new Set(
    state.conversations.filter((conversation) => !conversation.hidden).map((conversation) => conversation.id),
  );

  return {
    folders: structuredClone(state.folders),
    conversations: structuredClone(
      state.conversations.filter((conversation) => visibleConversationIds.has(conversation.id)),
    ),
    conversationMessages: structuredClone(
      Object.fromEntries(
        Object.entries(state.conversationMessages).filter(([conversationId]) =>
          visibleConversationIds.has(conversationId),
        ),
      ),
    ),
    settings: structuredClone(state.settings),
  };
}

export function createFolder(name: string) {
  const trimmedName = name.trim();

  if (!trimmedName) {
    return getSnapshot();
  }

  const state = readState();
  state.folders.push({
    id: createId("folder"),
    name: trimmedName,
  });
  writeState(state);

  return cloneSnapshot(state);
}

export function ensureFolder(name: string) {
  const trimmedName = name.trim();

  if (!trimmedName) {
    return null;
  }

  const state = readState();
  const existing =
    state.folders.find((item) => item.name.trim().toLowerCase() === trimmedName.toLowerCase()) ?? null;

  if (existing) {
    return structuredClone(existing);
  }

  const folder = {
    id: createId("folder"),
    name: trimmedName,
  };

  state.folders.push(folder);
  writeState(state);

  return structuredClone(folder);
}

export function deleteFolder(folderId: string) {
  const state = readState();
  const relatedConversationIds = state.conversations
    .filter((item) => item.folderId === folderId)
    .map((item) => item.id);

  state.folders = state.folders.filter((item) => item.id !== folderId);
  state.conversations = state.conversations.filter((item) => item.folderId !== folderId);
  relatedConversationIds.forEach((conversationId) => {
    delete state.conversationMessages[conversationId];
  });
  writeState(state);

  return cloneSnapshot(state);
}

export function updateFolder(folderId: string, name: string) {
  const trimmedName = name.trim();

  if (!trimmedName) {
    return getSnapshot();
  }

  const state = readState();
  state.folders = state.folders.map((item) =>
    item.id === folderId ? { ...item, name: trimmedName } : item,
  );
  writeState(state);

  return cloneSnapshot(state);
}

export function createConversation(input?: {
  title?: string;
  folderId?: string | null;
  workspaceDir?: string | null;
  sandboxMode?: CodexSandboxMode | null;
  hidden?: boolean;
  projectId?: string | null;
  agentProfileId?: string | null;
  source?: ConversationSource | null;
  channelLabel?: string | null;
  remoteChatLabel?: string | null;
  remoteUserLabel?: string | null;
  feishuChatSessionId?: string | null;
}) {
  const state = readState();
  const conversationId = createId("conversation");
  const now = new Date().toISOString();
  const conversation: ConversationItem = {
    id: conversationId,
    title: input?.title?.trim() || "新对话",
    timeLabel: "刚刚",
    lastActivityAt: now,
    preview: "新的对话",
    folderId: input?.folderId ?? null,
    workspaceDir: normalizeConversationWorkspaceDir(
      input?.workspaceDir,
      conversationId,
    ),
    sandboxMode: normalizeConversationSandboxMode(input?.sandboxMode),
    hidden: input?.hidden ?? false,
    projectId: input?.projectId ?? null,
    source: input?.source ?? "local",
    channelLabel: input?.channelLabel ?? null,
    remoteChatLabel: input?.remoteChatLabel ?? null,
    remoteUserLabel: input?.remoteUserLabel ?? null,
    feishuChatSessionId: normalizeFeishuChatSessionId(input?.feishuChatSessionId),
    codexThreadId: null,
    lastAssistantModel: null,
    agentProfileId: input?.agentProfileId ?? null,
  };

  state.conversations = [conversation, ...state.conversations.filter((item) => item.id !== conversationId)];
  state.conversationMessages[conversationId] = [];
  writeState(state);

  return {
    snapshot: cloneSnapshot(state),
    conversationId,
  };
}

export function updateConversation(
  conversationId: string,
  patch: Partial<
    Pick<
      ConversationItem,
      | "title"
      | "preview"
      | "timeLabel"
      | "folderId"
      | "workspaceDir"
      | "sandboxMode"
      | "hidden"
      | "projectId"
      | "source"
      | "channelLabel"
      | "remoteChatLabel"
      | "remoteUserLabel"
      | "feishuChatSessionId"
      | "codexThreadId"
      | "lastAssistantModel"
      | "agentProfileId"
      | "lastActivityAt"
    >
  >,
) {
  const state = readState();

  state.conversations = state.conversations.map((item) =>
    item.id === conversationId
      ? {
          ...item,
          ...patch,
          workspaceDir:
            Object.prototype.hasOwnProperty.call(patch, "workspaceDir")
              ? normalizeConversationWorkspaceDir(patch.workspaceDir, item.id)
              : item.workspaceDir,
          sandboxMode:
            Object.prototype.hasOwnProperty.call(patch, "sandboxMode")
              ? normalizeConversationSandboxMode(patch.sandboxMode)
              : item.sandboxMode,
          feishuChatSessionId:
            Object.prototype.hasOwnProperty.call(patch, "feishuChatSessionId")
              ? normalizeFeishuChatSessionId(patch.feishuChatSessionId)
              : item.feishuChatSessionId ?? null,
        }
      : item,
  );
  writeState(state);

  return cloneSnapshot(state);
}

export function findConversation(conversationId: string) {
  const state = readState();
  const conversation = state.conversations.find((item) => item.id === conversationId);

  return conversation ? structuredClone(conversation) : null;
}

export function deleteConversation(conversationId: string) {
  const state = readState();

  state.conversations = state.conversations.filter((item) => item.id !== conversationId);
  delete state.conversationMessages[conversationId];
  writeState(state);

  return cloneSnapshot(state);
}

export function addMessage(
  conversationId: string,
  message: Omit<ConversationMessage, "id"> & { id?: string },
) {
  const state = readState();
  const nextMessage = buildConversationMessage(message);

  const currentMessages = state.conversationMessages[conversationId] ?? [];
  state.conversationMessages[conversationId] = [...currentMessages, nextMessage];
  touchConversationForMessage(state, conversationId, nextMessage);
  writeState(state);

  return {
    snapshot: cloneSnapshot(state),
    message: structuredClone(nextMessage),
  };
}

export function upsertMessage(
  conversationId: string,
  message: Omit<ConversationMessage, "id"> & { id: string },
) {
  const state = readState();
  const nextMessage = buildConversationMessage(message);
  const currentMessages = state.conversationMessages[conversationId] ?? [];
  const existingIndex = currentMessages.findIndex((item) => item.id === nextMessage.id);

  if (existingIndex >= 0) {
    state.conversationMessages[conversationId] = currentMessages.map((item, index) =>
      index === existingIndex ? nextMessage : item,
    );
  } else {
    state.conversationMessages[conversationId] = [...currentMessages, nextMessage];
  }

  touchConversationForMessage(state, conversationId, nextMessage);
  writeState(state);

  return {
    snapshot: cloneSnapshot(state),
    message: structuredClone(nextMessage),
  };
}

export function updateMessageRemoteDelivery(
  conversationId: string,
  messageId: string,
  patch: {
    remoteMessageId?: string | null;
    remoteChatId?: string | null;
  },
) {
  const state = readState();
  const currentMessages = state.conversationMessages[conversationId] ?? [];
  let changed = false;

  state.conversationMessages[conversationId] = currentMessages.map((message) => {
    if (message.id !== messageId) {
      return message;
    }

    const nextRemoteMessageId = normalizeOptionalText(patch.remoteMessageId);
    const nextRemoteChatId = normalizeOptionalText(patch.remoteChatId);

    if (
      (message.remoteMessageId ?? null) === nextRemoteMessageId &&
      (message.remoteChatId ?? null) === nextRemoteChatId
    ) {
      return message;
    }

    changed = true;

    return {
      ...message,
      remoteMessageId: nextRemoteMessageId,
      remoteChatId: nextRemoteChatId,
    };
  });

  if (changed) {
    writeState(state);
  }

  return cloneSnapshot(state);
}

export function updateSettings(settings: Partial<AppSettings>) {
  const state = readState();
  state.settings = {
    ...state.settings,
    ...settings,
  };
  writeState(state);

  return cloneSnapshot(state);
}

export function syncConversationChannelMetadata(
  updates: Array<{
    conversationId: string;
    source: ConversationSource;
    channelLabel: string;
    remoteChatLabel: string;
    remoteUserLabel: string | null;
    feishuChatSessionId?: string | null;
  }>,
) {
  if (updates.length === 0) {
    return false;
  }

  const state = readState();
  const updatesByConversationId = new Map(
    updates.map((item) => [item.conversationId, item] as const),
  );
  let changed = false;

  state.conversations = state.conversations.map((conversation) => {
    const update = updatesByConversationId.get(conversation.id);

    if (!update) {
      return conversation;
    }

    const nextFeishuChatSessionId = Object.prototype.hasOwnProperty.call(
      update,
      "feishuChatSessionId",
    )
      ? normalizeFeishuChatSessionId(update.feishuChatSessionId)
      : conversation.feishuChatSessionId ?? null;

    if (
      conversation.source === update.source &&
      conversation.channelLabel === update.channelLabel &&
      conversation.remoteChatLabel === update.remoteChatLabel &&
      conversation.remoteUserLabel === update.remoteUserLabel &&
      (conversation.feishuChatSessionId ?? null) === nextFeishuChatSessionId
    ) {
      return conversation;
    }

    changed = true;

    return {
      ...conversation,
      source: update.source,
      channelLabel: update.channelLabel,
      remoteChatLabel: update.remoteChatLabel,
      remoteUserLabel: update.remoteUserLabel,
      feishuChatSessionId: nextFeishuChatSessionId,
    };
  });

  if (changed) {
    writeState(state);
  }

  return changed;
}

function readState(): AppSnapshot {
  return store.read();
}

function writeState(state: AppSnapshot) {
  store.write(state);
}

const STORE_PATH = OPENCRAB_LOCAL_STORE_PATH;
const store = createSyncJsonFileStore<AppSnapshot>({
  filePath: STORE_PATH,
  seed: createSeedState,
  normalize: normalizeSnapshot,
});

function createSeedState(): AppSnapshot {
  return {
    folders: structuredClone(seedFolders),
    conversations: structuredClone(seedConversations),
    conversationMessages: structuredClone(seedConversationMessages),
    settings: structuredClone(seedAppSettings),
  };
}

function cloneSnapshot(snapshot: AppSnapshot) {
  return structuredClone(snapshot);
}

function normalizeSnapshot(snapshot: Partial<AppSnapshot>): AppSnapshot {
  const normalizedMessages = Object.fromEntries(
    Object.entries(structuredClone(snapshot.conversationMessages || seedConversationMessages)).map(
      ([conversationId, messages]) => [conversationId, normalizeMessages(messages)],
    ),
  );

  return {
    folders: structuredClone(snapshot.folders || seedFolders),
    conversations: structuredClone(snapshot.conversations || seedConversations).map((conversation) => ({
      ...conversation,
      projectId: conversation.projectId ?? null,
      workspaceDir: normalizeConversationWorkspaceDir(
        conversation.workspaceDir,
        conversation.id,
      ),
      sandboxMode: normalizeConversationSandboxMode(conversation.sandboxMode),
      hidden: conversation.hidden ?? false,
      source: conversation.source ?? "local",
      channelLabel: conversation.channelLabel ?? null,
      remoteChatLabel: conversation.remoteChatLabel ?? null,
      remoteUserLabel: conversation.remoteUserLabel ?? null,
      feishuChatSessionId: normalizeFeishuChatSessionId(conversation.feishuChatSessionId),
      codexThreadId: conversation.codexThreadId ?? null,
      lastAssistantModel: conversation.lastAssistantModel ?? null,
      agentProfileId: conversation.agentProfileId ?? null,
      lastActivityAt: inferConversationActivityAt(
        conversation,
        normalizedMessages[conversation.id] ?? [],
      ),
    })),
    conversationMessages: normalizedMessages,
    settings: {
      ...seedAppSettings,
      ...(snapshot.settings || {}),
      userDisplayName:
        typeof snapshot.settings?.userDisplayName === "string" &&
        snapshot.settings.userDisplayName.trim().length > 0
          ? snapshot.settings.userDisplayName.trim()
          : seedAppSettings.userDisplayName,
      userAvatarDataUrl:
        typeof snapshot.settings?.userAvatarDataUrl === "string" &&
        snapshot.settings.userAvatarDataUrl.trim().length > 0
          ? snapshot.settings.userAvatarDataUrl
          : null,
      thinkingModeEnabled:
        snapshot.settings?.thinkingModeEnabled ?? seedAppSettings.thinkingModeEnabled,
    },
  };
}

function inferMessageTimestamp(meta: string | undefined) {
  if (!meta) {
    return undefined;
  }

  const todayMatch = meta.match(/^今天\s+(\d{2}):(\d{2})$/);

  if (todayMatch) {
    const now = new Date();
    return new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate(),
      Number(todayMatch[1]),
      Number(todayMatch[2]),
    ).toISOString();
  }

  const yesterdayMatch = meta.match(/^昨天\s+(\d{2}):(\d{2})$/);

  if (yesterdayMatch) {
    const now = new Date();
    return new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate() - 1,
      Number(yesterdayMatch[1]),
      Number(yesterdayMatch[2]),
    ).toISOString();
  }

  return undefined;
}

function normalizeConversationSandboxMode(
  value: CodexSandboxMode | null | undefined,
): CodexSandboxMode {
  if (
    value === "read-only" ||
    value === "workspace-write" ||
    value === "danger-full-access"
  ) {
    return value;
  }

  return "workspace-write";
}

function normalizeFeishuChatSessionId(value: string | null | undefined) {
  return normalizeOptionalText(value);
}

function normalizeOptionalText(value: string | null | undefined) {
  if (typeof value !== "string") {
    return null;
  }

  const normalized = value.trim();
  return normalized.length > 0 ? normalized : null;
}

function normalizeMessages(messages: ConversationMessage[]) {
  let lastKnownTimestamp: string | undefined;

  return messages.map((message) => {
    const inferredTimestamp = message.timestamp ?? inferMessageTimestamp(message.meta) ?? lastKnownTimestamp;

    if (inferredTimestamp) {
      lastKnownTimestamp = inferredTimestamp;
    }

    return {
      ...message,
      actorLabel: message.actorLabel ?? undefined,
      source: message.source ?? "local",
      remoteMessageId: message.remoteMessageId ?? null,
      remoteChatId: normalizeOptionalText(message.remoteChatId),
      timestamp: inferredTimestamp,
    };
  });
}

function inferConversationActivityAt(
  conversation: Partial<ConversationItem>,
  messages: ConversationMessage[],
) {
  const lastMessageTimestamp = getLatestMessageTimestamp(messages);

  if (lastMessageTimestamp) {
    return lastMessageTimestamp;
  }

  if (isValidIsoTimestamp(conversation.lastActivityAt)) {
    return conversation.lastActivityAt ?? null;
  }

  return inferActivityTimestampFromTimeLabel(conversation.timeLabel) ?? null;
}

function getLatestMessageTimestamp(messages: ConversationMessage[]) {
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const timestamp = messages[index]?.timestamp;

    if (isValidIsoTimestamp(timestamp)) {
      return timestamp ?? null;
    }
  }

  return null;
}

function isValidIsoTimestamp(value: string | null | undefined) {
  if (!value) {
    return false;
  }

  return !Number.isNaN(new Date(value).getTime());
}

function inferActivityTimestampFromTimeLabel(value: string | undefined) {
  if (!value) {
    return null;
  }

  const now = new Date();
  const trimmed = value.trim();

  if (trimmed === "刚刚") {
    return now.toISOString();
  }

  const todayTimeMatch = trimmed.match(/^(\d{2}):(\d{2})$/);

  if (todayTimeMatch) {
    return new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate(),
      Number(todayTimeMatch[1]),
      Number(todayTimeMatch[2]),
    ).toISOString();
  }

  if (trimmed === "昨天") {
    return new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate() - 1,
      12,
      0,
      0,
      0,
    ).toISOString();
  }

  const sameYearMatch = trimmed.match(/^(\d{1,2})月(\d{1,2})日$/);

  if (sameYearMatch) {
    return new Date(
      now.getFullYear(),
      Number(sameYearMatch[1]) - 1,
      Number(sameYearMatch[2]),
      12,
      0,
      0,
      0,
    ).toISOString();
  }

  const fullYearMatch = trimmed.match(/^(\d{4})\/(\d{1,2})\/(\d{1,2})$/);

  if (fullYearMatch) {
    return new Date(
      Number(fullYearMatch[1]),
      Number(fullYearMatch[2]) - 1,
      Number(fullYearMatch[3]),
      12,
      0,
      0,
      0,
    ).toISOString();
  }

  return null;
}

function createId(prefix: string) {
  return `${prefix}-${crypto.randomUUID()}`;
}

function buildConversationMessage(
  message: Omit<ConversationMessage, "id"> & { id?: string },
): ConversationMessage {
  return {
    id: message.id ?? createId("message"),
    role: message.role,
    actorLabel: message.actorLabel ?? undefined,
    content: message.content,
    timestamp: message.timestamp ?? new Date().toISOString(),
    source: message.source ?? "local",
    remoteMessageId: message.remoteMessageId ?? null,
    remoteChatId: normalizeOptionalText(message.remoteChatId),
    attachments: message.attachments ? structuredClone(message.attachments) : undefined,
    usedAttachmentNames: message.usedAttachmentNames
      ? structuredClone(message.usedAttachmentNames)
      : undefined,
    thinking: message.thinking ? structuredClone(message.thinking) : undefined,
    meta: message.meta,
    status: message.status,
  };
}

function touchConversationForMessage(
  state: ReturnType<typeof readState>,
  conversationId: string,
  message: ConversationMessage,
) {
  state.conversations = state.conversations.map((item) =>
    item.id === conversationId
      ? {
          ...item,
          preview:
            message.role === "user"
              ? message.content
              : message.actorLabel
                ? `${message.actorLabel}: ${message.content}`
                : item.preview,
          timeLabel: "刚刚",
          lastActivityAt: message.timestamp ?? item.lastActivityAt ?? null,
        }
      : item,
  );
  state.conversations = [
    ...state.conversations.filter((item) => item.id === conversationId),
    ...state.conversations.filter((item) => item.id !== conversationId),
  ];
}
