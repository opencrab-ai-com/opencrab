import { afterEach, describe, expect, it, vi } from "vitest";

const execFileMock = vi.hoisted(() => vi.fn());
const loginStatusReadCount = vi.hoisted(() => ({ value: 0 }));
const kPromisifyCustom = Symbol.for("nodejs.util.promisify.custom");

vi.mock("node:child_process", () => ({
  execFile: execFileMock,
}));

describe("codex login status cache", () => {
  const originalCacheMs = process.env.OPENCRAB_CODEX_LOGIN_STATUS_CACHE_MS;

  afterEach(async () => {
    if (originalCacheMs === undefined) {
      delete process.env.OPENCRAB_CODEX_LOGIN_STATUS_CACHE_MS;
    } else {
      process.env.OPENCRAB_CODEX_LOGIN_STATUS_CACHE_MS = originalCacheMs;
    }

    execFileMock.mockReset();
    loginStatusReadCount.value = 0;
    delete (globalThis as typeof globalThis & {
      __opencrabCodexLoginStatusCache?: unknown;
      __opencrabCodexLoginStatusPromise?: unknown;
    }).__opencrabCodexLoginStatusCache;
    delete (globalThis as typeof globalThis & {
      __opencrabCodexLoginStatusCache?: unknown;
      __opencrabCodexLoginStatusPromise?: unknown;
    }).__opencrabCodexLoginStatusPromise;
    vi.resetModules();
  });

  it("reuses a successful login status result across concurrent and sequential reads", async () => {
    process.env.OPENCRAB_CODEX_LOGIN_STATUS_CACHE_MS = "60000";
    Object.assign(execFileMock, {
      [kPromisifyCustom]: () =>
        new Promise<{ stdout: string; stderr: string }>((resolve) => {
          loginStatusReadCount.value += 1;
          setTimeout(() => {
            resolve({
              stdout: "Logged in using ChatGPT\n",
              stderr: "",
            });
          }, 5);
        }),
    });
    execFileMock.mockImplementation((...args: unknown[]) => {
      const callback = args[args.length - 1] as (error: Error | null, stdout: string, stderr: string) => void;
      setTimeout(() => {
        callback(null, "Logged in using ChatGPT\n", "");
      }, 5);
      return {} as never;
    });

    const { getCodexLoginStatus } = await import("@/lib/codex/sdk");
    const [first, second] = await Promise.all([
      getCodexLoginStatus(),
      getCodexLoginStatus(),
    ]);
    const third = await getCodexLoginStatus();

    expect(first).toEqual({ ok: true });
    expect(second).toEqual({ ok: true });
    expect(third).toEqual({ ok: true });
    expect(loginStatusReadCount.value).toBe(1);
  });

  it("invalidates the cached success result when requested", async () => {
    process.env.OPENCRAB_CODEX_LOGIN_STATUS_CACHE_MS = "60000";
    Object.assign(execFileMock, {
      [kPromisifyCustom]: async () => {
        loginStatusReadCount.value += 1;
        return {
          stdout: "Logged in using ChatGPT\n",
          stderr: "",
        };
      },
    });
    execFileMock.mockImplementation((...args: unknown[]) => {
      const callback = args[args.length - 1] as (error: Error | null, stdout: string, stderr: string) => void;
      callback(null, "Logged in using ChatGPT\n", "");
      return {} as never;
    });

    const { getCodexLoginStatus, invalidateCodexLoginStatusCache } = await import("@/lib/codex/sdk");

    await getCodexLoginStatus();
    invalidateCodexLoginStatusCache();
    await getCodexLoginStatus();

    expect(loginStatusReadCount.value).toBe(2);
  });
});
