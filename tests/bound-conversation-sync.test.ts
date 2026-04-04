import { mkdtempSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const sendFeishuReplyMock = vi.hoisted(() => vi.fn());
const sendTelegramReplyMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/channels/feishu", () => ({
  sendFeishuReply: sendFeishuReplyMock,
}));

vi.mock("@/lib/channels/telegram", () => ({
  sendTelegramReply: sendTelegramReplyMock,
}));

describe("bound conversation history sync", () => {
  const originalOpencrabHome = process.env.OPENCRAB_HOME;
  const tempHomes: string[] = [];

  beforeEach(() => {
    vi.resetModules();
    sendFeishuReplyMock.mockReset();
    sendTelegramReplyMock.mockReset();
    tempHomes.length = 0;
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

  it("syncs existing local history to feishu when a conversation is bound", async () => {
    const tempHome = mkdtempSync(path.join(os.tmpdir(), "opencrab-feishu-history-"));
    tempHomes.push(tempHome);
    process.env.OPENCRAB_HOME = tempHome;

    sendFeishuReplyMock
      .mockResolvedValueOnce({ remoteMessageId: "feishu-message-1" })
      .mockResolvedValueOnce({ remoteMessageId: "feishu-message-2" });

    const localStore = await import("@/lib/resources/local-store");
    const { conversationManagementService } = await import(
      "@/lib/modules/conversations/conversation-management-service"
    );

    const created = await conversationManagementService.create({
      title: "飞书历史同步",
    });

    localStore.addMessage(created.conversationId, {
      id: "message-user-1",
      role: "user",
      content: "这是网页里发出的用户消息",
      status: "done",
    });
    localStore.addMessage(created.conversationId, {
      id: "message-assistant-1",
      role: "assistant",
      actorLabel: "OpenCrab",
      content: "这是已经生成好的助手回复",
      status: "done",
    });

    const snapshot = await conversationManagementService.update(created.conversationId, {
      feishuChatSessionId: "oc_history_room_1",
    });
    const messages = snapshot.conversationMessages[created.conversationId] ?? [];

    expect(sendFeishuReplyMock).toHaveBeenCalledTimes(2);
    expect(sendFeishuReplyMock).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        chatId: "oc_history_room_1",
        text: "我：\n这是网页里发出的用户消息",
      }),
    );
    expect(sendFeishuReplyMock).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        chatId: "oc_history_room_1",
        text: "OpenCrab：\n这是已经生成好的助手回复",
      }),
    );
    expect(messages.find((message) => message.id === "message-user-1")).toMatchObject({
      remoteMessageId: "feishu-message-1",
      remoteChatId: "oc_history_room_1",
    });
    expect(messages.find((message) => message.id === "message-assistant-1")).toMatchObject({
      remoteMessageId: "feishu-message-2",
      remoteChatId: "oc_history_room_1",
    });
  });

  it("mirrors new local turns into a bound feishu conversation", async () => {
    const tempHome = mkdtempSync(path.join(os.tmpdir(), "opencrab-feishu-turn-sync-"));
    tempHomes.push(tempHome);
    process.env.OPENCRAB_HOME = tempHome;

    sendFeishuReplyMock
      .mockResolvedValueOnce({ remoteMessageId: "feishu-message-3" })
      .mockResolvedValueOnce({ remoteMessageId: "feishu-message-4" });

    const localStore = await import("@/lib/resources/local-store");
    const { conversationManagementService } = await import(
      "@/lib/modules/conversations/conversation-management-service"
    );
    const { createConversationTurnService } = await import(
      "@/lib/modules/conversations/conversation-turn-service"
    );

    const created = await conversationManagementService.create({
      title: "飞书跟随同步",
    });

    await conversationManagementService.update(created.conversationId, {
      feishuChatSessionId: "oc_turn_room_1",
    });

    const executeTurn = vi.fn(async ({ conversationId }: { conversationId: string }) => {
      localStore.addMessage(conversationId, {
        id: "message-user-2",
        role: "user",
        content: "继续推进这条对话",
        status: "done",
      });
      localStore.addMessage(conversationId, {
        id: "message-assistant-2",
        role: "assistant",
        actorLabel: "OpenCrab",
        content: "好的，我继续补全这条对话。",
        status: "done",
      });

      return {
        snapshot: localStore.getSnapshot(),
        assistant: {
          text: "好的，我继续补全这条对话。",
          attachments: [],
          model: "gpt-5.4",
          threadId: null,
          usage: null,
          thinking: [],
        },
      };
    });

    const service = createConversationTurnService({
      executeTurn: executeTurn as never,
    });
    const result = await service.reply({
      conversationId: created.conversationId,
      content: "继续推进这条对话",
    });
    const messages = result.snapshot.conversationMessages[created.conversationId] ?? [];

    expect(executeTurn).toHaveBeenCalledWith(
      expect.objectContaining({
        conversationId: created.conversationId,
        content: "继续推进这条对话",
      }),
    );
    expect(sendFeishuReplyMock).toHaveBeenCalledTimes(2);
    expect(sendFeishuReplyMock).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        chatId: "oc_turn_room_1",
        text: "我：\n继续推进这条对话",
      }),
    );
    expect(sendFeishuReplyMock).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        chatId: "oc_turn_room_1",
        text: "OpenCrab：\n好的，我继续补全这条对话。",
      }),
    );
    expect(messages.find((message) => message.id === "message-user-2")).toMatchObject({
      remoteMessageId: "feishu-message-3",
      remoteChatId: "oc_turn_room_1",
    });
    expect(messages.find((message) => message.id === "message-assistant-2")).toMatchObject({
      remoteMessageId: "feishu-message-4",
      remoteChatId: "oc_turn_room_1",
    });
  });
});
