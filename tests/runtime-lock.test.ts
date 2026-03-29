import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawn } from "node:child_process";
import { afterEach, describe, expect, it, vi } from "vitest";

const tempDirs: string[] = [];

describe("runtime lock", () => {
  const originalOpencrabHome = process.env.OPENCRAB_HOME;
  const childPids: number[] = [];

  afterEach(async () => {
    const runtimeLock = await import("@/lib/runtime/runtime-lock");
    runtimeLock.releaseRuntimeLock();

    for (const pid of childPids.splice(0)) {
      try {
        process.kill(pid, "SIGTERM");
      } catch {
        // Process already exited.
      }
    }

    if (typeof originalOpencrabHome === "string") {
      process.env.OPENCRAB_HOME = originalOpencrabHome;
    } else {
      delete process.env.OPENCRAB_HOME;
    }

    vi.resetModules();

    for (const dir of tempDirs.splice(0)) {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("creates a runtime lock owner record for the current process", async () => {
    const tempHome = createTempHome();
    process.env.OPENCRAB_HOME = tempHome;

    const runtimeLock = await import("@/lib/runtime/runtime-lock");
    const runtimePaths = await import("@/lib/resources/runtime-paths");

    const owner = runtimeLock.ensureRuntimeLock();
    const storedOwner = JSON.parse(
      readFileSync(runtimePaths.OPENCRAB_RUNTIME_LOCK_INFO_PATH, "utf8"),
    );

    expect(owner.pid).toBe(process.pid);
    expect(storedOwner.instanceId).toBe(owner.instanceId);
    expect(storedOwner.runtimeDir).toBe(tempHome);
  });

  it("rejects writes when another live process already owns the runtime lock", async () => {
    const tempHome = createTempHome();
    process.env.OPENCRAB_HOME = tempHome;

    const holder = spawn(process.execPath, ["-e", "setInterval(() => {}, 1000)"], {
      stdio: "ignore",
      detached: false,
    });

    if (!holder.pid) {
      throw new Error("Failed to start lock holder process.");
    }

    childPids.push(holder.pid);
    const lockDir = path.join(tempHome, ".runtime-lock");
    mkdirSync(lockDir, { recursive: true });
    writeFileSync(
      path.join(lockDir, "owner.json"),
      JSON.stringify(
        {
          instanceId: "external-holder",
          pid: holder.pid,
          hostname: "test-host",
          runtimeDir: tempHome,
          appMode: "standalone",
          appOrigin: "http://127.0.0.1:3000",
          startedAt: new Date().toISOString(),
          heartbeatAt: new Date().toISOString(),
          cwd: tempHome,
          argv: ["node", "holder.js"],
        },
        null,
        2,
      ),
      "utf8",
    );

    vi.resetModules();

    const { createSyncJsonFileStore } = await import("@/lib/server/json-file-store");
    const store = createSyncJsonFileStore({
      filePath: path.join(tempHome, "state", "settings.json"),
      seed: () => ({ ok: true }),
    });

    expect(() => store.write({ ok: false })).toThrowError(/runtime 已被另一个实例占用/);
  });

  it("cleans up a stale runtime lock left by a dead process", async () => {
    const tempHome = createTempHome();
    process.env.OPENCRAB_HOME = tempHome;

    const lockDir = path.join(tempHome, ".runtime-lock");
    mkdirSync(lockDir, { recursive: true });
    writeFileSync(
      path.join(lockDir, "owner.json"),
      JSON.stringify(
        {
          instanceId: "stale-holder",
          pid: 999_999,
          hostname: "test-host",
          runtimeDir: tempHome,
          appMode: "desktop",
          appOrigin: "http://127.0.0.1:3001",
          startedAt: "2024-01-01T00:00:00.000Z",
          heartbeatAt: "2024-01-01T00:00:00.000Z",
          cwd: tempHome,
          argv: ["node", "stale.js"],
        },
        null,
        2,
      ),
      "utf8",
    );

    vi.resetModules();

    const runtimeLock = await import("@/lib/runtime/runtime-lock");
    const owner = runtimeLock.ensureRuntimeLock();

    expect(owner.pid).toBe(process.pid);
    expect(owner.instanceId).not.toBe("stale-holder");
  });
});

function createTempHome() {
  const tempHome = mkdtempSync(path.join(os.tmpdir(), "opencrab-runtime-lock-"));
  tempDirs.push(tempHome);
  return tempHome;
}
