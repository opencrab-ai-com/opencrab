import { beforeEach, describe, expect, it, vi } from "vitest";

const getChromeInstallationStatusMock = vi.fn();
const getCodexExecutableStatusMock = vi.fn();
const getChatGptConnectionStatusMock = vi.fn();

vi.mock("@/lib/runtime/chrome", () => ({
  getChromeInstallationStatus: getChromeInstallationStatusMock,
}));

vi.mock("@/lib/codex/executable", () => ({
  getCodexExecutableStatus: getCodexExecutableStatusMock,
}));

vi.mock("@/lib/chatgpt/connection", () => ({
  getChatGptConnectionStatus: getChatGptConnectionStatusMock,
}));

describe("runtime first-run readiness", () => {
  beforeEach(() => {
    vi.resetModules();
    getChromeInstallationStatusMock.mockReset();
    getCodexExecutableStatusMock.mockReset();
    getChatGptConnectionStatusMock.mockReset();
  });

  it("reports ready only when Chrome, Codex, and ChatGPT are all ready", async () => {
    getChromeInstallationStatusMock.mockResolvedValue({
      ok: true,
      chromePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
      message: "chrome ok",
    });
    getCodexExecutableStatusMock.mockResolvedValue({
      ok: true,
      executablePath: "/tmp/codex.js",
      message: "codex ok",
    });
    getChatGptConnectionStatusMock.mockResolvedValue({
      provider: "chatgpt",
      authMode: null,
      stage: "connected",
      isConnected: true,
      authUrl: null,
      deviceCode: null,
      codeExpiresAt: null,
      startedAt: null,
      connectedAt: "2026-03-30T00:00:00.000Z",
      error: null,
      message: "chatgpt ok",
    });

    const { getRuntimeReadiness } = await import("@/lib/runtime/first-run-readiness");
    const readiness = await getRuntimeReadiness();

    expect(readiness.ready).toBe(true);
    expect(readiness.recommendedAction).toBeNull();
    expect(readiness.chatgpt.ok).toBe(true);
  });

  it("prioritizes Chrome installation before other setup steps", async () => {
    getChromeInstallationStatusMock.mockResolvedValue({
      ok: false,
      chromePath: null,
      message: "chrome missing",
    });
    getCodexExecutableStatusMock.mockResolvedValue({
      ok: true,
      executablePath: "/tmp/codex.js",
      message: "codex ok",
    });
    getChatGptConnectionStatusMock.mockResolvedValue({
      provider: "chatgpt",
      authMode: null,
      stage: "not_connected",
      isConnected: false,
      authUrl: null,
      deviceCode: null,
      codeExpiresAt: null,
      startedAt: null,
      connectedAt: null,
      error: null,
      message: "chatgpt missing",
    });

    const { getRuntimeReadiness } = await import("@/lib/runtime/first-run-readiness");
    const readiness = await getRuntimeReadiness();

    expect(readiness.ready).toBe(false);
    expect(readiness.recommendedAction).toBe("install_chrome");
  });

  it("asks the user to connect ChatGPT when Chrome and Codex are already ready", async () => {
    getChromeInstallationStatusMock.mockResolvedValue({
      ok: true,
      chromePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
      message: "chrome ok",
    });
    getCodexExecutableStatusMock.mockResolvedValue({
      ok: true,
      executablePath: "/tmp/codex.js",
      message: "codex ok",
    });
    getChatGptConnectionStatusMock.mockResolvedValue({
      provider: "chatgpt",
      authMode: "browser",
      stage: "waiting_browser_auth",
      isConnected: false,
      authUrl: "http://localhost:1455",
      deviceCode: null,
      codeExpiresAt: null,
      startedAt: "2026-03-30T00:00:00.000Z",
      connectedAt: null,
      error: null,
      message: "waiting",
    });

    const { getRuntimeReadiness } = await import("@/lib/runtime/first-run-readiness");
    const readiness = await getRuntimeReadiness();

    expect(readiness.ready).toBe(false);
    expect(readiness.recommendedAction).toBe("connect_chatgpt");
    expect(readiness.chatgpt.stage).toBe("waiting_browser_auth");
  });
});
