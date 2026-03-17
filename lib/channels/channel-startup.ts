import { getChannelDetail } from "@/lib/channels/channel-store";
import { syncFeishuChannelState } from "@/lib/channels/feishu-channel-service";
import {
  getFeishuSecrets,
  getTelegramSecrets,
  syncAllChannelConfigsFromSecrets,
} from "@/lib/channels/secret-store";
import { syncTelegramChannelState } from "@/lib/channels/telegram-channel-service";
import { ensurePublicBaseUrl } from "@/lib/tunnel/public-url-service";
import { ensureTunnelWatchdog } from "@/lib/tunnel/tunnel-watchdog";

const STARTUP_SYNC_COOLDOWN_MS = 5 * 60_000;
const CHANNEL_WATCHDOG_INTERVAL_MS = 30_000;

declare global {
  var __opencrabChannelStartupSyncPromise: Promise<void> | undefined;
  var __opencrabChannelStartupSyncLastRunAt: number | undefined;
  var __opencrabChannelWatchdogStarted: boolean | undefined;
}

export function ensureChannelStartupSync(input: { force?: boolean } = {}) {
  const lastRunAt = globalThis.__opencrabChannelStartupSyncLastRunAt ?? 0;

  if (globalThis.__opencrabChannelStartupSyncPromise) {
    return globalThis.__opencrabChannelStartupSyncPromise;
  }

  if (!input.force && Date.now() - lastRunAt < STARTUP_SYNC_COOLDOWN_MS) {
    return Promise.resolve();
  }

  const task = runChannelStartupSync()
    .catch(() => {
      return;
    })
    .finally(() => {
      globalThis.__opencrabChannelStartupSyncPromise = undefined;
      globalThis.__opencrabChannelStartupSyncLastRunAt = Date.now();
    });

  globalThis.__opencrabChannelStartupSyncPromise = task;

  return task;
}

export function ensureChannelWatchdog() {
  if (globalThis.__opencrabChannelWatchdogStarted) {
    return;
  }

  globalThis.__opencrabChannelWatchdogStarted = true;

  setInterval(() => {
    void ensureChannelStartupSync({ force: true });
  }, CHANNEL_WATCHDOG_INTERVAL_MS);
}

async function runChannelStartupSync() {
  syncAllChannelConfigsFromSecrets();
  ensureTunnelWatchdog();

  const telegramSecrets = getTelegramSecrets();
  const feishuSecrets = getFeishuSecrets();

  if (telegramSecrets.botToken && telegramSecrets.enabled !== false) {
    const telegram = getChannelDetail("telegram");

    if (!process.env.OPENCRAB_PUBLIC_BASE_URL?.trim()) {
      await ensurePublicBaseUrl();
    }

    if (
      !telegram.configSummary.webhookConfigured ||
      telegram.status !== "ready" ||
      Boolean(telegram.lastError)
    ) {
      await syncTelegramChannelState({ rebind: true });
    }
  }

  if (feishuSecrets.appId && feishuSecrets.appSecret) {
    const feishu = getChannelDetail("feishu");

    if (
      !feishu.configSummary.socketConnected ||
      !feishu.configSummary.credentialsVerified ||
      feishu.status !== "ready" ||
      Boolean(feishu.lastError)
    ) {
      await syncFeishuChannelState();
    }
  }
}
