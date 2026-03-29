import {
  existsSync,
  mkdirSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";

const HEARTBEAT_INTERVAL_MS = 5_000;
const STALE_LOCK_WINDOW_MS = 30_000;
const SIGNALS = ["SIGINT", "SIGTERM", "SIGHUP"];

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});

async function main() {
  const serverEntry = resolveServerEntry(process.argv[2]);
  acquireRuntimeLock();
  await import(pathToFileURL(serverEntry).href);
}

function resolveServerEntry(input) {
  const serverEntry = input?.trim();

  if (!serverEntry) {
    throw new Error("Desktop server entry is missing.");
  }

  const absolutePath = path.resolve(serverEntry);

  if (!existsSync(absolutePath)) {
    throw new Error(`Desktop server entry not found: ${absolutePath}`);
  }

  return absolutePath;
}

function acquireRuntimeLock() {
  const runtimeDir = resolveRuntimeDir();
  const lockDir = path.join(runtimeDir, ".runtime-lock");
  const infoPath = path.join(lockDir, "owner.json");
  const owner = createOwner(runtimeDir);

  mkdirSync(runtimeDir, { recursive: true });

  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      mkdirSync(lockDir);
      writeFileSync(infoPath, JSON.stringify(owner, null, 2), "utf8");
      registerCleanup({ lockDir, infoPath, owner });
      return;
    } catch (error) {
      if (error?.code !== "EEXIST") {
        throw error;
      }

      const existingOwner = readOwner(infoPath);

      if (existingOwner?.pid === process.pid) {
        registerCleanup({ lockDir, infoPath, owner: existingOwner });
        return;
      }

      if (shouldBreakStaleLock(lockDir, existingOwner)) {
        rmSync(lockDir, { recursive: true, force: true });
        continue;
      }

      throw new Error(buildConflictMessage(existingOwner));
    }
  }

  throw new Error(buildConflictMessage(readOwner(infoPath)));
}

function resolveRuntimeDir() {
  const configured = process.env.OPENCRAB_HOME?.trim();

  if (configured) {
    return path.resolve(configured);
  }

  return path.join(process.env.HOME || process.cwd(), ".opencrab");
}

function createOwner(runtimeDir) {
  const now = new Date().toISOString();

  return {
    instanceId: crypto.randomUUID(),
    pid: process.pid,
    hostname: os.hostname(),
    runtimeDir,
    appMode: process.env.OPENCRAB_APP_MODE || "standalone",
    appOrigin: process.env.OPENCRAB_APP_ORIGIN || null,
    startedAt: now,
    heartbeatAt: now,
    cwd: process.cwd(),
    argv: [...process.argv],
  };
}

function registerCleanup(input) {
  const heartbeatTimer = setInterval(() => {
    input.owner.heartbeatAt = new Date().toISOString();
    writeFileSync(input.infoPath, JSON.stringify(input.owner, null, 2), "utf8");
  }, HEARTBEAT_INTERVAL_MS);
  heartbeatTimer.unref?.();

  const release = () => {
    clearInterval(heartbeatTimer);

    const existingOwner = readOwner(input.infoPath);

    if (existingOwner && existingOwner.instanceId !== input.owner.instanceId) {
      return;
    }

    rmSync(input.lockDir, { recursive: true, force: true });
  };

  process.once("exit", release);

  for (const signal of SIGNALS) {
    const handler = () => {
      release();

      try {
        process.removeListener(signal, handler);
        process.kill(process.pid, signal);
      } catch {
        process.exit(0);
      }
    };

    process.on(signal, handler);
  }
}

function readOwner(infoPath) {
  try {
    const parsed = JSON.parse(readFileSync(infoPath, "utf8"));

    if (
      !parsed ||
      typeof parsed.instanceId !== "string" ||
      typeof parsed.pid !== "number" ||
      typeof parsed.appMode !== "string"
    ) {
      return null;
    }

    return parsed;
  } catch {
    return null;
  }
}

function shouldBreakStaleLock(lockDir, owner) {
  if (!owner) {
    return isDirectoryOlderThan(lockDir, STALE_LOCK_WINDOW_MS);
  }

  if (!isProcessAlive(owner.pid)) {
    return true;
  }

  return !isHeartbeatFresh(owner.heartbeatAt);
}

function isDirectoryOlderThan(targetPath, ageMs) {
  try {
    const stats = statSync(targetPath);
    return Date.now() - stats.mtimeMs > ageMs;
  } catch {
    return false;
  }
}

function isHeartbeatFresh(value) {
  const parsed = Date.parse(value || "");

  if (!Number.isFinite(parsed)) {
    return false;
  }

  return Date.now() - parsed <= STALE_LOCK_WINDOW_MS;
}

function isProcessAlive(pid) {
  if (!Number.isInteger(pid) || pid <= 0) {
    return false;
  }

  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    return error?.code === "EPERM";
  }
}

function buildConflictMessage(owner) {
  if (!owner) {
    return "OpenCrab runtime 已被另一个实例占用，请先关闭当前运行中的实例后再重试。";
  }

  const modeLabel =
    owner.appMode === "desktop"
      ? "桌面版"
      : owner.appMode === "standalone"
        ? "Web 生产态"
        : "Web 开发态";
  const originLabel = owner.appOrigin ? `（${owner.appOrigin}）` : "";

  return `OpenCrab runtime 已被另一个实例占用：${modeLabel}${originLabel}，PID ${owner.pid}。请先关闭当前运行中的实例，或为新实例指定不同的 OPENCRAB_HOME。`;
}
