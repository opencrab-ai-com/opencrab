import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import {
  appSettings as seedAppSettings,
  conversationMessages as seedConversationMessages,
  conversations as seedConversations,
  folders as seedFolders,
} from "@/lib/mock-data";
import type { AppSettings, ConversationItem, ConversationMessage } from "@/lib/mock-data";
import type { AppSnapshot } from "@/lib/resources/opencrab-api-types";

const STORE_DIR = path.join(process.cwd(), ".opencrab");
const STORE_PATH = path.join(STORE_DIR, "mock-store.json");

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

export function createConversation(input?: { title?: string; folderId?: string | null }) {
  const state = readState();
  const conversationId = createId("conversation");
  const conversation: ConversationItem = {
    id: conversationId,
    title: input?.title?.trim() || "新对话",
    timeLabel: "刚刚",
    preview: "新的对话",
    folderId: input?.folderId ?? null,
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
      "title" | "preview" | "timeLabel" | "folderId" | "codexThreadId" | "lastAssistantModel"
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
    attachments: message.attachments ? structuredClone(message.attachments) : undefined,
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
      codexThreadId: conversation.codexThreadId ?? null,
      lastAssistantModel: conversation.lastAssistantModel ?? null,
    })),
    conversationMessages: structuredClone(snapshot.conversationMessages || seedConversationMessages),
    settings: {
      ...seedAppSettings,
      ...(snapshot.settings || {}),
    },
  };
}

function createId(prefix: string) {
  return `${prefix}-${crypto.randomUUID()}`;
}
