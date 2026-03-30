import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const createCodexAppServerClientMock = vi.hoisted(() => vi.fn());
const buildChatGptLoginEnvMock = vi.hoisted(() =>
  vi.fn(
    () =>
      ({ HOME: "/tmp/opencrab-chatgpt-test" } as unknown as NodeJS.ProcessEnv),
  ),
);
const getCodexLoginStatusMock = vi.hoisted(() => vi.fn());
const execCodexCommandMock = vi.hoisted(() => vi.fn());
const openUrlInChromeMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/codex/app-server-client", () => ({
  createCodexAppServerClient: createCodexAppServerClientMock,
}));

vi.mock("@/lib/codex/sdk", () => ({
  buildChatGptLoginEnv: buildChatGptLoginEnvMock,
  getCodexLoginStatus: getCodexLoginStatusMock,
}));

vi.mock("@/lib/codex/executable", () => ({
  execCodexCommand: execCodexCommandMock,
}));

vi.mock("@/lib/runtime/chrome", () => ({
  openUrlInChrome: openUrlInChromeMock,
}));

type ConnectionModule = Awaited<typeof import("@/lib/chatgpt/connection")>;

type MockNotification = {
  method: string;
  params?: unknown;
};

type MockAppServerClient = {
  request: ReturnType<typeof vi.fn>;
  notify: ReturnType<typeof vi.fn>;
  onNotification: ReturnType<typeof vi.fn>;
  close: ReturnType<typeof vi.fn>;
  emit: (notification: MockNotification) => void;
};

function createMockAppServerClient(
  loginResponse = {
    type: "chatgpt" as const,
    loginId: "login-1",
    authUrl: "https://auth.openai.com/oauth/authorize?client_id=opencrab",
  },
): MockAppServerClient {
  const listeners = new Set<(notification: MockNotification) => void>();

  return {
    request: vi.fn(async (method: string) => {
      if (method === "account/login/start") {
        return loginResponse;
      }

      if (method === "account/login/cancel") {
        return { ok: true };
      }

      throw new Error(`Unexpected method: ${method}`);
    }),
    notify: vi.fn(),
    onNotification: vi.fn((listener: (notification: MockNotification) => void) => {
      listeners.add(listener);

      return () => {
        listeners.delete(listener);
      };
    }),
    close: vi.fn(),
    emit(notification: MockNotification) {
      listeners.forEach((listener) => listener(notification));
    },
  };
}

async function loadConnectionModule(): Promise<ConnectionModule> {
  return import("@/lib/chatgpt/connection");
}

describe("chatgpt connection flow", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.useFakeTimers();
    createCodexAppServerClientMock.mockReset();
    buildChatGptLoginEnvMock.mockClear();
    getCodexLoginStatusMock.mockReset();
    execCodexCommandMock.mockReset();
    openUrlInChromeMock.mockReset();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("starts browser auth with Codex app-server and opens ChatGPT in Chrome", async () => {
    const appServer = createMockAppServerClient();
    createCodexAppServerClientMock.mockResolvedValue(appServer);
    getCodexLoginStatusMock
      .mockResolvedValueOnce({
        ok: false,
        error: "missing",
      })
      .mockResolvedValueOnce({
        ok: false,
        error: "missing",
      });
    openUrlInChromeMock.mockResolvedValue({
      chromePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    });

    const connection = await loadConnectionModule();
    const status = await connection.startChatGptConnection();

    expect(createCodexAppServerClientMock).toHaveBeenCalledTimes(1);
    expect(appServer.request).toHaveBeenCalledWith("account/login/start", {
      type: "chatgpt",
    });
    expect(openUrlInChromeMock).toHaveBeenCalledWith(
      "https://auth.openai.com/oauth/authorize?client_id=opencrab",
      { HOME: "/tmp/opencrab-chatgpt-test" },
    );
    expect(status.stage).toBe("waiting_browser_auth");
    expect(status.authMode).toBe("browser");
    expect(status.authUrl).toContain("https://auth.openai.com/oauth/authorize");

    await connection.cancelChatGptConnection();
  });

  it("keeps the flow pending and updates the message when Chrome cannot be opened automatically", async () => {
    const appServer = createMockAppServerClient();
    createCodexAppServerClientMock.mockResolvedValue(appServer);
    getCodexLoginStatusMock.mockResolvedValue({
      ok: false,
      error: "missing",
    });
    openUrlInChromeMock.mockRejectedValue(
      new Error("Chrome launch failed"),
    );

    const connection = await loadConnectionModule();
    const status = await connection.startChatGptConnection();

    expect(status.stage).toBe("waiting_browser_auth");
    expect(status.message).toContain("没能自动在 Google Chrome 中打开");

    await connection.cancelChatGptConnection();
  });

  it("marks the connection as connected after the browser login completes", async () => {
    const appServer = createMockAppServerClient();
    createCodexAppServerClientMock.mockResolvedValue(appServer);
    getCodexLoginStatusMock
      .mockResolvedValueOnce({
        ok: false,
        error: "missing",
      })
      .mockResolvedValueOnce({
        ok: false,
        error: "missing",
      })
      .mockResolvedValueOnce({
        ok: true,
      })
      .mockResolvedValue({
        ok: true,
      });
    openUrlInChromeMock.mockResolvedValue({
      chromePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    });

    const connection = await loadConnectionModule();
    await connection.startChatGptConnection();

    appServer.emit({
      method: "account/login/completed",
      params: {
        loginId: "login-1",
        success: true,
        error: null,
      },
    });
    await Promise.resolve();
    await Promise.resolve();

    const status = await connection.getChatGptConnectionStatus();

    expect(status.isConnected).toBe(true);
    expect(status.stage).toBe("connected");
    expect(appServer.close).toHaveBeenCalled();
  });

  it("reopens the pending auth page in Chrome and can cancel the pending login", async () => {
    const appServer = createMockAppServerClient();
    createCodexAppServerClientMock.mockResolvedValue(appServer);
    getCodexLoginStatusMock.mockResolvedValue({
      ok: false,
      error: "missing",
    });
    openUrlInChromeMock.mockResolvedValue({
      chromePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    });

    const connection = await loadConnectionModule();
    await connection.startChatGptConnection();
    openUrlInChromeMock.mockClear();

    const reopened = await connection.openPendingChatGptConnectionInChrome();
    expect(openUrlInChromeMock).toHaveBeenCalledWith(
      "https://auth.openai.com/oauth/authorize?client_id=opencrab",
      { HOME: "/tmp/opencrab-chatgpt-test" },
    );
    expect(reopened.message).toContain("已重新打开 ChatGPT 登录页");

    const cancelled = await connection.cancelChatGptConnection();
    expect(appServer.request).toHaveBeenCalledWith("account/login/cancel", {
      loginId: "login-1",
    });
    expect(cancelled.stage).toBe("not_connected");
    expect(cancelled.message).toContain("已取消");
  });
});
