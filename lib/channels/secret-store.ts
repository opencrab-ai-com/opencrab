import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import type { ChannelId, ChannelSecretsStore, FeishuSecrets, TelegramSecrets } from "@/lib/channels/types";
import {
  getChannelDetail,
  markChannelNotConfigured,
  updateChannelRecord,
} from "@/lib/channels/channel-store";
import {
  OPENCRAB_CHANNEL_SECRET_STORE_PATH,
  OPENCRAB_RUNTIME_DIR,
} from "@/lib/resources/runtime-paths";

const STORE_DIR = OPENCRAB_RUNTIME_DIR;
const STORE_PATH = OPENCRAB_CHANNEL_SECRET_STORE_PATH;

export function getTelegramSecrets(): TelegramSecrets {
  const state = readState();
  const storedBotToken = state.telegram?.botToken;
  const envBotToken = process.env.OPENCRAB_TELEGRAM_BOT_TOKEN?.trim();
  const botToken = envBotToken || storedBotToken;

  return {
    botToken,
    webhookSecret:
      process.env.OPENCRAB_TELEGRAM_WEBHOOK_SECRET?.trim() || state.telegram?.webhookSecret,
    enabled: typeof state.telegram?.enabled === "boolean" ? state.telegram.enabled : Boolean(botToken),
  };
}

export function getTelegramBotTokenPreview() {
  const botToken = getTelegramSecrets().botToken;

  return {
    raw: botToken || null,
    masked: maskTelegramBotToken(botToken),
  };
}

export function getFeishuSecrets(): FeishuSecrets {
  const state = readState();

  return {
    appId: process.env.OPENCRAB_FEISHU_APP_ID?.trim() || state.feishu?.appId,
    appSecret: process.env.OPENCRAB_FEISHU_APP_SECRET?.trim() || state.feishu?.appSecret,
    verificationToken:
      process.env.OPENCRAB_FEISHU_VERIFICATION_TOKEN?.trim() || state.feishu?.verificationToken,
  };
}

export function updateChannelSecrets(
  channelId: ChannelId,
  patch: Partial<TelegramSecrets & FeishuSecrets>,
) {
  const state = readState();

  if (channelId === "telegram") {
    state.telegram = {
      ...state.telegram,
      ...pickNonEmptyTelegramSecrets(patch),
    };
    writeState(state);
    syncChannelConfigFromSecrets("telegram");
    return;
  }

  state.feishu = {
    ...state.feishu,
    ...pickNonEmptyFeishuSecrets(patch),
  };
  writeState(state);
  syncChannelConfigFromSecrets("feishu");
}

export function syncChannelConfigFromSecrets(channelId: ChannelId) {
  if (channelId === "telegram") {
    const secrets = getTelegramSecrets();
    const hasBotToken = Boolean(secrets.botToken);
    const isEnabled = secrets.enabled !== false;
    const current = getChannelDetail("telegram");

    updateChannelRecord("telegram", {
      status: !hasBotToken
        ? "not_configured"
        : !isEnabled
          ? "disconnected"
          : current.status === "error"
            ? "error"
            : "ready",
      lastError: hasBotToken ? current.lastError : null,
      configSummary: {
        hasBotToken,
        hasWebhookSecret: Boolean(secrets.webhookSecret),
        webhookConfigured: hasBotToken ? current.configSummary.webhookConfigured : false,
        webhookSetupMode: hasBotToken
          ? current.configSummary.webhookSetupMode
          : "manual",
      },
    });

    if (!hasBotToken) {
      markChannelNotConfigured("telegram");
    }

    return;
  }

  const secrets = getFeishuSecrets();
  const hasAppId = Boolean(secrets.appId);
  const hasAppSecret = Boolean(secrets.appSecret);
  const isConfigured = hasAppId && hasAppSecret;
  const current = getChannelDetail("feishu");

  updateChannelRecord("feishu", {
    status: isConfigured ? (current.status === "error" ? "error" : "ready") : "not_configured",
    lastError: isConfigured ? current.lastError : null,
    configSummary: {
      appId: secrets.appId || null,
      hasAppId,
      hasAppSecret,
      hasVerificationToken: Boolean(secrets.verificationToken),
    },
  });

  if (!isConfigured) {
    markChannelNotConfigured("feishu");
  }
}

export function syncAllChannelConfigsFromSecrets() {
  syncChannelConfigFromSecrets("telegram");
  syncChannelConfigFromSecrets("feishu");
}

export function setTelegramConnectionEnabled(enabled: boolean) {
  const state = readState();
  state.telegram = {
    ...state.telegram,
    enabled,
  };
  writeState(state);
  syncChannelConfigFromSecrets("telegram");
}

function readState(): ChannelSecretsStore {
  ensureStoreFile();

  try {
    return JSON.parse(readFileSync(STORE_PATH, "utf8")) as ChannelSecretsStore;
  } catch {
    const seed: ChannelSecretsStore = {};
    writeFileSync(STORE_PATH, JSON.stringify(seed, null, 2), "utf8");
    return seed;
  }
}

function writeState(state: ChannelSecretsStore) {
  ensureStoreFile();
  writeFileSync(STORE_PATH, JSON.stringify(state, null, 2), "utf8");
}

function ensureStoreFile() {
  if (!existsSync(STORE_DIR)) {
    mkdirSync(STORE_DIR, { recursive: true });
  }

  if (!existsSync(STORE_PATH)) {
    writeFileSync(STORE_PATH, JSON.stringify({}, null, 2), "utf8");
  }
}

function pickNonEmptyTelegramSecrets(
  patch: Partial<TelegramSecrets & FeishuSecrets>,
): TelegramSecrets {
  return {
    ...(typeof patch.botToken === "string" && patch.botToken.trim()
      ? { botToken: patch.botToken.trim() }
      : {}),
    ...(typeof patch.webhookSecret === "string" && patch.webhookSecret.trim()
      ? { webhookSecret: patch.webhookSecret.trim() }
      : {}),
    ...(typeof patch.enabled === "boolean" ? { enabled: patch.enabled } : {}),
  };
}

function maskTelegramBotToken(value: string | undefined) {
  if (!value) {
    return null;
  }

  if (value.length <= 10) {
    return value;
  }

  return `${value.slice(0, 6)}...${value.slice(-4)}`;
}

function pickNonEmptyFeishuSecrets(
  patch: Partial<TelegramSecrets & FeishuSecrets>,
): FeishuSecrets {
  return {
    ...(typeof patch.appId === "string" && patch.appId.trim() ? { appId: patch.appId.trim() } : {}),
    ...(typeof patch.appSecret === "string" && patch.appSecret.trim()
      ? { appSecret: patch.appSecret.trim() }
      : {}),
    ...(typeof patch.verificationToken === "string" && patch.verificationToken.trim()
      ? { verificationToken: patch.verificationToken.trim() }
      : {}),
  };
}
