import { closeSync, existsSync, mkdirSync, openSync, readFileSync } from "node:fs";
import { spawn, spawnSync } from "node:child_process";
import path from "node:path";
import {
  clearManagedTunnelConfig,
  getManagedTunnelConfig,
  saveManagedTunnelConfig,
} from "@/lib/runtime/runtime-config-store";
import { OPENCRAB_TUNNEL_LOG_DIR } from "@/lib/resources/runtime-paths";

type ManagedTunnelProvider = "cloudflared" | "localtunnel";

type ProvisionPublicBaseUrlResult = {
  publicBaseUrl: string;
  provider: ManagedTunnelProvider | "env";
  reused: boolean;
};

const PUBLIC_URL_PATTERNS = [
  /https:\/\/[a-z0-9-]+\.trycloudflare\.com/i,
  /https:\/\/[a-z0-9-]+\.loca\.lt/i,
  /https:\/\/[a-z0-9-]+\.localto\.net/i,
];
const TUNNEL_READY_TIMEOUT_MS = 20_000;
const TUNNEL_READY_POLL_MS = 400;
const PUBLIC_URL_HEALTH_PATH = "/api/health";
const PUBLIC_URL_HEALTH_TIMEOUT_MS = 5_000;

export async function ensurePublicBaseUrl(): Promise<ProvisionPublicBaseUrlResult> {
  const envPublicBaseUrl = normalizePublicBaseUrl(process.env.OPENCRAB_PUBLIC_BASE_URL);

  if (envPublicBaseUrl) {
    return {
      publicBaseUrl: envPublicBaseUrl,
      provider: "env",
      reused: true,
    };
  }

  const currentTunnel = getManagedTunnelConfig();

  if (
    currentTunnel?.publicBaseUrl &&
    isProcessAlive(currentTunnel.pid) &&
    (await isPublicBaseUrlReachable(currentTunnel.publicBaseUrl))
  ) {
    return {
      publicBaseUrl: currentTunnel.publicBaseUrl,
      provider: currentTunnel.provider,
      reused: true,
    };
  }

  if (currentTunnel) {
    clearManagedTunnelConfig();
  }

  const localUrl = getLocalOpenCrabUrl();
  const failures: string[] = [];

  for (const provider of getTunnelProviderCandidates()) {
    try {
      const tunnel = await startManagedTunnel(provider, localUrl);
      saveManagedTunnelConfig(tunnel);

      return {
        publicBaseUrl: tunnel.publicBaseUrl,
        provider,
        reused: false,
      };
    } catch (error) {
      failures.push(error instanceof Error ? error.message : `无法启动 ${provider}。`);
    }
  }

  throw new Error(
    failures[0]
      ? `OpenCrab 暂时无法自动生成公网地址。${failures[0]}`
      : "OpenCrab 暂时无法自动生成公网地址。",
  );
}

function getLocalOpenCrabUrl() {
  const port = process.env.PORT?.trim() || "3000";
  return `http://127.0.0.1:${port}`;
}

function getTunnelProviderCandidates(): ManagedTunnelProvider[] {
  const providers: ManagedTunnelProvider[] = ["cloudflared", "localtunnel"];
  return providers.filter((provider) => isTunnelProviderAvailable(provider));
}

async function startManagedTunnel(provider: ManagedTunnelProvider, localUrl: string) {
  ensureTunnelLogDir();

  const logPath = path.join(OPENCRAB_TUNNEL_LOG_DIR, `${provider}-${Date.now()}.log`);
  const logFd = openSync(logPath, "a");

  try {
    const command = provider === "cloudflared" ? "cloudflared" : "npx";
    const args =
      provider === "cloudflared"
        ? ["tunnel", "--url", localUrl, "--no-autoupdate"]
        : ["--yes", "localtunnel", "--port", new URL(localUrl).port, "--local-host", "127.0.0.1"];

    const child = spawn(command, args, {
      detached: true,
      stdio: ["ignore", logFd, logFd],
      env: process.env,
    });

    const pid = child.pid;

    if (!pid) {
      throw new Error(`${provider} 没有成功启动。`);
    }

    let publicBaseUrl: string;

    try {
      publicBaseUrl = await waitForTunnelUrl({
        provider,
        logPath,
        pid,
        child,
      });
    } catch (error) {
      stopProcess(pid);
      throw error;
    }

    child.unref();

    return {
      provider,
      pid,
      publicBaseUrl,
      localUrl,
      logPath,
      startedAt: new Date().toISOString(),
    };
  } finally {
    closeSync(logFd);
  }
}

async function waitForTunnelUrl(input: {
  provider: ManagedTunnelProvider;
  logPath: string;
  pid: number;
  child: ReturnType<typeof spawn>;
}) {
  const timeoutAt = Date.now() + TUNNEL_READY_TIMEOUT_MS;

  while (Date.now() < timeoutAt) {
    if (input.child.exitCode !== null) {
      throw new Error(readTunnelLogExcerpt(input.provider, input.logPath));
    }

    const publicBaseUrl = extractTunnelUrl(input.logPath);

    if (publicBaseUrl) {
      return publicBaseUrl;
    }

    if (!isProcessAlive(input.pid)) {
      throw new Error(readTunnelLogExcerpt(input.provider, input.logPath));
    }

    await wait(TUNNEL_READY_POLL_MS);
  }

  throw new Error(readTunnelLogExcerpt(input.provider, input.logPath, "隧道启动超时。"));
}

function extractTunnelUrl(logPath: string) {
  if (!existsSync(logPath)) {
    return null;
  }

  const logContent = readFileSync(logPath, "utf8");

  for (const pattern of PUBLIC_URL_PATTERNS) {
    const match = logContent.match(pattern);

    if (match?.[0]) {
      return normalizePublicBaseUrl(match[0]);
    }
  }

  return null;
}

function readTunnelLogExcerpt(
  provider: ManagedTunnelProvider,
  logPath: string,
  fallback = "",
) {
  if (!existsSync(logPath)) {
    return fallback || `${provider} 没有输出可用日志。`;
  }

  const lines = readFileSync(logPath, "utf8")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  const excerpt = lines.slice(-3).join(" ");

  return excerpt || fallback || `${provider} 没有输出可用日志。`;
}

function isProcessAlive(pid: number) {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

function stopProcess(pid: number) {
  try {
    process.kill(pid, "SIGTERM");
  } catch {
    return;
  }
}

function wait(ms: number) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function ensureTunnelLogDir() {
  if (!existsSync(OPENCRAB_TUNNEL_LOG_DIR)) {
    mkdirSync(OPENCRAB_TUNNEL_LOG_DIR, { recursive: true });
  }
}

export async function isPublicBaseUrlReachable(publicBaseUrl: string) {
  try {
    const response = await fetch(`${publicBaseUrl}${PUBLIC_URL_HEALTH_PATH}`, {
      cache: "no-store",
      signal: AbortSignal.timeout(PUBLIC_URL_HEALTH_TIMEOUT_MS),
    });

    return response.ok;
  } catch {
    return false;
  }
}

function isTunnelProviderAvailable(provider: ManagedTunnelProvider) {
  const command = provider === "cloudflared" ? "cloudflared" : "npx";
  const result = spawnSync("which", [command], {
    stdio: "ignore",
    env: process.env,
  });

  return result.status === 0;
}

function normalizePublicBaseUrl(value: string | null | undefined) {
  return value?.trim().replace(/\/+$/, "") || null;
}
