import { beforeEach, describe, expect, it, vi } from "vitest";

const streamCodexReplyMock = vi.hoisted(() => vi.fn());
const prepareConversationTurnMock = vi.hoisted(() => vi.fn());
const finalizeConversationTurnMock = vi.hoisted(() => vi.fn());
const updateConversationMock = vi.hoisted(() => vi.fn());
const addMessageMock = vi.hoisted(() => vi.fn());
const getAgentProfileMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/agents/agent-store", () => ({
  getAgentProfile: getAgentProfileMock,
}));

vi.mock("@/lib/codex/sdk", () => ({
  streamCodexReply: streamCodexReplyMock,
}));

vi.mock("@/lib/conversations/run-conversation-turn", () => ({
  prepareConversationTurn: prepareConversationTurnMock,
  finalizeConversationTurn: finalizeConversationTurnMock,
}));

vi.mock("@/lib/resources/local-store", () => ({
  addMessage: addMessageMock,
  updateConversation: updateConversationMock,
}));

type ConversationStreamModule = Awaited<
  typeof import("@/lib/modules/conversations/conversation-stream-service")
>;

async function loadConversationStreamModule(): Promise<ConversationStreamModule> {
  return import("@/lib/modules/conversations/conversation-stream-service");
}

async function readStreamEvents(response: Response) {
  const payload = await response.text();

  return payload
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => JSON.parse(line));
}

describe("conversation-stream-service", () => {
  beforeEach(() => {
    vi.resetModules();
    streamCodexReplyMock.mockReset();
    prepareConversationTurnMock.mockReset();
    finalizeConversationTurnMock.mockReset();
    updateConversationMock.mockReset();
    addMessageMock.mockReset();
    getAgentProfileMock.mockReset();

    prepareConversationTurnMock.mockReturnValue({
      conversationId: "conversation-1",
      conversation: {
        id: "conversation-1",
        title: "Test conversation",
        codexThreadId: null,
        lastAssistantModel: null,
        agentProfileId: null,
        workspaceDir: "/tmp/opencrab-test",
        sandboxMode: "workspace-write",
      },
      workingDirectory: "/tmp/opencrab-test",
      sandboxMode: "workspace-write",
      content: "你好",
      attachments: [],
      imagePaths: [],
      textAttachments: [],
      userMessageId: "message-user-1",
      assistantMessageId: "message-assistant-1",
    });
  });

  it("preserves the specific runtime error instead of overwriting it with the empty-content fallback", async () => {
    streamCodexReplyMock.mockImplementation(async function* () {
      throw new Error("OpenCrab 当前还不能稳定控制你正在使用的 Chrome。");
    });

    const { buildConversationReplyStream } =
      await loadConversationStreamModule();
    const response = await buildConversationReplyStream({
      request: new Request("http://opencrab.test/api/reply", {
        method: "POST",
      }),
      conversationId: "conversation-1",
      body: {
        content: "你好",
      },
    });

    const events = await readStreamEvents(response);

    expect(events).toEqual([
      {
        type: "error",
        error: "OpenCrab 当前还不能稳定控制你正在使用的 Chrome。",
      },
    ]);
  });

  it("still emits the generic fallback when the stream ends silently without assistant text", async () => {
    streamCodexReplyMock.mockImplementation(async function* () {
      yield {
        type: "thinking" as const,
        entries: ["正在检查上下文"],
      };
    });

    const { buildConversationReplyStream } =
      await loadConversationStreamModule();
    const response = await buildConversationReplyStream({
      request: new Request("http://opencrab.test/api/reply", {
        method: "POST",
      }),
      conversationId: "conversation-1",
      body: {
        content: "你好",
      },
    });

    const events = await readStreamEvents(response);

    expect(events).toEqual([
      {
        type: "thinking",
        entries: ["正在检查上下文"],
      },
      {
        type: "error",
        error: "OpenCrab 当前没有返回可用内容，请稍后再试。",
      },
    ]);
  });
});
