import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it, vi } from "vitest";
import {
  seedTestTeamAgents,
  STRATEGY_AGENT_ID,
  STRATEGY_AGENT_NAME,
  WRITER_AGENT_ID,
  WRITER_AGENT_NAME,
} from "@/tests/helpers/team-agents";
import {
  loadProjectStore,
  queueConversationReplies,
  setupProjectStoreTestHome,
  waitForProjectRuntime,
} from "@/tests/helpers/project-store-runtime";

const runConversationTurnMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/conversations/run-conversation-turn", () => ({
  runConversationTurn: runConversationTurnMock,
}));

const { createTempHome } = setupProjectStoreTestHome(runConversationTurnMock);

describe("project store runtime operations", () => {

  it("records structured heartbeat snapshots and run history during a normal run", async () => {
    const { tempHome, workspaceDir } = createTempHome("opencrab-project-runtime-");
    seedTestTeamAgents(tempHome);

    queueConversationReplies(runConversationTurnMock, [
      JSON.stringify({
        decision: "delegate",
        group_reply: `先由 @${STRATEGY_AGENT_NAME} 输出这一轮结构化判断，我拿到结果后再收束成 checkpoint。`,
        checkpoint_summary: "",
        delegations: [
          {
            agentName: STRATEGY_AGENT_NAME,
            task: "围绕当前目标给出一版结构化判断，明确范围、风险和下一步建议。",
            artifactTitles: ["团队目标"],
          },
        ],
      }),
      "我已经给出一版结构化判断，包含范围、风险和下一步建议。",
      JSON.stringify({
        decision: "waiting_approval",
        group_reply: "这一轮已经拿到足够稳定的阶段结果了，你可以确认结束，或者继续补充方向。",
        checkpoint_summary: "团队已经完成这一轮结构化判断，当前有可交付的阶段结果，等待用户确认或补充。",
        delegations: [],
      }),
    ], {
      threadPrefix: "runtime-thread",
      thinkingPrefix: "runtime-step",
    });

    const projectStore = await loadProjectStore();
    const created = projectStore.createProject({
      goal: "验证运行健康对象和 run log",
      workspaceDir,
      agentProfileIds: ["project-manager", STRATEGY_AGENT_ID],
    });
    const projectId = created?.project?.id ?? null;

    expect(projectId).toBeTruthy();

    if (!projectId) {
      throw new Error("projectId should exist after createProject");
    }

    await projectStore.runProject(projectId, {
      triggerLabel: "启动健康用例",
      triggerPrompt: "推进这一轮，并留下结构化 heartbeat 和 run log。",
    });
    await waitForProjectRuntime(projectId);

    const detail = projectStore.getProjectDetail(projectId);

    if (!detail?.project) {
      throw new Error("detail.project should exist after runtime");
    }

    const managerName =
      created?.agents.find((agent) => agent.agentProfileId === "project-manager")?.name ?? "PD-小马哥";

    expect(detail.project.runStatus).toBe("waiting_approval");
    expect(detail.runs.length).toBe(1);
    expect(detail.runs[0]?.status).toBe("waiting_approval");
    expect(detail.heartbeats.length).toBeGreaterThanOrEqual(2);
    expect(detail.heartbeats.some((heartbeat) => heartbeat.agentName === managerName)).toBe(true);
    expect(detail.heartbeats.some((heartbeat) => heartbeat.agentName === STRATEGY_AGENT_NAME)).toBe(true);
    expect(detail.stuckSignals).toHaveLength(0);
  });

  it("reassigns a stalled task to a peer and records stuck / recovery signals", async () => {
    const { tempHome, workspaceDir } = createTempHome("opencrab-project-runtime-");
    seedTestTeamAgents(tempHome);

    queueConversationReplies(runConversationTurnMock, [
      "我已经接住这一棒，并把阶段结果整理好了。",
      JSON.stringify({
        decision: "waiting_approval",
        group_reply: "卡住的这一棒已经由替补成员接住并交回结果了，你可以先确认这轮输出。",
        checkpoint_summary: "团队已通过替补成员完成这一棒恢复，当前已有新的阶段结果，等待用户确认。",
        delegations: [],
      }),
    ], {
      threadPrefix: "runtime-thread",
      thinkingPrefix: "runtime-step",
    });

    const projectStore = await loadProjectStore();
    const created = projectStore.createProject({
      goal: "验证替补成员继续推进",
      workspaceDir,
      agentProfileIds: ["project-manager", STRATEGY_AGENT_ID, WRITER_AGENT_ID],
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
      heartbeats: Array<Record<string, unknown>>;
      stuckSignals: Array<Record<string, unknown>>;
      recoveryActions: Array<Record<string, unknown>>;
      events: Array<Record<string, unknown>>;
      artifacts: Array<Record<string, unknown>>;
      reviews: Array<Record<string, unknown>>;
      runs: Array<Record<string, unknown>>;
    };
    const failedWorker =
      rawState.agents.find(
        (agent) => agent.projectId === projectId && agent.agentProfileId === STRATEGY_AGENT_ID,
      ) ?? null;
    const replacementWorker =
      rawState.agents.find(
        (agent) => agent.projectId === projectId && agent.agentProfileId === WRITER_AGENT_ID,
      ) ?? null;
    const manager =
      rawState.agents.find(
        (agent) => agent.projectId === projectId && agent.agentProfileId === "project-manager",
      ) ?? null;

    if (!failedWorker || !replacementWorker || !manager) {
      throw new Error("project should contain manager, failed worker and replacement worker");
    }

    rawState.rooms = rawState.rooms.map((room) =>
      room.id === projectId
        ? {
            ...room,
            status: "active",
            runStatus: "running",
            activeAgentId: failedWorker.id,
            nextAgentId: replacementWorker.id,
            currentStageLabel: "开发实现",
          }
        : room,
    );
    rawState.tasks = [
      {
        id: `${projectId}-task-reassign`,
        projectId,
        title: `${STRATEGY_AGENT_NAME} · 卡住的一棒`,
        description: "把当前需求整理成一版可继续推进的阶段结果。",
        status: "in_progress",
        ownerAgentId: failedWorker.id,
        ownerAgentName: failedWorker.name,
        stageLabel: "开发实现",
        acceptanceCriteria: "交回一版能让 PM 继续判断的阶段结果。",
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
        claimedAt: "2026-03-23T00:00:00.000Z",
        recoveryAttemptCount: 1,
        ownerReplacementCount: 0,
        lastReassignedAt: null,
        lastReassignmentReason: null,
        leaseAcquiredAt: "2026-03-23T00:00:00.000Z",
        leaseHeartbeatAt: "2026-03-23T00:00:00.000Z",
        leaseExpiresAt: "2026-03-23T00:01:00.000Z",
        startedAt: "2026-03-23T00:00:00.000Z",
        completedAt: null,
      },
      ...rawState.tasks.filter((task) => task.projectId !== projectId),
    ];
    rawState.agents = rawState.agents.map((agent) => {
      if (agent.id === failedWorker.id) {
        return {
          ...agent,
          status: "working",
          currentTaskId: `${projectId}-task-reassign`,
          lastAssignedTask: "把当前需求整理成一版可继续推进的阶段结果。",
          runtimeConversationId: null,
          blockedByAgentId: null,
        };
      }

      if (agent.id === replacementWorker.id) {
        return {
          ...agent,
          status: "idle",
          currentTaskId: null,
          blockedByAgentId: null,
        };
      }

      if (agent.id === manager.id) {
        return {
          ...agent,
          status: "planning",
          currentTaskId: null,
        };
      }

      return agent;
    });
    rawState.runs = [
      {
        id: `${projectId}-run-recovery`,
        projectId,
        status: "running",
        triggerLabel: "恢复运行",
        summary: "当前这轮仍在运行中。",
        currentStepLabel: "等待成员交回结果",
        startedAt: "2026-03-23T00:00:00.000Z",
        finishedAt: null,
      },
      ...rawState.runs.filter((run) => run.projectId !== projectId),
    ];

    writeFileSync(storePath, JSON.stringify(rawState, null, 2));

    await projectStore.replyToProjectConversation({
      projectId,
      conversationId: "conversation-recovery",
      content: "现在进展如何？",
    });
    await waitForProjectRuntime(projectId);

    const detail = projectStore.getProjectDetail(projectId);

    if (!detail?.project) {
      throw new Error("detail.project should exist after recovery");
    }

    const reassignedTask = detail.tasks.find((task) => task.id === `${projectId}-task-reassign`) ?? null;

    expect(detail.project.runStatus).toBe("waiting_approval");
    expect(reassignedTask?.ownerAgentName).toBe(WRITER_AGENT_NAME);
    expect(detail.recoveryActions.some((action) => action.kind === "reassign_to_peer")).toBe(true);
    expect(detail.stuckSignals.some((signal) => signal.status === "resolved")).toBe(true);
    expect(
      detail.mailboxThreads.some(
        (thread) => thread.kind === "direct_message" && thread.subject.includes("PM 改派"),
      ),
    ).toBe(true);
    expect(detail.heartbeats.some((heartbeat) => heartbeat.agentName === WRITER_AGENT_NAME)).toBe(true);
  });

  it("rolls back to the latest checkpoint and starts a fresh rerun", async () => {
    const { tempHome, workspaceDir } = createTempHome("opencrab-project-runtime-");
    seedTestTeamAgents(tempHome);

    queueConversationReplies(runConversationTurnMock, [
      JSON.stringify({
        decision: "delegate",
        group_reply: `先由 @${STRATEGY_AGENT_NAME} 整理第一版阶段判断，我拿到 checkpoint 后再决定是否继续派工。`,
        checkpoint_summary: "",
        delegations: [
          {
            agentName: STRATEGY_AGENT_NAME,
            task: "整理一版阶段判断，明确里程碑、风险和下一步。",
            artifactTitles: ["团队目标"],
          },
        ],
      }),
      "我已经整理出第一版阶段判断，包含里程碑、风险和下一步建议。",
      JSON.stringify({
        decision: "waiting_approval",
        group_reply: "这一轮已经有可交付的阶段判断了，你可以确认结束，或者让我继续补充。",
        checkpoint_summary: "团队已经交出一版阶段判断，当前 checkpoint 可供用户确认或作为重跑基线。",
        delegations: [],
      }),
      JSON.stringify({
        decision: "waiting_approval",
        group_reply: "我已经基于刚才的 checkpoint 重新启动并重整了一轮，现在可以再次确认。",
        checkpoint_summary: "团队已从最近 checkpoint 重跑一轮，并按新的要求重整了当前阶段结论。",
        delegations: [],
      }),
    ], {
      threadPrefix: "runtime-thread",
      thinkingPrefix: "runtime-step",
    });

    const projectStore = await loadProjectStore();
    const created = projectStore.createProject({
      goal: "验证 checkpoint rollback 后重跑",
      workspaceDir,
      agentProfileIds: ["project-manager", STRATEGY_AGENT_ID],
    });
    const projectId = created?.project?.id ?? null;

    expect(projectId).toBeTruthy();

    if (!projectId) {
      throw new Error("projectId should exist after createProject");
    }

    await projectStore.runProject(projectId, {
      triggerLabel: "启动 rollback 用例",
      triggerPrompt: "先推进到 checkpoint，再从 checkpoint 重跑。",
    });
    await waitForProjectRuntime(projectId);

    const beforeRollback = projectStore.getProjectDetail(projectId);

    if (!beforeRollback?.project) {
      throw new Error("beforeRollback.project should exist after first runtime");
    }

    expect(beforeRollback.project.runStatus).toBe("waiting_approval");
    expect(beforeRollback.runs).toHaveLength(1);

    await projectStore.updateProjectCheckpoint(projectId, {
      action: "rollback",
      note: "重跑时把重点改成里程碑风险和恢复路径。",
    });
    await waitForProjectRuntime(projectId);

    const detail = projectStore.getProjectDetail(projectId);

    if (!detail?.project) {
      throw new Error("detail.project should exist after rollback rerun");
    }

    expect(detail.project.runStatus).toBe("waiting_approval");
    expect(detail.runs).toHaveLength(2);
    expect(detail.runs[0]?.triggerLabel).toBe("从 checkpoint 重跑");
    expect(detail.runs[0]?.status).toBe("waiting_approval");
    expect(detail.runs[1]?.finishedAt).toBeTruthy();
    expect(detail.runs[1]?.currentStepLabel).toBe("已从最近 checkpoint 重跑");
    expect(detail.recoveryActions.some((action) => action.kind === "rollback_to_checkpoint")).toBe(true);
    expect(
      detail.events.some((event) => event.title === "已要求从最近 checkpoint 重跑"),
    ).toBe(true);
  });

  it("derives task, review, run, and recovery insights for the projects overview list", async () => {
    const { tempHome, workspaceDir } = createTempHome("opencrab-project-runtime-");
    seedTestTeamAgents(tempHome);

    const projectStore = await loadProjectStore();
    const created = projectStore.createProject({
      goal: "验证列表页联动字段",
      workspaceDir,
      agentProfileIds: ["project-manager", STRATEGY_AGENT_ID],
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
      heartbeats: Array<Record<string, unknown>>;
      stuckSignals: Array<Record<string, unknown>>;
      recoveryActions: Array<Record<string, unknown>>;
      events: Array<Record<string, unknown>>;
      artifacts: Array<Record<string, unknown>>;
      reviews: Array<Record<string, unknown>>;
      runs: Array<Record<string, unknown>>;
    };
    const worker =
      rawState.agents.find(
        (agent) => agent.projectId === projectId && agent.agentProfileId === STRATEGY_AGENT_ID,
      ) ?? null;

    if (!worker) {
      throw new Error("worker should exist in seeded project state");
    }

    rawState.rooms = rawState.rooms.map((room) =>
      room.id === projectId
        ? {
            ...room,
            runStatus: "running",
            currentStageLabel: "开发实现",
            lastActivityLabel: `${STRATEGY_AGENT_NAME}正在推进`,
          }
        : room,
    );
    rawState.tasks = [
      {
        id: `${projectId}-task-active`,
        projectId,
        title: "整理首页改版的主任务",
        description: "给出当前这一轮最核心的结构化判断。",
        status: "in_progress",
        ownerAgentId: worker.id,
        ownerAgentName: worker.name,
        stageLabel: "开发实现",
        acceptanceCriteria: "形成可继续推进的阶段结果。",
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
        updatedAt: "2026-03-23T00:10:00.000Z",
        claimedAt: "2026-03-23T00:00:00.000Z",
        recoveryAttemptCount: 0,
        ownerReplacementCount: 0,
        lastReassignedAt: null,
        lastReassignmentReason: null,
        leaseAcquiredAt: "2026-03-23T00:00:00.000Z",
        leaseHeartbeatAt: "2026-03-23T00:08:00.000Z",
        leaseExpiresAt: "2026-03-23T00:14:00.000Z",
        startedAt: "2026-03-23T00:01:00.000Z",
        completedAt: null,
      },
      {
        id: `${projectId}-task-blocked`,
        projectId,
        title: "等待上游产出的下一棒",
        description: "拿到上游结果后再继续。",
        status: "blocked",
        ownerAgentId: worker.id,
        ownerAgentName: worker.name,
        stageLabel: "结果整理",
        acceptanceCriteria: "上游完成后可恢复。",
        queuedStatus: "ready",
        dependsOnTaskIds: [`${projectId}-task-active`],
        inputArtifactIds: [],
        blockedByTaskId: `${projectId}-task-active`,
        blockedReason: "等待上游成员完成当前这一棒。",
        lockScopePaths: [],
        lockStatus: "none",
        lockBlockedByTaskId: null,
        resultSummary: null,
        artifactIds: [],
        createdAt: "2026-03-23T00:00:00.000Z",
        updatedAt: "2026-03-23T00:09:00.000Z",
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
    rawState.reviews = [
      {
        id: `${projectId}-review-overview`,
        projectId,
        taskId: `${projectId}-task-active`,
        taskTitle: "整理首页改版的主任务",
        reviewTargetLabel: "阶段结果",
        requesterAgentId: worker.id,
        requesterAgentName: worker.name,
        reviewerAgentId: null,
        reviewerAgentName: "你",
        status: "pending",
        summary: "等待确认当前阶段输出。",
        blockingComments: null,
        followUpTaskId: null,
        createdAt: "2026-03-23T00:10:00.000Z",
        updatedAt: "2026-03-23T00:10:00.000Z",
        completedAt: null,
      },
      ...rawState.reviews.filter((review) => review.projectId !== projectId),
    ];
    rawState.stuckSignals = [
      {
        id: `${projectId}-stuck-overview`,
        projectId,
        agentId: worker.id,
        agentName: worker.name,
        taskId: `${projectId}-task-active`,
        taskTitle: "整理首页改版的主任务",
        kind: "reply_timeout",
        status: "open",
        summary: "这条任务已经超过预期回传窗口。",
        detectedAt: "2026-03-23T00:11:00.000Z",
        updatedAt: "2026-03-23T00:11:00.000Z",
        resolvedAt: null,
      },
      ...rawState.stuckSignals.filter((signal) => signal.projectId !== projectId),
    ];
    rawState.recoveryActions = [
      {
        id: `${projectId}-recovery-overview`,
        projectId,
        kind: "rollback_to_checkpoint",
        summary: "项目经理刚从最近 checkpoint 规划了一次重跑。",
        taskId: `${projectId}-task-active`,
        taskTitle: "整理首页改版的主任务",
        fromAgentId: null,
        fromAgentName: "项目经理",
        toAgentId: null,
        toAgentName: "项目经理",
        createdAt: "2026-03-23T00:12:00.000Z",
      },
      ...rawState.recoveryActions.filter((action) => action.projectId !== projectId),
    ];
    rawState.runs = [
      {
        id: `${projectId}-run-overview`,
        projectId,
        status: "running",
        triggerLabel: "列表页联动用例",
        summary: "团队正在推进当前这轮运行。",
        currentStepLabel: `等待${STRATEGY_AGENT_NAME}交回当前这一棒`,
        startedAt: "2026-03-23T00:00:00.000Z",
        finishedAt: null,
      },
      ...rawState.runs.filter((run) => run.projectId !== projectId),
    ];

    writeFileSync(storePath, JSON.stringify(rawState, null, 2));

    const projects = projectStore.listProjects();
    const project = projects.find((item) => item.id === projectId) ?? null;

    expect(project).toBeTruthy();
    expect(project?.activeTaskTitle).toBe("整理首页改版的主任务");
    expect(project?.activeTaskStatus).toBe("in_progress");
    expect(project?.openTaskCount).toBe(2);
    expect(project?.pendingReviewCount).toBe(1);
    expect(project?.openStuckSignalCount).toBe(1);
    expect(project?.latestRecoveryKind).toBe("rollback_to_checkpoint");
    expect(project?.latestRunStepLabel).toBe(`等待${STRATEGY_AGENT_NAME}交回当前这一棒`);
    expect(project?.latestRecoverySummary).toContain("checkpoint");
  });
});
