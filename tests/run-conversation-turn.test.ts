import { existsSync, mkdtempSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { AppSnapshot } from "@/lib/resources/opencrab-api-types";
import type { ConversationMessage } from "@/lib/seed-data";

const streamCodexReplyMock = vi.hoisted(() => vi.fn());
const generateCodexReplyMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/codex/sdk", () => ({
  generateCodexReply: generateCodexReplyMock,
  streamCodexReply: streamCodexReplyMock,
}));

type LocalStoreModule = Awaited<typeof import("@/lib/resources/local-store")>;
type ConversationTurnModule = Awaited<typeof import("@/lib/conversations/run-conversation-turn")>;

async function loadLocalStore(): Promise<LocalStoreModule> {
  return import("@/lib/resources/local-store");
}

async function loadConversationTurn(): Promise<ConversationTurnModule> {
  return import("@/lib/conversations/run-conversation-turn");
}

describe("runConversationTurn streaming persistence", () => {
  const originalOpencrabHome = process.env.OPENCRAB_HOME;
  const tempHomes: string[] = [];

  beforeEach(() => {
    tempHomes.length = 0;
    vi.resetModules();
    streamCodexReplyMock.mockReset();
    generateCodexReplyMock.mockReset();
  });

  afterEach(() => {
    if (originalOpencrabHome === undefined) {
      delete process.env.OPENCRAB_HOME;
    } else {
      process.env.OPENCRAB_HOME = originalOpencrabHome;
    }

    tempHomes.forEach((homePath) => {
      rmSync(homePath, { recursive: true, force: true });
    });
  });

  it("writes pending thinking into the conversation before the final assistant message completes", async () => {
    const tempHome = mkdtempSync(path.join(os.tmpdir(), "opencrab-stream-turn-"));
    tempHomes.push(tempHome);
    process.env.OPENCRAB_HOME = tempHome;

    streamCodexReplyMock.mockImplementation(async function* () {
      yield {
        type: "thread" as const,
        threadId: "thread-live-1",
      };
      yield {
        type: "thinking" as const,
        entries: ["先读取上下文", "正在整理第一版判断"],
      };
      yield {
        type: "assistant" as const,
        text: "正在整理首页结构建议",
      };
      yield {
        type: "done" as const,
        text: "首页建议已经整理完成。",
        threadId: "thread-live-1",
        model: "gpt-5.4",
        usage: null,
        thinking: ["先读取上下文", "正在整理第一版判断"],
      };
    });

    const localStore = await loadLocalStore();
    const { runConversationTurn } = await loadConversationTurn();
    const created = localStore.createConversation({
      title: "Team runtime thinking",
      hidden: true,
    });
    const conversationId = created.conversationId;
    localStore.updateConversation(conversationId, {
      sandboxMode: "read-only",
    });
    const conversation = localStore.findConversation(conversationId);

    let thinkingSnapshot: AppSnapshot | null = null;
    let assistantSnapshot: AppSnapshot | null = null;

    await runConversationTurn({
      conversationId,
      content: "继续推进",
      onThinking: () => {
        thinkingSnapshot = localStore.getSnapshot();
      },
      onAssistantText: () => {
        assistantSnapshot = localStore.getSnapshot();
      },
    });

    const thinkingMessages =
      ((thinkingSnapshot as AppSnapshot | null)?.conversationMessages[conversationId] ?? []) as ConversationMessage[];
    const assistantDraftMessages =
      ((assistantSnapshot as AppSnapshot | null)?.conversationMessages[conversationId] ?? []) as ConversationMessage[];
    const thinkingMessage =
      thinkingMessages.find((message: ConversationMessage) => message.role === "assistant") ?? null;
    const assistantDraftMessage =
      assistantDraftMessages.find((message: ConversationMessage) => message.role === "assistant") ?? null;
    const finalSnapshot = localStore.getSnapshot();
    const finalAssistantMessages =
      finalSnapshot.conversationMessages[conversationId]?.filter((message) => message.role === "assistant") ?? [];
    const finalAssistantMessage = finalAssistantMessages[0] ?? null;

    expect(thinkingMessage?.status).toBe("pending");
    expect(thinkingMessage?.thinking).toEqual(["先读取上下文", "正在整理第一版判断"]);
    expect(thinkingMessage?.content).toBe("");

    expect(assistantDraftMessage?.status).toBe("pending");
    expect(assistantDraftMessage?.thinking).toEqual(["先读取上下文", "正在整理第一版判断"]);
    expect(assistantDraftMessage?.content).toBe("正在整理首页结构建议");

    expect(finalAssistantMessages).toHaveLength(1);
    expect(finalAssistantMessage?.status).toBe("done");
    expect(finalAssistantMessage?.thinking).toEqual(["先读取上下文", "正在整理第一版判断"]);
    expect(finalAssistantMessage?.content).toBe("首页建议已经整理完成。");
    expect(streamCodexReplyMock).toHaveBeenCalledWith(
      expect.objectContaining({
        sandboxMode: "read-only",
        workingDirectory: conversation?.workspaceDir,
      }),
    );
  });

  it("writes streamed plan steps into the assistant draft and keeps them on the final message", async () => {
    const tempHome = mkdtempSync(path.join(os.tmpdir(), "opencrab-stream-plan-"));
    tempHomes.push(tempHome);
    process.env.OPENCRAB_HOME = tempHome;

    streamCodexReplyMock.mockImplementation(async function* () {
      yield {
        type: "thread" as const,
        threadId: "thread-plan-1",
      };
      yield {
        type: "plan" as const,
        steps: [
          { id: "todo-1:0", text: "读取当前目录和上下文", status: "completed" as const },
          { id: "todo-1:1", text: "修改对话消息模型", status: "pending" as const },
        ],
      };
      yield {
        type: "assistant" as const,
        text: "正在整理这次改动",
      };
      yield {
        type: "done" as const,
        text: "已经把执行计划接入到对话消息里。",
        threadId: "thread-plan-1",
        model: "gpt-5.4",
        usage: null,
        thinking: [],
        planSteps: [
          { id: "todo-1:0", text: "读取当前目录和上下文", status: "completed" as const },
          { id: "todo-1:1", text: "修改对话消息模型", status: "completed" as const },
        ],
      };
    });

    const localStore = await loadLocalStore();
    const { runConversationTurn } = await loadConversationTurn();
    const created = localStore.createConversation({
      title: "Plan progress",
      hidden: true,
    });
    const conversationId = created.conversationId;

    let planSnapshot: AppSnapshot | null = null;
    let assistantSnapshot: AppSnapshot | null = null;

    await runConversationTurn({
      conversationId,
      content: "把 plan 展示做出来",
      onPlan: () => {
        planSnapshot = localStore.getSnapshot();
      },
      onAssistantText: () => {
        assistantSnapshot = localStore.getSnapshot();
      },
    });

    type MessageWithPlan = ConversationMessage & {
      planSteps?: Array<{ id: string; text: string; status: "pending" | "completed" }>;
    };

    const planMessages =
      ((planSnapshot as AppSnapshot | null)?.conversationMessages[conversationId] ?? []) as MessageWithPlan[];
    const assistantDraftMessages =
      ((assistantSnapshot as AppSnapshot | null)?.conversationMessages[conversationId] ?? []) as MessageWithPlan[];
    const draftMessage = planMessages.find((message) => message.role === "assistant") ?? null;
    const assistantDraftMessage =
      assistantDraftMessages.find((message) => message.role === "assistant") ?? null;
    const finalSnapshot = localStore.getSnapshot();
    const finalAssistantMessage =
      (finalSnapshot.conversationMessages[conversationId]?.find(
        (message) => message.role === "assistant",
      ) as MessageWithPlan | undefined) ?? null;

    expect(draftMessage?.status).toBe("pending");
    expect(draftMessage?.planSteps).toEqual([
      { id: "todo-1:0", text: "读取当前目录和上下文", status: "completed" },
      { id: "todo-1:1", text: "修改对话消息模型", status: "pending" },
    ]);

    expect(assistantDraftMessage?.status).toBe("pending");
    expect(assistantDraftMessage?.planSteps).toEqual([
      { id: "todo-1:0", text: "读取当前目录和上下文", status: "completed" },
      { id: "todo-1:1", text: "修改对话消息模型", status: "pending" },
    ]);

    expect(finalAssistantMessage?.status).toBe("done");
    expect(finalAssistantMessage?.planSteps).toEqual([
      { id: "todo-1:0", text: "读取当前目录和上下文", status: "completed" },
      { id: "todo-1:1", text: "修改对话消息模型", status: "completed" },
    ]);
  });

  it("assigns a default workspace per conversation and lets manual overrides fall back to that default", async () => {
    const tempHome = mkdtempSync(path.join(os.tmpdir(), "opencrab-conversation-workspace-"));
    tempHomes.push(tempHome);
    process.env.OPENCRAB_HOME = tempHome;

    const localStore = await loadLocalStore();
    const created = localStore.createConversation({
      title: "Workspace defaults",
    });
    const conversationId = created.conversationId;
    const expectedDefaultWorkspace = path.join(
      tempHome,
      "workspaces",
      "conversations",
      conversationId,
    );

    expect(localStore.findConversation(conversationId)?.workspaceDir).toBe(expectedDefaultWorkspace);
    expect(existsSync(expectedDefaultWorkspace)).toBe(true);
    expect(localStore.findConversation(conversationId)?.sandboxMode).toBe("workspace-write");

    const customWorkspace = path.join(tempHome, "custom-workspace");
    localStore.updateConversation(conversationId, {
      workspaceDir: customWorkspace,
      sandboxMode: "danger-full-access",
    });

    expect(localStore.findConversation(conversationId)?.workspaceDir).toBe(customWorkspace);
    expect(existsSync(customWorkspace)).toBe(true);
    expect(localStore.findConversation(conversationId)?.sandboxMode).toBe("danger-full-access");

    localStore.updateConversation(conversationId, {
      workspaceDir: null,
      sandboxMode: null,
    });

    expect(localStore.findConversation(conversationId)?.workspaceDir).toBe(expectedDefaultWorkspace);
    expect(localStore.findConversation(conversationId)?.sandboxMode).toBe("workspace-write");
  });
});
