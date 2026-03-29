import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import http from "node:http";
import net from "node:net";
import path from "node:path";
import { registerDesktopLocalFilesIpc } from "./ipc/local-files";
import {
  resolveDesktopBundleRoot,
  resolveDesktopExecutionRoot,
  resolveDesktopProjectRoot,
  resolveDesktopStandaloneRoot,
} from "./paths";

export type DesktopRuntimeMode = "dev" | "standalone";

export type DesktopRuntimeSession = {
  mode: DesktopRuntimeMode;
  host: string;
  port: number;
  appOrigin: string;
  workingDirectory: string;
  stop: () => Promise<void>;
};

type DesktopRuntimeOptions = {
  mode: DesktopRuntimeMode;
};

const DEFAULT_HOST = "127.0.0.1";
const DEFAULT_PORT = 3000;
const DEV_READY_TIMEOUT_MS = 90_000;
const STANDALONE_READY_TIMEOUT_MS = 20_000;
const SHUTDOWN_GRACE_MS = 5_000;
const RUNTIME_LOG_PREFIX = "[opencrab:desktop-runtime]";

export async function startDesktopRuntime(
  input: DesktopRuntimeOptions,
): Promise<DesktopRuntimeSession> {
  const mode = input.mode;
  const repoRoot = resolveDesktopProjectRoot();
  const bundleRoot = resolveDesktopBundleRoot();
  const executionRoot = resolveDesktopExecutionRoot();
  const host = normalizeHost(process.env.OPENCRAB_APP_HOST) || DEFAULT_HOST;
  const port = await findAvailablePort(DEFAULT_PORT);
  const appOrigin = buildOrigin({
    protocol: normalizeProtocol(process.env.OPENCRAB_APP_PROTOCOL) || "http",
    host,
    port,
  });
  const standaloneDir = resolveDesktopStandaloneRoot();
  const standaloneServerEntryPath = path.join(standaloneDir, "scripts", "desktop", "server-entry.mjs");
  const standaloneServerPath = path.join(standaloneDir, "server.js");
  const workingDirectory = mode === "standalone" ? standaloneDir : repoRoot;
  const command = process.execPath;
  const runtimePath = [path.dirname(process.execPath), process.env.PATH]
    .filter(Boolean)
    .join(path.delimiter);
  const args =
    mode === "standalone"
      ? [standaloneServerEntryPath, standaloneServerPath]
      : [path.join(repoRoot, "node_modules", "next", "dist", "bin", "next"), "dev", "--hostname", host, "--port", String(port)];

  if (mode === "standalone" && (!existsSync(standaloneServerEntryPath) || !existsSync(standaloneServerPath))) {
    throw new Error("Standalone server bundle is missing. Run `npm run desktop:build` first.");
  }

  if (mode === "dev" && !existsSync(args[0])) {
    throw new Error("Next dev runtime is missing. Please reinstall project dependencies.");
  }

  const child = spawn(command, args, {
    cwd: workingDirectory,
    env: {
      ...process.env,
      NODE_ENV: mode === "standalone" ? "production" : process.env.NODE_ENV || "development",
      HOSTNAME: host,
      PORT: String(port),
      OPENCRAB_APP_MODE: "desktop",
      OPENCRAB_APP_PROTOCOL: "http",
      OPENCRAB_APP_HOST: host,
      OPENCRAB_APP_PORT: String(port),
      OPENCRAB_APP_ORIGIN: appOrigin,
      OPENCRAB_RESOURCE_ROOT: mode === "standalone" ? standaloneDir : repoRoot,
      OPENCRAB_EXECUTION_ROOT: mode === "standalone" ? executionRoot : repoRoot,
      OPENCRAB_DESKTOP_BUNDLE_ROOT: bundleRoot,
      OPENCRAB_DESKTOP_RUNTIME_MODE: mode,
      ELECTRON_RUN_AS_NODE: "1",
      PATH: runtimePath,
    },
    stdio: ["ignore", "pipe", "pipe", "ipc"],
  });
  const cleanupLocalFilesIpc = registerDesktopLocalFilesIpc(child);

  let settled = false;
  const logLines: string[] = [];
  const appendLog = (chunk: Buffer | string) => {
    const text = String(chunk);
    const trimmed = text.trim();

    if (!trimmed) {
      return;
    }

    logLines.push(trimmed);

    if (logLines.length > 80) {
      logLines.splice(0, logLines.length - 80);
    }

    process.stdout.write(`${RUNTIME_LOG_PREFIX} ${trimmed}\n`);
  };

  child.stdout?.on("data", appendLog);
  child.stderr?.on("data", appendLog);

  try {
    await waitForHealthEndpoint(appOrigin, mode === "dev" ? DEV_READY_TIMEOUT_MS : STANDALONE_READY_TIMEOUT_MS);
    settled = true;
  } catch (error) {
    cleanupLocalFilesIpc();
    await stopChildProcess(child).catch(() => undefined);
    const logTail = logLines.length > 0 ? `\n\nRecent runtime output:\n${logLines.join("\n")}` : "";
    const reason = error instanceof Error ? error.message : "Desktop runtime failed to start.";
    throw new Error(`${reason}${logTail}`);
  }

  child.on("exit", (code, signal) => {
    cleanupLocalFilesIpc();

    if (settled && code !== 0 && signal !== "SIGTERM") {
      process.stderr.write(
        `${RUNTIME_LOG_PREFIX} runtime exited unexpectedly (code=${code ?? "null"}, signal=${signal ?? "null"})\n`,
      );
    }
  });

  return {
    mode,
    host,
    port,
    appOrigin,
    workingDirectory,
    stop: async () => {
      cleanupLocalFilesIpc();
      await stopChildProcess(child);
    },
  };
}

function normalizeProtocol(value: string | undefined) {
  const trimmed = value?.trim().toLowerCase();
  return trimmed === "http" || trimmed === "https" ? trimmed : null;
}

function normalizeHost(value: string | undefined) {
  const trimmed = value?.trim();

  if (!trimmed) {
    return null;
  }

  if (trimmed === "0.0.0.0" || trimmed === "::" || trimmed === "[::]" || trimmed === "::0") {
    return DEFAULT_HOST;
  }

  return trimmed.replace(/\/+$/, "");
}

function buildOrigin(input: { protocol: string; host: string; port: number }) {
  if (
    (input.protocol === "http" && input.port === 80) ||
    (input.protocol === "https" && input.port === 443)
  ) {
    return `${input.protocol}://${input.host}`;
  }

  return `${input.protocol}://${input.host}:${input.port}`;
}

async function findAvailablePort(preferredPort: number) {
  if (await isPortAvailable(preferredPort)) {
    return preferredPort;
  }

  return reserveEphemeralPort();
}

function isPortAvailable(port: number) {
  return new Promise<boolean>((resolve) => {
    const server = net.createServer();

    server.once("error", () => {
      resolve(false);
    });

    server.once("listening", () => {
      server.close(() => resolve(true));
    });

    server.listen(port, DEFAULT_HOST);
  });
}

function reserveEphemeralPort() {
  return new Promise<number>((resolve, reject) => {
    const server = net.createServer();

    server.once("error", reject);
    server.once("listening", () => {
      const address = server.address();

      if (!address || typeof address === "string") {
        server.close(() => reject(new Error("Failed to allocate an ephemeral port.")));
        return;
      }

      server.close((error) => {
        if (error) {
          reject(error);
          return;
        }

        resolve(address.port);
      });
    });

    server.listen(0, DEFAULT_HOST);
  });
}

function waitForHealthEndpoint(appOrigin: string, timeoutMs: number) {
  const deadline = Date.now() + timeoutMs;

  return new Promise<void>((resolve, reject) => {
    const attempt = () => {
      const request = http.get(`${appOrigin}/api/health`, (response) => {
        const isHealthy = response.statusCode === 200;
        response.resume();

        if (isHealthy) {
          resolve();
          return;
        }

        scheduleRetry();
      });

      request.on("error", scheduleRetry);
      request.setTimeout(1_500, () => {
        request.destroy();
        scheduleRetry();
      });
    };

    const scheduleRetry = () => {
      if (Date.now() >= deadline) {
        reject(new Error(`OpenCrab runtime did not become healthy within ${timeoutMs}ms.`));
        return;
      }

      setTimeout(attempt, 400);
    };

    attempt();
  });
}

function stopChildProcess(child: ReturnType<typeof spawn>) {
  return new Promise<void>((resolve) => {
    if (child.killed || child.exitCode !== null) {
      resolve();
      return;
    }

    let finished = false;
    const done = () => {
      if (finished) {
        return;
      }

      finished = true;
      resolve();
    };

    child.once("exit", done);
    child.kill("SIGTERM");

    setTimeout(() => {
      if (finished) {
        return;
      }

      child.kill("SIGKILL");
    }, SHUTDOWN_GRACE_MS);
  });
}
