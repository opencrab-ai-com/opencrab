import { getTelegramSecrets } from "@/lib/channels/secret-store";
import { syncTelegramChannelState } from "@/lib/channels/telegram-channel-service";
import { clearManagedTunnelConfig, getManagedTunnelConfig } from "@/lib/runtime/runtime-config-store";
import { ensurePublicBaseUrl, isPublicBaseUrlReachable } from "@/lib/tunnel/public-url-service";

const WATCHDOG_INTERVAL_MS = 30_000;

declare global {
  var __opencrabTunnelWatchdogStarted: boolean | undefined;
  var __opencrabTunnelWatchdogTicking: boolean | undefined;
}

export function ensureTunnelWatchdog() {
  if (process.env.OPENCRAB_PUBLIC_BASE_URL?.trim()) {
    return;
  }

  if (globalThis.__opencrabTunnelWatchdogStarted) {
    return;
  }

  globalThis.__opencrabTunnelWatchdogStarted = true;

  setInterval(() => {
    void healManagedTunnelIfNeeded();
  }, WATCHDOG_INTERVAL_MS);
}

async function healManagedTunnelIfNeeded() {
  if (globalThis.__opencrabTunnelWatchdogTicking) {
    return;
  }

  globalThis.__opencrabTunnelWatchdogTicking = true;

  try {
    const currentTunnel = getManagedTunnelConfig();

    if (!currentTunnel) {
      return;
    }

    const isHealthy =
      isProcessAlive(currentTunnel.pid) &&
      (await isPublicBaseUrlReachable(currentTunnel.publicBaseUrl));

    if (isHealthy) {
      return;
    }

    clearManagedTunnelConfig();
    await ensurePublicBaseUrl();

    if (getTelegramSecrets().botToken) {
      await syncTelegramChannelState({ rebind: true });
    }
  } catch {
    return;
  } finally {
    globalThis.__opencrabTunnelWatchdogTicking = false;
  }
}

function isProcessAlive(pid: number) {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}
