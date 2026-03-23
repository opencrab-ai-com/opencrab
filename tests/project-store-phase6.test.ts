import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const runConversationTurnMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/conversations/run-conversation-turn", () => ({
  runConversationTurn: runConversationTurnMock,
}));

type ProjectStoreModule = Awaited<typeof import("@/lib/projects/project-store")>;

function queueConversationReplies(replies: Array<string | Error>) {
  let index = 0;

  runConversationTurnMock.mockImplementation(async (input: {
    onThreadReady?: (threadId: string | null) => void;
    onThinking?: (entries: string[]) => void;
    onAssistantText?: (text: string) => void;
  }) => {
    const nextReply = replies[index++];

    input.onThreadReady?.(`thread-${index}`);
    input.onThinking?.([`step-${index}`]);

    if (nextReply instanceof Error) {
      throw nextReply;
    }

    input.onAssistantText?.(nextReply);

    return {
      assistant: {
        text: nextReply,
      },
    };
  });
}

function clearRuntimeQueues() {
  delete (globalThis as typeof globalThis & {
    __opencrabProjectRuntimeQueues?: Map<string, Promise<void>>;
  }).__opencrabProjectRuntimeQueues;
}

async function loadProjectStore(): Promise<ProjectStoreModule> {
  vi.resetModules();
  return import("@/lib/projects/project-store");
}

async function waitForProjectRuntime(projectId: string) {
  const queues = (globalThis as typeof globalThis & {
    __opencrabProjectRuntimeQueues?: Map<string, Promise<void>>;
  }).__opencrabProjectRuntimeQueues;

  await (queues?.get(projectId) ?? Promise.resolve());
}

describe("project store phase 6 coordination", () => {
  const originalOpencrabHome = process.env.OPENCRAB_HOME;
  const tempHomes: string[] = [];

  beforeEach(() => {
    runConversationTurnMock.mockReset();
    clearRuntimeQueues();
    tempHomes.length = 0;
  });

  afterEach(() => {
    clearRuntimeQueues();
    runConversationTurnMock.mockReset();

    if (originalOpencrabHome === undefined) {
      delete process.env.OPENCRAB_HOME;
    } else {
      process.env.OPENCRAB_HOME = originalOpencrabHome;
    }

    tempHomes.forEach((homePath) => {
      rmSync(homePath, { recursive: true, force: true });
    });
  });

  it("creates mailbox coordination threads across delegation, handoff, review, and self-claim", async () => {
    const tempHome = mkdtempSync(path.join(os.tmpdir(), "opencrab-phase6-"));
    const workspaceDir = path.join(tempHome, "workspace");
    tempHomes.push(tempHome);
    process.env.OPENCRAB_HOME = tempHome;

    queueConversationReplies([
      JSON.stringify({
        decision: "delegate",
        group_reply: "收到，先由 @产品策略师 输出执行草案，再由 @表达整理师 整理成阶段总结。",
        checkpoint_summary: "",
        delegations: [
          {
            agentName: "产品策略师",
            task: "基于团队目标输出一版执行草案，明确范围、结构和下一步。",
            artifactTitles: ["团队目标"],
          },
          {
            agentName: "表达整理师",
            task: "在上游结果基础上整理成一版清楚的阶段总结，方便项目经理收束。",
            artifactTitles: ["团队目标"],
          },
        ],
      }),
      "我已经整理出一版执行草案，包含范围、结构和下一步建议。",
      "我已经把上游结果整理成阶段总结，可以直接给项目经理收束。",
      JSON.stringify({
        decision: "waiting_approval",
        group_reply: "这一轮已经有可交付结果了，你可以确认结束；如果还要补充，我再继续组织下一轮。",
        checkpoint_summary: "团队已经完成本轮两棒接力，当前具备可交付的阶段总结，等待用户确认或提出补充。",
        delegations: [],
      }),
    ]);

    const projectStore = await loadProjectStore();
    const created = projectStore.createProject({
      goal: "梳理 Team Mode Phase 6 的协作闭环",
      workspaceDir,
      agentProfileIds: ["project-manager", "product-strategist", "writer-editor"],
    });
    const projectId = created?.project?.id ?? null;

    expect(projectId).toBeTruthy();

    if (!projectId) {
      throw new Error("projectId should exist after createProject");
    }

    await projectStore.runProject(projectId, {
      triggerLabel: "启动 Phase 6",
      triggerPrompt: "推进成员协作层，给我一个能验收的阶段结果。",
    });
    await waitForProjectRuntime(projectId);

    const detail = projectStore.getProjectDetail(projectId);

    if (!detail?.project) {
      throw new Error("detail.project should exist after runtime");
    }

    expect(detail.project.runStatus).toBe("waiting_approval");
    expect(detail.reviews.filter((review) => review.status === "pending").length).toBeGreaterThanOrEqual(2);
    expect(detail.tasks.filter((task) => task.status === "completed")).toHaveLength(3);

    const mailboxKinds = new Set(detail.mailboxThreads.map((thread) => thread.kind));

    expect(mailboxKinds.has("direct_message")).toBe(true);
    expect(mailboxKinds.has("broadcast")).toBe(true);
    expect(mailboxKinds.has("request_input")).toBe(true);
    expect(mailboxKinds.has("handoff")).toBe(true);
    expect(mailboxKinds.has("review_request")).toBe(true);
    expect(mailboxKinds.has("next_step_suggestion")).toBe(true);

    expect(
      detail.mailboxThreads.some((thread) => thread.kind === "request_input" && thread.status === "resolved"),
    ).toBe(true);
    expect(
      detail.mailboxThreads.some((thread) => thread.kind === "handoff" && thread.status === "resolved"),
    ).toBe(true);
    expect(
      detail.mailboxThreads.some(
        (thread) => thread.kind === "next_step_suggestion" && thread.status === "resolved",
      ),
    ).toBe(true);
    expect(
      detail.mailboxThreads.filter(
        (thread) => thread.kind === "review_request" && thread.status === "open",
      ).length,
    ).toBeGreaterThanOrEqual(2);
  });

  it("auto-claims a ready task for an idle owner and emits a self-claim signal", async () => {
    const tempHome = mkdtempSync(path.join(os.tmpdir(), "opencrab-phase6-"));
    const workspaceDir = path.join(tempHome, "workspace");
    tempHomes.push(tempHome);
    process.env.OPENCRAB_HOME = tempHome;

    const projectStore = await loadProjectStore();
    const created = projectStore.createProject({
      goal: "验证 self-claim 的边界触发条件",
      workspaceDir,
      agentProfileIds: ["project-manager", "product-strategist"],
    });
    const projectId = created?.project?.id ?? null;

    expect(projectId).toBeTruthy();

    if (!projectId) {
      throw new Error("projectId should exist after createProject");
    }

    const storePath = path.join(tempHome, "state", "projects.json");
    const rawState = JSON.parse(readFileSync(storePath, "utf8")) as {
      rooms: Array<Record<string, unknown>>;
      agents: Array<Record<string, unknown>>;
      tasks: Array<Record<string, unknown>>;
      mailboxThreads: Array<Record<string, unknown>>;
      events: Array<Record<string, unknown>>;
      artifacts: Array<Record<string, unknown>>;
      reviews: Array<Record<string, unknown>>;
      runs: Array<Record<string, unknown>>;
    };
    const worker =
      rawState.agents.find(
        (agent) => agent.projectId === projectId && agent.agentProfileId === "product-strategist",
      ) ?? null;

    if (!worker) {
      throw new Error("worker should exist in seeded project state");
    }

    rawState.rooms = rawState.rooms.map((room) =>
      room.id === projectId
        ? {
            ...room,
            status: "active",
            runStatus: "running",
            activeAgentId: worker.id,
            nextAgentId: worker.id,
          }
        : room,
    );
    rawState.tasks = [
      {
        id: `${projectId}-task-self-claim`,
        projectId,
        title: "产品策略师 · 自领一条可执行任务",
        description: "把当前需求整理成一版可执行的结构化判断。",
        status: "ready",
        ownerAgentId: worker.id,
        ownerAgentName: worker.name,
        stageLabel: "团队推进",
        acceptanceCriteria: "交回一版清楚的结构化判断。",
        queuedStatus: null,
        dependsOnTaskIds: [],
        inputArtifactIds: [],
        blockedByTaskId: null,
        blockedReason: null,
        lockScopePaths: [],
        lockStatus: "none",
        lockBlockedByTaskId: null,
        resultSummary: null,
        artifactIds: [],
        createdAt: "2026-03-23T00:00:00.000Z",
        updatedAt: "2026-03-23T00:00:00.000Z",
        claimedAt: null,
        recoveryAttemptCount: 0,
        ownerReplacementCount: 0,
        lastReassignedAt: null,
        lastReassignmentReason: null,
        leaseAcquiredAt: null,
        leaseHeartbeatAt: null,
        leaseExpiresAt: null,
        startedAt: null,
        completedAt: null,
      },
      ...rawState.tasks.filter((task) => task.projectId !== projectId),
    ];
    rawState.agents = rawState.agents.map((agent) =>
      agent.id === worker.id
        ? {
            ...agent,
            status: "idle",
            currentTaskId: null,
            blockedByAgentId: null,
          }
        : agent.projectId === projectId && agent.canDelegate
          ? {
              ...agent,
              status: "planning",
              currentTaskId: null,
            }
          : agent,
    );

    writeFileSync(storePath, JSON.stringify(rawState, null, 2));

    await projectStore.replyToProjectConversation({
      projectId,
      conversationId: "conversation-self-claim",
      content: "现在进展如何？",
    });

    const detail = projectStore.getProjectDetail(projectId);

    if (!detail?.project) {
      throw new Error("detail.project should exist after self-claim normalization");
    }

    const claimedTask = detail.tasks.find((task) => task.id === `${projectId}-task-self-claim`) ?? null;
    const selfClaimThread =
      detail.mailboxThreads.find((thread) => thread.kind === "self_claim") ?? null;
    const claimedWorker =
      detail.agents.find((agent) => agent.agentProfileId === "product-strategist") ?? null;

    expect(claimedTask?.status).toBe("claimed");
    expect(claimedWorker?.currentTaskId).toBe(`${projectId}-task-self-claim`);
    expect(claimedWorker?.status).toBe("working");
    expect(selfClaimThread).not.toBeNull();
    expect(selfClaimThread?.status).toBe("open");
  });

  it("opens a structured escalation thread when a worker execution fails", async () => {
    const tempHome = mkdtempSync(path.join(os.tmpdir(), "opencrab-phase6-"));
    const workspaceDir = path.join(tempHome, "workspace");
    tempHomes.push(tempHome);
    process.env.OPENCRAB_HOME = tempHome;

    queueConversationReplies([
      JSON.stringify({
        decision: "delegate",
        group_reply: "先由 @产品策略师 处理这一棒，我等结果回来后再判断下一步。",
        checkpoint_summary: "",
        delegations: [
          {
            agentName: "产品策略师",
            task: "基于当前目标给出第一版结构化判断。",
            artifactTitles: ["团队目标"],
          },
        ],
      }),
      new Error("工作区写入失败"),
    ]);

    const projectStore = await loadProjectStore();
    const created = projectStore.createProject({
      goal: "验证 Phase 6 的异常升级链路",
      workspaceDir,
      agentProfileIds: ["project-manager", "product-strategist"],
    });
    const projectId = created?.project?.id ?? null;

    expect(projectId).toBeTruthy();

    if (!projectId) {
      throw new Error("projectId should exist after createProject");
    }

    await projectStore.runProject(projectId, {
      triggerLabel: "启动异常用例",
      triggerPrompt: "推进这一轮，如果成员出错要把异常结构化地升级出来。",
    });
    await waitForProjectRuntime(projectId);

    const detail = projectStore.getProjectDetail(projectId);
    const escalationThread =
      detail?.mailboxThreads.find((thread) => thread.kind === "escalation") ?? null;

    if (!detail?.project) {
      throw new Error("detail.project should exist after escalation");
    }

    expect(detail.project.runStatus).toBe("waiting_user");
    expect(detail.project.currentStageLabel).toBe("等待你补充");
    expect(detail.tasks.some((task) => task.status === "cancelled")).toBe(true);
    expect(escalationThread).not.toBeNull();
    expect(escalationThread?.status).toBe("open");
    expect(escalationThread?.summary).toContain("工作区写入失败");
  });
});
