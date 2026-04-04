import { mkdtempSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  clearProjectRuntimeQueues,
  queueConversationReplies,
  waitForProjectRuntime,
} from "@/tests/helpers/project-store-runtime";

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
    clearProjectRuntimeQueues();
    tempHomes.length = 0;
  });

  afterEach(() => {
    clearProjectRuntimeQueues();

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

    const created = await conversationManagementService.create({
      title: "产品讨论",
    });
    const conversationId = created.conversationId;
    const snapshot = await conversationManagementService.update(conversationId, {
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

  it("routes inbound feishu team-room messages back into Team Runtime control after completion", async () => {
    const tempHome = mkdtempSync(path.join(os.tmpdir(), "opencrab-feishu-team-room-"));
    tempHomes.push(tempHome);
    process.env.OPENCRAB_HOME = tempHome;

    queueConversationReplies(runConversationTurnMock, [
      JSON.stringify({
        decision: "waiting_approval",
        group_reply: "第一轮阶段结果已经整理好了，你可以先确认完成。",
        checkpoint_summary: "第一轮已经完成，等待确认。",
        delegations: [],
      }),
      JSON.stringify({
        decision: "waiting_approval",
        group_reply: "收到，我已经按第二轮方向补齐验收标准和边界条件，你可以再确认一次。",
        checkpoint_summary: "第二轮已经按新方向补齐验收标准和边界条件，等待确认。",
        delegations: [],
      }),
    ], {
      threadPrefix: "feishu-team-thread",
      thinkingPrefix: "feishu-team-step",
    });

    const projectStore = await import("@/lib/projects/project-store");
    const localStore = await import("@/lib/resources/local-store");
    const dispatcher = await import("@/lib/channels/dispatcher");

    const created = projectStore.createProject({
      goal: "验证团队完成后仍可从飞书继续控制",
      workspaceDir: path.join(tempHome, "workspace"),
      agentProfileIds: ["project-manager"],
    });
    const projectId = created?.project?.id ?? null;

    if (!projectId) {
      throw new Error("projectId should exist after createProject");
    }

    const bound = projectStore.updateProjectFeishuChatSessionId(projectId, "oc_team_room_2");
    const teamConversationId = bound?.project?.teamConversationId ?? null;

    if (!teamConversationId) {
      throw new Error("teamConversationId should exist after binding the team room");
    }

    await projectStore.runProject(projectId, {
      triggerLabel: "启动第一轮",
      triggerPrompt: "先给我一版第一轮阶段结果。",
    });
    await waitForProjectRuntime(projectId);

    expect(projectStore.getProjectDetail(projectId)?.project?.runStatus).toBe("waiting_approval");

    await projectStore.replyToProjectConversation({
      projectId,
      conversationId: teamConversationId,
      content: "确认完成",
    });

    expect(projectStore.getProjectDetail(projectId)?.project?.runStatus).toBe("completed");

    await dispatcher.handleInboundChannelTextMessage({
      channelId: "feishu",
      dedupeKey: "feishu-dedupe-3",
      remoteMessageId: "message-3",
      remoteChatId: "oc_team_room_2",
      remoteChatLabel: "Team 群聊",
      remoteUserId: "user-3",
      remoteUserLabel: "Sky",
      text: "第二轮开始，把验收标准和边界条件补齐。",
    });
    await waitForProjectRuntime(projectId);

    const resumedDetail = projectStore.getProjectDetail(projectId);
    const resumedMessages = localStore.getSnapshot().conversationMessages[teamConversationId] ?? [];
    const resumeManagerPrompt = String(runConversationTurnMock.mock.calls[1]?.[0]?.content ?? "");

    expect(resumedDetail?.project?.runStatus).toBe("waiting_approval");
    expect(resumedDetail?.project?.latestUserRequest).toBe("第二轮开始，把验收标准和边界条件补齐。");
    expect(
      resumedMessages.some(
        (message) =>
          message.role === "user" && message.content === "第二轮开始，把验收标准和边界条件补齐。",
      ),
    ).toBe(true);
    expect(
      resumedMessages.some(
        (message) =>
          message.role === "assistant" &&
          message.content.includes("第二轮方向补齐验收标准和边界条件"),
      ),
    ).toBe(true);
    expect(resumeManagerPrompt).toContain("第二轮开始，把验收标准和边界条件补齐。");
    expect(runConversationTurnMock).not.toHaveBeenCalledWith(
      expect.objectContaining({
        conversationId: teamConversationId,
        userMessageSource: "feishu",
      }),
    );
  });
});
