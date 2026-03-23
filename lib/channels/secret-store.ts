import type { ChannelId, ChannelSecretsStore, FeishuSecrets, TelegramSecrets } from "@/lib/channels/types";
import {
  getChannelDetail,
  markChannelNotConfigured,
  updateChannelRecord,
} from "@/lib/channels/channel-store";
import {
  OPENCRAB_CHANNEL_SECRET_STORE_PATH,
} from "@/lib/resources/runtime-paths";
import { createSyncJsonFileStore } from "@/lib/infrastructure/json-store/sync-json-file-store";

const STORE_PATH = OPENCRAB_CHANNEL_SECRET_STORE_PATH;
const store = createSyncJsonFileStore<ChannelSecretsStore>({
  filePath: STORE_PATH,
  seed: () => ({}),
});

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

export function getFeishuCredentialPreview() {
  const { appId, appSecret } = getFeishuSecrets();

  return {
    appId: {
      raw: appId || null,
      masked: maskFeishuCredential(appId, 6, 4),
    },
    appSecret: {
      raw: appSecret || null,
      masked: maskFeishuCredential(appSecret, 4, 4),
    },
  };
}

export function getFeishuSecrets(): FeishuSecrets {
  const state = readState();
  const appId = process.env.OPENCRAB_FEISHU_APP_ID?.trim() || state.feishu?.appId;
  const appSecret = process.env.OPENCRAB_FEISHU_APP_SECRET?.trim() || state.feishu?.appSecret;

  return {
    appId,
    appSecret,
    verificationToken:
      process.env.OPENCRAB_FEISHU_VERIFICATION_TOKEN?.trim() || state.feishu?.verificationToken,
    encryptKey:
      process.env.OPENCRAB_FEISHU_ENCRYPT_KEY?.trim() || state.feishu?.encryptKey,
    enabled:
      typeof state.feishu?.enabled === "boolean" ? state.feishu.enabled : Boolean(appId && appSecret),
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
    const isReady =
      hasBotToken &&
      isEnabled &&
      current.configSummary.credentialsVerified === true &&
      current.configSummary.webhookConfigured === true;

    updateChannelRecord("telegram", {
      status: !hasBotToken
        ? "not_configured"
        : !isEnabled
          ? "disconnected"
          : isReady
            ? "ready"
            : current.status === "error"
              ? "error"
              : current.configSummary.credentialsVerified === true
                ? "connecting"
              : "disconnected",
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
  const isEnabled = secrets.enabled !== false;
  const current = getChannelDetail("feishu");
  const isReady =
    isConfigured &&
    isEnabled &&
    current.configSummary.credentialsVerified === true &&
    current.configSummary.socketConnected === true;

  updateChannelRecord("feishu", {
    status: !isConfigured
      ? "not_configured"
      : !isEnabled
        ? "disconnected"
      : isReady
        ? "ready"
        : current.status === "error"
          ? "error"
          : current.configSummary.credentialsVerified === true
            ? "connecting"
          : "disconnected",
    lastError: isConfigured && isEnabled ? current.lastError : null,
    configSummary: {
      appId: secrets.appId || null,
      connectionMode: "websocket",
      socketStatus: isConfigured ? current.configSummary.socketStatus || "idle" : "idle",
      socketConnected: isConfigured ? Boolean(current.configSummary.socketConnected) : false,
      lastSocketConnectedAt: isConfigured
        ? current.configSummary.lastSocketConnectedAt || null
        : null,
      hasAppId,
      hasAppSecret,
      hasVerificationToken: Boolean(secrets.verificationToken),
      hasEncryptKey: Boolean(secrets.encryptKey),
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

export function setFeishuConnectionEnabled(enabled: boolean) {
  const state = readState();
  state.feishu = {
    ...state.feishu,
    enabled,
  };
  writeState(state);
  syncChannelConfigFromSecrets("feishu");
}

function readState(): ChannelSecretsStore {
  return store.read();
}

function writeState(state: ChannelSecretsStore) {
  store.write(state);
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

function maskFeishuCredential(
  value: string | undefined,
  prefixLength: number,
  suffixLength: number,
) {
  if (!value) {
    return null;
  }

  if (value.length <= prefixLength + suffixLength + 3) {
    return value;
  }

  return `${value.slice(0, prefixLength)}...${value.slice(-suffixLength)}`;
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
    ...(typeof patch.encryptKey === "string" && patch.encryptKey.trim()
      ? { encryptKey: patch.encryptKey.trim() }
      : {}),
    ...(typeof patch.enabled === "boolean" ? { enabled: patch.enabled } : {}),
  };
}
