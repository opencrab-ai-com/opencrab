import type { ChildProcessWithoutNullStreams } from "node:child_process";
import { spawnCodexCommand } from "@/lib/codex/executable";
import packageJson from "../../package.json";

type AppServerResponseMessage = {
  id: string | number;
  result?: unknown;
  error?: {
    message?: string;
  };
};

type AppServerNotificationMessage = {
  method: string;
  params?: unknown;
};

type PendingRequest = {
  resolve: (value: unknown) => void;
  reject: (reason?: unknown) => void;
};

export type CodexAppServerNotification = AppServerNotificationMessage;

export type CodexAppServerClient = {
  request<TResult>(method: string, params: unknown): Promise<TResult>;
  notify(method: string, params?: unknown): void;
  onNotification(
    listener: (notification: CodexAppServerNotification) => void,
  ): () => void;
  close: () => void;
};

export async function createCodexAppServerClient(
  env: NodeJS.ProcessEnv = process.env,
): Promise<CodexAppServerClient> {
  const child = spawnCodexCommand(["app-server", "--listen", "stdio://"], {
    env,
    stdio: ["pipe", "pipe", "pipe"],
  }) as ChildProcessWithoutNullStreams;

  child.stdout.setEncoding("utf8");

  let lineBuffer = "";
  let nextRequestId = 1;
  let closed = false;
  let stderrOutput = "";
  const pendingRequests = new Map<string | number, PendingRequest>();
  const notificationListeners = new Set<
    (notification: CodexAppServerNotification) => void
  >();

  child.stdout.on("data", (chunk: string) => {
    lineBuffer += chunk;

    while (true) {
      const newlineIndex = lineBuffer.indexOf("\n");

      if (newlineIndex < 0) {
        break;
      }

      const line = lineBuffer.slice(0, newlineIndex).trim();
      lineBuffer = lineBuffer.slice(newlineIndex + 1);

      if (!line) {
        continue;
      }

      handleMessage(line);
    }
  });

  child.stderr.on("data", (chunk: Buffer | string) => {
    stderrOutput += String(chunk);
  });

  child.once("exit", () => {
    closed = true;
    const error = new Error(
      normalizeAppServerError(stderrOutput) ||
        "Codex app-server 已提前退出。",
    );

    pendingRequests.forEach((pending) => {
      pending.reject(error);
    });
    pendingRequests.clear();
  });

  const client: CodexAppServerClient = {
    async request<TResult>(method: string, params: unknown) {
      if (closed) {
        throw new Error("Codex app-server 已关闭。");
      }

      const requestId = nextRequestId++;

      const resultPromise = new Promise<TResult>((resolve, reject) => {
        pendingRequests.set(requestId, {
          resolve: (value) => resolve(value as TResult),
          reject,
        });
      });

      child.stdin.write(
        `${JSON.stringify({ method, id: requestId, params })}\n`,
      );

      return resultPromise;
    },
    notify(method: string, params?: unknown) {
      if (closed) {
        return;
      }

      child.stdin.write(`${JSON.stringify({ method, params })}\n`);
    },
    onNotification(listener) {
      notificationListeners.add(listener);

      return () => {
        notificationListeners.delete(listener);
      };
    },
    close() {
      if (closed) {
        return;
      }

      closed = true;

      pendingRequests.forEach((pending) => {
        pending.reject(new Error("Codex app-server 已关闭。"));
      });
      pendingRequests.clear();

      if (!child.killed) {
        child.kill("SIGTERM");
      }
    },
  };

  await client.request("initialize", {
    clientInfo: {
      name: "opencrab",
      title: "OpenCrab",
      version: packageJson.version,
    },
    capabilities: null,
  });

  client.notify("initialized");

  return client;

  function handleMessage(line: string) {
    let parsed: AppServerResponseMessage | AppServerNotificationMessage;

    try {
      parsed = JSON.parse(line) as
        | AppServerResponseMessage
        | AppServerNotificationMessage;
    } catch {
      return;
    }

    if ("id" in parsed) {
      const pending = pendingRequests.get(parsed.id);

      if (!pending) {
        return;
      }

      pendingRequests.delete(parsed.id);

      if (parsed.error) {
        pending.reject(
          new Error(parsed.error.message || "Codex app-server 请求失败。"),
        );
        return;
      }

      pending.resolve(parsed.result);
      return;
    }

    if ("method" in parsed) {
      notificationListeners.forEach((listener) => {
        listener(parsed);
      });
    }
  }
}

function normalizeAppServerError(stderrOutput: string) {
  const lines = stderrOutput
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

  return lines.at(-1) || null;
}
