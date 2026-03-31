import { beforeEach, describe, expect, it, vi } from "vitest";

const getCodexStatusMock = vi.hoisted(() => vi.fn());
const getBrowserSessionStatusMock = vi.hoisted(() => vi.fn());
const getChatGptConnectionStatusMock = vi.hoisted(() => vi.fn());
const getRuntimeReadinessMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/codex/sdk", () => ({
  getCodexStatus: getCodexStatusMock,
}));

vi.mock("@/lib/codex/browser-session", () => ({
  getBrowserSessionStatus: getBrowserSessionStatusMock,
}));

vi.mock("@/lib/chatgpt/connection", () => ({
  getChatGptConnectionStatus: getChatGptConnectionStatusMock,
}));

vi.mock("@/lib/runtime/first-run-readiness", () => ({
  getRuntimeReadiness: getRuntimeReadinessMock,
}));

describe("runtime connection snapshot", () => {
  beforeEach(() => {
    getCodexStatusMock.mockReset();
    getBrowserSessionStatusMock.mockReset();
    getChatGptConnectionStatusMock.mockReset();
    getRuntimeReadinessMock.mockReset();
  });

  it("aggregates the shared runtime connection state into one snapshot", async () => {
    getCodexStatusMock.mockResolvedValue({
      ok: true,
      model: "gpt-5.4",
      reasoningEffort: "high",
      sandboxMode: "workspace-write",
      networkAccessEnabled: true,
      approvalPolicy: "on-request",
      reply: "ready",
      threadId: null,
      usage: null,
      loginStatus: "logged_in",
      loginMethod: "chatgpt",
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
      connectedAt: "2026-03-31T00:00:00.000Z",
      error: null,
      message: "connected",
    });
    getBrowserSessionStatusMock.mockResolvedValue({
      ok: true,
      status: "ready",
      mode: "current-browser",
      browserUrl: "http://127.0.0.1:9333",
      userDataDir: null,
      launchedByOpenCrab: false,
      chromePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
      message: "ready",
    });
    getRuntimeReadinessMock.mockResolvedValue({
      ready: true,
      requiredBrowser: "chrome",
      recommendedAction: null,
      chrome: {
        ok: true,
        chromePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
        message: "ok",
      },
      codex: {
        ok: true,
        executablePath: "/tmp/codex",
        message: "ok",
      },
      chatgpt: {
        ok: true,
        stage: "connected",
        message: "ok",
      },
    });

    const { getRuntimeConnectionSnapshot } = await import(
      "@/lib/runtime/runtime-connection-snapshot"
    );
    const snapshot = await getRuntimeConnectionSnapshot();

    expect(snapshot.codexStatus.ok).toBe(true);
    expect(snapshot.chatGptConnectionStatus.stage).toBe("connected");
    expect(snapshot.browserSessionStatus.status).toBe("ready");
    expect(snapshot.runtimeReadiness.ready).toBe(true);
  });

  it("degrades to a stable snapshot when one sub-resource throws", async () => {
    getCodexStatusMock.mockRejectedValue(new Error("codex down"));
    getChatGptConnectionStatusMock.mockRejectedValue(new Error("chatgpt down"));
    getBrowserSessionStatusMock.mockRejectedValue(new Error("browser down"));
    getRuntimeReadinessMock.mockRejectedValue(new Error("readiness down"));

    const { getRuntimeConnectionSnapshot } = await import(
      "@/lib/runtime/runtime-connection-snapshot"
    );
    const snapshot = await getRuntimeConnectionSnapshot();

    expect(snapshot.codexStatus.ok).toBe(false);
    expect(snapshot.chatGptConnectionStatus.stage).toBe("error");
    expect(snapshot.browserSessionStatus.status).toBe("unreachable");
    expect(snapshot.runtimeReadiness.ready).toBe(false);
  });
});
