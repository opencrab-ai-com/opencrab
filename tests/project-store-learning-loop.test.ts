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

describe("project store learning loop", () => {

  it("derives reflections and injects learning suggestions into the next manager prompt", async () => {
    const { tempHome, workspaceDir } = createTempHome("opencrab-project-learning-");
    seedTestTeamAgents(tempHome);

    queueConversationReplies(runConversationTurnMock, [
      JSON.stringify({
        decision: "delegate",
        group_reply: `先由 @${STRATEGY_AGENT_NAME} 输出阶段判断，我拿到结果后再收束。`,
        checkpoint_summary: "",
        delegations: [
          {
            agentName: STRATEGY_AGENT_NAME,
            task: "整理一版阶段判断，明确当前范围、依赖、里程碑风险和下一步建议。",
            artifactTitles: ["团队目标"],
          },
        ],
      }),
      "我已经整理出当前范围、依赖、里程碑风险和下一步建议。",
      JSON.stringify({
        decision: "waiting_approval",
        group_reply: "这一轮已经有可交付的阶段判断了，你可以确认结束，或者告诉我还要补什么。",
        checkpoint_summary: "团队已经交出一版阶段判断，当前可进入待确认 checkpoint。",
        delegations: [],
      }),
      JSON.stringify({
        decision: "waiting_approval",
        group_reply: "我已经带着上一轮复盘和建议重新判断了一轮，现在可以再次确认。",
        checkpoint_summary: "团队已把上一轮 learning loop 的提醒合进本轮判断。",
        delegations: [],
      }),
    ], {
      threadPrefix: "learning-thread",
      thinkingPrefix: "learning-step",
    });

    const projectStore = await loadProjectStore();
    const created = projectStore.createProject({
      goal: "验证 learning loop 会影响下一轮派工判断",
      workspaceDir,
      agentProfileIds: ["project-manager", STRATEGY_AGENT_ID],
    });
    const projectId = created?.project?.id ?? null;

    expect(projectId).toBeTruthy();

    if (!projectId) {
      throw new Error("projectId should exist after createProject");
    }

    await projectStore.runProject(projectId, {
      triggerLabel: "启动 learning 用例",
      triggerPrompt: "先推进到 checkpoint。",
    });
    await waitForProjectRuntime(projectId);

    await projectStore.updateProjectCheckpoint(projectId, {
      action: "request_changes",
      note: "下一轮请更明确写出风险、依赖和验收标准。",
    });

    const waitingDetail = projectStore.getProjectDetail(projectId);

    if (!waitingDetail?.project) {
      throw new Error("waiting detail should exist");
    }

    expect(waitingDetail.project.runStatus).toBe("waiting_user");
    expect(waitingDetail.taskReflections.length).toBeGreaterThan(0);
    expect(waitingDetail.stageReflections.length).toBeGreaterThan(0);
    expect(waitingDetail.runSummaries.length).toBeGreaterThan(0);
    expect(waitingDetail.learningSuggestions.length).toBeGreaterThan(0);

    await projectStore.updateProjectCheckpoint(projectId, {
      action: "resume",
      note: "下一轮请更明确写出风险、依赖和验收标准。",
    });
    await waitForProjectRuntime(projectId);

    const detail = projectStore.getProjectDetail(projectId);

    if (!detail?.project) {
      throw new Error("detail.project should exist after resume");
    }

    const resumeManagerPrompt = runConversationTurnMock.mock.calls[3]?.[0]?.content ?? "";

    expect(detail.project.runStatus).toBe("waiting_approval");
    expect(resumeManagerPrompt).toContain("Learning Loop");
    expect(resumeManagerPrompt).toContain("任务模板建议");
    expect(
      resumeManagerPrompt.includes("失败模式") ||
        resumeManagerPrompt.includes("角色调优建议") ||
        resumeManagerPrompt.includes("质量闸门建议"),
    ).toBe(true);
  });

  it("builds task reflections, stage reflections, run summaries, and six suggestion kinds from seeded project state", async () => {
    const { tempHome, workspaceDir } = createTempHome("opencrab-project-learning-");
    seedTestTeamAgents(tempHome);

    const projectStore = await loadProjectStore();
    const created = projectStore.createProject({
      goal: "验证 learning loop 的结构化对象",
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
      projectMemories: Array<Record<string, unknown>>;
      teamMemories: Array<Record<string, unknown>>;
      roleMemories: Array<Record<string, unknown>>;
      taskReflections: Array<Record<string, unknown>>;
      stageReflections: Array<Record<string, unknown>>;
      runSummaries: Array<Record<string, unknown>>;
      learningSuggestions: Array<Record<string, unknown>>;
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
        (agent) => agent.projectId === projectId && agent.agentProfileId === STRATEGY_AGENT_ID,
      ) ?? null;
    const writer =
      rawState.agents.find(
        (agent) => agent.projectId === projectId && agent.agentProfileId === WRITER_AGENT_ID,
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
        title: `${STRATEGY_AGENT_NAME}整理阶段判断`,
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
        title: `${WRITER_AGENT_NAME}整理阶段总结`,
        description: "在上游结果基础上整理成可直接确认的总结。",
        status: "cancelled",
        ownerAgentId: writer.id,
        ownerAgentName: writer.name,
        stageLabel: "结果整理",
        acceptanceCriteria: "形成可确认的阶段总结。",
        queuedStatus: "ready",
        dependsOnTaskIds: [`${projectId}-task-strategy`],
        inputArtifactIds: [],
        blockedByTaskId: `${projectId}-task-strategy`,
        blockedReason: "等待上游补齐风险、依赖和验收标准。",
        lockScopePaths: [],
        lockStatus: "none",
        lockBlockedByTaskId: null,
        resultSummary: "由于输入不完整，这条任务没有顺利交回。",
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
        completedAt: "2026-03-23T00:11:00.000Z",
      },
      ...rawState.tasks.filter((task) => task.projectId !== projectId),
    ];
    rawState.reviews = [
      {
        id: `${projectId}-review-learning`,
        projectId,
        taskId: `${projectId}-task-strategy`,
        taskTitle: `${STRATEGY_AGENT_NAME}整理阶段判断`,
        reviewTargetLabel: "阶段判断",
        requesterAgentId: strategist.id,
        requesterAgentName: strategist.name,
        reviewerAgentId: manager.id,
        reviewerAgentName: manager.name,
        status: "changes_requested",
        summary: "需要把结果改得更适合下一棒继续推进。",
        blockingComments: "缺少风险、依赖和验收标准，导致下游很难直接接棒。",
        followUpTaskId: `${projectId}-task-writer`,
        createdAt: "2026-03-23T00:10:00.000Z",
        updatedAt: "2026-03-23T00:12:00.000Z",
        completedAt: "2026-03-23T00:12:00.000Z",
      },
      ...rawState.reviews.filter((review) => review.projectId !== projectId),
    ];
    rawState.stuckSignals = [
      {
        id: `${projectId}-stuck-learning`,
        projectId,
        agentId: writer.id,
        agentName: writer.name,
        taskId: `${projectId}-task-writer`,
        taskTitle: `${WRITER_AGENT_NAME}整理阶段总结`,
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
        id: `${projectId}-recovery-learning`,
        projectId,
        kind: "reassign_to_peer",
        summary: "项目经理曾把这条任务改派给更适合整理对外表达的成员继续。",
        taskId: `${projectId}-task-writer`,
        taskTitle: `${WRITER_AGENT_NAME}整理阶段总结`,
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
        id: `${projectId}-run-learning`,
        projectId,
        status: "waiting_approval",
        triggerLabel: "learning 同步用例",
        summary: "当前这一轮已经拿到阶段结果，等待最终确认。",
        currentStepLabel: "项目经理已交付阶段总结，等待用户确认",
        startedAt: "2026-03-23T00:00:00.000Z",
        finishedAt: null,
      },
      ...rawState.runs.filter((run) => run.projectId !== projectId),
    ];

    writeFileSync(storePath, JSON.stringify(rawState, null, 2));

    await projectStore.updateProjectCheckpoint(projectId, {
      action: "pause",
    }).catch(() => null);

    const detail = projectStore.getProjectDetail(projectId);

    if (!detail?.project) {
      throw new Error("detail.project should exist after sync");
    }

    expect(detail.taskReflections.length).toBeGreaterThanOrEqual(2);
    expect(detail.stageReflections.some((reflection) => reflection.stageLabel === "产品定义")).toBe(true);
    expect(detail.stageReflections.some((reflection) => reflection.stageLabel === "结果整理")).toBe(true);
    expect(detail.runSummaries.length).toBeGreaterThanOrEqual(1);
    expect(detail.learningSuggestions.some((suggestion) => suggestion.kind === "failure_pattern")).toBe(true);
    expect(detail.learningSuggestions.some((suggestion) => suggestion.kind === "task_template")).toBe(true);
    expect(detail.learningSuggestions.some((suggestion) => suggestion.kind === "role_tuning")).toBe(true);
    expect(detail.learningSuggestions.some((suggestion) => suggestion.kind === "quality_gate")).toBe(true);
    expect(detail.learningSuggestions.some((suggestion) => suggestion.kind === "skill_upgrade")).toBe(true);
    expect(detail.learningSuggestions.some((suggestion) => suggestion.kind === "agent_profile_update")).toBe(true);
    expect(
      detail.learningSuggestions.some(
        (suggestion) => suggestion.kind === "skill_upgrade" && suggestion.requiresHumanReview,
      ),
    ).toBe(true);
    const templateSuggestion =
      detail.learningSuggestions.find((suggestion) => suggestion.kind === "task_template") ?? null;
    expect(templateSuggestion?.evidenceSources.some((source) => source.kind === "task_reflection")).toBe(true);
    expect(templateSuggestion?.writebackTargets.length).toBeGreaterThan(0);
    expect(detail.mailboxThreads.some((thread) => thread.kind === "human_review" && thread.status === "open")).toBe(true);
  });

  it("allows human review suggestions to be accepted and settles the related mailbox thread", async () => {
    const { tempHome, workspaceDir } = createTempHome("opencrab-project-learning-");
    seedTestTeamAgents(tempHome);

    queueConversationReplies(runConversationTurnMock, [
      JSON.stringify({
        decision: "delegate",
        group_reply: `先由 @${STRATEGY_AGENT_NAME} 输出阶段判断，我拿到结果后再收束。`,
        checkpoint_summary: "",
        delegations: [
          {
            agentName: STRATEGY_AGENT_NAME,
            task: "整理一版阶段判断，明确当前范围、依赖、里程碑风险和下一步建议。",
            artifactTitles: ["团队目标"],
          },
        ],
      }),
      "我已经整理出当前范围、依赖、里程碑风险和下一步建议。",
      JSON.stringify({
        decision: "waiting_approval",
        group_reply: "这一轮已经有可交付的阶段判断了，你可以确认结束，或者告诉我还要补什么。",
        checkpoint_summary: "团队已经交出一版阶段判断，当前可进入待确认 checkpoint。",
        delegations: [],
      }),
    ], {
      threadPrefix: "learning-thread",
      thinkingPrefix: "learning-step",
    });

    const projectStore = await loadProjectStore();
    const created = projectStore.createProject({
      goal: "验证 learning suggestion 的人审流",
      workspaceDir,
      agentProfileIds: ["project-manager", STRATEGY_AGENT_ID],
    });
    const projectId = created?.project?.id ?? null;

    expect(projectId).toBeTruthy();

    if (!projectId) {
      throw new Error("projectId should exist after createProject");
    }

    await projectStore.runProject(projectId, {
      triggerLabel: "启动人审建议用例",
      triggerPrompt: "先推进到 checkpoint。",
    });
    await waitForProjectRuntime(projectId);

    await projectStore.updateProjectCheckpoint(projectId, {
      action: "request_changes",
      note: "下一轮请更明确写出风险、依赖和验收标准。",
    });

    const beforeReview = projectStore.getProjectDetail(projectId);

    if (!beforeReview?.project) {
      throw new Error("beforeReview.project should exist");
    }

    const reviewSuggestion =
      beforeReview.learningSuggestions.find((suggestion) => suggestion.kind === "skill_upgrade") ?? null;

    expect(reviewSuggestion?.requiresHumanReview).toBe(true);

    if (!reviewSuggestion) {
      throw new Error("skill upgrade suggestion should exist");
    }

    const reviewThread =
      beforeReview.mailboxThreads.find(
        (thread) =>
          thread.kind === "human_review" &&
          thread.relatedSuggestionId === reviewSuggestion.id &&
          thread.status === "open",
      ) ?? null;

    expect(reviewThread).toBeTruthy();

    const afterReview = projectStore.reviewProjectLearningSuggestion(projectId, {
      suggestionId: reviewSuggestion.id,
      action: "accept",
      note: "这条建议值得进入默认策略。",
    });

    if (!afterReview?.project) {
      throw new Error("afterReview.project should exist");
    }

    const acceptedSuggestion =
      afterReview.learningSuggestions.find((suggestion) => suggestion.id === reviewSuggestion.id) ?? null;
    const settledThread =
      afterReview.mailboxThreads.find((thread) => thread.relatedSuggestionId === reviewSuggestion.id) ?? null;

    expect(acceptedSuggestion?.status).toBe("accepted");
    expect(acceptedSuggestion?.reviewNote).toBe("这条建议值得进入默认策略。");
    expect(settledThread?.status).toBe("resolved");
  });

  it("turns accepted suggestions into reusable cross-project candidates after explicit confirmation", async () => {
    const { tempHome, workspaceDir } = createTempHome("opencrab-project-learning-");
    const secondWorkspaceDir = path.join(tempHome, "workspace-2");
    seedTestTeamAgents(tempHome);

    queueConversationReplies(runConversationTurnMock, [
      JSON.stringify({
        decision: "delegate",
        group_reply: `先由 @${STRATEGY_AGENT_NAME} 输出阶段判断，我拿到结果后再收束。`,
        checkpoint_summary: "",
        delegations: [
          {
            agentName: STRATEGY_AGENT_NAME,
            task: "整理一版阶段判断，明确当前范围、依赖、里程碑风险和下一步建议。",
            artifactTitles: ["团队目标"],
          },
        ],
      }),
      "我已经整理出当前范围、依赖、里程碑风险和下一步建议。",
      JSON.stringify({
        decision: "waiting_approval",
        group_reply: "这一轮已经有可交付的阶段判断了，你可以确认结束，或者告诉我还要补什么。",
        checkpoint_summary: "团队已经交出一版阶段判断，当前可进入待确认 checkpoint。",
        delegations: [],
      }),
      JSON.stringify({
        decision: "waiting_user",
        group_reply: "我已经带着跨项目候选看了一轮，但当前还缺新的输入边界，请先补充目标和验收标准。",
        checkpoint_summary: "当前先等待你补充第二个项目的范围和验收标准。",
        delegations: [],
      }),
    ], {
      threadPrefix: "learning-thread",
      thinkingPrefix: "learning-step",
    });

    const projectStore = await loadProjectStore();
    const firstProject = projectStore.createProject({
      goal: "验证跨项目复用候选会进入后续项目 prompt",
      workspaceDir,
      agentProfileIds: ["project-manager", STRATEGY_AGENT_ID],
    });
    const firstProjectId = firstProject?.project?.id ?? null;

    expect(firstProjectId).toBeTruthy();

    if (!firstProjectId) {
      throw new Error("firstProjectId should exist after createProject");
    }

    await projectStore.runProject(firstProjectId, {
      triggerLabel: "启动复用候选用例",
      triggerPrompt: "先推进到 checkpoint。",
    });
    await waitForProjectRuntime(firstProjectId);

    await projectStore.updateProjectCheckpoint(firstProjectId, {
      action: "request_changes",
      note: "下一轮请更明确写出风险、依赖和验收标准。",
    });

    const firstDetail = projectStore.getProjectDetail(firstProjectId);
    const templateSuggestion =
      firstDetail?.learningSuggestions.find((suggestion) => suggestion.kind === "task_template") ?? null;

    expect(templateSuggestion).toBeTruthy();

    if (!templateSuggestion) {
      throw new Error("task template suggestion should exist");
    }

    const acceptedDetail = projectStore.reviewProjectLearningSuggestion(firstProjectId, {
      suggestionId: templateSuggestion.id,
      action: "accept",
      note: "这条模板建议值得成为跨项目候选。",
    });
    const pendingCandidate =
      acceptedDetail?.learningReuseCandidates.find(
        (candidate) =>
          candidate.sourceProjectId === firstProjectId &&
          candidate.sourceSuggestionId === templateSuggestion.id &&
          candidate.status === "pending_review",
      ) ?? null;

    expect(pendingCandidate?.kind).toBe("task_template_candidate");

    if (!pendingCandidate) {
      throw new Error("pending reuse candidate should exist after accepting the suggestion");
    }

    const confirmedDetail = projectStore.reviewProjectLearningReuseCandidate(firstProjectId, {
      candidateId: pendingCandidate.id,
      action: "confirm",
      note: "这条候选可以进入跨项目候选库。",
    });
    const confirmedCandidate =
      confirmedDetail?.learningReuseCandidates.find((candidate) => candidate.id === pendingCandidate.id) ?? null;

    expect(confirmedCandidate?.status).toBe("confirmed");
    expect(confirmedCandidate?.reviewNote).toBe("这条候选可以进入跨项目候选库。");

    const secondProject = projectStore.createProject({
      goal: "验证第二个项目能看到已确认的跨项目候选",
      workspaceDir: secondWorkspaceDir,
      agentProfileIds: ["project-manager", STRATEGY_AGENT_ID],
    });
    const secondProjectId = secondProject?.project?.id ?? null;

    expect(secondProjectId).toBeTruthy();

    if (!secondProjectId) {
      throw new Error("secondProjectId should exist after createProject");
    }

    await projectStore.runProject(secondProjectId, {
      triggerLabel: "验证复用候选 prompt",
      triggerPrompt: "先读取上下文，再决定是否继续推进。",
    });
    await waitForProjectRuntime(secondProjectId);

    const secondProjectManagerPrompt = runConversationTurnMock.mock.calls[3]?.[0]?.content ?? "";

    expect(secondProjectManagerPrompt).toContain("跨项目复用候选");
    expect(secondProjectManagerPrompt).toContain(confirmedCandidate?.title ?? "任务模板候选");
    expect(secondProjectManagerPrompt).toContain("验证跨项目复用候选会进入后续");
  });
});
