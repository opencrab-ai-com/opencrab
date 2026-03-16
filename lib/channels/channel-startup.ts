import { getChannelDetail } from "@/lib/channels/channel-store";
import { getTelegramSecrets, syncAllChannelConfigsFromSecrets } from "@/lib/channels/secret-store";
import { syncTelegramChannelState } from "@/lib/channels/telegram-channel-service";
import { ensurePublicBaseUrl } from "@/lib/tunnel/public-url-service";
import { ensureTunnelWatchdog } from "@/lib/tunnel/tunnel-watchdog";

const STARTUP_SYNC_COOLDOWN_MS = 5 * 60_000;

declare global {
  var __opencrabChannelStartupSyncPromise: Promise<void> | undefined;
  var __opencrabChannelStartupSyncLastRunAt: number | undefined;
}

export function ensureChannelStartupSync() {
  const lastRunAt = globalThis.__opencrabChannelStartupSyncLastRunAt ?? 0;

  if (globalThis.__opencrabChannelStartupSyncPromise) {
    return globalThis.__opencrabChannelStartupSyncPromise;
  }

  if (Date.now() - lastRunAt < STARTUP_SYNC_COOLDOWN_MS) {
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

async function runChannelStartupSync() {
  syncAllChannelConfigsFromSecrets();
  ensureTunnelWatchdog();

  const telegramSecrets = getTelegramSecrets();

  if (!telegramSecrets.botToken || telegramSecrets.enabled === false) {
    return;
  }

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
