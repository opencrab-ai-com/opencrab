import { mkdtempSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const runConversationTurnMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/conversations/run-conversation-turn", () => ({
  runConversationTurn: runConversationTurnMock,
}));

describe("feishu chat session binding", () => {
  const originalOpencrabHome = process.env.OPENCRAB_HOME;
  const tempHomes: string[] = [];

  beforeEach(() => {
    vi.resetModules();
    runConversationTurnMock.mockReset();
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

  it("routes inbound feishu messages into a product-bound conversation without changing its mode", async () => {
    const tempHome = mkdtempSync(path.join(os.tmpdir(), "opencrab-feishu-binding-"));
    tempHomes.push(tempHome);
    process.env.OPENCRAB_HOME = tempHome;

    runConversationTurnMock.mockResolvedValue({
      assistant: {
        text: "这条对话已经继续推进。",
        attachments: [],
        model: "gpt-5.4",
      },
    });

    const { conversationManagementService } = await import(
      "@/lib/modules/conversations/conversation-management-service"
    );
    const localStore = await import("@/lib/resources/local-store");
    const channelStore = await import("@/lib/channels/channel-store");
    const dispatcher = await import("@/lib/channels/dispatcher");

    const created = conversationManagementService.create({
      title: "产品讨论",
    });
    const conversationId = created.conversationId;
    const snapshot = conversationManagementService.update(conversationId, {
      feishuChatSessionId: "oc_product_room_1",
    });
    const beforeInbound = snapshot.conversations.find((conversation) => conversation.id === conversationId) ?? null;

    expect(beforeInbound?.source).toBe("local");
    expect(beforeInbound?.feishuChatSessionId).toBe("oc_product_room_1");
    expect(channelStore.findBinding("feishu", "oc_product_room_1")?.kind).toBe("product_bound");

    await dispatcher.handleInboundChannelTextMessage({
      channelId: "feishu",
      dedupeKey: "feishu-dedupe-1",
      remoteMessageId: "message-1",
      remoteChatId: "oc_product_room_1",
      remoteChatLabel: "产品群聊",
      remoteUserId: "user-1",
      remoteUserLabel: "Sky",
      text: "继续这条产品对话",
    });

    const afterInbound = localStore.findConversation(conversationId);

    expect(afterInbound?.source).toBe("local");
    expect(afterInbound?.feishuChatSessionId).toBe("oc_product_room_1");
    expect(afterInbound?.remoteChatLabel).toBe("产品群聊");
    expect(runConversationTurnMock).toHaveBeenCalledWith(
      expect.objectContaining({
        conversationId,
        userMessageSource: "feishu",
        remoteUserMessageId: "message-1",
      }),
    );
  });

  it("keeps feishu-origin conversations marked as inbound channel bindings", async () => {
    const tempHome = mkdtempSync(path.join(os.tmpdir(), "opencrab-feishu-inbound-"));
    tempHomes.push(tempHome);
    process.env.OPENCRAB_HOME = tempHome;

    runConversationTurnMock.mockResolvedValue({
      assistant: {
        text: "收到，我继续跟进。",
        attachments: [],
        model: "gpt-5.4",
      },
    });

    const localStore = await import("@/lib/resources/local-store");
    const channelStore = await import("@/lib/channels/channel-store");
    const dispatcher = await import("@/lib/channels/dispatcher");

    const handled = await dispatcher.handleInboundChannelTextMessage({
      channelId: "feishu",
      dedupeKey: "feishu-dedupe-2",
      remoteMessageId: "message-2",
      remoteChatId: "oc_channel_room_1",
      remoteChatLabel: "飞书外部群",
      remoteUserId: "user-2",
      remoteUserLabel: "OpenCrab User",
      text: "从飞书发来的第一条消息",
    });

    const conversation = localStore.findConversation(handled.conversationId);

    expect(conversation?.source).toBe("feishu");
    expect(conversation?.feishuChatSessionId).toBe("oc_channel_room_1");
    expect(channelStore.findBinding("feishu", "oc_channel_room_1")?.kind).toBe("channel_inbound");
  });
});
