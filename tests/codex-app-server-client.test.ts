import { EventEmitter } from "node:events";
import { PassThrough } from "node:stream";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const spawnCodexCommandMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/codex/executable", () => ({
  spawnCodexCommand: spawnCodexCommandMock,
}));

class MockChildProcess extends EventEmitter {
  stdout = new PassThrough();
  stderr = new PassThrough();
  stdin = {
    write: vi.fn((chunk: string) => {
      this.stdinWrites.push(chunk);
      return true;
    }),
  };
  stdinWrites: string[] = [];
  killed = false;
  kill = vi.fn(() => {
    this.killed = true;
    this.emit("exit", 0);
    return true;
  });
}

type AppServerClientModule = Awaited<typeof import("@/lib/codex/app-server-client")>;

async function loadAppServerClientModule(): Promise<AppServerClientModule> {
  return import("@/lib/codex/app-server-client");
}

function readWrittenMessage(child: MockChildProcess, index: number) {
  return JSON.parse(child.stdinWrites[index] || "{}");
}

describe("codex app-server client", () => {
  beforeEach(() => {
    vi.resetModules();
    spawnCodexCommandMock.mockReset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("initializes the app-server and forwards requests plus notifications", async () => {
    const child = new MockChildProcess();
    spawnCodexCommandMock.mockReturnValue(child);

    const { createCodexAppServerClient } = await loadAppServerClientModule();
    const clientPromise = createCodexAppServerClient({
      HOME: "/tmp/opencrab-app-server",
    } as unknown as NodeJS.ProcessEnv);

    const initializeRequest = readWrittenMessage(child, 0);
    expect(initializeRequest.method).toBe("initialize");
    expect(initializeRequest.params.clientInfo.name).toBe("opencrab");

    child.stdout.write(
      `${JSON.stringify({ id: initializeRequest.id, result: { ok: true } })}\n`,
    );

    const client = await clientPromise;
    const initializedNotification = readWrittenMessage(child, 1);
    expect(initializedNotification.method).toBe("initialized");

    const notificationListener = vi.fn();
    client.onNotification(notificationListener);

    const requestPromise = client.request("account/read", {
      refreshToken: false,
    });
    const accountReadRequest = readWrittenMessage(child, 2);
    expect(accountReadRequest.method).toBe("account/read");

    child.stdout.write(
      `${JSON.stringify({
        method: "account/login/completed",
        params: { success: true, loginId: "login-1" },
      })}\n`,
    );
    expect(notificationListener).toHaveBeenCalledWith({
      method: "account/login/completed",
      params: { success: true, loginId: "login-1" },
    });

    child.stdout.write(
      `${JSON.stringify({
        id: accountReadRequest.id,
        result: { account: { type: "chatgpt" } },
      })}\n`,
    );

    await expect(requestPromise).resolves.toEqual({
      account: { type: "chatgpt" },
    });
  });

  it("rejects pending requests when the app-server exits unexpectedly", async () => {
    const child = new MockChildProcess();
    spawnCodexCommandMock.mockReturnValue(child);

    const { createCodexAppServerClient } = await loadAppServerClientModule();
    const clientPromise = createCodexAppServerClient();

    const initializeRequest = readWrittenMessage(child, 0);
    child.stdout.write(
      `${JSON.stringify({ id: initializeRequest.id, result: { ok: true } })}\n`,
    );

    const client = await clientPromise;
    const requestPromise = client.request("account/read", {
      refreshToken: false,
    });

    child.stderr.write("Codex app-server crashed");
    child.emit("exit", 1);

    await expect(requestPromise).rejects.toThrow("Codex app-server crashed");
  });
});
