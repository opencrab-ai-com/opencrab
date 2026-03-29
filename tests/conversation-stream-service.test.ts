import { mkdtempSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const streamCodexReplyMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/codex/sdk", () => ({
  streamCodexReply: streamCodexReplyMock,
}));

type LocalStoreModule = Awaited<typeof import("@/lib/resources/local-store")>;
type ConversationStreamServiceModule = Awaited<
  typeof import("@/lib/modules/conversations/conversation-stream-service")
>;

async function loadLocalStore(): Promise<LocalStoreModule> {
  return import("@/lib/resources/local-store");
}

async function loadConversationStreamService(): Promise<ConversationStreamServiceModule> {
  return import("@/lib/modules/conversations/conversation-stream-service");
}

describe("buildConversationReplyStream idle timeout", () => {
  const originalOpencrabHome = process.env.OPENCRAB_HOME;
  const originalIdleTimeout = process.env.OPENCRAB_REPLY_STREAM_IDLE_TIMEOUT_MS;
  const originalHeartbeatInterval = process.env.OPENCRAB_REPLY_STREAM_HEARTBEAT_INTERVAL_MS;
  const tempHomes: string[] = [];

  beforeEach(() => {
    tempHomes.length = 0;
    vi.resetModules();
    streamCodexReplyMock.mockReset();
  });

  afterEach(() => {
    if (originalOpencrabHome === undefined) {
      delete process.env.OPENCRAB_HOME;
    } else {
      process.env.OPENCRAB_HOME = originalOpencrabHome;
    }

    if (originalIdleTimeout === undefined) {
      delete process.env.OPENCRAB_REPLY_STREAM_IDLE_TIMEOUT_MS;
    } else {
      process.env.OPENCRAB_REPLY_STREAM_IDLE_TIMEOUT_MS = originalIdleTimeout;
    }

    if (originalHeartbeatInterval === undefined) {
      delete process.env.OPENCRAB_REPLY_STREAM_HEARTBEAT_INTERVAL_MS;
    } else {
      process.env.OPENCRAB_REPLY_STREAM_HEARTBEAT_INTERVAL_MS = originalHeartbeatInterval;
    }

    tempHomes.forEach((homePath) => {
      rmSync(homePath, { recursive: true, force: true });
    });
  });

  it("emits a terminal error when the codex stream stalls after the thread event", async () => {
    const tempHome = mkdtempSync(path.join(os.tmpdir(), "opencrab-stream-service-"));
    tempHomes.push(tempHome);
    process.env.OPENCRAB_HOME = tempHome;
    process.env.OPENCRAB_REPLY_STREAM_IDLE_TIMEOUT_MS = "20";
    process.env.OPENCRAB_REPLY_STREAM_HEARTBEAT_INTERVAL_MS = "5";

    streamCodexReplyMock.mockImplementation(async function* () {
      yield {
        type: "thread" as const,
        threadId: null,
      };
      await new Promise(() => undefined);
    });

    const localStore = await loadLocalStore();
    const { buildConversationReplyStream } = await loadConversationStreamService();
    const created = localStore.createConversation({
      title: "Reply timeout",
    });

    const response = await buildConversationReplyStream({
      request: new Request("http://localhost/api/conversations/reply/stream", {
        method: "POST",
        body: JSON.stringify({}),
      }),
      conversationId: created.conversationId,
      body: {
        content: "你好",
        model: "gpt-5.4",
        reasoningEffort: "medium",
        userMessageId: "message-timeout-user",
        assistantMessageId: "message-timeout-assistant",
      },
    });

    const lines = (await response.text())
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => JSON.parse(line));

    expect(lines).toHaveLength(2);
    expect(lines[0]).toEqual({
      type: "thread",
      threadId: null,
    });
    expect(lines[1]).toEqual({
      type: "error",
      error: "OpenCrab 长时间没有返回内容（超过 1 秒），本次回复已自动停止，请重试。",
    });

    expect(
      localStore.getSnapshot().conversationMessages[created.conversationId]?.map((message) => ({
        id: message.id,
        role: message.role,
        status: message.status,
      })),
    ).toEqual([
      {
        id: "message-timeout-user",
        role: "user",
        status: "done",
      },
    ]);
  });
});
