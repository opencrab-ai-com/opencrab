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

    input.onThreadReady?.(`thread-phase8-${index}`);
    input.onThinking?.([`phase8-step-${index}`]);

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

describe("project store phase 8 memory layer", () => {
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

  it("persists project memory and injects it into the next manager prompt", async () => {
    const tempHome = mkdtempSync(path.join(os.tmpdir(), "opencrab-phase8-"));
    const workspaceDir = path.join(tempHome, "workspace");
    tempHomes.push(tempHome);
    process.env.OPENCRAB_HOME = tempHome;

    queueConversationReplies([
      JSON.stringify({
        decision: "delegate",
        group_reply: "先由 @产品策略师 输出阶段判断，我拿到结果后再收束成 checkpoint。",
        checkpoint_summary: "",
        delegations: [
          {
            agentName: "产品策略师",
            task: "整理一版阶段判断，明确当前范围、里程碑风险和下一步建议。",
            artifactTitles: ["团队目标"],
          },
        ],
      }),
      "我已经整理出当前范围、里程碑风险和下一步建议。",
      JSON.stringify({
        decision: "waiting_approval",
        group_reply: "这一轮已经有可交付的阶段判断了，你可以确认结束，或者告诉我还要补什么。",
        checkpoint_summary: "团队已经交出一版阶段判断，当前可进入待确认 checkpoint。",
        delegations: [],
      }),
      JSON.stringify({
        decision: "waiting_approval",
        group_reply: "我已经带着新的偏好重新判断了一轮，现在可以再次确认。",
        checkpoint_summary: "团队已把新的用户偏好合进本轮判断，当前 checkpoint 已更新。",
        delegations: [],
      }),
    ]);

    const projectStore = await loadProjectStore();
    const created = projectStore.createProject({
      goal: "验证 Phase 8 的项目记忆会影响下一轮判断",
      workspaceDir,
      agentProfileIds: ["project-manager", "product-strategist"],
    });
    const projectId = created?.project?.id ?? null;

    expect(projectId).toBeTruthy();

    if (!projectId) {
      throw new Error("projectId should exist after createProject");
    }

    await projectStore.runProject(projectId, {
      triggerLabel: "启动 memory 用例",
      triggerPrompt: "先推进到 checkpoint。",
    });
    await waitForProjectRuntime(projectId);

    await projectStore.updateProjectCheckpoint(projectId, {
      action: "request_changes",
      note: "后续更强调里程碑风险、可交付时间和依赖项。",
    });

    const beforeResume = projectStore.getProjectDetail(projectId);

    expect(beforeResume?.project?.runStatus).toBe("waiting_user");
    expect(beforeResume?.projectMemory?.preferences.some((entry) => entry.summary.includes("里程碑风险"))).toBe(true);

    await projectStore.updateProjectCheckpoint(projectId, {
      action: "resume",
      note: "后续更强调里程碑风险、可交付时间和依赖项。",
    });
    await waitForProjectRuntime(projectId);

    const detail = projectStore.getProjectDetail(projectId);

    if (!detail?.project || !detail.projectMemory) {
      throw new Error("detail and project memory should exist after resume");
    }

    const resumeManagerPrompt = runConversationTurnMock.mock.calls[3]?.[0]?.content ?? "";

    expect(detail.project.runStatus).toBe("waiting_approval");
    expect(detail.projectMemory.decisions.length).toBeGreaterThan(0);
    expect(detail.projectMemory.preferences.some((entry) => entry.summary.includes("里程碑风险"))).toBe(true);
    expect(resumeManagerPrompt).toContain("Memory Layer");
    expect(resumeManagerPrompt).toContain("项目记忆 / 偏好");
    expect(resumeManagerPrompt).toContain("里程碑风险、可交付时间和依赖项");
  });

  it("derives team memory and role memory from handoffs, blockers, reviews, and recovery actions", async () => {
    const tempHome = mkdtempSync(path.join(os.tmpdir(), "opencrab-phase8-"));
    const workspaceDir = path.join(tempHome, "workspace");
    tempHomes.push(tempHome);
    process.env.OPENCRAB_HOME = tempHome;

    const projectStore = await loadProjectStore();
    const created = projectStore.createProject({
      goal: "验证团队记忆和角色记忆",
      workspaceDir,
      agentProfileIds: ["project-manager", "product-strategist", "writer-editor"],
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
      projectMemories: Array<Record<string, unknown>>;
      teamMemories: Array<Record<string, unknown>>;
      roleMemories: Array<Record<string, unknown>>;
      heartbeats: Array<Record<string, unknown>>;
      stuckSignals: Array<Record<string, unknown>>;
      recoveryActions: Array<Record<string, unknown>>;
      events: Array<Record<string, unknown>>;
      artifacts: Array<Record<string, unknown>>;
      reviews: Array<Record<string, unknown>>;
      runs: Array<Record<string, unknown>>;
    };
    const manager =
      rawState.agents.find(
        (agent) => agent.projectId === projectId && agent.agentProfileId === "project-manager",
      ) ?? null;
    const strategist =
      rawState.agents.find(
        (agent) => agent.projectId === projectId && agent.agentProfileId === "product-strategist",
      ) ?? null;
    const writer =
      rawState.agents.find(
        (agent) => agent.projectId === projectId && agent.agentProfileId === "writer-editor",
      ) ?? null;

    if (!manager || !strategist || !writer) {
      throw new Error("manager, strategist and writer should exist");
    }

    rawState.rooms = rawState.rooms.map((room) =>
      room.id === projectId
        ? {
            ...room,
            status: "active",
            runStatus: "running",
            currentStageLabel: "结果整理",
            activeAgentId: writer.id,
            nextAgentId: null,
          }
        : room,
    );
    rawState.tasks = [
      {
        id: `${projectId}-task-strategy`,
        projectId,
        title: "产品策略师整理阶段判断",
        description: "先产出当前这一轮的结构化判断。",
        status: "completed",
        ownerAgentId: strategist.id,
        ownerAgentName: strategist.name,
        stageLabel: "产品定义",
        acceptanceCriteria: "给到后续成员可直接复用的阶段结果。",
        queuedStatus: null,
        dependsOnTaskIds: [],
        inputArtifactIds: [],
        blockedByTaskId: null,
        blockedReason: null,
        lockScopePaths: [],
        lockStatus: "none",
        lockBlockedByTaskId: null,
        resultSummary: "已经整理出结构化判断。",
        artifactIds: [],
        createdAt: "2026-03-23T00:00:00.000Z",
        updatedAt: "2026-03-23T00:10:00.000Z",
        claimedAt: "2026-03-23T00:00:00.000Z",
        recoveryAttemptCount: 0,
        ownerReplacementCount: 0,
        lastReassignedAt: null,
        lastReassignmentReason: null,
        leaseAcquiredAt: "2026-03-23T00:00:00.000Z",
        leaseHeartbeatAt: "2026-03-23T00:08:00.000Z",
        leaseExpiresAt: "2026-03-23T00:16:00.000Z",
        startedAt: "2026-03-23T00:01:00.000Z",
        completedAt: "2026-03-23T00:10:00.000Z",
      },
      {
        id: `${projectId}-task-writer`,
        projectId,
        title: "表达整理师整理阶段总结",
        description: "在上游结果基础上整理成可直接确认的总结。",
        status: "blocked",
        ownerAgentId: writer.id,
        ownerAgentName: writer.name,
        stageLabel: "结果整理",
        acceptanceCriteria: "形成可确认的阶段总结。",
        queuedStatus: "ready",
        dependsOnTaskIds: [`${projectId}-task-strategy`],
        inputArtifactIds: [],
        blockedByTaskId: `${projectId}-task-strategy`,
        blockedReason: "等待产品策略师补齐里程碑风险和依赖项。",
        lockScopePaths: [],
        lockStatus: "none",
        lockBlockedByTaskId: null,
        resultSummary: null,
        artifactIds: [],
        createdAt: "2026-03-23T00:00:00.000Z",
        updatedAt: "2026-03-23T00:11:00.000Z",
        claimedAt: null,
        recoveryAttemptCount: 1,
        ownerReplacementCount: 1,
        lastReassignedAt: "2026-03-23T00:11:00.000Z",
        lastReassignmentReason: "上一版输入不够完整，需要补齐里程碑风险和依赖项。",
        leaseAcquiredAt: null,
        leaseHeartbeatAt: null,
        leaseExpiresAt: null,
        startedAt: null,
        completedAt: null,
      },
      ...rawState.tasks.filter((task) => task.projectId !== projectId),
    ];
    rawState.reviews = [
      {
        id: `${projectId}-review-memory`,
        projectId,
        taskId: `${projectId}-task-strategy`,
        taskTitle: "产品策略师整理阶段判断",
        reviewTargetLabel: "阶段判断",
        requesterAgentId: strategist.id,
        requesterAgentName: strategist.name,
        reviewerAgentId: manager.id,
        reviewerAgentName: manager.name,
        status: "changes_requested",
        summary: "需要把结果改得更适合下一棒继续推进。",
        blockingComments: "缺少里程碑风险和依赖项，导致下游很难直接接棒。",
        followUpTaskId: `${projectId}-task-writer`,
        createdAt: "2026-03-23T00:10:00.000Z",
        updatedAt: "2026-03-23T00:12:00.000Z",
        completedAt: "2026-03-23T00:12:00.000Z",
      },
      ...rawState.reviews.filter((review) => review.projectId !== projectId),
    ];
    rawState.stuckSignals = [
      {
        id: `${projectId}-stuck-memory`,
        projectId,
        agentId: writer.id,
        agentName: writer.name,
        taskId: `${projectId}-task-writer`,
        taskTitle: "表达整理师整理阶段总结",
        kind: "reply_timeout",
        status: "resolved",
        summary: "这条任务一度卡在等上游输入，回传超时。",
        detectedAt: "2026-03-23T00:11:00.000Z",
        updatedAt: "2026-03-23T00:12:00.000Z",
        resolvedAt: "2026-03-23T00:12:00.000Z",
      },
      ...rawState.stuckSignals.filter((signal) => signal.projectId !== projectId),
    ];
    rawState.recoveryActions = [
      {
        id: `${projectId}-recovery-memory`,
        projectId,
        kind: "reassign_to_peer",
        summary: "项目经理曾把这条任务改派给更适合整理对外表达的成员继续。",
        taskId: `${projectId}-task-writer`,
        taskTitle: "表达整理师整理阶段总结",
        fromAgentId: strategist.id,
        fromAgentName: strategist.name,
        toAgentId: writer.id,
        toAgentName: writer.name,
        createdAt: "2026-03-23T00:12:30.000Z",
      },
      ...rawState.recoveryActions.filter((action) => action.projectId !== projectId),
    ];
    rawState.runs = [
      {
        id: `${projectId}-run-memory`,
        projectId,
        status: "running",
        triggerLabel: "memory 同步用例",
        summary: "当前仍在推进中。",
        currentStepLabel: "等待表达整理师接住下一棒",
        startedAt: "2026-03-23T00:00:00.000Z",
        finishedAt: null,
      },
      ...rawState.runs.filter((run) => run.projectId !== projectId),
    ];

    writeFileSync(storePath, JSON.stringify(rawState, null, 2));

    await projectStore.updateProjectCheckpoint(projectId, {
      action: "pause",
    });

    const detail = projectStore.getProjectDetail(projectId);

    if (!detail?.projectMemory || !detail.teamMemory) {
      throw new Error("project and team memories should exist after sync");
    }

    expect(detail.projectMemory.risks.some((entry) => entry.summary.includes("里程碑风险"))).toBe(true);
    expect(detail.projectMemory.pitfalls.some((entry) => entry.summary.includes("改派"))).toBe(true);
    expect(detail.teamMemory.handoffPatterns.some((pattern) => pattern.label.includes("产品策略师 -> 表达整理师"))).toBe(true);
    expect(detail.teamMemory.blockerPatterns.some((pattern) => pattern.label.includes("回传超时"))).toBe(true);
    expect(detail.teamMemory.reviewPatterns.some((pattern) => pattern.label.includes("阶段判断"))).toBe(true);
    expect(detail.roleMemories.some((memory) => memory.agentName === "产品策略师" && memory.strengths.length > 0)).toBe(true);
    expect(detail.roleMemories.some((memory) => memory.agentName === "表达整理师" && memory.commonIssues.length > 0)).toBe(true);
  });
});
