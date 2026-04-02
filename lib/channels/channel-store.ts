import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { getSnapshot } from "@/lib/resources/local-store";
import type { ConversationItem } from "@/lib/seed-data";
import {
  OPENCRAB_CHANNEL_STORE_PATH,
  OPENCRAB_STATE_DIR,
} from "@/lib/resources/runtime-paths";
import { getStoredPublicBaseUrl } from "@/lib/runtime/runtime-config-store";
import type {
  ChannelBinding,
  ChannelBindingKind,
  ChannelDetail,
  ChannelEvent,
  ChannelId,
  ChannelOverview,
  ChannelRecord,
  ChannelStatus,
  ChannelStoreState,
} from "@/lib/channels/types";

const STORE_DIR = OPENCRAB_STATE_DIR;
const STORE_PATH = OPENCRAB_CHANNEL_STORE_PATH;
const MAX_EVENTS = 200;

export const CHANNEL_DEFINITIONS: Record<
  ChannelId,
  { id: ChannelId; name: string; webhookPath: string }
> = {
  telegram: {
    id: "telegram",
    name: "Telegram",
    webhookPath: "/api/channels/telegram/webhook",
  },
  feishu: {
    id: "feishu",
    name: "飞书",
    webhookPath: "/api/channels/feishu/webhook",
  },
};

export function getPublicBaseUrl() {
  return (
    process.env.OPENCRAB_PUBLIC_BASE_URL?.trim().replace(/\/+$/, "") ||
    getStoredPublicBaseUrl() ||
    null
  );
}

export function getChannelWebhookUrl(channelId: ChannelId) {
  const baseUrl = getPublicBaseUrl();

  return baseUrl ? `${baseUrl}${CHANNEL_DEFINITIONS[channelId].webhookPath}` : null;
}

export function getChannelOverviewList(): ChannelOverview[] {
  const state = readState();

  return state.channels.map((channel) => ({
    ...channel,
    bindingCount: state.bindings.filter((binding) => binding.channelId === channel.id).length,
    recentEventCount: state.events.filter((event) => event.channelId === channel.id).length,
  }));
}

export function getChannelDetail(channelId: ChannelId): ChannelDetail {
  const state = readState();
  const channel = state.channels.find((item) => item.id === channelId) ?? createDefaultChannel(channelId);
  const snapshot = getSnapshot();
  const bindings = state.bindings
    .filter((binding) => binding.channelId === channelId)
    .sort(sortByRecent)
    .map((binding) => ({
      ...binding,
      conversation:
        snapshot.conversations.find((conversation) => conversation.id === binding.conversationId) ?? null,
    }));
  const events = state.events.filter((event) => event.channelId === channelId).sort(sortByRecent);

  return {
    ...channel,
    bindingCount: bindings.length,
    recentEventCount: events.length,
    bindings,
    events,
  };
}

export function updateChannelRecord(
  channelId: ChannelId,
  patch: Partial<Omit<ChannelRecord, "configSummary">> & {
    configSummary?: Partial<ChannelRecord["configSummary"]>;
  },
) {
  return mutateState((state) => {
    const current = state.channels.find((item) => item.id === channelId) ?? createDefaultChannel(channelId);
    const next: ChannelRecord = {
      ...current,
      ...patch,
      configSummary: {
        ...current.configSummary,
        ...(patch.configSummary || {}),
      },
      updatedAt: new Date().toISOString(),
    };

    state.channels = [
      next,
      ...state.channels.filter((item) => item.id !== channelId),
    ].sort((left, right) => left.name.localeCompare(right.name, "zh-CN"));

    return next;
  });
}

export function markChannelReady(channelId: ChannelId) {
  return updateChannelRecord(channelId, {
    status: "ready",
    lastError: null,
    lastEventAt: new Date().toISOString(),
  });
}

export function markChannelError(channelId: ChannelId, message: string) {
  return updateChannelRecord(channelId, {
    status: "error",
    lastError: message,
    lastEventAt: new Date().toISOString(),
  });
}

export function markChannelNotConfigured(channelId: ChannelId) {
  return updateChannelRecord(channelId, {
    status: "not_configured",
    lastError: null,
  });
}

export function findBinding(channelId: ChannelId, remoteChatId: string) {
  const state = readState();
  const snapshot = getSnapshot();
  const stored =
    state.bindings.find(
      (binding) => binding.channelId === channelId && binding.remoteChatId === remoteChatId,
    ) ?? null;

  if (stored && isBindingUsable(snapshot.conversations, stored)) {
    return structuredClone(stored);
  }

  if (channelId !== "feishu") {
    return null;
  }

  const conversation = snapshot.conversations.find(
    (item) => normalizeRemoteChatId(item.feishuChatSessionId) === remoteChatId,
  );

  if (!conversation) {
    return null;
  }

  return reconcileConversationBinding(buildFeishuConversationBinding(conversation));
}

export function findBindingByConversationId(conversationId: string) {
  const state = readState();
  const snapshot = getSnapshot();
  const conversation = snapshot.conversations.find((item) => item.id === conversationId) ?? null;

  if (!conversation) {
    return null;
  }

  const stored =
    state.bindings.find(
      (binding) => binding.conversationId === conversationId && isBindingUsable(snapshot.conversations, binding),
    ) ?? null;

  if (stored) {
    return structuredClone(stored);
  }

  if (!conversation.feishuChatSessionId) {
    return null;
  }

  return reconcileConversationBinding(buildFeishuConversationBinding(conversation));
}

export function getAllBindings() {
  return structuredClone(readState().bindings);
}

export function upsertBinding(
  input: Pick<
    ChannelBinding,
    | "kind"
    | "channelId"
    | "remoteChatId"
    | "remoteChatLabel"
    | "remoteUserId"
    | "remoteUserLabel"
    | "conversationId"
  >,
) {
  return mutateState((state) => {
    const now = new Date().toISOString();
    const current = state.bindings.find(
      (binding) =>
        binding.channelId === input.channelId &&
        (binding.remoteChatId === input.remoteChatId ||
          binding.conversationId === input.conversationId),
    );

    const next: ChannelBinding = current
      ? {
          ...current,
          ...input,
          updatedAt: now,
        }
      : {
          id: createId("binding"),
          ...input,
          createdAt: now,
          updatedAt: now,
          lastInboundAt: null,
          lastOutboundAt: null,
        };

    state.bindings = [
      next,
      ...state.bindings.filter(
        (binding) =>
          binding.id !== next.id &&
          !(
            binding.channelId === input.channelId &&
            (binding.remoteChatId === input.remoteChatId ||
              binding.conversationId === input.conversationId)
          ),
      ),
    ];

    return next;
  });
}

export function reconcileConversationBinding(input: {
  channelId: ChannelId;
  conversationId: string;
  remoteChatId: string | null;
  remoteChatLabel?: string | null;
  remoteUserId?: string | null;
  remoteUserLabel?: string | null;
  kind?: ChannelBindingKind;
}) {
  const normalizedRemoteChatId = normalizeRemoteChatId(input.remoteChatId);

  if (!normalizedRemoteChatId) {
    clearConversationBindings(input.conversationId, input.channelId);
    return null;
  }

  return upsertBinding({
    kind: input.kind ?? "channel_inbound",
    channelId: input.channelId,
    remoteChatId: normalizedRemoteChatId,
    remoteChatLabel: normalizeRemoteChatLabel(input.remoteChatLabel, normalizedRemoteChatId),
    remoteUserId: normalizeOptionalText(input.remoteUserId),
    remoteUserLabel: normalizeOptionalText(input.remoteUserLabel),
    conversationId: input.conversationId,
  });
}

export function clearConversationBindings(conversationId: string, channelId?: ChannelId) {
  return mutateState((state) => {
    const beforeCount = state.bindings.length;
    state.bindings = state.bindings.filter(
      (binding) =>
        binding.conversationId !== conversationId ||
        (channelId !== undefined && binding.channelId !== channelId),
    );

    return beforeCount !== state.bindings.length;
  });
}

export function updateBindingActivity(
  bindingId: string,
  patch: Partial<Pick<ChannelBinding, "lastInboundAt" | "lastOutboundAt" | "remoteUserLabel">>,
) {
  return mutateState((state) => {
    const current = state.bindings.find((binding) => binding.id === bindingId);

    if (!current) {
      return null;
    }

    const next: ChannelBinding = {
      ...current,
      ...patch,
      updatedAt: new Date().toISOString(),
    };

    state.bindings = [
      next,
      ...state.bindings.filter((binding) => binding.id !== bindingId),
    ];

    return next;
  });
}

export function findEventByDedupeKey(channelId: ChannelId, dedupeKey: string) {
  const state = readState();

  return (
    state.events.find((event) => event.channelId === channelId && event.dedupeKey === dedupeKey) ?? null
  );
}

export function recordChannelEvent(
  input: Omit<ChannelEvent, "id" | "createdAt">,
) {
  return mutateState((state) => {
    const event: ChannelEvent = {
      id: createId("event"),
      createdAt: new Date().toISOString(),
      ...input,
    };

    state.events = [event, ...state.events].slice(0, MAX_EVENTS);

    const channel = state.channels.find((item) => item.id === input.channelId) ?? createDefaultChannel(input.channelId);
    state.channels = [
      {
        ...channel,
        lastEventAt: event.createdAt,
        lastInboundAt: input.direction === "inbound" ? event.createdAt : channel.lastInboundAt,
        lastOutboundAt: input.direction === "outbound" ? event.createdAt : channel.lastOutboundAt,
        lastError: input.status === "error" ? input.errorMessage : channel.lastError,
        status: input.status === "error" ? "error" : channel.status,
        updatedAt: event.createdAt,
      },
      ...state.channels.filter((item) => item.id !== input.channelId),
    ].sort((left, right) => left.name.localeCompare(right.name, "zh-CN"));

    return event;
  });
}

export function createDefaultChannel(channelId: ChannelId): ChannelRecord {
  return {
    id: channelId,
    name: CHANNEL_DEFINITIONS[channelId].name,
    status: "not_configured",
    lastError: null,
    lastEventAt: null,
    lastInboundAt: null,
    lastOutboundAt: null,
    updatedAt: new Date().toISOString(),
    configSummary: {
      webhookPath: CHANNEL_DEFINITIONS[channelId].webhookPath,
      webhookUrl: getChannelWebhookUrl(channelId),
    },
  };
}

function readState(): ChannelStoreState {
  ensureStoreFile();

  try {
    const raw = readFileSync(STORE_PATH, "utf8");
    const parsed = JSON.parse(raw) as Partial<ChannelStoreState>;
    const normalized = normalizeState(parsed);
    const nextSerialized = JSON.stringify(normalized, null, 2);

    if (nextSerialized !== raw) {
      writeFileSync(STORE_PATH, nextSerialized, "utf8");
    }

    return normalized;
  } catch {
    const seed = createSeedState();
    writeFileSync(STORE_PATH, JSON.stringify(seed, null, 2), "utf8");
    return seed;
  }
}

function mutateState<T>(mutator: (state: ChannelStoreState) => T) {
  const state = readState();
  const result = mutator(state);
  writeState(state);
  return structuredClone(result);
}

function writeState(state: ChannelStoreState) {
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

function createSeedState(): ChannelStoreState {
  return {
    channels: Object.values(CHANNEL_DEFINITIONS)
      .map((definition) => createDefaultChannel(definition.id))
      .sort((left, right) => left.name.localeCompare(right.name, "zh-CN")),
    bindings: [],
    events: [],
  };
}

function normalizeState(state: Partial<ChannelStoreState>): ChannelStoreState {
  const channels = Object.values(CHANNEL_DEFINITIONS).map((definition) => {
    const current = state.channels?.find((item) => item.id === definition.id);

    return {
      ...createDefaultChannel(definition.id),
      ...(current || {}),
      configSummary: {
        ...createDefaultChannel(definition.id).configSummary,
        ...(current?.configSummary || {}),
        webhookPath: definition.webhookPath,
        webhookUrl: getChannelWebhookUrl(definition.id),
      },
    };
  });

  return {
    channels,
    bindings: structuredClone(state.bindings || []).map((binding) => ({
      ...binding,
      kind: binding.kind ?? "channel_inbound",
      remoteChatLabel: normalizeRemoteChatLabel(binding.remoteChatLabel, binding.remoteChatId),
      remoteUserId: normalizeOptionalText(binding.remoteUserId),
      remoteUserLabel: normalizeOptionalText(binding.remoteUserLabel),
    })),
    events: structuredClone(state.events || []).slice(0, MAX_EVENTS),
  };
}

function isBindingUsable(conversations: ConversationItem[], binding: ChannelBinding) {
  const conversation = conversations.find((item) => item.id === binding.conversationId) ?? null;

  if (!conversation) {
    return false;
  }

  if (binding.channelId === "feishu" && binding.kind === "product_bound") {
    return normalizeRemoteChatId(conversation.feishuChatSessionId) === binding.remoteChatId;
  }

  return true;
}

function buildFeishuConversationBinding(conversation: ConversationItem) {
  const remoteChatId = normalizeRemoteChatId(conversation.feishuChatSessionId);

  if (!remoteChatId) {
    throw new Error("Feishu conversation binding requires a remote chat id.");
  }

  return {
    kind:
      conversation.source === "feishu"
        ? ("channel_inbound" as const)
        : ("product_bound" as const),
    channelId: "feishu" as const,
    conversationId: conversation.id,
    remoteChatId,
    remoteChatLabel: normalizeRemoteChatLabel(conversation.remoteChatLabel, remoteChatId),
    remoteUserId: null,
    remoteUserLabel: normalizeOptionalText(conversation.remoteUserLabel),
  };
}

function normalizeRemoteChatId(value: string | null | undefined) {
  if (typeof value !== "string") {
    return null;
  }

  const normalized = value.trim();
  return normalized.length > 0 ? normalized : null;
}

function normalizeOptionalText(value: string | null | undefined) {
  if (typeof value !== "string") {
    return null;
  }

  const normalized = value.trim();
  return normalized.length > 0 ? normalized : null;
}

function normalizeRemoteChatLabel(value: string | null | undefined, fallback: string) {
  return normalizeOptionalText(value) ?? fallback;
}

function createId(prefix: string) {
  return `${prefix}-${crypto.randomUUID()}`;
}

function sortByRecent(
  left: { updatedAt?: string | null; createdAt?: string | null },
  right: { updatedAt?: string | null; createdAt?: string | null },
) {
  return Date.parse(right.updatedAt || right.createdAt || "") - Date.parse(left.updatedAt || left.createdAt || "");
}

export function getChannelStatusLabel(status: ChannelStatus) {
  if (status === "connecting") {
    return "连接中";
  }

  if (status === "ready") {
    return "已就绪";
  }

  if (status === "error") {
    return "异常";
  }

  if (status === "disconnected") {
    return "已断开";
  }

  return "未配置";
}
