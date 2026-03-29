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
import { OpenCrabError } from "@/lib/shared/errors/opencrab-error";
import { getOpenCrabAppMode, type OpenCrabAppMode } from "@/lib/runtime/app-mode";
import { getOpenCrabAppOrigin } from "@/lib/runtime/app-origin";
import {
  OPENCRAB_RUNTIME_DIR,
  OPENCRAB_RUNTIME_LOCK_DIR,
  OPENCRAB_RUNTIME_LOCK_INFO_PATH,
} from "@/lib/resources/runtime-paths";

const HEARTBEAT_INTERVAL_MS = 5_000;
const STALE_LOCK_WINDOW_MS = 30_000;
const SIGNALS: NodeJS.Signals[] = ["SIGINT", "SIGTERM", "SIGHUP"];

export type RuntimeLockOwner = {
  instanceId: string;
  pid: number;
  hostname: string;
  runtimeDir: string;
  appMode: OpenCrabAppMode;
  appOrigin: string | null;
  startedAt: string;
  heartbeatAt: string;
  cwd: string;
  argv: string[];
};

type RuntimeLockState = {
  owner: RuntimeLockOwner;
  heartbeatTimer: NodeJS.Timeout | null;
};

declare global {
  var __opencrabRuntimeLockState: RuntimeLockState | undefined;
  var __opencrabRuntimeLockCleanupRegistered: boolean | undefined;
}

export class RuntimeLockConflictError extends OpenCrabError {
  owner: RuntimeLockOwner | null;

  constructor(owner: RuntimeLockOwner | null) {
    super(buildRuntimeLockConflictMessage(owner), {
      statusCode: 409,
      code: "runtime_locked",
      details: owner ? { owner } : undefined,
    });
    this.name = "RuntimeLockConflictError";
    this.owner = owner;
  }
}

export function ensureRuntimeLock() {
  const existingState = globalThis.__opencrabRuntimeLockState;

  if (existingState) {
    return structuredClone(existingState.owner);
  }

  mkdirSync(path.dirname(OPENCRAB_RUNTIME_LOCK_DIR), { recursive: true });

  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      mkdirSync(OPENCRAB_RUNTIME_LOCK_DIR);
      const owner = createRuntimeLockOwner();
      writeOwnerInfo(owner);

      const state: RuntimeLockState = {
        owner,
        heartbeatTimer: null,
      };

      state.heartbeatTimer = setInterval(() => {
        refreshRuntimeLockHeartbeat();
      }, HEARTBEAT_INTERVAL_MS);
      state.heartbeatTimer.unref?.();

      globalThis.__opencrabRuntimeLockState = state;
      registerRuntimeLockCleanup();
      return structuredClone(owner);
    } catch (error) {
      if (!isAlreadyExistsError(error)) {
        throw error;
      }

      const owner = readRuntimeLockOwner();

      if (owner?.pid === process.pid) {
        const adoptedState: RuntimeLockState = {
          owner,
          heartbeatTimer: null,
        };

        adoptedState.heartbeatTimer = setInterval(() => {
          refreshRuntimeLockHeartbeat();
        }, HEARTBEAT_INTERVAL_MS);
        adoptedState.heartbeatTimer.unref?.();

        globalThis.__opencrabRuntimeLockState = adoptedState;
        registerRuntimeLockCleanup();
        return structuredClone(owner);
      }

      if (shouldBreakStaleLock(owner)) {
        breakStaleRuntimeLock();
        continue;
      }

      throw new RuntimeLockConflictError(owner);
    }
  }

  throw new RuntimeLockConflictError(readRuntimeLockOwner());
}

export function releaseRuntimeLock() {
  releaseRuntimeLockSync();
}

export function getRuntimeLockOwner() {
  const owner =
    globalThis.__opencrabRuntimeLockState?.owner ??
    (existsSync(OPENCRAB_RUNTIME_LOCK_DIR) ? readRuntimeLockOwner() : null);

  return owner ? structuredClone(owner) : null;
}

export function isRuntimePathManagedByLock(targetPath: string) {
  return isPathInsideDirectory(targetPath, OPENCRAB_RUNTIME_DIR);
}

export function ensureRuntimeLockForPath(targetPath: string) {
  if (!isRuntimePathManagedByLock(targetPath)) {
    return null;
  }

  return ensureRuntimeLock();
}

function createRuntimeLockOwner(): RuntimeLockOwner {
  const now = new Date().toISOString();

  return {
    instanceId: crypto.randomUUID(),
    pid: process.pid,
    hostname: os.hostname(),
    runtimeDir: OPENCRAB_RUNTIME_DIR,
    appMode: getOpenCrabAppMode(),
    appOrigin: safeGetAppOrigin(),
    startedAt: now,
    heartbeatAt: now,
    cwd: process.cwd(),
    argv: [...process.argv],
  };
}

function safeGetAppOrigin() {
  try {
    return getOpenCrabAppOrigin();
  } catch {
    return null;
  }
}

function refreshRuntimeLockHeartbeat() {
  const state = globalThis.__opencrabRuntimeLockState;

  if (!state) {
    return;
  }

  state.owner.heartbeatAt = new Date().toISOString();

  try {
    writeOwnerInfo(state.owner);
  } catch {
    // Keep the in-memory lock state even if the heartbeat write momentarily fails.
  }
}

function registerRuntimeLockCleanup() {
  if (globalThis.__opencrabRuntimeLockCleanupRegistered) {
    return;
  }

  globalThis.__opencrabRuntimeLockCleanupRegistered = true;
  process.once("exit", () => {
    releaseRuntimeLockSync();
  });

  for (const signal of SIGNALS) {
    const handler = () => {
      releaseRuntimeLockSync();
      process.removeListener(signal, handler);

      try {
        process.kill(process.pid, signal);
      } catch {
        process.exit(0);
      }
    };

    process.on(signal, handler);
  }
}

function releaseRuntimeLockSync() {
  const state = globalThis.__opencrabRuntimeLockState;

  if (!state) {
    return;
  }

  if (state.heartbeatTimer) {
    clearInterval(state.heartbeatTimer);
  }

  globalThis.__opencrabRuntimeLockState = undefined;

  try {
    const owner = readRuntimeLockOwner();

    if (owner && owner.instanceId !== state.owner.instanceId) {
      return;
    }
  } catch {
    // Best-effort cleanup.
  }

  rmSync(OPENCRAB_RUNTIME_LOCK_DIR, { recursive: true, force: true });
}

function shouldBreakStaleLock(owner: RuntimeLockOwner | null) {
  if (!owner) {
    return isLockDirectoryOlderThan(STALE_LOCK_WINDOW_MS);
  }

  if (owner.pid === process.pid) {
    return false;
  }

  if (!isProcessAlive(owner.pid)) {
    return true;
  }

  return !isHeartbeatFresh(owner.heartbeatAt);
}

function breakStaleRuntimeLock() {
  rmSync(OPENCRAB_RUNTIME_LOCK_DIR, { recursive: true, force: true });
}

function isHeartbeatFresh(value: string) {
  const timestamp = Date.parse(value);

  if (!Number.isFinite(timestamp)) {
    return false;
  }

  return Date.now() - timestamp <= STALE_LOCK_WINDOW_MS;
}

function isLockDirectoryOlderThan(ageMs: number) {
  try {
    const stats = statSync(OPENCRAB_RUNTIME_LOCK_DIR);
    return Date.now() - stats.mtimeMs > ageMs;
  } catch {
    return false;
  }
}

function isProcessAlive(pid: number) {
  if (!Number.isInteger(pid) || pid <= 0) {
    return false;
  }

  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    if ((error as NodeJS.ErrnoException | undefined)?.code === "EPERM") {
      return true;
    }

    return false;
  }
}

function readRuntimeLockOwner() {
  try {
    const raw = readFileSync(OPENCRAB_RUNTIME_LOCK_INFO_PATH, "utf8");
    return normalizeOwner(JSON.parse(raw));
  } catch {
    return null;
  }
}

function writeOwnerInfo(owner: RuntimeLockOwner) {
  mkdirSync(OPENCRAB_RUNTIME_LOCK_DIR, { recursive: true });
  writeFileSync(OPENCRAB_RUNTIME_LOCK_INFO_PATH, JSON.stringify(owner, null, 2), "utf8");
}

function normalizeOwner(value: unknown): RuntimeLockOwner | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  const owner = value as Partial<RuntimeLockOwner>;

  if (
    typeof owner.instanceId !== "string" ||
    typeof owner.pid !== "number" ||
    typeof owner.hostname !== "string" ||
    typeof owner.runtimeDir !== "string" ||
    typeof owner.startedAt !== "string" ||
    typeof owner.heartbeatAt !== "string" ||
    typeof owner.cwd !== "string" ||
    !Array.isArray(owner.argv)
  ) {
    return null;
  }

  return {
    instanceId: owner.instanceId,
    pid: owner.pid,
    hostname: owner.hostname,
    runtimeDir: owner.runtimeDir,
    appMode: normalizeAppMode(owner.appMode),
    appOrigin: typeof owner.appOrigin === "string" ? owner.appOrigin : null,
    startedAt: owner.startedAt,
    heartbeatAt: owner.heartbeatAt,
    cwd: owner.cwd,
    argv: owner.argv.filter((item): item is string => typeof item === "string"),
  };
}

function normalizeAppMode(value: unknown): OpenCrabAppMode {
  return value === "desktop" || value === "standalone" ? value : "source";
}

function buildRuntimeLockConflictMessage(owner: RuntimeLockOwner | null) {
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

function isAlreadyExistsError(error: unknown) {
  return (error as NodeJS.ErrnoException | undefined)?.code === "EEXIST";
}

function isPathInsideDirectory(targetPath: string, parentDir: string) {
  const relativePath = path.relative(parentDir, targetPath);
  return relativePath === "" || (!relativePath.startsWith("..") && !path.isAbsolute(relativePath));
}
