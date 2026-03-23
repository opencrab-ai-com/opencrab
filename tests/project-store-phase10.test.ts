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
    content: string;
    onThreadReady?: (threadId: string | null) => void;
    onThinking?: (entries: string[]) => void;
    onAssistantText?: (text: string) => void;
  }) => {
    const nextReply = replies[index++];

    input.onThreadReady?.(`thread-phase10-${index}`);
    input.onThinking?.([`phase10-step-${index}`]);

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

describe("project store phase 10 controlled autonomy", () => {
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

  it("opens an autonomy budget gate after several guarded rounds and lets the user approve more autonomy", async () => {
    const tempHome = mkdtempSync(path.join(os.tmpdir(), "opencrab-phase10-"));
    const workspaceDir = path.join(tempHome, "workspace");
    tempHomes.push(tempHome);
    process.env.OPENCRAB_HOME = tempHome;

    queueConversationReplies([
      JSON.stringify({
        decision: "delegate",
        group_reply: "先由 @产品策略师 做第一棒，我拿到结果后继续安排。",
        checkpoint_summary: "",
        delegations: [
          {
            agentName: "产品策略师",
            task: "给出第一版结构化判断。",
            artifactTitles: ["团队目标"],
          },
        ],
      }),
      "第 1 轮结果：已经完成结构化判断。",
      JSON.stringify({
        decision: "delegate",
        group_reply: "继续由 @产品策略师 往下细化这一轮结果。",
        checkpoint_summary: "",
        delegations: [
          {
            agentName: "产品策略师",
            task: "基于上一轮结果继续细化并补齐关键依赖。",
            artifactTitles: ["团队目标"],
          },
        ],
      }),
      "第 2 轮结果：已经补齐关键依赖。",
      JSON.stringify({
        decision: "delegate",
        group_reply: "再由 @产品策略师 整理成更适合交接的版本。",
        checkpoint_summary: "",
        delegations: [
          {
            agentName: "产品策略师",
            task: "把结果整理成更适合后续交接的版本。",
            artifactTitles: ["团队目标"],
          },
        ],
      }),
      "第 3 轮结果：已经整理成交接版。",
      JSON.stringify({
        decision: "delegate",
        group_reply: "最后再由 @产品策略师 做一轮低风险收口。",
        checkpoint_summary: "",
        delegations: [
          {
            agentName: "产品策略师",
            task: "做一轮低风险收口，确保交接信息完整。",
            artifactTitles: ["团队目标"],
          },
        ],
      }),
      "第 4 轮结果：已经完成低风险收口。",
      JSON.stringify({
        decision: "delegate",
        group_reply: "继续由 @产品策略师 把最后一版整理成可确认的阶段结论。",
        checkpoint_summary: "",
        delegations: [
          {
            agentName: "产品策略师",
            task: "把当前结果整理成可确认的阶段结论。",
            artifactTitles: ["团队目标"],
          },
        ],
      }),
      "第 5 轮结果：已经整理成阶段结论。",
      JSON.stringify({
        decision: "waiting_approval",
        group_reply: "这一轮已经拿到可确认的阶段结论了，你可以直接确认，或者继续补充。",
        checkpoint_summary: "团队已经在继续自治后交出一版可确认的阶段结论。",
        delegations: [],
      }),
    ]);

    const projectStore = await loadProjectStore();
    const created = projectStore.createProject({
      goal: "验证 Phase 10 的自治预算 gate",
      workspaceDir,
      agentProfileIds: ["project-manager", "product-strategist"],
    });
    const projectId = created?.project?.id ?? null;

    expect(projectId).toBeTruthy();

    if (!projectId) {
      throw new Error("projectId should exist after createProject");
    }

    await projectStore.runProject(projectId, {
      triggerLabel: "启动自治预算用例",
      triggerPrompt: "继续推进，直到需要人工放行为止。",
    });
    await waitForProjectRuntime(projectId);

    const gatedDetail = projectStore.getProjectDetail(projectId);

    if (!gatedDetail?.project) {
      throw new Error("gatedDetail.project should exist");
    }

    expect(gatedDetail.project.runStatus).toBe("waiting_approval");
    expect(gatedDetail.project.openGateCount).toBeGreaterThan(0);
    expect(gatedDetail.autonomyGates.some((gate) => gate.kind === "autonomy_budget" && gate.status === "open")).toBe(true);
    expect(gatedDetail.project.autonomyStatus).toBe("gated");

    await projectStore.updateProjectCheckpoint(projectId, {
      action: "approve",
      note: "可以继续，但先做低风险收口。",
    });
    await waitForProjectRuntime(projectId);

    const resumedDetail = projectStore.getProjectDetail(projectId);

    if (!resumedDetail?.project) {
      throw new Error("resumedDetail.project should exist");
    }

    const resumeManagerPrompt = runConversationTurnMock.mock.calls[8]?.[0]?.content ?? "";

    expect(resumeManagerPrompt).toContain("继续在当前安全边界内推进");
    expect(resumedDetail.autonomyGates.some((gate) => gate.kind === "autonomy_budget" && gate.status === "resolved")).toBe(true);
    expect(resumedDetail.project.openGateCount).toBe(0);
    expect(resumedDetail.project.runStatus).toBe("waiting_approval");
  });

  it("auto-executes a self-claimed ready task under the task graph constraint", async () => {
    const tempHome = mkdtempSync(path.join(os.tmpdir(), "opencrab-phase10-"));
    const workspaceDir = path.join(tempHome, "workspace");
    tempHomes.push(tempHome);
    process.env.OPENCRAB_HOME = tempHome;

    queueConversationReplies([
      "这是产品策略师主动接手后给出的第一版结构化判断。",
      JSON.stringify({
        decision: "waiting_approval",
        group_reply: "自领任务的结果已经整理好了，你可以直接确认，或者告诉我还要补什么。",
        checkpoint_summary: "这条自领任务已经完成并交回项目经理。",
        delegations: [],
      }),
    ]);

    const projectStore = await loadProjectStore();
    const created = projectStore.createProject({
      goal: "验证 self-claim 会自动执行",
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
      autonomyGates: Array<Record<string, unknown>>;
      runs: Array<Record<string, unknown>>;
    };
    const manager =
      rawState.agents.find(
        (agent) => agent.projectId === projectId && agent.agentProfileId === "project-manager",
      ) ?? null;
    const worker =
      rawState.agents.find(
        (agent) => agent.projectId === projectId && agent.agentProfileId === "product-strategist",
      ) ?? null;

    if (!manager || !worker) {
      throw new Error("manager and worker should exist");
    }

    rawState.rooms = rawState.rooms.map((room) =>
      room.id === projectId
        ? {
            ...room,
            status: "active",
            runStatus: "running",
            currentStageLabel: "产品定义",
            activeAgentId: worker.id,
            nextAgentId: worker.id,
            autonomyRoundCount: 0,
            autonomyRoundBudget: 4,
            autonomyStatus: "guarded",
            autonomyPauseReason: null,
          }
        : room,
    );
    rawState.tasks = [
      {
        id: `${projectId}-task-self-claim-run`,
        projectId,
        title: "产品策略师整理可交接判断",
        description: "把当前目标整理成一版可继续交接的结构化判断。",
        status: "ready",
        ownerAgentId: worker.id,
        ownerAgentName: worker.name,
        stageLabel: "产品定义",
        acceptanceCriteria: "给到项目经理一版可以继续收束的阶段结果。",
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
            lastAssignedTask: null,
          }
        : agent.id === manager.id
          ? {
              ...agent,
              status: "planning",
              currentTaskId: null,
              blockedByAgentId: null,
            }
          : agent,
    );
    rawState.runs = [
      {
        id: `${projectId}-run-self-claim`,
        projectId,
        status: "running",
        triggerLabel: "self-claim 执行用例",
        summary: "当前正在等待下一棒自动接手。",
        currentStepLabel: "等待任务解锁后的自领执行",
        startedAt: "2026-03-23T00:00:00.000Z",
        finishedAt: null,
      },
      ...rawState.runs.filter((run) => run.projectId !== projectId),
    ];

    writeFileSync(storePath, JSON.stringify(rawState, null, 2));

    await projectStore.replyToProjectConversation({
      projectId,
      conversationId: "conversation-phase10-self-claim",
      content: "现在进展如何？",
    });
    await waitForProjectRuntime(projectId);

    const detail = projectStore.getProjectDetail(projectId);

    if (!detail?.project) {
      throw new Error("detail.project should exist after self-claim run");
    }

    const claimedTask = detail.tasks.find((task) => task.id === `${projectId}-task-self-claim-run`) ?? null;
    const selfClaimThread =
      detail.mailboxThreads.find((thread) => thread.kind === "self_claim" && thread.relatedTaskId === claimedTask?.id) ??
      null;
    const claimedWorker =
      detail.agents.find((agent) => agent.agentProfileId === "product-strategist") ?? null;

    expect(claimedTask?.status).toBe("completed");
    expect(claimedTask?.resultSummary).toContain("第一版结构化判断");
    expect(claimedWorker?.lastResultSummary).toContain("第一版结构化判断");
    expect(selfClaimThread?.status).toBe("resolved");
    expect(detail.project.runStatus).toBe("waiting_approval");
  });
});
