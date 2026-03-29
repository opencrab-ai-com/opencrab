import { EventEmitter } from "node:events";
import { mkdtempSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";

const DESKTOP_BRIDGE_REQUEST_KIND = "opencrab:desktop-local-files:request";
const DESKTOP_BRIDGE_RESPONSE_KIND = "opencrab:desktop-local-files:response";

const tempDirs: string[] = [];
const originalAppMode = process.env.OPENCRAB_APP_MODE;
const originalSendDescriptor = Object.getOwnPropertyDescriptor(process, "send");

describe("native directory picker desktop bridge", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.resetModules();

    if (typeof originalAppMode === "string") {
      process.env.OPENCRAB_APP_MODE = originalAppMode;
    } else {
      delete process.env.OPENCRAB_APP_MODE;
    }

    if (originalSendDescriptor) {
      Object.defineProperty(process, "send", originalSendDescriptor);
    } else {
      delete (process as NodeJS.Process & { send?: unknown }).send;
    }

    for (const dir of tempDirs.splice(0)) {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("uses the desktop bridge to pick a directory when running in desktop mode", async () => {
    const defaultPath = createTempDir();
    process.env.OPENCRAB_APP_MODE = "desktop";
    const bridgeBus = installProcessMessageBus();

    const send = vi.fn((message: unknown) => {
      const request = message as {
        requestId: string;
      };

      queueMicrotask(() => {
        bridgeBus.emit({
          kind: DESKTOP_BRIDGE_RESPONSE_KIND,
          requestId: request.requestId,
          ok: true,
          result: {
            path: defaultPath,
            cancelled: false,
          },
        });
      });

      return true;
    });

    Object.defineProperty(process, "send", {
      value: send,
      configurable: true,
      writable: true,
    });

    const { pickNativeDirectory } = await import("@/lib/server/native-directory-picker");
    await expect(
      pickNativeDirectory({
        title: "选择工作区",
        defaultPath,
      }),
    ).resolves.toBe(defaultPath);

    expect(send).toHaveBeenCalledTimes(1);
    expect(send).toHaveBeenCalledWith(
      expect.objectContaining({
        kind: DESKTOP_BRIDGE_REQUEST_KIND,
        action: "pick-directory",
        payload: {
          title: "选择工作区",
          defaultPath,
        },
      }),
    );
  });

  it("uses the desktop bridge to reveal a local path when running in desktop mode", async () => {
    process.env.OPENCRAB_APP_MODE = "desktop";
    const targetPath = path.join(createTempDir(), "notes.md");
    const bridgeBus = installProcessMessageBus();

    const send = vi.fn((message: unknown) => {
      const request = message as {
        requestId: string;
      };

      queueMicrotask(() => {
        bridgeBus.emit({
          kind: DESKTOP_BRIDGE_RESPONSE_KIND,
          requestId: request.requestId,
          ok: true,
          result: {
            path: targetPath,
          },
        });
      });

      return true;
    });

    Object.defineProperty(process, "send", {
      value: send,
      configurable: true,
      writable: true,
    });

    const { revealNativePath } = await import("@/lib/server/native-directory-picker");
    await expect(revealNativePath(targetPath)).resolves.toBeUndefined();

    expect(send).toHaveBeenCalledTimes(1);
    expect(send).toHaveBeenCalledWith(
      expect.objectContaining({
        kind: DESKTOP_BRIDGE_REQUEST_KIND,
        action: "reveal-path",
        payload: {
          targetPath,
        },
      }),
    );
  });
});

function createTempDir() {
  const dir = mkdtempSync(path.join(os.tmpdir(), "opencrab-native-picker-"));
  tempDirs.push(dir);
  return dir;
}

function installProcessMessageBus() {
  const bus = new EventEmitter();
  const originalOn = process.on.bind(process);
  const originalRemoveListener = process.removeListener.bind(process);

  vi.spyOn(process, "on").mockImplementation(((event, listener) => {
    if (event === "message") {
      bus.on("message", listener as (...args: unknown[]) => void);
      return process;
    }

    return originalOn(event, listener);
  }) as typeof process.on);

  vi.spyOn(process, "removeListener").mockImplementation(((event, listener) => {
    if (event === "message") {
      bus.removeListener("message", listener as (...args: unknown[]) => void);
      return process;
    }

    return originalRemoveListener(event, listener);
  }) as typeof process.removeListener);

  return {
    emit(message: unknown) {
      bus.emit("message", message);
    },
  };
}
