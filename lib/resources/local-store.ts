import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import {
  appSettings as seedAppSettings,
  conversationMessages as seedConversationMessages,
  conversations as seedConversations,
  folders as seedFolders,
} from "@/lib/seed-data";
import {
  OPENCRAB_LOCAL_STORE_PATH,
  OPENCRAB_RUNTIME_DIR,
} from "@/lib/resources/runtime-paths";
import type {
  AppSettings,
  ConversationItem,
  ConversationMessage,
  ConversationSource,
} from "@/lib/seed-data";
import type { AppSnapshot } from "@/lib/resources/opencrab-api-types";

export function getSnapshot(): AppSnapshot {
  return cloneSnapshot(readState());
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
  source?: ConversationSource | null;
  channelLabel?: string | null;
  remoteChatLabel?: string | null;
  remoteUserLabel?: string | null;
}) {
  const state = readState();
  const conversationId = createId("conversation");
  const conversation: ConversationItem = {
    id: conversationId,
    title: input?.title?.trim() || "新对话",
    timeLabel: "刚刚",
    preview: "新的对话",
    folderId: input?.folderId ?? null,
    source: input?.source ?? "local",
    channelLabel: input?.channelLabel ?? null,
    remoteChatLabel: input?.remoteChatLabel ?? null,
    remoteUserLabel: input?.remoteUserLabel ?? null,
    codexThreadId: null,
    lastAssistantModel: null,
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
      | "source"
      | "channelLabel"
      | "remoteChatLabel"
      | "remoteUserLabel"
      | "codexThreadId"
      | "lastAssistantModel"
    >
  >,
) {
  const state = readState();

  state.conversations = state.conversations.map((item) =>
    item.id === conversationId ? { ...item, ...patch } : item,
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
  const nextMessage: ConversationMessage = {
    id: message.id ?? createId("message"),
    role: message.role,
    content: message.content,
    timestamp: message.timestamp ?? new Date().toISOString(),
    source: message.source ?? "local",
    remoteMessageId: message.remoteMessageId ?? null,
    attachments: message.attachments ? structuredClone(message.attachments) : undefined,
    usedAttachmentNames: message.usedAttachmentNames
      ? structuredClone(message.usedAttachmentNames)
      : undefined,
    thinking: message.thinking ? structuredClone(message.thinking) : undefined,
    meta: message.meta,
    status: message.status,
  };

  const currentMessages = state.conversationMessages[conversationId] ?? [];
  state.conversationMessages[conversationId] = [...currentMessages, nextMessage];
  state.conversations = state.conversations.map((item) =>
    item.id === conversationId
      ? {
          ...item,
          preview: message.role === "user" ? message.content : item.preview,
          timeLabel: "刚刚",
        }
      : item,
  );
  state.conversations = [
    ...state.conversations.filter((item) => item.id === conversationId),
    ...state.conversations.filter((item) => item.id !== conversationId),
  ];
  writeState(state);

  return {
    snapshot: cloneSnapshot(state),
    message: structuredClone(nextMessage),
  };
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

function readState(): AppSnapshot {
  ensureStoreFile();

  try {
    const parsed = JSON.parse(readFileSync(STORE_PATH, "utf8")) as Partial<AppSnapshot>;
    const normalized = normalizeSnapshot(parsed);
    writeFileSync(STORE_PATH, JSON.stringify(normalized, null, 2), "utf8");
    return normalized;
  } catch {
    const seedState = createSeedState();
    writeFileSync(STORE_PATH, JSON.stringify(seedState, null, 2), "utf8");
    return seedState;
  }
}

function writeState(state: AppSnapshot) {
  ensureStoreFile();
  writeFileSync(STORE_PATH, JSON.stringify(state, null, 2), "utf8");
}

function ensureStoreFile() {
  if (!existsSync(STORE_DIR)) {
    mkdirSync(STORE_DIR, { recursive: true });
  }

  if (!existsSync(STORE_PATH)) {
    writeFileSync(STORE_PATH, JSON.stringify(createSeedState(), null, 2), "utf8");
  }
}

const STORE_DIR = OPENCRAB_RUNTIME_DIR;
const STORE_PATH = OPENCRAB_LOCAL_STORE_PATH;

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
  return {
    folders: structuredClone(snapshot.folders || seedFolders),
    conversations: structuredClone(snapshot.conversations || seedConversations).map((conversation) => ({
      ...conversation,
      source: conversation.source ?? "local",
      channelLabel: conversation.channelLabel ?? null,
      remoteChatLabel: conversation.remoteChatLabel ?? null,
      remoteUserLabel: conversation.remoteUserLabel ?? null,
      codexThreadId: conversation.codexThreadId ?? null,
      lastAssistantModel: conversation.lastAssistantModel ?? null,
    })),
    conversationMessages: Object.fromEntries(
      Object.entries(structuredClone(snapshot.conversationMessages || seedConversationMessages)).map(
        ([conversationId, messages]) => [conversationId, normalizeMessages(messages)],
      ),
    ),
    settings: {
      ...seedAppSettings,
      ...(snapshot.settings || {}),
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

function normalizeMessages(messages: ConversationMessage[]) {
  let lastKnownTimestamp: string | undefined;

  return messages.map((message) => {
    const inferredTimestamp = message.timestamp ?? inferMessageTimestamp(message.meta) ?? lastKnownTimestamp;

    if (inferredTimestamp) {
      lastKnownTimestamp = inferredTimestamp;
    }

    return {
      ...message,
      source: message.source ?? "local",
      remoteMessageId: message.remoteMessageId ?? null,
      timestamp: inferredTimestamp,
    };
  });
}

function createId(prefix: string) {
  return `${prefix}-${crypto.randomUUID()}`;
}
