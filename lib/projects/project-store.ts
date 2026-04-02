import path from "node:path";
import { getAgentProfile } from "@/lib/agents/agent-store";
import {
  clearConversationBindings,
  reconcileConversationBinding,
} from "@/lib/channels/channel-store";
import { runConversationTurn } from "@/lib/conversations/run-conversation-turn";
import {
  addMessage,
  createConversation,
  deleteConversation,
  ensureFolder,
  getVisibleSnapshot,
  getSnapshot,
  updateConversation as updateStoredConversation,
} from "@/lib/resources/local-store";
import {
  OPENCRAB_PROJECTS_STORE_PATH,
} from "@/lib/resources/runtime-paths";
import { normalizeProjectWorkspaceDir } from "@/lib/resources/workspace-directories";
import { createSyncJsonFileStore } from "@/lib/infrastructure/json-store/sync-json-file-store";
import {
  buildManagerArtifactCatalogLines,
  buildWorkerArtifactInputLines,
  normalizeDelegationArtifactTitles,
  resolveArtifactIdsByTitles,
} from "@/lib/projects/project-artifact-runtime";
import type {
  ProjectAgentRecord,
  ProjectAutonomyGateRecord,
  ProjectArtifactRecord,
  ProjectCheckpointAction,
  ProjectDetail,
  ProjectLearningEvidenceSource,
  ProjectLearningEvidenceSourceKind,
  ProjectLearningReuseCandidateKind,
  ProjectLearningReuseCandidateRecord,
  ProjectEventRecord,
  ProjectHeartbeatRecord,
  ProjectMailboxThreadRecord,
  ProjectLearningSuggestionRecord,
  ProjectMemoryEntry,
  ProjectMemoryRecord,
  ProjectRecoveryActionRecord,
  ProjectReviewRecord,
  ProjectRoomRecord,
  ProjectRoleMemoryRecord,
  ProjectRunSummaryRecord,
  ProjectStageReflectionRecord,
  ProjectStuckSignalKind,
  ProjectStuckSignalRecord,
  ProjectStoreState,
  ProjectTaskRecord,
  ProjectTaskReflectionRecord,
  ProjectTeamMemoryPattern,
  ProjectTeamMemoryRecord,
} from "@/lib/projects/types";

const STORE_PATH = OPENCRAB_PROJECTS_STORE_PATH;
const TASK_LEASE_WINDOW_MS = 6 * 60 * 1000;
const TASK_RECOVERY_LIMIT_BEFORE_REASSIGN = 2;
const PROJECT_AUTONOMY_ROUND_BUDGET = 20;
const CHECKPOINT_ARTIFACT_TITLES = ["阶段总结", "待补充事项"] as const;
const CHECKPOINT_TASK_TITLES = ["项目经理整理阶段输出，等待确认", "等待用户补充方向后继续推进"] as const;
const store = createSyncJsonFileStore<ProjectStoreState>({
  filePath: STORE_PATH,
  seed: createInitialState,
  normalize: normalizeProjectStoreState,
});

declare global {
  var __opencrabProjectRuntimeQueues: Map<string, Promise<void>> | undefined;
}

export function listProjects(): ProjectRoomRecord[] {
  const state = readState();
  return state.rooms.map((room) => structuredClone(buildProjectRoomWithInsights(state, room)));
}

export function getProjectDetail(projectId: string): ProjectDetail | null {
  const state = readState();
  const room = state.rooms.find((item) => item.id === projectId) ?? null;

  if (!room) {
    return null;
  }

  return {
    project: structuredClone(buildProjectRoomWithInsights(state, room)),
    agents: state.agents
      .filter((item) => item.projectId === projectId)
      .map((item) => structuredClone(item)),
    events: state.events
      .filter((item) => item.projectId === projectId)
      .sort((left, right) => Date.parse(right.createdAt) - Date.parse(left.createdAt))
      .map((item) => structuredClone(item)),
    artifacts: state.artifacts
      .filter((item) => item.projectId === projectId)
      .sort((left, right) => Date.parse(right.updatedAt) - Date.parse(left.updatedAt))
      .map((item) => structuredClone(item)),
    mailboxThreads: state.mailboxThreads
      .filter((item) => item.projectId === projectId)
      .sort((left, right) => Date.parse(right.updatedAt) - Date.parse(left.updatedAt))
      .map((item) => structuredClone(item)),
    projectMemory:
      structuredClone(state.projectMemories.find((item) => item.projectId === projectId) ?? null),
    teamMemory:
      structuredClone(state.teamMemories.find((item) => item.projectId === projectId) ?? null),
    roleMemories: state.roleMemories
      .filter((item) => item.projectId === projectId)
      .sort((left, right) => left.agentName.localeCompare(right.agentName, "zh-Hans-CN"))
      .map((item) => structuredClone(item)),
    taskReflections: state.taskReflections
      .filter((item) => item.projectId === projectId)
      .sort((left, right) => Date.parse(right.updatedAt) - Date.parse(left.updatedAt))
      .map((item) => structuredClone(item)),
    stageReflections: state.stageReflections
      .filter((item) => item.projectId === projectId)
      .sort((left, right) => Date.parse(right.updatedAt) - Date.parse(left.updatedAt))
      .map((item) => structuredClone(item)),
    runSummaries: state.runSummaries
      .filter((item) => item.projectId === projectId)
      .sort((left, right) => Date.parse(right.updatedAt) - Date.parse(left.updatedAt))
      .map((item) => structuredClone(item)),
    learningSuggestions: state.learningSuggestions
      .filter((item) => item.projectId === projectId)
      .sort((left, right) => Date.parse(right.updatedAt) - Date.parse(left.updatedAt))
      .map((item) => structuredClone(item)),
    learningReuseCandidates: state.learningReuseCandidates
      .sort((left, right) => Date.parse(right.updatedAt) - Date.parse(left.updatedAt))
      .map((item) => structuredClone(item)),
    autonomyGates: state.autonomyGates
      .filter((item) => item.projectId === projectId)
      .sort((left, right) => Date.parse(right.updatedAt) - Date.parse(left.updatedAt))
      .map((item) => structuredClone(item)),
    heartbeats: state.heartbeats
      .filter((item) => item.projectId === projectId)
      .sort((left, right) => Date.parse(right.recordedAt) - Date.parse(left.recordedAt))
      .map((item) => structuredClone(item)),
    stuckSignals: state.stuckSignals
      .filter((item) => item.projectId === projectId)
      .sort((left, right) => Date.parse(right.updatedAt) - Date.parse(left.updatedAt))
      .map((item) => structuredClone(item)),
    recoveryActions: state.recoveryActions
      .filter((item) => item.projectId === projectId)
      .sort((left, right) => Date.parse(right.createdAt) - Date.parse(left.createdAt))
      .map((item) => structuredClone(item)),
    reviews: state.reviews
      .filter((item) => item.projectId === projectId)
      .sort((left, right) => sortProjectReviews(left, right))
      .map((item) => structuredClone(item)),
    tasks: state.tasks
      .filter((item) => item.projectId === projectId)
      .sort((left, right) => sortProjectTasks(left, right))
      .map((item) => structuredClone(item)),
    runs: state.runs
      .filter((item) => item.projectId === projectId)
      .sort((left, right) => Date.parse(right.startedAt) - Date.parse(left.startedAt))
      .map((item) => structuredClone(item)),
  };
}

function buildProjectRoomWithInsights(
  state: ProjectStoreState,
  room: ProjectRoomRecord,
): ProjectRoomRecord {
  const projectTasks = state.tasks
    .filter((task) => task.projectId === room.id)
    .sort((left, right) => sortProjectTasks(left, right));
  const openTasks = projectTasks.filter((task) => !isProjectTaskTerminal(task.status));
  const activeTask = openTasks[0] ?? null;
  const pendingReviewCount = state.reviews.filter(
    (review) => review.projectId === room.id && review.status === "pending",
  ).length;
  const openStuckSignals = state.stuckSignals.filter(
    (signal) => signal.projectId === room.id && signal.status === "open",
  );
  const openAutonomyGates = state.autonomyGates.filter(
    (gate) => gate.projectId === room.id && gate.status === "open",
  );
  const latestRecovery =
    state.recoveryActions
      .filter((action) => action.projectId === room.id)
      .sort((left, right) => Date.parse(right.createdAt) - Date.parse(left.createdAt))[0] ?? null;
  const latestRun =
    state.runs
      .filter((run) => run.projectId === room.id)
      .sort((left, right) => Date.parse(right.startedAt) - Date.parse(left.startedAt))[0] ?? null;
  const latestGate =
    [...openAutonomyGates].sort((left, right) => Date.parse(right.updatedAt) - Date.parse(left.updatedAt))[0] ?? null;

  return {
    ...room,
    activeTaskTitle: activeTask?.title ?? null,
    activeTaskStatus: activeTask?.status ?? null,
    openTaskCount: openTasks.length,
    pendingReviewCount,
    openStuckSignalCount: openStuckSignals.length,
    openGateCount: openAutonomyGates.length,
    latestGateSummary: latestGate ? compactConversationExcerpt(latestGate.summary, 110) : null,
    autonomyStatus: room.autonomyStatus ?? "guarded",
    autonomyRoundBudget: room.autonomyRoundBudget ?? PROJECT_AUTONOMY_ROUND_BUDGET,
    autonomyRoundCount: room.autonomyRoundCount ?? 0,
    autonomyApprovedAt: room.autonomyApprovedAt ?? room.updatedAt,
    autonomyPauseReason: room.autonomyPauseReason ?? null,
    latestRecoverySummary: latestRecovery ? compactConversationExcerpt(latestRecovery.summary, 110) : null,
    latestRecoveryKind: latestRecovery?.kind ?? null,
    latestRunStepLabel: latestRun?.currentStepLabel ?? null,
  };
}

function findOpenProjectAutonomyGates(
  state: ProjectStoreState,
  projectId: string,
) {
  return state.autonomyGates.filter((gate) => gate.projectId === projectId && gate.status === "open");
}

function resolveProjectAutonomyGate(
  state: ProjectStoreState,
  input: {
    projectId: string;
    kind: ProjectAutonomyGateRecord["kind"];
    title: string;
    summary: string;
    now: string;
  },
) {
  const gateId = `${input.projectId}-autonomy-gate-${input.kind}`;
  const existing = state.autonomyGates.find((gate) => gate.id === gateId) ?? null;

  state.autonomyGates = existing
    ? state.autonomyGates.map((gate) =>
        gate.id === gateId
          ? {
              ...gate,
              status: "open",
              title: input.title,
              summary: compactConversationExcerpt(input.summary, 220),
              updatedAt: input.now,
              resolvedAt: null,
            }
          : gate,
      )
    : [
        {
          id: gateId,
          projectId: input.projectId,
          kind: input.kind,
          status: "open",
          title: input.title,
          summary: compactConversationExcerpt(input.summary, 220),
          openedAt: input.now,
          updatedAt: input.now,
          resolvedAt: null,
        },
        ...state.autonomyGates,
      ];

  return gateId;
}

function settleProjectAutonomyGates(
  state: ProjectStoreState,
  input: {
    projectId: string;
    updatedAt: string;
    kinds?: ProjectAutonomyGateRecord["kind"][];
  },
) {
  const gateKindSet = input.kinds?.length ? new Set(input.kinds) : null;

  state.autonomyGates = state.autonomyGates.map((gate) => {
    if (
      gate.projectId !== input.projectId ||
      gate.status !== "open" ||
      (gateKindSet && !gateKindSet.has(gate.kind))
    ) {
      return gate;
    }

    return {
      ...gate,
      status: "resolved",
      updatedAt: input.updatedAt,
      resolvedAt: input.updatedAt,
    };
  });
}

function consumeProjectAutonomyRound(
  state: ProjectStoreState,
  input: {
    projectId: string;
    now: string;
  },
) {
  state.rooms = state.rooms.map((room) =>
    room.id === input.projectId
      ? {
          ...room,
          autonomyStatus: "guarded",
          autonomyRoundBudget: room.autonomyRoundBudget ?? PROJECT_AUTONOMY_ROUND_BUDGET,
          autonomyRoundCount: (room.autonomyRoundCount ?? 0) + 1,
          autonomyPauseReason: null,
          updatedAt: input.now,
        }
      : room,
  );
}

function resetProjectAutonomyState(
  state: ProjectStoreState,
  input: {
    projectId: string;
    now: string;
    note?: string | null;
  },
) {
  state.rooms = state.rooms.map((room) =>
    room.id === input.projectId
      ? {
          ...room,
          autonomyStatus: "guarded",
          autonomyRoundBudget: room.autonomyRoundBudget ?? PROJECT_AUTONOMY_ROUND_BUDGET,
          autonomyRoundCount: 0,
          autonomyApprovedAt: input.now,
          autonomyPauseReason: input.note ?? null,
          updatedAt: input.now,
        }
      : room,
  );
}

function buildAutonomyBudgetGateSummary(input: {
  roundCount: number;
  roundBudget: number;
}) {
  return `团队已经在当前边界内连续自主推进 ${input.roundCount} 轮，达到本轮安全自治上限 ${input.roundBudget} 轮。继续前请你确认是否放行下一段自动推进。`;
}

function detectProjectAutonomyRiskGate(
  state: ProjectStoreState,
  room: ProjectRoomRecord,
) {
  const approvedAt = room.autonomyApprovedAt ?? room.updatedAt ?? room.createdAt;
  const openStuckSignals = state.stuckSignals.filter(
    (signal) => signal.projectId === room.id && signal.status === "open",
  );
  const recentRecoveries = state.recoveryActions.filter(
    (action) =>
      action.projectId === room.id &&
      Date.parse(action.createdAt) >= Date.parse(approvedAt),
  );
  const recentChangedReviews = state.reviews.filter(
    (review) =>
      review.projectId === room.id &&
      review.status === "changes_requested" &&
      Date.parse(review.updatedAt) >= Date.parse(approvedAt),
  );

  if (openStuckSignals.length === 0 && recentRecoveries.length === 0 && recentChangedReviews.length === 0) {
    return null;
  }

  const lines = [
    openStuckSignals.length > 0
      ? `当前仍有 ${openStuckSignals.length} 条卡住信号没有收束。`
      : null,
    recentRecoveries.length > 0
      ? `最近这段自治推进里已经触发 ${recentRecoveries.length} 次恢复动作。`
      : null,
    recentChangedReviews.length > 0
      ? `最近这段自治推进里出现 ${recentChangedReviews.length} 次 changes requested。`
      : null,
    "继续自动推进前，建议你先确认是否接受这段风险。"
  ].filter(Boolean);

  return {
    title: "命中风险边界，需要人工放行",
    summary: lines.join(" "),
  };
}

export function createProject(input: {
  goal: string;
  workspaceDir: string;
  agentProfileIds: string[];
  model?: string | null;
  reasoningEffort?: ProjectAgentRecord["reasoningEffort"] | null;
  sandboxMode?: ProjectAgentRecord["sandboxMode"] | null;
}) {
  const goal = input.goal.trim();

  if (!goal) {
    throw new Error("请先填写这个团队的目标。");
  }

  const workspaceDir = normalizeProjectWorkspaceDir(input.workspaceDir);

  const normalizedAgentProfileIds = ensureProjectManagerAgentId(
    Array.from(
      new Set(
        input.agentProfileIds
          .map((agentId) => agentId.trim())
          .filter(Boolean),
      ),
    ),
  );

  if (normalizedAgentProfileIds.length === 0) {
    throw new Error("请至少为这个团队加入一个智能体。");
  }

  const selectedProfiles = normalizedAgentProfileIds.map((agentId) => {
    const detail = getAgentProfile(agentId);

    if (!detail) {
      throw new Error("选择的智能体不存在，暂时无法创建团队。");
    }

    return {
      id: detail.id,
      name: detail.name,
      summary: detail.summary,
      source: detail.source,
      teamRole: detail.teamRole,
      defaultModel: detail.defaultModel,
      defaultReasoningEffort: detail.defaultReasoningEffort,
      defaultSandboxMode: detail.defaultSandboxMode,
    };
  });

  const snapshot = getSnapshot();
  const model = input.model?.trim() || snapshot.settings.defaultModel;
  const reasoningEffort = input.reasoningEffort ?? snapshot.settings.defaultReasoningEffort;
  const sandboxMode = input.sandboxMode ?? "workspace-write";
  const now = new Date().toISOString();
  const projectId = `project-${crypto.randomUUID()}`;
  const room = buildManualRoom({
    projectId,
    goal,
    workspaceDir,
    profiles: selectedProfiles,
    model,
    reasoningEffort,
    sandboxMode,
    createdAt: now,
  });
  const state = readState();

  state.rooms = [room.room, ...state.rooms];
  state.agents = [...room.agents, ...state.agents];
  state.events = [...room.events, ...state.events];
  state.artifacts = [...room.artifacts, ...state.artifacts];
  state.reviews = [...room.reviews, ...state.reviews];
  state.tasks = [...room.tasks, ...state.tasks];
  writeState(state);

  return getProjectDetail(projectId);
}

export function deleteProject(projectId: string) {
  const state = readState();
  const room = state.rooms.find((item) => item.id === projectId) ?? null;
  const exists = Boolean(room);

  if (!exists) {
    return false;
  }

  const snapshot = getSnapshot();
  const relatedConversationIds = new Set<string>();

  snapshot.conversations.forEach((conversation) => {
    if (conversation.projectId === projectId) {
      relatedConversationIds.add(conversation.id);
    }
  });

  if (room?.teamConversationId) {
    relatedConversationIds.add(room.teamConversationId);
  }

  state.agents
    .filter((item) => item.projectId === projectId)
    .forEach((agent) => {
      if (agent.runtimeConversationId) {
        relatedConversationIds.add(agent.runtimeConversationId);
      }
    });

  relatedConversationIds.forEach((conversationId) => {
    clearConversationBindings(conversationId);
    deleteConversation(conversationId);
  });

  globalThis.__opencrabProjectRuntimeQueues?.delete(projectId);

  removeProjectCascadeState(state, projectId);
  writeState(state);

  return true;
}

function removeProjectCascadeState(state: ProjectStoreState, projectId: string) {
  state.rooms = state.rooms.filter((item) => item.id !== projectId);
  state.agents = state.agents.filter((item) => item.projectId !== projectId);
  state.events = state.events.filter((item) => item.projectId !== projectId);
  state.artifacts = state.artifacts.filter((item) => item.projectId !== projectId);
  state.mailboxThreads = state.mailboxThreads.filter((item) => item.projectId !== projectId);
  state.projectMemories = state.projectMemories.filter((item) => item.projectId !== projectId);
  state.teamMemories = state.teamMemories.filter((item) => item.projectId !== projectId);
  state.roleMemories = state.roleMemories.filter((item) => item.projectId !== projectId);
  state.taskReflections = state.taskReflections.filter((item) => item.projectId !== projectId);
  state.stageReflections = state.stageReflections.filter((item) => item.projectId !== projectId);
  state.runSummaries = state.runSummaries.filter((item) => item.projectId !== projectId);
  state.learningSuggestions = state.learningSuggestions.filter((item) => item.projectId !== projectId);
  state.learningReuseCandidates = state.learningReuseCandidates.filter((item) => item.sourceProjectId !== projectId);
  state.autonomyGates = state.autonomyGates.filter((item) => item.projectId !== projectId);
  state.heartbeats = state.heartbeats.filter((item) => item.projectId !== projectId);
  state.stuckSignals = state.stuckSignals.filter((item) => item.projectId !== projectId);
  state.recoveryActions = state.recoveryActions.filter((item) => item.projectId !== projectId);
  state.reviews = state.reviews.filter((item) => item.projectId !== projectId);
  state.tasks = state.tasks.filter((item) => item.projectId !== projectId);
  state.runs = state.runs.filter((item) => item.projectId !== projectId);
}

export async function replyToProjectConversation(input: {
  projectId: string;
  conversationId: string;
  content: string;
}) {
  const state = readState();
  const room = state.rooms.find((item) => item.id === input.projectId) ?? null;

  if (!room) {
    const error = new Error("这个团队模式不存在，暂时无法在群聊中继续推进。");
    (error as Error & { statusCode?: number }).statusCode = 404;
    throw error;
  }

  const content = input.content.trim();

  if (!content) {
    throw new Error("请先输入你想让团队继续推进的内容。");
  }

  const conversationId = ensureTeamConversation(state, room);

  if (conversationId !== input.conversationId) {
    updateStoredConversation(input.conversationId, {
      projectId: room.id,
      workspaceDir: room.workspaceDir,
      sandboxMode: room.sandboxMode,
    });
  }

  addMessage(conversationId, {
    role: "user",
    content,
    meta: "团队群聊",
    status: "done",
  });

  const projectAgents = state.agents.filter((agent) => agent.projectId === room.id);
  const manager =
    projectAgents.find((agent) => agent.agentProfileId === "project-manager") ||
    projectAgents.find((agent) => agent.canDelegate) ||
    null;
  const recentGroupMessages = getRecentTeamConversationMessages(conversationId);

  if (room.status === "paused" || room.runStatus === "paused") {
    const pausedReply =
      "当前团队已暂停。我会保留这轮上下文、分工和成员结果；等你点击恢复运行后，我会从现在的进度继续，而不是重新开始。";

    if (manager) {
      appendTeamConversationMessages(conversationId, [
        {
          actorLabel: manager.name,
          content: pausedReply,
        },
      ]);
    }

    state.rooms = state.rooms.map((item) =>
      item.id === room.id
        ? {
            ...item,
            latestUserRequest: content,
            summary: pausedReply,
            lastActivityLabel: "团队当前处于暂停中",
            updatedAt: new Date().toISOString(),
          }
        : item,
    );
    writeState(state);
    return getVisibleSnapshot();
  }

  if (!manager) {
    const replies = buildProjectConversationReplies(state, room.id, content);
    appendTeamConversationMessages(conversationId, replies);

    const now = new Date().toISOString();
    state.rooms = state.rooms.map((item) =>
      item.id === room.id
        ? {
            ...item,
            latestUserRequest: content,
            summary: replies[0]?.content || item.summary,
            lastActivityLabel: "群聊刚刚更新",
            updatedAt: now,
          }
        : item,
    );
    writeState(state);

    return getVisibleSnapshot();
  }

  if (shouldAttemptRuntimeRecovery(content)) {
    const recoveryReply = recoverStalledProjectRuntime({
      state,
      room,
      manager,
      projectAgents,
      conversationId,
      recentGroupMessages,
    });

    if (recoveryReply) {
      return getVisibleSnapshot();
    }
  }

  if (shouldReplyWithProjectProgress(room, manager, projectAgents, content)) {
    const progressReply = buildProjectProgressReply(room, manager, projectAgents);
    const now = new Date().toISOString();

    appendTeamConversationMessages(conversationId, [
      {
        actorLabel: manager.name,
        content: progressReply,
      },
    ]);

    state.rooms = state.rooms.map((item) =>
      item.id === room.id
        ? {
            ...item,
            summary: progressReply,
            lastActivityLabel: "项目经理刚刚同步了当前进展",
            updatedAt: now,
          }
        : item,
    );
    writeState(state);

    return getVisibleSnapshot();
  }

  const plan =
    (await planProjectConversationWithManager(state, room, manager, projectAgents, content, recentGroupMessages)) ||
    buildFallbackManagerPlan(state, room.id, manager, content);

  if (isProjectRuntimePaused(readState().rooms.find((item) => item.id === room.id) ?? null)) {
    return getVisibleSnapshot();
  }

  appendTeamConversationMessages(conversationId, [
    {
      actorLabel: manager.name,
      content: plan.groupReply,
    },
  ]);

  const now = new Date().toISOString();
  if (plan.delegations.length > 0) {
    applyRuntimeDelegationState(state, {
      projectId: room.id,
      managerId: manager.id,
      delegations: plan.delegations,
      fallbackStageLabel: "项目经理统筹",
    });
    state.rooms = state.rooms.map((item) =>
      item.id === room.id
        ? {
            ...item,
            runStatus: "running",
            latestUserRequest: content,
            summary: plan.groupReply || item.summary,
            lastActivityLabel: "项目经理刚刚完成分工",
            updatedAt: now,
          }
        : item,
    );
  } else if (plan.decision === "waiting_user" || plan.decision === "waiting_approval") {
    applyProjectManagerCheckpoint(state, {
      projectId: room.id,
      managerId: manager.id,
      decision: plan.decision,
      summary: plan.checkpointSummary || plan.groupReply,
      now,
    });
    state.rooms = state.rooms.map((item) =>
      item.id === room.id
        ? {
            ...item,
            latestUserRequest: content,
          }
        : item,
    );
  } else {
    clearRuntimeDelegationState(state, {
      projectId: room.id,
      managerId: manager.id,
      stageLabel: "项目经理统筹",
    });
    state.rooms = state.rooms.map((item) =>
      item.id === room.id
        ? {
            ...item,
            runStatus: "running",
            latestUserRequest: content,
            summary: plan.groupReply || item.summary,
            lastActivityLabel: "项目经理刚刚回复",
            updatedAt: now,
          }
        : item,
    );
  }
  writeState(state);

  if (plan.delegations.length > 0) {
    enqueueProjectRuntimeWork(room.id, async () => {
      await continueProjectDelegationsInBackground({
        projectId: room.id,
        conversationId,
        delegations: plan.delegations,
        recentMessages: [
          ...recentGroupMessages,
          {
            role: "assistant",
            actorLabel: manager.name,
            content: plan.groupReply,
          },
        ],
      });
    });
  }

  return getVisibleSnapshot();
}

type RuntimeManagerPlan = {
  decision: "delegate" | "waiting_user" | "waiting_approval";
  groupReply: string;
  checkpointSummary: string | null;
  delegations: Array<{
    agentName: string;
    task: string;
    artifactTitles: string[];
  }>;
};

type RuntimeConversationMessage = {
  role: "user" | "assistant";
  actorLabel: string | null;
  content: string;
};

class ProjectRuntimeReplacedError extends Error {
  constructor() {
    super("Project runtime was replaced before this result returned.");
    this.name = "ProjectRuntimeReplacedError";
  }
}

function getRecentTeamConversationMessages(conversationId: string) {
  const snapshot = getSnapshot();
  const messages = snapshot.conversationMessages[conversationId] ?? [];

  return messages.slice(-8).map((message) => ({
    role: message.role,
    actorLabel: message.actorLabel ?? null,
    content: message.content,
  }));
}

function compactConversationExcerpt(value: string, maxLength = 220) {
  const normalized = value.replace(/\s+/g, " ").trim();

  if (normalized.length <= maxLength) {
    return normalized;
  }

  return `${normalized.slice(0, maxLength - 3)}...`;
}

function buildRuntimeRecentMessageLines(
  messages: RuntimeConversationMessage[],
  options: {
    limit?: number;
    maxLength?: number;
  } = {},
) {
  const limit = options.limit ?? 5;
  const maxLength = options.maxLength ?? 220;

  return messages
    .slice(-limit)
    .map(
      (message) =>
        `- ${message.role === "user" ? "用户" : message.actorLabel || "成员"}: ${compactConversationExcerpt(message.content, maxLength)}`,
    )
    .join("\n");
}

function buildProjectMemoryEntryLines(
  title: string,
  entries: ProjectMemoryEntry[],
) {
  if (entries.length === 0) {
    return null;
  }

  return `${title}：\n${entries
    .slice(0, 2)
    .map((entry) => `- ${entry.label}: ${entry.summary}`)
    .join("\n")}`;
}

function buildTeamMemoryPatternLines(
  title: string,
  patterns: ProjectTeamMemoryPattern[],
) {
  if (patterns.length === 0) {
    return null;
  }

  return `${title}：\n${patterns
    .slice(0, 2)
    .map((pattern) => `- ${pattern.label}: ${pattern.summary}`)
    .join("\n")}`;
}

function buildManagerMemoryPromptSection(
  projectMemory: ProjectMemoryRecord | null,
  teamMemory: ProjectTeamMemoryRecord | null,
  roleMemories: ProjectRoleMemoryRecord[],
) {
  const sections = [
    projectMemory ? buildProjectMemoryEntryLines("项目记忆 / 决策", projectMemory.decisions) : null,
    projectMemory ? buildProjectMemoryEntryLines("项目记忆 / 偏好", projectMemory.preferences) : null,
    projectMemory ? buildProjectMemoryEntryLines("项目记忆 / 风险", projectMemory.risks) : null,
    projectMemory ? buildProjectMemoryEntryLines("项目记忆 / 历史坑点", projectMemory.pitfalls) : null,
    teamMemory ? buildTeamMemoryPatternLines("团队记忆 / 接力经验", teamMemory.handoffPatterns) : null,
    teamMemory ? buildTeamMemoryPatternLines("团队记忆 / 常见卡点", teamMemory.blockerPatterns) : null,
    teamMemory ? buildTeamMemoryPatternLines("团队记忆 / 常见 review 问题", teamMemory.reviewPatterns) : null,
    roleMemories.length > 0
      ? `角色记忆：\n${roleMemories
          .slice(0, 3)
          .map((memory) => {
            const lines = [
              memory.strengths[0] ? `擅长：${memory.strengths[0]}` : null,
              memory.commonIssues[0] ? `常见问题：${memory.commonIssues[0]}` : null,
              memory.preferredInputFormat[0] ? `输入偏好：${memory.preferredInputFormat[0]}` : null,
            ].filter(Boolean);

            return `- ${memory.agentName}: ${lines.join("；") || "暂无结构化角色记忆"}`;
          })
          .join("\n")}`
      : null,
  ].filter(Boolean);

  return sections.join("\n\n") || "- 当前还没有结构化 memory，先按最新群聊、任务和交付物判断。";
}

function buildWorkerMemoryPromptSection(
  projectMemory: ProjectMemoryRecord | null,
  roleMemory: ProjectRoleMemoryRecord | null,
) {
  const sections = [
    projectMemory ? buildProjectMemoryEntryLines("项目偏好", projectMemory.preferences) : null,
    projectMemory ? buildProjectMemoryEntryLines("项目风险", projectMemory.risks) : null,
    projectMemory ? buildProjectMemoryEntryLines("历史坑点", projectMemory.pitfalls) : null,
    roleMemory
      ? [
          "你的角色记忆：",
          ...roleMemory.strengths.slice(0, 2).map((item) => `- 擅长：${item}`),
          ...roleMemory.commonIssues.slice(0, 2).map((item) => `- 常见问题：${item}`),
          ...roleMemory.preferredInputFormat.slice(0, 2).map((item) => `- 输入偏好：${item}`),
        ].join("\n")
      : null,
  ].filter(Boolean);

  return sections.join("\n\n") || "- 当前还没有结构化 memory，先按任务、群聊和输入交付物直接完成。";
}

function buildLearningSuggestionPromptSection(
  suggestions: ProjectLearningSuggestionRecord[],
) {
  const visibleSuggestions = suggestions.filter((suggestion) => suggestion.status !== "dismissed");

  if (visibleSuggestions.length === 0) {
    return "- 当前还没有结构化 learning suggestion。";
  }

  return visibleSuggestions
    .sort((left, right) => {
      if (left.status !== right.status) {
        return left.status === "accepted" ? -1 : 1;
      }

      if (left.requiresHumanReview !== right.requiresHumanReview) {
        return left.requiresHumanReview ? -1 : 1;
      }

      return Date.parse(right.updatedAt) - Date.parse(left.updatedAt);
    })
    .slice(0, 5)
    .map((suggestion) => {
      const evidence =
        suggestion.evidenceLabels.length > 0 ? `（证据：${suggestion.evidenceLabels.join("、")}）` : "";
      const reviewFlag = suggestion.requiresHumanReview
        ? suggestion.status === "open"
          ? " [待人审]"
          : " [已人审]"
        : "";
      const actionItems =
        suggestion.actionItems.length > 0 ? `；建议动作：${suggestion.actionItems.join("；")}` : "";
      return `- [${suggestion.kind}] ${suggestion.title}${reviewFlag}: ${suggestion.summary}${actionItems}${evidence}`;
    })
    .join("\n");
}

function buildLearningReuseCandidatePromptSection(
  candidates: ProjectLearningReuseCandidateRecord[],
  currentProjectId: string,
) {
  const visibleCandidates = candidates.filter(
    (candidate) => candidate.status === "confirmed" && candidate.sourceProjectId !== currentProjectId,
  );

  if (visibleCandidates.length === 0) {
    return "- 当前还没有已确认的跨项目复用候选。";
  }

  return visibleCandidates
    .slice(0, 4)
    .map((candidate) => {
      const evidence =
        candidate.evidenceLabels.length > 0 ? `（证据：${candidate.evidenceLabels.join("、")}）` : "";
      return `- [${candidate.kind}] ${candidate.title}: 来自项目「${candidate.sourceProjectTitle}」，${candidate.summary}${evidence}`;
    })
    .join("\n");
}

async function planProjectConversationWithManager(
  state: ProjectStoreState,
  room: ProjectRoomRecord,
  manager: ProjectAgentRecord,
  projectAgents: ProjectAgentRecord[],
  content: string,
  recentMessages: RuntimeConversationMessage[],
) {
  const runtimeConversationId = ensureAgentRuntimeConversation(state, room, manager);
  const otherAgents = projectAgents.filter((agent) => agent.id !== manager.id);
  const projectArtifacts = state.artifacts.filter((artifact) => artifact.projectId === room.id);
  const projectMemory = state.projectMemories.find((item) => item.projectId === room.id) ?? null;
  const teamMemory = state.teamMemories.find((item) => item.projectId === room.id) ?? null;
  const roleMemories = state.roleMemories.filter((item) => item.projectId === room.id);
  const learningSuggestions = state.learningSuggestions.filter((item) => item.projectId === room.id);
  const learningReuseCandidates = state.learningReuseCandidates;
  const prompt = buildManagerPlanningPrompt(
    room,
    otherAgents,
    projectArtifacts,
    content,
    recentMessages,
    projectMemory,
    teamMemory,
    roleMemories,
    learningSuggestions,
    learningReuseCandidates,
  );
  updateAgentPublicProgress(state, manager.id, {
    label: "正在判断下一步",
    detail: "项目经理正在结合当前群聊、上游结果和团队目标，判断下一棒该由谁接力。",
  });
  writeState(state);
  const result = await runConversationTurn({
    conversationId: runtimeConversationId,
    content: prompt,
    model: manager.model,
    reasoningEffort: manager.reasoningEffort,
    sandboxMode: manager.sandboxMode,
    workingDirectory: room.workspaceDir || undefined,
    onThreadReady: () => {
      const nextState = readState();
      updateAgentPublicProgress(nextState, manager.id, {
        label: "已接入运行时",
        detail: "项目经理已经拿到新的 runtime 会话，正在整理接下来的分工判断。",
      });
      writeState(nextState);
    },
    onThinking: (entries) => {
      const nextState = readState();
      updateAgentPublicProgress(nextState, manager.id, summarizeThinkingProgress(entries, {
        agent: manager,
        task: content,
        fallbackLabel: "正在分析协作节奏",
        fallbackDetail: "项目经理正在比较目标、依赖和现有结果，决定下一步是否派工或先向用户收束。",
      }));
      writeState(nextState);
    },
    onAssistantText: (text) => {
      const nextState = readState();
      updateAgentPublicProgress(nextState, manager.id, summarizeAssistantDraftProgress(text, {
        fallbackLabel: "正在整理群聊回复",
        fallbackDetail: "项目经理正在把分工判断整理成一条适合发到群聊里的安排说明。",
      }));
      writeState(nextState);
    },
  });
  syncMutableProjectState(state, readState());
  const latestArtifacts = readState().artifacts.filter((artifact) => artifact.projectId === room.id);
  const plan = parseManagerPlan(result.assistant.text, otherAgents, latestArtifacts);

  updateProjectAgent(state, manager.id, {
    status: plan.delegations.length > 0 ? "planning" : plan.decision === "waiting_user" ? "planning" : "reviewing",
    lastAssignedTask: content,
    lastResultSummary: compactRuntimeText(plan.checkpointSummary || plan.groupReply),
    progressLabel:
      plan.delegations.length > 0
        ? "已完成分工判断"
        : plan.decision === "waiting_approval"
          ? "已整理交付总结"
          : "正在等待用户补充",
    progressDetails: compactConversationExcerpt(
      plan.checkpointSummary || plan.groupReply,
      160,
    ),
    lastHeartbeatAt: new Date().toISOString(),
    progressTrail: appendAgentProgressTrail(
      state.agents.find((agent) => agent.id === manager.id)?.progressTrail ?? manager.progressTrail,
      {
      label:
        plan.delegations.length > 0
          ? "已完成分工判断"
          : plan.decision === "waiting_approval"
            ? "已整理交付总结"
            : "正在等待用户补充",
      detail: compactConversationExcerpt(plan.checkpointSummary || plan.groupReply, 160),
      },
    ),
  });

  return plan;
}

function buildManagerPlanningPrompt(
  room: ProjectRoomRecord,
  otherAgents: ProjectAgentRecord[],
  artifacts: ProjectArtifactRecord[],
  content: string,
  recentMessages: RuntimeConversationMessage[],
  projectMemory: ProjectMemoryRecord | null,
  teamMemory: ProjectTeamMemoryRecord | null,
  roleMemories: ProjectRoleMemoryRecord[],
  learningSuggestions: ProjectLearningSuggestionRecord[],
  learningReuseCandidates: ProjectLearningReuseCandidateRecord[],
) {
  const memberLines = otherAgents
    .map((agent) => `- ${agent.name}: ${compactAgentResponsibility(agent)}`)
    .join("\n");
  const messageLines = buildRuntimeRecentMessageLines(recentMessages, {
    limit: 5,
    maxLength: 180,
  });
  const artifactLines = buildManagerArtifactCatalogLines(artifacts, {
    limit: 6,
    maxLength: 120,
  });
  const memoryLines = buildManagerMemoryPromptSection(
    projectMemory,
    teamMemory,
    roleMemories.filter((memory) => otherAgents.some((agent) => agent.id === memory.agentId)),
  );
  const learningLines = buildLearningSuggestionPromptSection(learningSuggestions);
  const reuseCandidateLines = buildLearningReuseCandidatePromptSection(learningReuseCandidates, room.id);
  const workspaceGuardrails = buildWorkspaceExecutionGuardrails({
    workspaceDir: room.workspaceDir ?? null,
    textSources: [room.goal, content, ...recentMessages.map((message) => message.content)],
    mode: "manager",
  });

  return `你正在 OpenCrab 的 Team Runtime 中担任项目经理。你需要判断这条群聊消息是否需要委派给其他成员，并给出面向群聊的回应。

团队目标：
${room.goal}

工作空间目录：
${room.workspaceDir || "未指定"}

可委派成员：
${memberLines || "- 无"}

最近群聊：
${messageLines || "- 暂无"}

当前可复用交付物：
${artifactLines || "- 当前还没有可复用交付物"}

Memory Layer：
${memoryLines}

Learning Loop：
${learningLines}

跨项目复用候选：
${reuseCandidateLines}

目录边界：
${workspaceGuardrails}

本轮用户消息：
${content}

请只输出一个 JSON 对象，不要加代码块，不要加解释。格式如下：
{
  "decision": "delegate 或 waiting_user 或 waiting_approval",
  "group_reply": "你准备直接发到群聊里的自然语言回复，必要时显式 @成员名",
  "checkpoint_summary": "当 decision 为 waiting_user 或 waiting_approval 时，给一段可写入团队摘要的结果总结；否则返回空字符串",
  "delegations": [
    {
      "agentName": "必须严格等于上面成员列表里的名字",
      "task": "分配给这个成员的具体任务，必须可执行、不可空泛",
      "artifactTitles": ["如果这条任务依赖已有交付物，这里必须严格填写上面“当前可复用交付物”里的标题；否则返回空数组"]
    }
  ]
}

规则：
1. 如果用户在要求你分工、安排、拆解、推进、拉成员协作，优先委派成员，不要只说你会继续推进。
2. 默认只安排当前最应该启动的一步；如果后续工作依赖本轮结果，不要提前把后续成员全部叫出来。
3. 只有当多个任务明确互不依赖、并且并行推进确实更合理时，才允许同时委派多个成员；即便如此，也尽量不要超过 2 个成员。
4. 如果最新结果已经足够让下一个角色继续工作，就在 group_reply 里明确说明“先由谁继续”，让群里看起来像真实团队接力，而不是一口气全员出动。
5. 当你判断团队还需要继续推进时，decision 必须是 delegate，并且 delegations 不能为空。
6. 当你判断已经拿到了可交付结果，只差用户确认是否结束或提出补充时，decision 必须是 waiting_approval，并在 group_reply 里明确请用户确认或反馈。
7. 当你判断当前缺的是用户补充信息或方向，而不是成员继续工作时，decision 必须是 waiting_user，并在 group_reply 里明确向用户索要什么。
8. decision 不是 delegate 时，delegations 必须为空数组。
9. group_reply 必须是自然中文，适合直接发到群聊里。
10. 不要编造不存在的成员名字。
11. “跨项目复用候选”只是一组可选经验，不是默认必须套用的模板。只有当它和当前项目明确匹配时才采用。
12. 如果某条任务必须基于已有交付物继续推进，必须把这些交付物标题写进 artifactTitles，而不是只在 task 里模糊提一句。
13. artifactTitles 只能使用“当前可复用交付物”里已经出现过的标题。
14. 工作空间目录是这个 Team 的默认产出目录。即使目标、群聊或上游结果里提到了别的代码目录，也默认只把那些路径当作参考输入，不要直接把它们写成默认落地产出目录。
15. 只有当用户这一轮明确要求“直接修改某个外部目录 / 仓库”时，你才允许把那个路径写进 delegation task；否则任务描述里应该明确要求成员把草稿、方案、截图、报告和新产出沉淀到工作空间目录。`;
}

function parseManagerPlan(
  text: string,
  agents: ProjectAgentRecord[],
  artifacts: ProjectArtifactRecord[],
): RuntimeManagerPlan {
  const payload = extractJsonObject(text);
  const decision =
    payload?.decision === "waiting_user" || payload?.decision === "waiting_approval"
      ? payload.decision
      : "delegate";
  const groupReply =
    typeof payload?.group_reply === "string" && payload.group_reply.trim()
      ? payload.group_reply.trim()
      : "收到，我会先收束这轮目标，再决定是否继续派工。";
  const checkpointSummary =
    typeof payload?.checkpoint_summary === "string" && payload.checkpoint_summary.trim()
      ? payload.checkpoint_summary.trim()
      : null;
  const validAgentNames = new Set(agents.map((agent) => agent.name));
  const seenAgentNames = new Set<string>();
  const delegations = Array.isArray(payload?.delegations)
    ? payload.delegations
        .map((item: unknown) => {
          if (!item || typeof item !== "object") {
            return null;
          }

          const candidate = item as { agentName?: unknown; task?: unknown; artifactTitles?: unknown };
          const agentName = typeof candidate.agentName === "string" ? candidate.agentName.trim() : "";
          const task = typeof candidate.task === "string" ? candidate.task.trim() : "";
          const artifactTitles = normalizeDelegationArtifactTitles(candidate.artifactTitles).filter((title) =>
            artifacts.some((artifact) => artifact.title === title),
          );

          if (!agentName || !task || !validAgentNames.has(agentName) || seenAgentNames.has(agentName)) {
            return null;
          }

          seenAgentNames.add(agentName);

          return {
            agentName,
            task,
            artifactTitles,
          };
        })
        .filter(Boolean)
        .slice(0, 2) as RuntimeManagerPlan["delegations"]
    : [];

  return {
    decision: delegations.length > 0 ? "delegate" : decision,
    groupReply,
    checkpointSummary,
    delegations,
  };
}

function extractJsonObject(text: string) {
  const fencedMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const source = fencedMatch?.[1] || text;
  const start = source.indexOf("{");
  const end = source.lastIndexOf("}");

  if (start === -1 || end === -1 || end <= start) {
    return null;
  }

  try {
    return JSON.parse(source.slice(start, end + 1));
  } catch {
    return null;
  }
}

function buildFallbackManagerPlan(
  state: ProjectStoreState,
  projectId: string,
  manager: ProjectAgentRecord,
  content: string,
): RuntimeManagerPlan {
  const projectAgents = state.agents.filter((agent) => agent.projectId === projectId);
  const otherAgents = projectAgents.filter((agent) => agent.id !== manager.id);
  const explicitTargets = otherAgents.filter((agent) => matchesAgentMention(content, agent));
  const autonomousTargets = otherAgents.filter(
    (agent) => !explicitTargets.some((item) => item.id === agent.id) && shouldAgentJoinConversation(content, agent),
  );
  const routedTargets =
    explicitTargets.length > 0
      ? explicitTargets.slice(0, 2)
      : matchesDelegationIntent(content)
        ? otherAgents.slice(0, 1)
        : autonomousTargets.slice(0, 1);
  const hasStageResults = projectAgents.some(
    (agent) => agent.id !== manager.id && Boolean(agent.lastResultSummary),
  );

  if (routedTargets.length === 0) {
    return {
      decision: hasStageResults ? "waiting_approval" : "waiting_user",
      groupReply: hasStageResults
        ? "这一阶段我先收口到这里。当前已经有可交付结果了，你可以先确认是否结束；如果还要继续补充或改方向，直接告诉我，我再拉下一轮。"
        : "收到，我先不盲目继续派工。当前还缺一条更明确的目标或验收标准，请你告诉我这轮最希望团队产出的结果是什么，我再继续推进。",
      checkpointSummary: hasStageResults
        ? "项目经理已基于当前成员结果完成阶段收束，团队已有可交付结论，正在等待用户确认是否结束或继续补充。"
        : "当前缺少足够清晰的用户目标或验收标准，项目经理已暂停继续派工，等待新的补充后再恢复推进。",
      delegations: [],
    };
  }

  return {
    decision: "delegate",
    groupReply: `收到，这一轮先由 ${routedTargets.map((agent) => `@${agent.name}`).join("、")} 接力推进；等这一阶段结果回来后，我再继续安排下一步。`,
    checkpointSummary: null,
    delegations: routedTargets.map((agent) => ({
      agentName: agent.name,
      task: describeAgentAssignment(agent),
      artifactTitles: [],
    })),
  };
}

function buildManagerFollowUpContent(
  delegations: RuntimeManagerPlan["delegations"],
  recentMessages: RuntimeConversationMessage[],
) {
  const latestResults = recentMessages
    .filter((message) => message.role === "assistant" && message.actorLabel)
    .slice(-Math.max(delegations.length, 1))
    .map((message) => `- ${message.actorLabel}: ${compactConversationExcerpt(message.content, 160)}`)
    .join("\n");

  return `我刚收到上一阶段成员结果。请你基于最新群聊判断下一步是否要继续派工、应该先由谁接力，还是应该先向用户收束阶段结论。

上一阶段成员：
${delegations.map((item) => `- ${item.agentName}: ${item.task}`).join("\n") || "- 无"}

上一阶段结果摘要：
${latestResults || "- 暂无"}

请特别注意任务依赖关系：如果下游工作依赖上游结果，不要一次性把后续所有成员都叫出来，而是按阶段继续推进。`;
}

async function executeAgentTask(
  state: ProjectStoreState,
  room: ProjectRoomRecord,
  agent: ProjectAgentRecord,
  task: string,
  recentMessages: RuntimeConversationMessage[],
) {
  const runtimeConversationId = ensureAgentRuntimeConversation(state, room, agent);
  const startedAt = new Date().toISOString();

  updateProjectAgent(state, agent.id, {
    status: "working",
    lastAssignedTask: task,
    currentTaskId: agent.currentTaskId ?? null,
    progressLabel: "准备开始执行",
    progressDetails: `已接到新任务：${compactConversationExcerpt(task, 120)}`,
    lastHeartbeatAt: startedAt,
    progressTrail: appendAgentProgressTrail(agent.progressTrail, {
      label: "准备开始执行",
      detail: `已接到新任务：${compactConversationExcerpt(task, 120)}`,
    }),
  });
  if (agent.currentTaskId) {
    updateProjectTask(state, agent.currentTaskId, {
      status: "in_progress",
      description: task,
      queuedStatus: null,
      claimedAt: state.tasks.find((taskItem) => taskItem.id === agent.currentTaskId)?.claimedAt ?? startedAt,
      recoveryAttemptCount: 0,
      leaseAcquiredAt:
        state.tasks.find((taskItem) => taskItem.id === agent.currentTaskId)?.leaseAcquiredAt ?? startedAt,
      startedAt,
      updatedAt: startedAt,
      blockedByTaskId: null,
      blockedReason: null,
    });
    refreshTaskLease(state, agent.currentTaskId, startedAt);
  }
  writeState(state);

  const currentTask =
    agent.currentTaskId ? state.tasks.find((taskItem) => taskItem.id === agent.currentTaskId) ?? null : null;
  const artifactsById = new Map(
    state.artifacts
      .filter((artifact) => artifact.projectId === room.id)
      .map((artifact) => [artifact.id, artifact] as const),
  );
  const projectMemory = state.projectMemories.find((item) => item.projectId === room.id) ?? null;
  const roleMemory =
    state.roleMemories.find((item) => item.projectId === room.id && item.agentId === agent.id) ?? null;
  const learningSuggestions = state.learningSuggestions.filter((item) => item.projectId === room.id);
  const learningReuseCandidates = state.learningReuseCandidates;
  const prompt = buildWorkerExecutionPrompt(
    room,
    agent,
    task,
    recentMessages,
    currentTask?.inputArtifactIds ?? [],
    artifactsById,
    projectMemory,
    roleMemory,
    learningSuggestions,
    learningReuseCandidates,
  );
  const result = await runConversationTurn({
    conversationId: runtimeConversationId,
    content: prompt,
    model: agent.model,
    reasoningEffort: agent.reasoningEffort,
    sandboxMode: agent.sandboxMode,
    workingDirectory: room.workspaceDir || undefined,
    onThreadReady: () => {
      const nextState = readState();
      updateAgentPublicProgress(nextState, agent.id, {
        label: "已接入运行时",
        detail: "已经拿到新的 runtime 会话，开始读取上下文和当前这棒任务。",
      });
      const nextTaskId = nextState.agents.find((item) => item.id === agent.id)?.currentTaskId ?? null;
      if (nextTaskId) {
        refreshTaskLease(nextState, nextTaskId, new Date().toISOString());
      }
      writeState(nextState);
    },
    onThinking: (entries) => {
      const nextState = readState();
      updateAgentPublicProgress(nextState, agent.id, summarizeThinkingProgress(entries, {
        agent,
        task,
        fallbackLabel: "正在处理当前任务",
        fallbackDetail: "正在梳理任务上下文、已有结果和可交付边界。",
      }));
      const nextTaskId = nextState.agents.find((item) => item.id === agent.id)?.currentTaskId ?? null;
      if (nextTaskId) {
        refreshTaskLease(nextState, nextTaskId, new Date().toISOString());
      }
      writeState(nextState);
    },
    onAssistantText: (text) => {
      const nextState = readState();
      updateAgentPublicProgress(nextState, agent.id, summarizeAssistantDraftProgress(text, {
        fallbackLabel: "正在整理阶段结果",
        fallbackDetail: "已经进入产出阶段，正在把当前这棒的结果整理成可交付说明。",
      }));
      const nextTaskId = nextState.agents.find((item) => item.id === agent.id)?.currentTaskId ?? null;
      if (nextTaskId) {
        refreshTaskLease(nextState, nextTaskId, new Date().toISOString());
      }
      writeState(nextState);
    },
  });
  const replyText = result.assistant.text.trim();
  syncMutableProjectState(state, readState());
  const latestState = readState();
  const latestAgent = latestState.agents.find((item) => item.id === agent.id) ?? null;
  const manager =
    latestState.agents.find((item) => item.projectId === room.id && item.agentProfileId === "project-manager") ||
    latestState.agents.find((item) => item.projectId === room.id && item.canDelegate) ||
    null;

  if (latestAgent?.runtimeConversationId !== runtimeConversationId) {
    throw new ProjectRuntimeReplacedError();
  }

  updateProjectAgent(state, agent.id, {
    status: "reviewing",
    currentTaskId: null,
    lastResultSummary: compactRuntimeText(replyText),
    blockedByAgentId: null,
    lastCompletedAt: new Date().toISOString(),
    progressLabel: "已交回阶段结果",
    progressDetails: compactConversationExcerpt(replyText, 160),
    lastHeartbeatAt: new Date().toISOString(),
    progressTrail: appendAgentProgressTrail(latestAgent?.progressTrail ?? agent.progressTrail, {
      label: "已交回阶段结果",
      detail: compactConversationExcerpt(replyText, 160),
    }),
  });
  if (latestAgent?.currentTaskId) {
    const completedAt = new Date().toISOString();
    const completedTaskTitle =
      latestState.tasks.find((taskItem) => taskItem.id === latestAgent.currentTaskId)?.title ||
      `${agent.name} 的阶段结果`;
    updateProjectTask(state, latestAgent.currentTaskId, {
      status: "completed",
      queuedStatus: null,
      resultSummary: compactRuntimeText(replyText),
      updatedAt: completedAt,
      completedAt,
      recoveryAttemptCount: 0,
    });
    expireTaskLease(state, latestAgent.currentTaskId, completedAt);
    settleProjectStuckSignals(state, {
      projectId: room.id,
      updatedAt: completedAt,
      agentId: agent.id,
      taskId: latestAgent.currentTaskId,
    });
    unlockProjectTaskDependents(state, {
      projectId: room.id,
      completedTaskId: latestAgent.currentTaskId,
      now: completedAt,
    });
    const taskResultArtifact = upsertTaskResultArtifact(state.artifacts, {
      projectId: room.id,
      taskId: latestAgent.currentTaskId,
      taskTitle: completedTaskTitle,
      sourceTaskTitle: completedTaskTitle,
      ownerName: agent.name,
      ownerAgentId: agent.id,
      summary: replyText,
      updatedAt: completedAt,
    });
    state.artifacts = taskResultArtifact.artifacts;
    attachArtifactsToTask(state, latestAgent.currentTaskId, [taskResultArtifact.artifactId]);
    syncProjectArtifactCount(state, room.id);
    settleProjectMailboxThreads(state, {
      projectId: room.id,
      updatedAt: completedAt,
      relatedTaskId: latestAgent.currentTaskId,
    });
    createProjectReview(state, {
      projectId: room.id,
      taskId: latestAgent.currentTaskId,
      taskTitle: completedTaskTitle,
      reviewTargetLabel: `${agent.name} 交回的阶段结果`,
      requesterAgentId: agent.id,
      requesterAgentName: agent.name,
      reviewerAgentId: manager?.id ?? null,
      reviewerAgentName: manager?.name ?? "项目经理",
      summary: `这条任务已经完成，等待 ${manager?.name ?? "项目经理"} 复核本轮结果并决定下一步。`,
      createdAt: new Date().toISOString(),
    });
    if (manager?.id) {
      const downstreamTask =
        state.tasks.find(
          (task) =>
            task.projectId === room.id &&
            task.dependsOnTaskIds.includes(latestAgent.currentTaskId ?? "") &&
            !isProjectTaskTerminal(task.status),
        ) ?? null;
      upsertProjectMailboxThread(state, {
        projectId: room.id,
        kind: "next_step_suggestion",
        subject: `建议下一棒 · ${agent.name}`,
        summary: downstreamTask
          ? `${agent.name} 已交回“${completedTaskTitle}”的结果，建议下一棒由 ${
              downstreamTask.ownerAgentName || "对应成员"
            } 接手“${downstreamTask.title}”。`
          : `${agent.name} 已交回“${completedTaskTitle}”的结果，建议项目经理先进入复核或阶段收束。`,
        fromAgentId: agent.id,
        fromAgentName: agent.name,
        toAgentIds: [manager.id],
        toAgentNames: [manager.name],
        relatedTaskId: latestAgent.currentTaskId,
        relatedTaskTitle: completedTaskTitle,
        relatedArtifactIds: [taskResultArtifact.artifactId],
        createdAt: completedAt,
      });
    }
  }
  writeState(state);

  return replyText;
}

function syncMutableProjectState(target: ProjectStoreState, source: ProjectStoreState) {
  target.rooms = source.rooms;
  target.agents = source.agents;
  target.events = source.events;
  target.artifacts = source.artifacts;
  target.mailboxThreads = source.mailboxThreads;
  target.projectMemories = source.projectMemories;
  target.teamMemories = source.teamMemories;
  target.roleMemories = source.roleMemories;
  target.taskReflections = source.taskReflections;
  target.stageReflections = source.stageReflections;
  target.runSummaries = source.runSummaries;
  target.learningSuggestions = source.learningSuggestions;
  target.autonomyGates = source.autonomyGates;
  target.heartbeats = source.heartbeats;
  target.stuckSignals = source.stuckSignals;
  target.recoveryActions = source.recoveryActions;
  target.reviews = source.reviews;
  target.runs = source.runs;
}

function buildWorkerExecutionPrompt(
  room: ProjectRoomRecord,
  agent: ProjectAgentRecord,
  task: string,
  recentMessages: RuntimeConversationMessage[],
  inputArtifactIds: string[],
  artifactsById: Map<string, ProjectArtifactRecord>,
  projectMemory: ProjectMemoryRecord | null,
  roleMemory: ProjectRoleMemoryRecord | null,
  learningSuggestions: ProjectLearningSuggestionRecord[],
  learningReuseCandidates: ProjectLearningReuseCandidateRecord[],
) {
  const messageLines = buildRuntimeRecentMessageLines(recentMessages, {
    limit: 5,
    maxLength: 180,
  });
  const artifactLines = buildWorkerArtifactInputLines(inputArtifactIds, artifactsById, {
    limit: 4,
    maxLength: 120,
  });
  const memoryLines = buildWorkerMemoryPromptSection(projectMemory, roleMemory);
  const learningLines = buildLearningSuggestionPromptSection(learningSuggestions);
  const reuseCandidateLines = buildLearningReuseCandidatePromptSection(learningReuseCandidates, room.id);
  const workspaceGuardrails = buildWorkspaceExecutionGuardrails({
    workspaceDir: room.workspaceDir ?? null,
    textSources: [room.goal, task, ...recentMessages.map((message) => message.content)],
    mode: "worker",
  });

  return `你正在 OpenCrab 的 Team Runtime 中以成员身份执行一个子任务。请直接完成任务，不要只回复“收到”。

团队目标：
${room.goal}

工作空间目录：
${room.workspaceDir || "未指定"}

你的职责：
${compactAgentResponsibility(agent)}

最近群聊：
${messageLines || "- 暂无"}

这条任务可直接复用的交付物：
${artifactLines || "- 当前没有显式挂接的输入交付物"}

Memory Layer：
${memoryLines}

Learning Loop：
${learningLines}

跨项目复用候选：
${reuseCandidateLines}

目录边界：
${workspaceGuardrails}

项目经理分配给你的任务：
${task}

输出要求：
1. 直接给出这项子任务的第一版结果。
2. 优先提供具体判断、方案、步骤、结构或内容，而不是承诺。
3. 如果信息不够，也先给最有价值的初版，并明确缺口。
4. “跨项目复用候选”只是一组可选经验，不是默认必须照搬的模板；只有明确匹配当前任务时才采用。
5. 不要说“收到”“我会先”“稍后回传”这类过程性空话。
6. 默认把工作空间目录当成唯一的产出落点；除非用户本轮明确要求直接修改别的目录，否则不要在工作空间目录之外新建或改写文件。
7. 如果团队目标或任务里提到了别的代码目录，那默认表示“可读取、可参考”，不自动等于“去那里写结果”。
8. 如果确实需要参考外部代码库，也优先把分析、草稿、截图、报告和阶段交付物写回工作空间目录，并在回复里说明你参考了哪个路径。`;
}

function buildWorkspaceExecutionGuardrails(input: {
  workspaceDir: string | null;
  textSources: string[];
  mode: "manager" | "worker";
}) {
  const workspaceDir = input.workspaceDir?.trim() || null;
  const referencedPaths = extractAbsolutePathsFromTexts(input.textSources);
  const externalPaths = referencedPaths.filter((candidate) => {
    if (!workspaceDir) {
      return true;
    }

    const normalizedWorkspaceDir = path.normalize(workspaceDir);
    const normalizedCandidate = path.normalize(candidate);
    return (
      normalizedCandidate !== normalizedWorkspaceDir &&
      !normalizedCandidate.startsWith(`${normalizedWorkspaceDir}${path.sep}`)
    );
  });

  const lines = [
    workspaceDir
      ? `- 工作空间目录：${workspaceDir}。默认所有新建文件、草稿、截图、方案文档和阶段产物都应写到这里。`
      : "- 当前没有工作空间目录，请优先用自然语言交付，不要假设别的目录就是默认产出位置。",
  ];

  if (externalPaths.length > 0) {
    lines.push("- 目标或上下文里还提到了这些外部路径，请默认只把它们当作参考输入，而不是默认写入目标：");
    lines.push(...externalPaths.slice(0, 6).map((candidate) => `  - ${candidate}`));
  }

  lines.push(
    input.mode === "manager"
      ? "- 给成员派工时，除非用户这一轮明确要求直接修改某个外部目录，否则不要把外部路径写成默认落地产出目录。"
      : "- 执行任务时，除非用户这一轮明确要求直接修改某个外部目录，否则不要跨目录写文件。",
  );

  lines.push("- 如果需要读取外部代码库，请把它视为参考源；读取后产出的分析、计划、截图和交付说明仍应回写到工作空间目录。");

  return lines.join("\n");
}

function extractAbsolutePathsFromTexts(textSources: string[]) {
  const candidates = new Set<string>();

  for (const source of textSources) {
    if (!source) {
      continue;
    }

    for (const match of source.matchAll(/(?:\/Users\/[^\s，。；、"'`()]+|\/[A-Za-z0-9._~/-]+)/g)) {
      const value = match[0]?.trim();

      if (!value || !path.isAbsolute(value)) {
        continue;
      }

      candidates.add(value.replace(/[),.，。；;！？!]+$/u, ""));
    }
  }

  return [...candidates];
}

export function updateProjectWorkspaceDir(projectId: string, workspaceDir: string) {
  const state = readState();
  const room = state.rooms.find((item) => item.id === projectId) ?? null;

  if (!room) {
    return null;
  }

  const normalizedWorkspaceDir = normalizeProjectWorkspaceDir(workspaceDir);
  const now = new Date().toISOString();

  state.rooms = state.rooms.map((item) =>
    item.id === projectId
      ? {
          ...item,
          workspaceDir: normalizedWorkspaceDir,
          updatedAt: now,
        }
      : item,
  );

  if (room.teamConversationId) {
    updateStoredConversation(room.teamConversationId, {
      projectId: room.id,
      workspaceDir: normalizedWorkspaceDir,
      sandboxMode: room.sandboxMode,
    });
  }

  state.agents
    .filter((agent) => agent.projectId === projectId && agent.runtimeConversationId)
    .forEach((agent) => {
      if (!agent.runtimeConversationId) {
        return;
      }

      updateStoredConversation(agent.runtimeConversationId, {
        workspaceDir: normalizedWorkspaceDir,
        sandboxMode: agent.sandboxMode,
      });
    });

  writeState(state);

  return getProjectDetail(projectId);
}

export function updateProjectSandboxMode(
  projectId: string,
  sandboxMode: ProjectRoomRecord["sandboxMode"],
) {
  const state = readState();
  const room = state.rooms.find((item) => item.id === projectId) ?? null;

  if (!room) {
    return null;
  }

  const normalizedSandboxMode =
    sandboxMode === "read-only" ||
    sandboxMode === "workspace-write" ||
    sandboxMode === "danger-full-access"
      ? sandboxMode
      : "workspace-write";
  const now = new Date().toISOString();

  state.rooms = state.rooms.map((item) =>
    item.id === projectId
      ? {
          ...item,
          sandboxMode: normalizedSandboxMode,
          updatedAt: now,
        }
      : item,
  );
  state.agents = state.agents.map((agent) =>
    agent.projectId === projectId
      ? {
          ...agent,
          sandboxMode: normalizedSandboxMode,
        }
      : agent,
  );

  if (room.teamConversationId) {
    updateStoredConversation(room.teamConversationId, {
      projectId: room.id,
      workspaceDir: room.workspaceDir,
      sandboxMode: normalizedSandboxMode,
    });
  }

  state.agents
    .filter((agent) => agent.projectId === projectId && agent.runtimeConversationId)
    .forEach((agent) => {
      if (!agent.runtimeConversationId) {
        return;
      }

      updateStoredConversation(agent.runtimeConversationId, {
        workspaceDir: room.workspaceDir,
        sandboxMode: normalizedSandboxMode,
      });
    });

  writeState(state);

  return getProjectDetail(projectId);
}

export function updateProjectFeishuChatSessionId(
  projectId: string,
  feishuChatSessionId: string | null | undefined,
) {
  const state = readState();
  const room = state.rooms.find((item) => item.id === projectId) ?? null;

  if (!room) {
    return null;
  }

  const normalizedFeishuChatSessionId = normalizeFeishuChatSessionId(feishuChatSessionId);
  const teamConversationId = normalizedFeishuChatSessionId
    ? ensureTeamConversation(state, {
        ...room,
        feishuChatSessionId: normalizedFeishuChatSessionId,
      })
    : room.teamConversationId;
  const now = new Date().toISOString();

  state.rooms = state.rooms.map((item) =>
    item.id === projectId
      ? {
          ...item,
          teamConversationId: teamConversationId ?? null,
          feishuChatSessionId: normalizedFeishuChatSessionId,
          updatedAt: now,
        }
      : item,
  );

  if (teamConversationId) {
    updateStoredConversation(teamConversationId, {
      projectId: room.id,
      workspaceDir: room.workspaceDir,
      sandboxMode: room.sandboxMode,
      feishuChatSessionId: normalizedFeishuChatSessionId,
    });
    reconcileConversationBinding({
      kind: "product_bound",
      channelId: "feishu",
      conversationId: teamConversationId,
      remoteChatId: normalizedFeishuChatSessionId,
      remoteChatLabel: normalizedFeishuChatSessionId ?? `${room.teamName} · 群聊`,
      remoteUserId: null,
      remoteUserLabel: null,
    });
  }

  writeState(state);

  return getProjectDetail(projectId);
}

function ensureAgentRuntimeConversation(
  state: ProjectStoreState,
  room: ProjectRoomRecord,
  agent: ProjectAgentRecord,
) {
  if (agent.runtimeConversationId) {
    const snapshot = getSnapshot();
    const runtimeMessages = snapshot.conversationMessages[agent.runtimeConversationId] ?? [];
    const totalChars = runtimeMessages.reduce((sum, message) => sum + message.content.length, 0);

    if (runtimeMessages.length <= 8 && totalChars <= 16_000) {
      updateStoredConversation(agent.runtimeConversationId, {
        workspaceDir: room.workspaceDir,
        sandboxMode: agent.sandboxMode,
      });
      return agent.runtimeConversationId;
    }

    clearConversationBindings(agent.runtimeConversationId);
    deleteConversation(agent.runtimeConversationId);
    updateProjectAgent(state, agent.id, {
      runtimeConversationId: null,
    });
  }

  const existing = getSnapshot().conversations.find(
    (conversation) =>
      conversation.hidden === true &&
      conversation.agentProfileId === (agent.agentProfileId ?? null) &&
      conversation.title === `${room.teamName} · ${agent.name} runtime`,
  );

  if (existing) {
    updateStoredConversation(existing.id, {
      workspaceDir: room.workspaceDir,
      sandboxMode: agent.sandboxMode,
    });
    updateProjectAgent(state, agent.id, {
      runtimeConversationId: existing.id,
    });
    writeState(state);
    return existing.id;
  }

  const created = createConversation({
    title: `${room.teamName} · ${agent.name} runtime`,
    hidden: true,
    workspaceDir: room.workspaceDir,
    sandboxMode: agent.sandboxMode,
    agentProfileId: agent.agentProfileId ?? null,
  });

  updateProjectAgent(state, agent.id, {
    runtimeConversationId: created.conversationId,
  });
  writeState(state);

  return created.conversationId;
}

function enqueueProjectRuntimeWork(
  projectId: string,
  taskFactory: () => Promise<void>,
  options: { interrupt?: boolean } = {},
) {
  if (!globalThis.__opencrabProjectRuntimeQueues) {
    globalThis.__opencrabProjectRuntimeQueues = new Map();
  }

  const running = options.interrupt
    ? Promise.resolve()
    : globalThis.__opencrabProjectRuntimeQueues.get(projectId) ?? Promise.resolve();
  const next = running
    .catch(() => undefined)
    .then(taskFactory)
    .catch(() => undefined)
    .finally(() => {
      if (globalThis.__opencrabProjectRuntimeQueues?.get(projectId) === next) {
        globalThis.__opencrabProjectRuntimeQueues.delete(projectId);
      }
    });

  globalThis.__opencrabProjectRuntimeQueues.set(projectId, next);
}

function isProjectRuntimePaused(room: ProjectRoomRecord | null) {
  return !room || room.status === "paused" || room.runStatus === "paused";
}

function collectPendingDelegationsForResume(
  projectAgents: ProjectAgentRecord[],
  managerId: string,
  room: ProjectRoomRecord,
  tasks: ProjectTaskRecord[],
  artifacts: ProjectArtifactRecord[],
) {
  const artifactTitlesById = new Map(artifacts.map((artifact) => [artifact.id, artifact.title] as const));
  const taskQueue = tasks
    .filter(
      (task) =>
        task.projectId === room.id &&
        task.ownerAgentId !== managerId &&
        (task.status === "reopened" || task.status === "claimed" || task.status === "ready" || task.status === "blocked"),
    )
    .sort((left, right) => sortProjectTasks(left, right));

  if (taskQueue.length > 0) {
    const ordered: RuntimeManagerPlan["delegations"] = [];
    const seenTaskIds = new Set<string>();
    let currentTask =
      taskQueue.find((task) => task.status === "reopened" || task.status === "claimed" || task.status === "ready") ||
      null;

    while (currentTask && !seenTaskIds.has(currentTask.id) && ordered.length < 4) {
      seenTaskIds.add(currentTask.id);
      ordered.push({
        agentName: currentTask.ownerAgentName || "未命名成员",
        task: currentTask.description,
        artifactTitles: currentTask.inputArtifactIds
          .map((artifactId) => artifactTitlesById.get(artifactId) ?? null)
          .filter(Boolean) as string[],
      });

      currentTask =
        taskQueue.find((task) => task.blockedByTaskId === currentTask?.id && !seenTaskIds.has(task.id)) || null;
    }

    if (ordered.length > 0) {
      return ordered;
    }
  }

  const ordered: RuntimeManagerPlan["delegations"] = [];
  const seen = new Set<string>();

  let current =
    projectAgents.find((agent) => agent.id === room.activeAgentId && agent.id !== managerId) ||
    projectAgents.find((agent) => agent.id === room.nextAgentId && agent.id !== managerId) ||
    projectAgents.find(
      (agent) =>
        agent.id !== managerId &&
        Boolean(agent.lastAssignedTask) &&
        (agent.status === "working" || Boolean(agent.blockedByAgentId)),
    ) ||
    null;

  while (current && !seen.has(current.id) && ordered.length < 4) {
    seen.add(current.id);

    if (current.lastAssignedTask) {
      ordered.push({
        agentName: current.name,
        task: current.lastAssignedTask,
        artifactTitles: [],
      });
    }

    current =
      projectAgents.find((agent) => agent.blockedByAgentId === current?.id && !seen.has(agent.id)) ||
      null;
  }

  return ordered;
}

async function continueProjectDelegationsInBackground(input: {
  projectId: string;
  conversationId: string;
  delegations: RuntimeManagerPlan["delegations"];
  recentMessages: RuntimeConversationMessage[];
}) {
  let recentMessages = [...input.recentMessages];
  let pendingDelegations = [...input.delegations];
  let cycleCount = 0;

  while (pendingDelegations.length > 0 && cycleCount < 12) {
    for (const delegation of pendingDelegations) {
      const state = readState();
      const room = state.rooms.find((item) => item.id === input.projectId) ?? null;

      if (!room || isProjectRuntimePaused(room)) {
        return;
      }

      const agent = state.agents.find(
        (item) => item.projectId === input.projectId && item.name === delegation.agentName,
      );

      if (!agent) {
        continue;
      }

      const linkedTask =
        agent.currentTaskId ? state.tasks.find((task) => task.id === agent.currentTaskId) ?? null : null;

      if (linkedTask?.status === "blocked") {
        continue;
      }

      let workerReply = "";

      try {
        workerReply = await executeAgentTask(state, room, agent, delegation.task, recentMessages);
      } catch (error) {
        if (error instanceof ProjectRuntimeReplacedError) {
          return;
        }

        const failureState = readState();
        const failureManager =
          failureState.agents.find(
            (item) => item.projectId === input.projectId && item.agentProfileId === "project-manager",
          ) ||
          failureState.agents.find((item) => item.projectId === input.projectId && item.canDelegate) ||
          null;
        const failureAgent =
          failureState.agents.find(
            (item) => item.projectId === input.projectId && item.name === delegation.agentName,
          ) || null;

        if (!failureManager || !failureAgent) {
          return;
        }

        handleProjectRuntimeFailure(failureState, {
          projectId: input.projectId,
          conversationId: input.conversationId,
          manager: failureManager,
          failedAgent: failureAgent,
          errorMessage: error instanceof Error ? error.message : "成员执行时发生了未知错误。",
          now: new Date().toISOString(),
        });
        return;
      }

      const latestStateAfterWorker = readState();
      const latestRoomAfterWorker =
        latestStateAfterWorker.rooms.find((item) => item.id === input.projectId) ?? null;

      if (isProjectRuntimePaused(latestRoomAfterWorker)) {
        return;
      }

      appendTeamConversationMessages(input.conversationId, [
        {
          actorLabel: agent.name,
          content: workerReply,
        },
      ]);

      const now = new Date().toISOString();
      state.rooms = state.rooms.map((item) =>
        item.id === input.projectId
          ? {
              ...item,
              summary: workerReply,
              lastActivityLabel: `${agent.name} 刚刚提交了阶段结果`,
              updatedAt: now,
            }
          : item,
      );
      writeState(state);

      const workerMessage: RuntimeConversationMessage = {
        role: "assistant",
        actorLabel: agent.name,
        content: workerReply,
      };

      recentMessages = [...recentMessages, workerMessage].slice(-6);
    }

    cycleCount += 1;

    const state = readState();
    const room = state.rooms.find((item) => item.id === input.projectId) ?? null;
    const projectAgents = state.agents.filter((agent) => agent.projectId === input.projectId);
    const manager =
      projectAgents.find((agent) => agent.agentProfileId === "project-manager") ||
      projectAgents.find((agent) => agent.canDelegate) ||
      null;

    if (!room || isProjectRuntimePaused(room) || !manager) {
      return;
    }

    const autonomyBudget = room.autonomyRoundBudget ?? PROJECT_AUTONOMY_ROUND_BUDGET;
    const autonomyRoundCount = room.autonomyRoundCount ?? 0;

    if (autonomyRoundCount >= autonomyBudget || cycleCount >= 12) {
      const now = new Date().toISOString();
      const gateSummary = buildAutonomyBudgetGateSummary({
        roundCount: Math.max(autonomyRoundCount, cycleCount),
        roundBudget: autonomyBudget,
      });
      resolveProjectAutonomyGate(state, {
        projectId: input.projectId,
        kind: "autonomy_budget",
        title: "已达到本轮安全自治上限",
        summary: gateSummary,
        now,
      });
      appendTeamConversationMessages(input.conversationId, [
        {
          actorLabel: manager.name,
          content:
            "这一轮我先停在安全边界上。当前已经连续自主推进了几棒，如果你确认继续，我会再往下跑一段。",
        },
      ]);
      state.rooms = state.rooms.map((item) =>
        item.id === input.projectId
          ? {
              ...item,
              autonomyStatus: "gated",
              autonomyPauseReason: gateSummary,
              updatedAt: now,
            }
          : item,
      );
      applyProjectManagerCheckpoint(state, {
        projectId: input.projectId,
        managerId: manager.id,
        decision: "waiting_approval",
        summary: gateSummary,
        now,
      });
      writeState(state);
      return;
    }

    const riskGate = detectProjectAutonomyRiskGate(state, room);

    if (riskGate) {
      const now = new Date().toISOString();
      resolveProjectAutonomyGate(state, {
        projectId: input.projectId,
        kind: "risk_boundary",
        title: riskGate.title,
        summary: riskGate.summary,
        now,
      });
      appendTeamConversationMessages(input.conversationId, [
        {
          actorLabel: manager.name,
          content: "我先停一下。这一轮已经碰到风险边界，继续自动推进前更适合先由你决定要不要放行。",
        },
      ]);
      state.rooms = state.rooms.map((item) =>
        item.id === input.projectId
          ? {
              ...item,
              autonomyStatus: "gated",
              autonomyPauseReason: riskGate.summary,
              updatedAt: now,
            }
          : item,
      );
      applyProjectManagerCheckpoint(state, {
        projectId: input.projectId,
        managerId: manager.id,
        decision: "waiting_approval",
        summary: riskGate.summary,
        now,
      });
      writeState(state);
      return;
    }

    const followUpContent = buildManagerFollowUpContent(pendingDelegations, recentMessages);
    let followUpPlan: RuntimeManagerPlan | null = null;

    try {
      followUpPlan = await planProjectConversationWithManager(
        state,
        room,
        manager,
        projectAgents,
        followUpContent,
        recentMessages,
      );
    } catch (error) {
      handleProjectRuntimeFailure(state, {
        projectId: input.projectId,
        conversationId: input.conversationId,
        manager,
        failedAgent: manager,
        errorMessage: error instanceof Error ? error.message : "项目经理在收束阶段结果时发生了未知错误。",
        now: new Date().toISOString(),
      });
      return;
    }

    followUpPlan ||= {
      decision: "waiting_user",
      groupReply: "这一阶段的结果我已经收到。我先把当前结论收束一下，如果需要下一位成员接力，我会继续在群里安排。",
      checkpointSummary: null,
      delegations: [],
    };

    if (isProjectRuntimePaused(readState().rooms.find((item) => item.id === input.projectId) ?? null)) {
      return;
    }

    appendTeamConversationMessages(input.conversationId, [
      {
        actorLabel: manager.name,
        content: followUpPlan.groupReply,
      },
    ]);

    const managerMessage: RuntimeConversationMessage = {
      role: "assistant",
      actorLabel: manager.name,
      content: followUpPlan.groupReply,
    };
    recentMessages = [...recentMessages, managerMessage].slice(-6);

    const now = new Date().toISOString();
    state.rooms = state.rooms.map((item) =>
      item.id === input.projectId
        ? {
            ...item,
            runStatus: "running",
            summary: followUpPlan.groupReply,
            lastActivityLabel:
              followUpPlan.delegations.length > 0
                ? "项目经理刚刚更新了下一步安排"
                : "项目经理刚刚收束了阶段结论",
            updatedAt: now,
          }
        : item,
    );

    if (followUpPlan.delegations.length === 0) {
      if (followUpPlan.decision === "waiting_user" || followUpPlan.decision === "waiting_approval") {
        applyProjectManagerCheckpoint(state, {
          projectId: input.projectId,
          managerId: manager.id,
          decision: followUpPlan.decision,
          summary: followUpPlan.checkpointSummary || followUpPlan.groupReply,
          now,
        });
      } else {
        clearRuntimeDelegationState(state, {
          projectId: input.projectId,
          managerId: manager.id,
          stageLabel: "阶段收束",
        });
      }
      writeState(state);
      return;
    }

    consumeProjectAutonomyRound(state, {
      projectId: input.projectId,
      now,
    });
    applyRuntimeDelegationState(state, {
      projectId: input.projectId,
      managerId: manager.id,
      delegations: followUpPlan.delegations,
      fallbackStageLabel: "项目经理统筹",
    });
    writeState(state);

    pendingDelegations = [...followUpPlan.delegations];
  }
}

function updateProjectAgent(
  state: ProjectStoreState,
  agentId: string,
  patch: Partial<ProjectAgentRecord>,
) {
  state.agents = state.agents.map((agent) =>
    agent.id === agentId
      ? {
          ...agent,
          ...patch,
        }
      : agent,
  );
}

function shouldReplyWithProjectProgress(
  room: ProjectRoomRecord,
  manager: ProjectAgentRecord,
  projectAgents: ProjectAgentRecord[],
  content: string,
) {
  if (room.runStatus !== "running") {
    return false;
  }

  const normalized = content.replace(/\s+/g, "").toLowerCase();

  if (!/(进展|进度|状态|怎么样|做到哪|到哪了|当前情况|卡住|汇报|同步|目前)/u.test(normalized)) {
    return false;
  }

  const activeAgent = projectAgents.find((agent) => agent.id === room.activeAgentId) ?? null;

  return Boolean(activeAgent && activeAgent.id !== manager.id);
}

function shouldAttemptRuntimeRecovery(content: string) {
  const normalized = content.replace(/\s+/g, "").toLowerCase();
  return /(进展|进度|状态|怎么样|做到哪|到哪了|卡住|恢复|重试|重启|继续推进|重新推进|怎么还没)/u.test(
    normalized,
  );
}

function pickReplacementWorker(
  projectAgents: ProjectAgentRecord[],
  input: {
    failedAgentId: string;
    preferredVisibility: ProjectAgentRecord["visibility"];
  },
) {
  return (
    [...projectAgents]
      .filter(
        (agent) =>
          !agent.canDelegate &&
          agent.id !== input.failedAgentId &&
          !agent.currentTaskId &&
          agent.status !== "working",
      )
      .sort((left, right) => {
        const leftVisibilityScore = left.visibility === input.preferredVisibility ? 0 : 1;
        const rightVisibilityScore = right.visibility === input.preferredVisibility ? 0 : 1;

        if (leftVisibilityScore !== rightVisibilityScore) {
          return leftVisibilityScore - rightVisibilityScore;
        }

        if (left.status !== right.status) {
          return left.status === "idle" ? -1 : 1;
        }

        return left.name.localeCompare(right.name, "zh-Hans-CN");
      })[0] ?? null
  );
}

function recoverStalledProjectRuntime(input: {
  state: ProjectStoreState;
  room: ProjectRoomRecord;
  manager: ProjectAgentRecord;
  projectAgents: ProjectAgentRecord[];
  conversationId: string;
  recentGroupMessages: RuntimeConversationMessage[];
}) {
  const activeAgent =
    input.projectAgents.find((agent) => agent.id === input.room.activeAgentId) ?? null;

  if (!activeAgent || activeAgent.canDelegate || !activeAgent.lastAssignedTask) {
    return null;
  }

  const runtimeState = inspectAgentRuntimeState(activeAgent);

  if (runtimeState.status !== "stalled") {
    return null;
  }

  const now = new Date().toISOString();
  const activeTask =
    activeAgent.currentTaskId
      ? input.state.tasks.find((task) => task.id === activeAgent.currentTaskId) ?? null
      : null;

  upsertProjectStuckSignal(input.state, {
    projectId: input.room.id,
    agentId: activeAgent.id,
    agentName: activeAgent.name,
    taskId: activeTask?.id ?? null,
    taskTitle: activeTask?.title ?? null,
    kind: runtimeState.kind,
    summary: runtimeState.detail,
    detectedAt: now,
  });

  if (activeAgent.runtimeConversationId) {
    clearConversationBindings(activeAgent.runtimeConversationId);
    deleteConversation(activeAgent.runtimeConversationId);
  }
  const nextRecoveryAttemptCount = (activeTask?.recoveryAttemptCount ?? 0) + 1;
  const shouldReassignToManager =
    Boolean(activeTask) && nextRecoveryAttemptCount >= TASK_RECOVERY_LIMIT_BEFORE_REASSIGN;

  if (activeTask) {
    updateProjectTask(input.state, activeTask.id, {
      recoveryAttemptCount: nextRecoveryAttemptCount,
      updatedAt: now,
    });
  }

  const replacementAgent =
    shouldReassignToManager && activeTask
      ? pickReplacementWorker(input.projectAgents, {
          failedAgentId: activeAgent.id,
          preferredVisibility: activeAgent.visibility,
        })
      : null;

  if (replacementAgent && activeTask) {
    const reason = `这条任务已经连续 ${nextRecoveryAttemptCount} 次在后台执行中租约过期或没有正常回传，项目经理已把 baton 改派给 ${replacementAgent.name} 继续接力。`;
    const reassignedTask = reassignTaskOwner(input.state, {
      taskId: activeTask.id,
      ownerAgentId: replacementAgent.id,
      ownerAgentName: replacementAgent.name,
      reason,
      now,
      nextStatus: activeTask.blockedByTaskId || activeTask.lockBlockedByTaskId ? "blocked" : "claimed",
    });

    settleProjectStuckSignals(input.state, {
      projectId: input.room.id,
      updatedAt: now,
      agentId: activeAgent.id,
      taskId: activeTask.id,
    });
    appendProjectRecoveryAction(input.state, {
      projectId: input.room.id,
      kind: "reassign_to_peer",
      summary: reason,
      taskId: activeTask.id,
      taskTitle: activeTask.title,
      fromAgentId: activeAgent.id,
      fromAgentName: activeAgent.name,
      toAgentId: replacementAgent.id,
      toAgentName: replacementAgent.name,
      createdAt: now,
    });

    updateProjectAgent(input.state, activeAgent.id, {
      runtimeConversationId: null,
      status: "idle",
      currentTaskId: null,
      blockedByAgentId: null,
      lastResultSummary: "这一棒连续异常，任务已改派给其他成员继续接力。",
      progressLabel: "任务已交给替补成员",
      progressDetails: reason,
      lastHeartbeatAt: now,
      progressTrail: appendAgentProgressTrail(activeAgent.progressTrail, {
        label: "任务已交给替补成员",
        detail: reason,
        createdAt: now,
      }),
    });
    updateProjectAgent(input.state, replacementAgent.id, {
      status: "working",
      currentTaskId: reassignedTask?.id ?? replacementAgent.currentTaskId ?? null,
      blockedByAgentId: null,
      lastAssignedTask: activeTask.description,
      progressLabel: "已接替卡住任务",
      progressDetails: `项目经理已把卡住的这一棒改派给 ${replacementAgent.name}：${compactConversationExcerpt(
        activeTask.description,
        140,
      )}`,
      lastHeartbeatAt: now,
      progressTrail: appendAgentProgressTrail(replacementAgent.progressTrail, {
        label: "已接替卡住任务",
        detail: `项目经理已把卡住的这一棒改派给 ${replacementAgent.name}：${compactConversationExcerpt(
          activeTask.description,
          140,
        )}`,
        createdAt: now,
      }),
    });
    updateProjectAgent(input.state, input.manager.id, {
      status: "planning",
      currentTaskId: input.manager.currentTaskId ?? null,
      blockedByAgentId: null,
      progressLabel: "已安排替补成员继续",
      progressDetails: compactConversationExcerpt(reason, 180),
      lastHeartbeatAt: now,
      progressTrail: appendAgentProgressTrail(input.manager.progressTrail, {
        label: "已安排替补成员继续",
        detail: reason,
        createdAt: now,
      }),
    });

    input.state.rooms = input.state.rooms.map((room) =>
      room.id === input.room.id
        ? {
            ...room,
            activeAgentId: replacementAgent.id,
            nextAgentId: input.manager.id,
            currentStageLabel: input.room.currentStageLabel || "团队推进",
            summary: reason,
            lastActivityLabel: `${replacementAgent.name} 已接替卡住任务`,
            updatedAt: now,
          }
        : room,
    );
    input.state.events = [
      {
        id: `${input.room.id}-event-owner-replacement-${crypto.randomUUID()}`,
        projectId: input.room.id,
        actorName: input.manager.name,
        title: "已替换执行成员继续推进",
        description: `@${activeAgent.name} 这一棒连续异常，任务已改派给 @${replacementAgent.name} 继续接力。`,
        visibility: "backstage",
        createdAt: now,
      },
      ...input.state.events,
    ];
    upsertProjectMailboxThread(input.state, {
      projectId: input.room.id,
      kind: "direct_message",
      subject: `PM 改派 · ${replacementAgent.name}`,
      summary: `项目经理已把卡住任务正式改派给 ${replacementAgent.name}，由他继续接住“${activeTask.title}”。`,
      fromAgentId: input.manager.id,
      fromAgentName: input.manager.name,
      toAgentIds: [replacementAgent.id],
      toAgentNames: [replacementAgent.name],
      relatedTaskId: activeTask.id,
      relatedTaskTitle: activeTask.title,
      createdAt: now,
    });

    const managerReply = [
      `我检查到 @${activeAgent.name} 这一棒已经连续 ${nextRecoveryAttemptCount} 次没有正常续约，卡点是：${runtimeState.detail}`,
      `我这次不再把任务收回给 PM，而是直接改派给 @${replacementAgent.name} 继续接力，尽量不打断当前任务链。`,
      "接下来我会继续盯这条 baton 的回传；一旦拿到新结果，就继续安排下一步。",
    ].join("\n");

    appendTeamConversationMessages(input.conversationId, [
      {
        actorLabel: input.manager.name,
        content: managerReply,
      },
    ]);
    writeState(input.state);

    enqueueProjectRuntimeWork(
      input.room.id,
      async () => {
        await continueProjectDelegationsInBackground({
          projectId: input.room.id,
          conversationId: input.conversationId,
          delegations: [
            {
              agentName: replacementAgent.name,
              task: activeTask.description,
              artifactTitles: [],
            },
          ],
          recentMessages: [
            ...input.recentGroupMessages,
            {
              role: "assistant",
              actorLabel: input.manager.name,
              content: managerReply,
            },
          ],
        });
      },
      { interrupt: true },
    );

    return managerReply;
  }

  if (shouldReassignToManager && activeTask) {
    const reason = `这条任务已经连续 ${nextRecoveryAttemptCount} 次在后台执行中租约过期或没有正常回传，项目经理已收回 ownership 准备重新编排。`;
    const reassignedTask = reassignTaskOwner(input.state, {
      taskId: activeTask.id,
      ownerAgentId: input.manager.id,
      ownerAgentName: input.manager.name,
      reason,
      now,
      nextStatus: activeTask.blockedByTaskId || activeTask.lockBlockedByTaskId ? "blocked" : "claimed",
    });
    settleProjectStuckSignals(input.state, {
      projectId: input.room.id,
      updatedAt: now,
      agentId: activeAgent.id,
      taskId: activeTask.id,
    });
    appendProjectRecoveryAction(input.state, {
      projectId: input.room.id,
      kind: "take_over_by_manager",
      summary: reason,
      taskId: activeTask.id,
      taskTitle: activeTask.title,
      fromAgentId: activeAgent.id,
      fromAgentName: activeAgent.name,
      toAgentId: input.manager.id,
      toAgentName: input.manager.name,
      createdAt: now,
    });

    updateProjectAgent(input.state, activeAgent.id, {
      runtimeConversationId: null,
      status: "idle",
      currentTaskId: null,
      blockedByAgentId: null,
      lastResultSummary: "这一棒连续异常，任务已被项目经理回收重新编排。",
      progressLabel: "任务已被项目经理接管",
      progressDetails: reason,
      lastHeartbeatAt: now,
      progressTrail: appendAgentProgressTrail(activeAgent.progressTrail, {
        label: "任务已被项目经理接管",
        detail: reason,
        createdAt: now,
      }),
    });
    updateProjectAgent(input.state, input.manager.id, {
      status: "planning",
      currentTaskId: reassignedTask?.id ?? input.manager.currentTaskId ?? null,
      blockedByAgentId: null,
      progressLabel: "已接管异常任务",
      progressDetails: compactConversationExcerpt(reason, 180),
      lastHeartbeatAt: now,
      progressTrail: appendAgentProgressTrail(input.manager.progressTrail, {
        label: "已接管异常任务",
        detail: reason,
        createdAt: now,
      }),
    });

    input.state.rooms = input.state.rooms.map((room) =>
      room.id === input.room.id
        ? {
            ...room,
            activeAgentId: input.manager.id,
            nextAgentId: activeAgent.id,
            currentStageLabel: "项目经理统筹",
            summary: reason,
            lastActivityLabel: "项目经理已接管异常任务",
            updatedAt: now,
          }
        : room,
    );
    input.state.events = [
      {
        id: `${input.room.id}-event-owner-replacement-${crypto.randomUUID()}`,
        projectId: input.room.id,
        actorName: input.manager.name,
        title: "项目经理已接管卡住任务",
        description: `@${activeAgent.name} 这一棒连续异常，任务 ownership 已回收到项目经理名下，后续会由 PM 重新拆解或重新派工。`,
        visibility: "backstage",
        createdAt: now,
      },
      ...input.state.events,
    ];

    const managerReply = [
      `我检查到 @${activeAgent.name} 这一棒已经连续 ${nextRecoveryAttemptCount} 次没有正常续约，卡点是：${runtimeState.detail}`,
      "我这次不再简单重试，而是先把这条任务回收到项目经理名下，避免它一直无限等待。",
      "接下来我会基于现有结果重新拆解或重新派工，再继续推进。",
    ].join("\n");

    appendTeamConversationMessages(input.conversationId, [
      {
        actorLabel: input.manager.name,
        content: managerReply,
      },
    ]);
    writeState(input.state);
    return managerReply;
  }

  updateProjectAgent(input.state, activeAgent.id, {
    runtimeConversationId: null,
    status: "idle",
    blockedByAgentId: null,
    lastResultSummary: "上一轮后台执行没有正常回传，项目经理已自动重试当前棒次。",
    progressLabel: "检测到异常，准备重试",
    progressDetails: `项目经理发现这一棒疑似卡住，正在重建 ${activeAgent.name} 的后台会话并重推同一任务。`,
    lastHeartbeatAt: now,
    progressTrail: appendAgentProgressTrail(activeAgent.progressTrail, {
      label: "检测到异常，准备重试",
      detail: `项目经理发现这一棒疑似卡住，正在重建 ${activeAgent.name} 的后台会话并重推同一任务。`,
      createdAt: now,
    }),
  });
  if (activeTask) {
    updateProjectTask(input.state, activeTask.id, {
      lastReassignedAt: now,
      lastReassignmentReason: "项目经理已重建后台会话，准备按同一 ownership 重试当前棒次。",
    });
  }
  appendProjectRecoveryAction(input.state, {
    projectId: input.room.id,
    kind: "retry_same_owner",
    summary: `项目经理已重建 ${activeAgent.name} 的后台会话，准备按同一 ownership 重试当前棒次。`,
    taskId: activeTask?.id ?? null,
    taskTitle: activeTask?.title ?? null,
    fromAgentId: activeAgent.id,
    fromAgentName: activeAgent.name,
    toAgentId: activeAgent.id,
    toAgentName: activeAgent.name,
    createdAt: now,
  });
  const managerReply = [
    `我检查到 @${activeAgent.name} 这一棒已经卡住了，卡点是：${runtimeState.detail}`,
    "我已经中断旧的后台会话，并按当前同一任务重新推了一次，不会影响上一棒已经完成的结果。",
    "接下来我会继续盯着这一棒的回传；一旦有新结果，我就继续安排下一步。",
  ].join("\n");

  appendTeamConversationMessages(input.conversationId, [
    {
      actorLabel: input.manager.name,
      content: managerReply,
    },
  ]);

  applyRuntimeDelegationState(input.state, {
    projectId: input.room.id,
    managerId: input.manager.id,
    delegations: [
      {
        agentName: activeAgent.name,
        task: activeAgent.lastAssignedTask,
        artifactTitles: [],
      },
    ],
    fallbackStageLabel: input.room.currentStageLabel || "项目经理统筹",
  });

  input.state.rooms = input.state.rooms.map((item) =>
    item.id === input.room.id
      ? {
          ...item,
          runStatus: "running",
          summary: managerReply,
          lastActivityLabel: "项目经理刚刚重启了卡住成员",
          updatedAt: now,
        }
      : item,
  );
  writeState(input.state);

  enqueueProjectRuntimeWork(
    input.room.id,
    async () => {
      await continueProjectDelegationsInBackground({
        projectId: input.room.id,
        conversationId: input.conversationId,
        delegations: [
          {
            agentName: activeAgent.name,
            task: activeAgent.lastAssignedTask || "",
            artifactTitles: [],
          },
        ],
        recentMessages: [
          ...input.recentGroupMessages,
          {
            role: "assistant",
            actorLabel: input.manager.name,
            content: managerReply,
          },
        ],
      });
    },
    { interrupt: true },
  );

  return managerReply;
}

function buildProjectProgressReply(
  room: ProjectRoomRecord,
  manager: ProjectAgentRecord,
  projectAgents: ProjectAgentRecord[],
) {
  const activeAgent = projectAgents.find((agent) => agent.id === room.activeAgentId) ?? null;
  const nextAgent = projectAgents.find((agent) => agent.id === room.nextAgentId) ?? null;
  const activeRuntimeState = activeAgent ? inspectAgentRuntimeState(activeAgent) : null;
  const completedAgent = [...projectAgents]
    .filter((agent) => !agent.canDelegate && Boolean(agent.lastResultSummary))
    .sort((left, right) => {
      const leftTime = left.lastCompletedAt ? Date.parse(left.lastCompletedAt) : 0;
      const rightTime = right.lastCompletedAt ? Date.parse(right.lastCompletedAt) : 0;
      return rightTime - leftTime;
    })[0] ?? null;

  if (!activeAgent || activeAgent.id === manager.id) {
    return "当前这轮还在由我收束和判断下一步，暂时没有新的成员执行棒次。我会先继续整理，再决定要不要点下一位成员。";
  }

  if (activeRuntimeState?.status === "stalled") {
    return [
      `我这里看到当前这一步大概率已经卡住了，卡点在 @${activeAgent.name} 这一棒的后台执行回传。`,
      `当前阶段：${inferRuntimeStageLabel(activeAgent, activeAgent.lastAssignedTask)}。`,
      `这位成员最近拿到的任务是：${compactConversationExcerpt(activeAgent.lastAssignedTask || "未记录任务。", 120)}`,
      `我目前还没有收到它的有效结果回传，${activeRuntimeState.detail}`,
      "这说明不是我在继续派工，而是这一棒本身没有正常收口。你如果愿意，可以让我直接重试这一棒，或先调整任务后再继续。",
    ].join("\n");
  }

  const taskSummary = compactConversationExcerpt(
    activeAgent.lastAssignedTask || "当前正在处理项目经理刚刚分配的这一棒任务。",
    120,
  );
  const progressLine =
    activeAgent.progressLabel && activeAgent.progressDetails
      ? `当前公开进展：${activeAgent.progressLabel}。${activeAgent.progressDetails}`
      : activeAgent.progressLabel
        ? `当前公开进展：${activeAgent.progressLabel}。`
        : "当前还没有拿到更细的执行过程说明。";
  const heartbeatLine = activeAgent.lastHeartbeatAt
    ? `最近一次心跳：${new Intl.DateTimeFormat("zh-CN", {
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
      }).format(new Date(activeAgent.lastHeartbeatAt))}`
    : "最近一次心跳还未记录。";
  const completedSummary = completedAgent?.lastResultSummary
    ? compactConversationExcerpt(completedAgent.lastResultSummary, 100)
    : null;

  return [
    `当前还在正常推进，没有卡住。现在这一棒由 @${activeAgent.name} 在执行，我这边不会打断它。`,
    `当前阶段：${inferRuntimeStageLabel(activeAgent, activeAgent.lastAssignedTask)}。`,
    `这位成员正在处理：${taskSummary}`,
    progressLine,
    heartbeatLine,
    completedAgent
      ? `上一棒已由 ${completedAgent.name} 交回，我已经基于它完成接力判断：${completedSummary}`
      : "上一棒还没有形成可回看的阶段结果。",
    nextAgent
      ? `如果这一棒顺利完成，下一步预计会交给 ${nextAgent.name}。`
      : "等当前结果回来后，我会再判断是继续派工，还是先向你收束阶段结论。",
  ].join("\n");
}

function handleProjectRuntimeFailure(
  state: ProjectStoreState,
  input: {
    projectId: string;
    conversationId: string;
    manager: ProjectAgentRecord;
    failedAgent: ProjectAgentRecord;
    errorMessage: string;
    now: string;
  },
) {
  const compactError = compactConversationExcerpt(input.errorMessage, 140);
  const managerReply = input.failedAgent.canDelegate
    ? `我在整理这轮阶段结果时遇到问题：${compactError}。我先暂停继续派工，等你确认是要重试这一轮，还是先调整目标再继续。`
    : `@${input.failedAgent.name} 这一棒执行时遇到问题：${compactError}。我先暂停继续派工，避免影响当前结果；你可以让我重试，或者先调整目标后再继续。`;

  appendTeamConversationMessages(input.conversationId, [
    {
      actorLabel: input.manager.name,
      content: managerReply,
    },
  ]);

  updateProjectAgent(state, input.failedAgent.id, {
    status: "idle",
    currentTaskId: null,
    blockedByAgentId: null,
    lastResultSummary: `执行遇到问题：${compactError}`,
    progressLabel: "执行遇到问题",
    progressDetails: compactConversationExcerpt(managerReply, 160),
    lastHeartbeatAt: input.now,
    progressTrail: appendAgentProgressTrail(input.failedAgent.progressTrail, {
      label: "执行遇到问题",
      detail: compactConversationExcerpt(managerReply, 160),
      createdAt: input.now,
    }),
  });
  if (input.failedAgent.currentTaskId) {
    updateProjectTask(state, input.failedAgent.currentTaskId, {
      status: "cancelled",
      resultSummary: `执行遇到问题：${compactError}`,
      updatedAt: input.now,
      completedAt: input.now,
    });
    expireTaskLease(state, input.failedAgent.currentTaskId, input.now);
    settleProjectReviews(state, {
      projectId: input.projectId,
      taskIds: [input.failedAgent.currentTaskId],
      status: "cancelled",
      updatedAt: input.now,
      blockingComments: compactError,
    });
  }
  upsertProjectMailboxThread(state, {
    projectId: input.projectId,
    kind: "escalation",
    subject: `执行异常升级 · ${input.failedAgent.name}`,
    summary: input.failedAgent.canDelegate
      ? `项目经理在收束阶段结果时遇到异常：${compactError}`
      : `${input.failedAgent.name} 已把执行异常升级给项目经理：${compactError}`,
    fromAgentId: input.failedAgent.id,
    fromAgentName: input.failedAgent.name,
    toAgentIds: [input.manager.id],
    toAgentNames: [input.manager.name],
    relatedTaskId: input.failedAgent.currentTaskId ?? null,
    relatedTaskTitle:
      input.failedAgent.currentTaskId
        ? state.tasks.find((task) => task.id === input.failedAgent.currentTaskId)?.title ?? null
        : null,
    createdAt: input.now,
  });
  appendProjectRecoveryAction(state, {
    projectId: input.projectId,
    kind: "take_over_by_manager",
    summary: input.failedAgent.canDelegate
      ? `项目经理在收束阶段结果时遇到异常，当前运行已切到人工补充 checkpoint：${compactError}`
      : `${input.failedAgent.name} 这一棒执行失败，项目经理已终止当前任务并等待新的补充方向。`,
    taskId: input.failedAgent.currentTaskId ?? null,
    taskTitle:
      input.failedAgent.currentTaskId
        ? state.tasks.find((task) => task.id === input.failedAgent.currentTaskId)?.title ?? null
        : null,
    fromAgentId: input.failedAgent.id,
    fromAgentName: input.failedAgent.name,
    toAgentId: input.manager.id,
    toAgentName: input.manager.name,
    createdAt: input.now,
  });

  applyProjectManagerCheckpoint(state, {
    projectId: input.projectId,
    managerId: input.manager.id,
    decision: "waiting_user",
    summary:
      input.failedAgent.canDelegate
        ? `项目经理在收束阶段结果时遇到问题：${compactError}`
        : `${input.failedAgent.name} 在执行这一棒时遇到问题：${compactError}`,
    now: input.now,
  });
  writeState(state);
}

function inspectAgentRuntimeState(agent: ProjectAgentRecord) {
  if (!agent.runtimeConversationId) {
    return {
      status: "stalled" as const,
      kind: "runtime_missing" as const,
      detail: "当前成员还没有可用的 runtime 会话记录。",
    };
  }

  const snapshot = getSnapshot();
  const conversation =
    snapshot.conversations.find((item) => item.id === agent.runtimeConversationId) ?? null;
  const messages = snapshot.conversationMessages[agent.runtimeConversationId] ?? [];
  const projectId = agent.projectId;
  const task =
    agent.currentTaskId
      ? readState().tasks.find((item) => item.projectId === projectId && item.id === agent.currentTaskId) ?? null
      : null;
  const lastMessage = messages[messages.length - 1] ?? null;
  const hasAssistantReply = messages.some((message) => message.role === "assistant");
  const lastTimestamp = lastMessage?.timestamp ?? null;
  const ageMs = lastTimestamp ? Date.now() - Date.parse(lastTimestamp) : Number.POSITIVE_INFINITY;
  const leaseExpired = isTaskLeaseExpired(task);
  const isLikelyStalled =
    agent.status === "working" &&
    ((!conversation?.codexThreadId || !hasAssistantReply) &&
      ageMs > 5 * 60 * 1000 ||
      leaseExpired);

  if (isLikelyStalled) {
    return {
      status: "stalled" as const,
      kind: leaseExpired
        ? ("lease_expired" as const)
        : conversation?.codexThreadId
          ? ("reply_timeout" as const)
          : ("runtime_missing" as const),
      detail: leaseExpired
        ? "这条任务的执行租约已经过期，说明后台执行在预期窗口内没有正常续约。"
        : conversation?.codexThreadId
          ? "runtime 会话已经创建，但超过 5 分钟都没有新的成员结果写回。"
          : "runtime 会话里只有任务下发，没有拿到有效 thread 回传或成员输出。",
    };
  }

  return {
    status: "running" as const,
    kind: null,
    detail: "后台 runtime 仍在推进中。",
  };
}

function compactAgentResponsibility(agent: ProjectAgentRecord) {
  const normalized = agent.responsibility.replace(/\s+/g, " ").trim();
  return normalized.length > 140 ? `${normalized.slice(0, 137)}...` : normalized;
}

function compactRuntimeText(value: string) {
  const normalized = value.replace(/\s+/g, " ").trim();
  return normalized.length > 160 ? `${normalized.slice(0, 157)}...` : normalized;
}

function resolveAgentHeartbeatStatus(agent: ProjectAgentRecord): ProjectHeartbeatRecord["status"] {
  if (agent.status === "working" || agent.status === "planning" || agent.status === "reviewing") {
    return "healthy";
  }

  if (agent.blockedByAgentId) {
    return "warning";
  }

  return "idle";
}

function buildAgentHeartbeatSummary(
  agent: ProjectAgentRecord,
  task: ProjectTaskRecord | null,
) {
  if (agent.progressLabel) {
    return `${agent.progressLabel}${agent.progressDetails ? ` · ${agent.progressDetails}` : ""}`;
  }

  if (task) {
    return `当前关联任务：${task.title}`;
  }

  if (agent.blockedByAgentId) {
    return "当前在等待上游成员交回结果。";
  }

  return agent.canDelegate ? "项目经理正在观察团队节奏并决定下一步。" : "当前空闲，等待下一条 baton。";
}

function appendAgentProgressTrail(
  trail: ProjectAgentRecord["progressTrail"],
  input: {
    label: string;
    detail: string;
    createdAt?: string;
  },
) {
  const nextCreatedAt = input.createdAt || new Date().toISOString();
  const normalizedDetail = compactConversationExcerpt(input.detail, 180);
  const currentTrail = Array.isArray(trail) ? [...trail] : [];
  const previous = currentTrail[currentTrail.length - 1] ?? null;

  if (previous && previous.label === input.label && previous.detail === normalizedDetail) {
    currentTrail[currentTrail.length - 1] = {
      ...previous,
      createdAt: nextCreatedAt,
    };
    return currentTrail.slice(-6);
  }

  return [
    ...currentTrail.slice(-5),
    {
      id: `agent-progress-${crypto.randomUUID()}`,
      label: input.label,
      detail: normalizedDetail,
      createdAt: nextCreatedAt,
    },
  ];
}

function updateAgentPublicProgress(
  state: ProjectStoreState,
  agentId: string,
  input: {
    label: string;
    detail: string;
    createdAt?: string;
  },
) {
  const createdAt = input.createdAt || new Date().toISOString();
  const normalizedDetail = compactConversationExcerpt(input.detail, 180);

  updateProjectAgent(state, agentId, {
    progressLabel: input.label,
    progressDetails: normalizedDetail,
    lastHeartbeatAt: createdAt,
    progressTrail: appendAgentProgressTrail(
      state.agents.find((agent) => agent.id === agentId)?.progressTrail,
      {
        label: input.label,
        detail: normalizedDetail,
        createdAt,
      },
    ),
  });
  const agent = state.agents.find((item) => item.id === agentId) ?? null;

  if (agent) {
    settleProjectStuckSignals(state, {
      projectId: agent.projectId,
      updatedAt: createdAt,
      agentId,
      taskId: agent.currentTaskId ?? null,
    });
  }
}

function summarizeThinkingProgress(
  entries: string[],
  input: {
    agent: ProjectAgentRecord;
    task: string;
    fallbackLabel: string;
    fallbackDetail: string;
  },
) {
  const joined = entries.join(" ").replace(/\s+/g, " ").trim();
  const normalized = joined.toLowerCase();
  const taskPreview = compactConversationExcerpt(input.task, 100);

  if (/(read|open|inspect|scan|browse|search|文件|目录|路径|读取|查看|搜索|检索)/i.test(normalized)) {
    return {
      label: "正在读取上下文",
      detail: `正在围绕“${taskPreview}”读取相关文件、群聊上下文和上游结果。`,
    };
  }

  if (/(plan|analy|compare|review|judge|decid|总结|判断|分析|比较|评审|收束|依赖)/i.test(normalized)) {
    return {
      label: "正在分析方案",
      detail: `正在分析当前任务的依赖、边界和最合适的推进方式：${taskPreview}`,
    };
  }

  if (/(write|edit|implement|code|page|component|draft|生成|撰写|实现|修改|搭建|落地)/i.test(normalized)) {
    return {
      label: "正在落地执行",
      detail: `已经进入产出阶段，正在把这棒任务落成可交付结果：${taskPreview}`,
    };
  }

  if (/(final|respond|reply|compose|整理输出|输出|回复|汇总|交付)/i.test(normalized)) {
    return {
      label: "正在整理输出",
      detail: "当前主要在收束已有判断，准备形成一条适合回传给团队或用户的阶段结果。",
    };
  }

  return {
    label: input.fallbackLabel,
    detail: input.fallbackDetail,
  };
}

function summarizeAssistantDraftProgress(
  text: string,
  input: {
    fallbackLabel: string;
    fallbackDetail: string;
  },
) {
  const normalized = text.replace(/\s+/g, " ").trim();

  if (!normalized) {
    return {
      label: input.fallbackLabel,
      detail: input.fallbackDetail,
    };
  }

  if (normalized.length > 120) {
    return {
      label: "正在整理阶段结果",
      detail: `已经形成较完整的输出草稿，正在做最后整理：${compactConversationExcerpt(normalized, 120)}`,
    };
  }

  return {
    label: input.fallbackLabel,
    detail: input.fallbackDetail,
  };
}

function buildProjectCheckpointSummary(
  state: ProjectStoreState,
  input: {
    projectId: string;
    decision: "waiting_user" | "waiting_approval";
    headline: string;
  },
) {
  const room = state.rooms.find((item) => item.id === input.projectId) ?? null;
  const projectAgents = state.agents.filter((agent) => agent.projectId === input.projectId);
  const completedAgents = projectAgents.filter(
    (agent) => !agent.canDelegate && Boolean(agent.lastResultSummary),
  );
  const completionLines = completedAgents
    .slice(0, 4)
    .map((agent) => `- ${agent.name}：${compactRuntimeText(agent.lastResultSummary || "")}`)
    .join("\n");

  if (input.decision === "waiting_user") {
    return [
      "项目经理判断",
      "当前还不应该继续盲目派工，先停在这里等你补充。",
      "",
      "为什么暂停",
      input.headline,
      "",
      "当前已拿到的进展",
      completionLines || "- 这一轮还没有足够稳定的阶段结果。",
      "",
      "接下来需要你给什么",
      `- 请补充这轮最希望交付的结果、边界或验收标准。`,
      `- 当前团队目标：${room?.goal || "未指定"}`,
      "",
      "之后会怎么继续",
      "- 你一旦补充，项目经理会重新判断第一棒该由谁接力，并继续推进后续阶段。",
    ].join("\n");
  }

  return [
    "项目经理阶段总结",
    input.headline,
    "",
    "本轮已完成",
    completionLines || "- 当前已有阶段结论，但成员摘要尚未完全同步到看板。",
    "",
    "当前判断",
    "- 这轮已经有可交付结果，不需要继续派工。",
    "- 现在更合适由你确认是否结束，或指出还要补充的问题。",
    "",
    "请你决定",
    "- 如果认可当前结果：确认完成这一轮。",
    "- 如果还不够：直接反馈问题，项目经理会基于你的意见继续组织下一轮。",
  ].join("\n");
}

function inferRuntimeStageLabel(agent: ProjectAgentRecord | null, task?: string | null) {
  const identity = `${agent?.name || ""} ${agent?.role || ""} ${task || ""}`.toLowerCase();

  if (/(项目经理|lead|统筹|收束|安排|派工|分工)/i.test(identity)) {
    return "项目经理统筹";
  }

  if (/(产品|信息架构|交互|需求|结构|页面范围)/i.test(identity)) {
    return "产品定义";
  }

  if (/(开发|工程|技术|实现|mvp|代码|落地)/i.test(identity)) {
    return "开发实现";
  }

  if (/(杠精|验收|审查|风险|红线|review)/i.test(identity)) {
    return "验收复核";
  }

  if (/(writer|文案|表达|汇报|对外|总结)/i.test(identity)) {
    return "结果整理";
  }

  return "团队推进";
}

function applyRuntimeDelegationState(
  state: ProjectStoreState,
  input: {
    projectId: string;
    managerId: string | null;
    delegations: RuntimeManagerPlan["delegations"];
    fallbackStageLabel?: string | null;
  },
) {
  const projectAgents = state.agents.filter((agent) => agent.projectId === input.projectId);
  const manager = input.managerId
    ? projectAgents.find((agent) => agent.id === input.managerId) ?? null
    : null;
  const delegatedAgents = input.delegations
    .map((delegation) => projectAgents.find((agent) => agent.name === delegation.agentName) ?? null)
    .filter(Boolean) as ProjectAgentRecord[];
  const primaryAgent = delegatedAgents[0] ?? null;
  const secondaryAgent = delegatedAgents[1] ?? null;
  const primaryDelegation = input.delegations[0] ?? null;
  const now = new Date().toISOString();
  settleProjectMailboxThreads(state, {
    projectId: input.projectId,
    updatedAt: now,
    kind: "next_step_suggestion",
  });
  if (manager?.currentTaskId) {
    updateProjectTask(state, manager.currentTaskId, {
      status: "completed",
      resultSummary: "项目经理已完成当前阶段拆解，并把 baton 正式交给执行成员。",
      updatedAt: now,
      completedAt: now,
    });
  }

  createDelegationTasks(state, {
    projectId: input.projectId,
    managerId: input.managerId,
    managerName: manager?.name ?? "项目经理",
    delegations: input.delegations,
    delegatedAgents,
    stageLabel: inferRuntimeStageLabel(primaryAgent, primaryDelegation?.task || null),
    now,
  });

  state.rooms = state.rooms.map((room) =>
    room.id === input.projectId
      ? {
          ...room,
          currentStageLabel:
            primaryAgent || input.managerId
              ? inferRuntimeStageLabel(primaryAgent, primaryDelegation?.task || null)
              : input.fallbackStageLabel ?? room.currentStageLabel ?? "团队推进",
          activeAgentId: primaryAgent?.id ?? input.managerId ?? null,
          nextAgentId: secondaryAgent?.id ?? null,
        }
      : room,
  );

  state.agents = state.agents.map((agent) => {
    if (agent.projectId !== input.projectId) {
      return agent;
    }

    if (agent.id === input.managerId) {
      return {
        ...agent,
        status: input.delegations.length > 0 ? "planning" : "reviewing",
        currentTaskId: null,
        blockedByAgentId: null,
        progressLabel: input.delegations.length > 0 ? "已完成本轮派工" : agent.progressLabel ?? null,
        progressDetails:
          input.delegations.length > 0
            ? `当前先由 ${delegatedAgents.map((item) => item.name).join("、")} 接力推进，项目经理会等结果回来后继续判断。`
            : agent.progressDetails ?? null,
        lastHeartbeatAt: now,
        progressTrail:
          input.delegations.length > 0
            ? appendAgentProgressTrail(agent.progressTrail, {
                label: "已完成本轮派工",
                detail: `当前先由 ${delegatedAgents.map((item) => item.name).join("、")} 接力推进，项目经理会等结果回来后继续判断。`,
              })
            : agent.progressTrail ?? [],
      };
    }

    const delegationIndex = delegatedAgents.findIndex((item) => item.id === agent.id);
    const linkedTask = state.tasks.find((task) => task.id === agent.currentTaskId) ?? null;

    if (delegationIndex === 0) {
      if (linkedTask?.status === "blocked") {
        return {
          ...agent,
          status: "idle",
          blockedByAgentId: null,
          currentTaskId: agent.currentTaskId ?? null,
          lastAssignedTask: input.delegations[delegationIndex]?.task || agent.lastAssignedTask || null,
          progressLabel: "等待输入交付物",
          progressDetails: linkedTask.blockedReason || "当前这棒还在等待上游交付物或补充结果。",
          lastHeartbeatAt: now,
          progressTrail: appendAgentProgressTrail(agent.progressTrail, {
            label: "等待输入交付物",
            detail: linkedTask.blockedReason || "当前这棒还在等待上游交付物或补充结果。",
          }),
        };
      }

      return {
        ...agent,
        status: "working",
        blockedByAgentId: null,
        currentTaskId: agent.currentTaskId ?? null,
        lastAssignedTask: input.delegations[delegationIndex]?.task || agent.lastAssignedTask || null,
        progressLabel: "等待开始执行",
        progressDetails: `项目经理已把当前这棒交给他：${compactConversationExcerpt(
          input.delegations[delegationIndex]?.task || agent.lastAssignedTask || "当前任务待同步。",
          120,
        )}`,
        lastHeartbeatAt: now,
        progressTrail: appendAgentProgressTrail(agent.progressTrail, {
          label: "等待开始执行",
          detail: `项目经理已把当前这棒交给他：${compactConversationExcerpt(
            input.delegations[delegationIndex]?.task || agent.lastAssignedTask || "当前任务待同步。",
            120,
          )}`,
        }),
      };
    }

    if (delegationIndex > 0) {
      return {
        ...agent,
        status: "idle",
        blockedByAgentId: delegatedAgents[delegationIndex - 1]?.id ?? primaryAgent?.id ?? null,
        currentTaskId: agent.currentTaskId ?? null,
        lastAssignedTask: input.delegations[delegationIndex]?.task || agent.lastAssignedTask || null,
        progressLabel: "等待上游结果",
        progressDetails: `这位成员已经在接力链上，但需要等 ${
          delegatedAgents[delegationIndex - 1]?.name || primaryAgent?.name || "上游成员"
        } 先交回结果后才会真正开工。`,
        lastHeartbeatAt: now,
        progressTrail: appendAgentProgressTrail(agent.progressTrail, {
          label: "等待上游结果",
          detail: `这位成员已经在接力链上，但需要等 ${
            delegatedAgents[delegationIndex - 1]?.name || primaryAgent?.name || "上游成员"
          } 先交回结果后才会真正开工。`,
        }),
      };
    }

    return {
      ...agent,
      status: agent.lastResultSummary ? "reviewing" : "idle",
      blockedByAgentId: primaryAgent?.id ?? null,
      currentTaskId: null,
      progressLabel: agent.lastResultSummary ? "已交回阶段结果" : "尚未上场",
      progressDetails: agent.lastResultSummary
        ? compactConversationExcerpt(agent.lastResultSummary, 120)
        : primaryAgent
          ? `当前不在这轮接力链里，项目经理会先观察 ${primaryAgent.name} 这棒的结果。`
          : "当前还没有进入这轮接力链。",
      lastHeartbeatAt: agent.lastHeartbeatAt ?? now,
    };
  });
}

function clearRuntimeDelegationState(
  state: ProjectStoreState,
  input: {
    projectId: string;
    managerId: string | null;
    stageLabel: string;
  },
) {
  settleProjectMailboxThreads(state, {
    projectId: input.projectId,
    updatedAt: new Date().toISOString(),
    kind: "next_step_suggestion",
  });
  state.rooms = state.rooms.map((room) =>
    room.id === input.projectId
      ? {
          ...room,
          currentStageLabel: input.stageLabel,
          activeAgentId: input.managerId,
          nextAgentId: null,
        }
      : room,
  );

  state.agents = state.agents.map((agent) => {
    if (agent.projectId !== input.projectId) {
      return agent;
    }

    return {
      ...agent,
      status: agent.id === input.managerId ? "reviewing" : agent.lastResultSummary ? "reviewing" : "idle",
      currentTaskId: agent.id === input.managerId ? agent.currentTaskId ?? null : null,
      blockedByAgentId: null,
      progressLabel:
        agent.id === input.managerId
          ? "正在收束阶段结果"
          : agent.lastResultSummary
            ? "已交回阶段结果"
            : "待命",
      progressDetails:
        agent.id === input.managerId
          ? "项目经理正在基于已有阶段结果做收束判断。"
          : agent.lastResultSummary
            ? compactConversationExcerpt(agent.lastResultSummary, 120)
            : "当前没有新的执行任务，等待项目经理决定下一步。",
      lastHeartbeatAt: new Date().toISOString(),
    };
  });
}

function applyProjectManagerCheckpoint(
  state: ProjectStoreState,
  input: {
    projectId: string;
    managerId: string | null;
    decision: "waiting_user" | "waiting_approval";
    summary: string;
    now: string;
  },
) {
  settleProjectMailboxThreads(state, {
    projectId: input.projectId,
    updatedAt: input.now,
    kind: "next_step_suggestion",
  });
  settleOpenProjectTasks(state, {
    projectId: input.projectId,
    now: input.now,
    nextStatus: input.decision,
  });
  const managerName =
    input.managerId
      ? state.agents.find((agent) => agent.id === input.managerId)?.name ?? "项目经理"
      : "项目经理";
  createCheckpointTask(state, {
    projectId: input.projectId,
    managerId: input.managerId,
    managerName,
    decision: input.decision,
    summary: input.summary,
    now: input.now,
  });
  const stageLabel = input.decision === "waiting_approval" ? "等待你确认" : "等待你补充";
  const activityLabel =
    input.decision === "waiting_approval" ? "项目经理刚刚交付了阶段总结" : "项目经理正在等待你的补充";
  const runStatus = input.decision === "waiting_approval" ? "waiting_approval" : "waiting_user";
  const latestRun = state.runs.find((run) => run.projectId === input.projectId) ?? null;
  const formattedSummary = buildProjectCheckpointSummary(state, {
    projectId: input.projectId,
    decision: input.decision,
    headline: input.summary,
  });

  state.rooms = state.rooms.map((room) =>
    room.id === input.projectId
      ? {
          ...room,
          runStatus,
          currentStageLabel: stageLabel,
          activeAgentId: input.managerId,
          nextAgentId: null,
          summary: formattedSummary,
          lastActivityLabel: activityLabel,
          updatedAt: input.now,
        }
      : room,
  );

  state.agents = state.agents.map((agent) => {
    if (agent.projectId !== input.projectId) {
      return agent;
    }

    return {
      ...agent,
      status: agent.id === input.managerId ? "reviewing" : agent.lastResultSummary ? "reviewing" : "idle",
      currentTaskId: agent.id === input.managerId ? agent.currentTaskId ?? null : null,
      blockedByAgentId: null,
      progressLabel:
        agent.id === input.managerId
          ? input.decision === "waiting_approval"
            ? "已整理交付总结"
            : "正在等待用户补充"
          : agent.lastResultSummary
            ? "已交回阶段结果"
            : "待命",
      progressDetails:
        agent.id === input.managerId
          ? compactConversationExcerpt(formattedSummary, 160)
          : agent.lastResultSummary
            ? compactConversationExcerpt(agent.lastResultSummary, 120)
            : "当前没有新的执行任务，等待项目经理恢复推进。",
      lastHeartbeatAt: input.now,
      progressTrail:
        agent.id === input.managerId
          ? appendAgentProgressTrail(agent.progressTrail, {
              label: input.decision === "waiting_approval" ? "已整理交付总结" : "正在等待用户补充",
              detail: compactConversationExcerpt(formattedSummary, 160),
              createdAt: input.now,
            })
          : agent.progressTrail ?? [],
    };
  });

  if (latestRun) {
    state.runs = state.runs.map((run) =>
      run.id === latestRun.id
      ? {
              ...run,
            status: runStatus,
            summary: formattedSummary,
            currentStepLabel:
              input.decision === "waiting_approval"
                ? "项目经理已交付阶段总结，等待用户确认"
                : "项目经理已暂停派工，等待用户补充",
          }
        : run,
    );
  }

  state.events = [
    {
      id: `${input.projectId}-event-${runStatus}-${crypto.randomUUID()}`,
      projectId: input.projectId,
      actorName: "项目经理",
      title: input.decision === "waiting_approval" ? "已交付阶段总结" : "正在等待用户补充",
      description: formattedSummary,
      visibility: "frontstage",
      createdAt: input.now,
    },
    ...state.events,
  ];

  state.artifacts = upsertArtifactsAfterRun(state.artifacts, {
    projectId: input.projectId,
    summary: formattedSummary,
    updatedAt: input.now,
    phase: runStatus,
  });
  syncProjectArtifactCount(state, input.projectId);
}

export async function runProject(
  projectId: string,
  input: {
    triggerLabel?: string;
    triggerPrompt?: string | null;
  } = {},
) {
  const state = readState();
  const room = state.rooms.find((item) => item.id === projectId);

  if (!room) {
    const error = new Error("这个团队模式不存在，暂时无法启动。");
    (error as Error & { statusCode?: number }).statusCode = 404;
    throw error;
  }

  const now = new Date().toISOString();
  const goal = room.goal;
  const triggerLabel = input.triggerLabel?.trim() || "手动启动";
  const triggerPrompt = input.triggerPrompt?.trim() || room.latestUserRequest || room.goal;
  const teamConversationId = ensureTeamConversation(state, room);
  const runId = `project-run-${crypto.randomUUID()}`;
  const projectAgents = state.agents.filter((agent) => agent.projectId === projectId);
  const manager =
    projectAgents.find((agent) => agent.agentProfileId === "project-manager") ||
    projectAgents.find((agent) => agent.canDelegate) ||
    null;
  const recentGroupMessages = getRecentTeamConversationMessages(teamConversationId);

  if (room.status === "paused" || room.runStatus === "paused") {
    if (!manager) {
      const error = new Error("当前团队缺少项目经理角色，暂时无法恢复运行。");
      (error as Error & { statusCode?: number }).statusCode = 400;
      throw error;
    }

    const resumeAt = new Date().toISOString();
    const pendingDelegations = collectPendingDelegationsForResume(
      projectAgents,
      manager.id,
      room,
      state.tasks,
      state.artifacts,
    );
    const resumeReply =
      pendingDelegations.length > 0
        ? `继续上一次暂停点。我会先让 ${pendingDelegations
            .map((item) => `@${item.agentName}`)
            .join("、")} 接着当前 baton 往下推进，后续再根据结果继续安排。`
        : "继续推进这一轮。我会先重新收束当前上下文，再安排下一棒接力。";

    state.rooms = state.rooms.map((item) =>
      item.id === projectId
        ? {
            ...item,
            status: "active",
            runStatus: "running",
            latestUserRequest: triggerPrompt,
            summary: resumeReply,
            lastActivityLabel: "团队已恢复运行",
            updatedAt: resumeAt,
          }
        : item,
    );
    resetProjectAutonomyState(state, {
      projectId,
      now: resumeAt,
    });

    state.runs = state.runs.map((run) =>
      run.projectId === projectId && run.finishedAt === null
        ? {
            ...run,
            status: "running",
            summary: resumeReply,
            currentStepLabel:
              pendingDelegations.length > 0 ? "已从暂停点恢复当前棒次" : "项目经理正在重新整理下一步安排",
          }
        : run,
    );

    state.events = [
      {
        id: `${projectId}-event-runtime-resume-${crypto.randomUUID()}`,
        projectId,
        actorName: manager.name,
        title: "已恢复团队运行",
        description:
          pendingDelegations.length > 0
            ? `团队会从暂停前的当前棒次继续，优先恢复 ${pendingDelegations.map((item) => item.agentName).join("、")} 的接力任务。`
            : "团队会基于当前上下文重新判断下一步安排，然后继续推进。",
        visibility: "frontstage",
        createdAt: resumeAt,
      },
      ...state.events,
    ];

    appendTeamConversationMessages(teamConversationId, [
      {
        actorLabel: manager.name,
        content: resumeReply,
      },
    ]);

    if (pendingDelegations.length > 0) {
      applyRuntimeDelegationState(state, {
        projectId: room.id,
        managerId: manager.id,
        delegations: pendingDelegations,
        fallbackStageLabel: room.currentStageLabel || "项目经理统筹",
      });
    } else {
      clearRuntimeDelegationState(state, {
        projectId: room.id,
        managerId: manager.id,
        stageLabel: room.currentStageLabel || "项目经理统筹",
      });
    }
    writeState(state);

    if (pendingDelegations.length > 0) {
      enqueueProjectRuntimeWork(
        room.id,
        async () => {
          await continueProjectDelegationsInBackground({
            projectId: room.id,
            conversationId: teamConversationId,
            delegations: pendingDelegations,
            recentMessages: [
              ...recentGroupMessages,
              {
                role: "assistant",
                actorLabel: manager.name,
                content: resumeReply,
              },
            ],
          });
        },
        { interrupt: true },
      );

      return getProjectDetail(projectId);
    }

    enqueueProjectRuntimeWork(
      room.id,
      async () => {
        const latest = readState();
        const latestRoom = latest.rooms.find((item) => item.id === room.id) ?? null;
        const latestAgents = latest.agents.filter((agent) => agent.projectId === room.id);
        const latestManager =
          latestAgents.find((agent) => agent.agentProfileId === "project-manager") ||
          latestAgents.find((agent) => agent.canDelegate) ||
          null;

        if (!latestRoom || !latestManager || isProjectRuntimePaused(latestRoom)) {
          return;
        }

        const latestRecentMessages = getRecentTeamConversationMessages(teamConversationId);
        const plan =
          (await planProjectConversationWithManager(
            latest,
            latestRoom,
            latestManager,
            latestAgents,
            triggerPrompt,
            latestRecentMessages,
          )) || buildFallbackManagerPlan(latest, latestRoom.id, latestManager, triggerPrompt);

        if (isProjectRuntimePaused(readState().rooms.find((item) => item.id === latestRoom.id) ?? null)) {
          return;
        }

        appendTeamConversationMessages(teamConversationId, [
          {
            actorLabel: latestManager.name,
            content: plan.groupReply,
          },
        ]);

        const followUpAt = new Date().toISOString();

        if (plan.delegations.length > 0) {
          consumeProjectAutonomyRound(latest, {
            projectId: latestRoom.id,
            now: followUpAt,
          });
          applyRuntimeDelegationState(latest, {
            projectId: latestRoom.id,
            managerId: latestManager.id,
            delegations: plan.delegations,
            fallbackStageLabel: "项目经理统筹",
          });
          latest.rooms = latest.rooms.map((item) =>
            item.id === latestRoom.id
              ? {
                  ...item,
                  status: "active",
                  runStatus: "running",
                  latestUserRequest: triggerPrompt,
                  summary: plan.groupReply,
                  lastActivityLabel: "项目经理刚刚恢复了下一步安排",
                  updatedAt: followUpAt,
                }
              : item,
          );
          writeState(latest);

          await continueProjectDelegationsInBackground({
            projectId: latestRoom.id,
            conversationId: teamConversationId,
            delegations: plan.delegations,
            recentMessages: [
              ...latestRecentMessages,
              {
                role: "assistant",
                actorLabel: latestManager.name,
                content: plan.groupReply,
              },
            ],
          });
          return;
        }

        if (plan.decision === "waiting_user" || plan.decision === "waiting_approval") {
          applyProjectManagerCheckpoint(latest, {
            projectId: latestRoom.id,
            managerId: latestManager.id,
            decision: plan.decision,
            summary: plan.checkpointSummary || plan.groupReply,
            now: followUpAt,
          });
          writeState(latest);
          return;
        }

        clearRuntimeDelegationState(latest, {
          projectId: latestRoom.id,
          managerId: latestManager.id,
          stageLabel: "项目经理统筹",
        });
        latest.rooms = latest.rooms.map((item) =>
          item.id === latestRoom.id
            ? {
                ...item,
                summary: plan.groupReply,
                lastActivityLabel: "项目经理刚刚恢复了团队统筹",
                updatedAt: followUpAt,
              }
            : item,
        );
        writeState(latest);
      },
      { interrupt: true },
    );

    return getProjectDetail(projectId);
  }

  state.rooms = state.rooms.map((item) =>
    item.id === projectId
      ? {
          ...item,
          status: "active",
          runStatus: "running",
          latestUserRequest: triggerPrompt,
          currentStageLabel: "项目经理统筹",
          summary: "项目经理正在拆解目标、分工并调度成员执行。",
          activeAgentId:
            state.agents.find((agent) => agent.projectId === projectId && agent.canDelegate)?.id ?? null,
          nextAgentId: null,
          lastActivityLabel: "团队运行中",
          updatedAt: now,
        }
      : item,
  );
  resetProjectAutonomyState(state, {
    projectId,
    now,
  });

  state.agents = state.agents.map((agent) =>
    agent.projectId === projectId
      ? {
          ...agent,
          status: agent.canDelegate ? "planning" : "idle",
          currentTaskId: agent.canDelegate ? agent.currentTaskId ?? null : null,
          blockedByAgentId: null,
        }
      : agent,
  );

  activateManagerPlanningTask(state, {
    projectId,
    managerId: manager?.id ?? null,
    managerName: manager?.name ?? "项目经理",
    taskDescription: triggerPrompt,
    now,
  });

  state.runs = [
    {
      id: runId,
      projectId,
      status: "running",
      triggerLabel,
      summary: buildRunStartSummary(goal, triggerPrompt),
      currentStepLabel: "项目经理正在分工并调度成员执行",
      startedAt: now,
      finishedAt: null,
    },
    ...state.runs,
  ];

  state.events = [
    {
      id: `${projectId}-event-runtime-start-${crypto.randomUUID()}`,
      projectId,
      actorName: "项目经理",
      title: "已启动 Team Runtime",
      description: "项目经理开始读取目标、整理分工并调度后台成员会话。",
      visibility: "frontstage",
      createdAt: now,
    },
    ...state.events,
  ];

  writeState(state);

  addMessage(teamConversationId, {
    role: "user",
    content: triggerPrompt,
    meta: triggerLabel,
    status: "done",
  });

  if (!manager) {
    appendTeamConversationMessages(teamConversationId, [
      {
        actorLabel: "OpenCrab",
        content: "团队当前缺少项目经理角色，暂时无法继续调度。请先检查成员配置后再试。",
      },
    ]);
    const failedAt = new Date().toISOString();
    state.rooms = state.rooms.map((item) =>
      item.id === projectId
        ? {
            ...item,
            runStatus: "waiting_user",
            currentStageLabel: "等待你补充",
            summary: "当前团队缺少可用的项目经理角色，无法继续派工。请先检查团队成员配置。",
            lastActivityLabel: "项目经理缺失",
            updatedAt: failedAt,
          }
        : item,
    );
    writeState(state);
    return getProjectDetail(projectId);
  }

  const plan =
    (await planProjectConversationWithManager(
      state,
      room,
      manager,
      projectAgents,
      triggerPrompt,
      recentGroupMessages,
    )) || buildFallbackManagerPlan(state, room.id, manager, triggerPrompt);

  const latestRoomAfterPlanning = readState().rooms.find((item) => item.id === room.id) ?? null;

  if (isProjectRuntimePaused(latestRoomAfterPlanning)) {
    return getProjectDetail(projectId);
  }

  appendTeamConversationMessages(teamConversationId, [
    {
      actorLabel: manager.name,
      content: plan.groupReply,
    },
  ]);

  const managerReplyAt = new Date().toISOString();

  if (plan.delegations.length > 0) {
    consumeProjectAutonomyRound(state, {
      projectId: room.id,
      now: managerReplyAt,
    });
    applyRuntimeDelegationState(state, {
      projectId: room.id,
      managerId: manager.id,
      delegations: plan.delegations,
      fallbackStageLabel: "项目经理统筹",
    });
    state.rooms = state.rooms.map((item) =>
      item.id === room.id
        ? {
            ...item,
            runStatus: "running",
            summary: plan.groupReply,
            lastActivityLabel: "项目经理刚刚完成分工",
            updatedAt: managerReplyAt,
          }
        : item,
    );
    writeState(state);

    enqueueProjectRuntimeWork(room.id, async () => {
      await continueProjectDelegationsInBackground({
        projectId: room.id,
        conversationId: teamConversationId,
        delegations: plan.delegations,
        recentMessages: [
          ...recentGroupMessages,
          {
            role: "assistant",
            actorLabel: manager.name,
            content: plan.groupReply,
          },
        ],
      });
    });

    return getProjectDetail(projectId);
  }

  if (plan.decision === "waiting_user" || plan.decision === "waiting_approval") {
    applyProjectManagerCheckpoint(state, {
      projectId: room.id,
      managerId: manager.id,
      decision: plan.decision,
      summary: plan.checkpointSummary || plan.groupReply,
      now: managerReplyAt,
    });
    writeState(state);
    return getProjectDetail(projectId);
  }

  clearRuntimeDelegationState(state, {
    projectId: room.id,
    managerId: manager.id,
    stageLabel: "项目经理统筹",
  });
  writeState(state);

  return getProjectDetail(projectId);
}

function findLatestProjectCheckpoint(
  state: ProjectStoreState,
  projectId: string,
) {
  const latestArtifact =
    state.artifacts
      .filter(
        (artifact) =>
          artifact.projectId === projectId &&
          CHECKPOINT_ARTIFACT_TITLES.includes(artifact.title as (typeof CHECKPOINT_ARTIFACT_TITLES)[number]),
      )
      .sort((left, right) => Date.parse(right.updatedAt) - Date.parse(left.updatedAt))[0] ?? null;
  const latestTask =
    state.tasks
      .filter(
        (task) =>
          task.projectId === projectId &&
          CHECKPOINT_TASK_TITLES.includes(task.title as (typeof CHECKPOINT_TASK_TITLES)[number]),
      )
      .sort((left, right) => Date.parse(right.updatedAt) - Date.parse(left.updatedAt))[0] ?? null;

  return {
    label: latestArtifact?.title ?? latestTask?.title ?? null,
    summary:
      latestArtifact?.summary ??
      latestTask?.resultSummary ??
      latestTask?.description ??
      null,
    artifact: latestArtifact,
    task: latestTask,
  };
}

function buildCheckpointRollbackPrompt(input: {
  goal: string;
  checkpointLabel: string;
  checkpointSummary: string;
  note: string | null;
}) {
  const sections = [
    "请从最近 checkpoint 重新启动这一轮团队协作。",
    "",
    `最近 checkpoint：${input.checkpointLabel}`,
    input.checkpointSummary,
    "",
    "要求：把这份 checkpoint 当作当前基线，重新判断是否继续派工、如何改排接力以及需要哪些交付物。",
  ];

  if (input.note) {
    sections.push("", `这次重跑额外要求：${input.note}`);
  }

  sections.push("", `当前团队目标：${input.goal}`);

  return sections.join("\n");
}

function buildCheckpointRollbackSummary(input: {
  checkpointLabel: string;
  note: string | null;
}) {
  if (input.note) {
    return `已从最近 checkpoint“${input.checkpointLabel}”重新启动下一轮，并带上新的补充要求：${input.note}`;
  }

  return `已从最近 checkpoint“${input.checkpointLabel}”重新启动下一轮，项目经理会基于上一版阶段结果重新判断接力安排。`;
}

function buildAutonomyContinuationPrompt(input: {
  goal: string;
  gateSummary: string | null;
  note: string | null;
}) {
  if (input.note) {
    return `${input.note}\n\n要求：在当前安全边界内继续自治推进，不要跳过风险提醒。`;
  }

  const sections = [
    "继续在当前安全边界内推进这一轮团队协作。",
    input.gateSummary ? `上一轮停点：${input.gateSummary}` : null,
    `当前团队目标：${input.goal}`,
  ].filter(Boolean);

  return sections.join("\n");
}

export async function updateProjectCheckpoint(
  projectId: string,
  input: {
    action: ProjectCheckpointAction;
    note?: string | null;
  },
) {
  const state = readState();
  const room = state.rooms.find((item) => item.id === projectId);

  if (!room) {
    const error = new Error("这个团队模式不存在，暂时无法更新。");
    (error as Error & { statusCode?: number }).statusCode = 404;
    throw error;
  }

  const note = input.note?.trim() || null;
  const latestRun = state.runs.find((item) => item.projectId === projectId) ?? null;
  const now = new Date().toISOString();
  const teamConversationId = ensureTeamConversation(state, room);
  const openAutonomyGates = findOpenProjectAutonomyGates(state, projectId);
  const manager =
    state.agents.find((agent) => agent.projectId === projectId && agent.agentProfileId === "project-manager") ||
    state.agents.find((agent) => agent.projectId === projectId && agent.canDelegate) ||
    null;

  if (input.action === "pause") {
    if (room.runStatus !== "running") {
      throw new Error("当前团队没有在运行中，暂时不需要暂停。");
    }

    const pauseReply =
      "收到，我先暂停当前团队推进，保留这轮上下文、分工和成员结果。等你恢复运行后，我会从现在的进度继续，而不是重新开始。";

    state.rooms = state.rooms.map((item) =>
      item.id === projectId
        ? {
            ...item,
            status: "paused",
            runStatus: "paused",
            summary: pauseReply,
            lastActivityLabel: "团队已暂停",
            updatedAt: now,
          }
        : item,
    );

    if (latestRun) {
      state.runs = state.runs.map((run) =>
        run.id === latestRun.id
          ? {
              ...run,
              status: "paused",
              summary: pauseReply,
              currentStepLabel: "团队已暂停，等待恢复运行",
            }
          : run,
      );
    }

    state.events = [
      {
        id: `${projectId}-event-pause-${crypto.randomUUID()}`,
        projectId,
        actorName: manager?.name || "项目经理",
        title: "团队已暂停",
        description: "当前执行链已经暂停，现有上下文、分工状态和成员结果都会被保留。",
        visibility: "frontstage",
        createdAt: now,
      },
      ...state.events,
    ];

    if (manager) {
      appendTeamConversationMessages(teamConversationId, [
        {
          actorLabel: manager.name,
          content: pauseReply,
        },
      ]);
    }

    writeState(state);
    return getProjectDetail(projectId);
  }

  if (input.action === "rollback") {
    if (
      room.runStatus !== "waiting_approval" &&
      room.runStatus !== "waiting_user" &&
      room.runStatus !== "completed"
    ) {
      throw new Error("当前状态还没有稳定 checkpoint，暂时不能从最近 checkpoint 重跑。");
    }

    const checkpoint = findLatestProjectCheckpoint(state, projectId);

    if (!checkpoint.label || !checkpoint.summary) {
      throw new Error("最近还没有可回滚的 checkpoint，暂时无法重跑。");
    }

    const rollbackSummary = buildCheckpointRollbackSummary({
      checkpointLabel: checkpoint.label,
      note,
    });
    const rollbackPrompt = buildCheckpointRollbackPrompt({
      goal: room.goal,
      checkpointLabel: checkpoint.label,
      checkpointSummary: checkpoint.summary,
      note,
    });

    settleOpenProjectTasks(state, {
      projectId,
      now,
      nextStatus: "completed",
    });
    settleProjectReviews(state, {
      projectId,
      status: "cancelled",
      updatedAt: now,
      blockingComments: note || "已从最近 checkpoint 重新启动下一轮。",
    });
    settleProjectMailboxThreads(state, {
      projectId,
      updatedAt: now,
    });
    settleProjectStuckSignals(state, {
      projectId,
      updatedAt: now,
    });

    state.rooms = state.rooms.map((item) =>
      item.id === projectId
        ? {
            ...item,
            status: "active",
            runStatus: "ready",
            currentStageLabel: "待重跑",
            activeAgentId: manager?.id ?? null,
            nextAgentId: null,
            latestUserRequest: note || item.latestUserRequest || item.goal,
            summary: rollbackSummary,
            lastActivityLabel: "已从 checkpoint 重跑",
            updatedAt: now,
          }
        : item,
    );

    if (latestRun) {
      state.runs = state.runs.map((run) =>
        run.id === latestRun.id
          ? {
              ...run,
              summary: `${run.summary}\n\n${rollbackSummary}`,
              currentStepLabel: "已从最近 checkpoint 重跑",
              finishedAt: now,
            }
          : run,
      );
    }

    appendProjectRecoveryAction(state, {
      projectId,
      kind: "rollback_to_checkpoint",
      summary: rollbackSummary,
      taskId: checkpoint.task?.id ?? checkpoint.artifact?.sourceTaskId ?? null,
      taskTitle: checkpoint.task?.title ?? checkpoint.artifact?.sourceTaskTitle ?? null,
      fromAgentId: manager?.id ?? null,
      fromAgentName: manager?.name ?? "项目经理",
      toAgentId: manager?.id ?? null,
      toAgentName: manager?.name ?? "项目经理",
      createdAt: now,
    });

    state.events = [
      {
        id: `${projectId}-event-checkpoint-rollback-${crypto.randomUUID()}`,
        projectId,
        actorName: "你",
        title: "已要求从最近 checkpoint 重跑",
        description: note
          ? `${rollbackSummary}\n\n补充要求：${note}`
          : rollbackSummary,
        visibility: "frontstage",
        createdAt: now,
      },
      {
        id: `${projectId}-event-checkpoint-rollback-backstage-${crypto.randomUUID()}`,
        projectId,
        actorName: manager?.name ?? "项目经理",
        title: "项目经理准备从最近 checkpoint 重排接力",
        description: `会基于“${checkpoint.label}”重新整理计划，并启动新一轮 Team Runtime。`,
        visibility: "backstage",
        createdAt: now,
      },
      ...state.events,
    ];

    appendTeamConversationMessages(teamConversationId, [
      ...(note
        ? [
            {
              role: "user" as const,
              content: note,
            },
          ]
        : []),
      {
        actorLabel: manager?.name ?? findProjectActorLabel(state, projectId, "lead"),
        content: rollbackSummary,
      },
    ]);

    settleProjectAutonomyGates(state, {
      projectId,
      updatedAt: now,
    });

    writeState(state);

    return runProject(projectId, {
      triggerLabel: "从 checkpoint 重跑",
      triggerPrompt: rollbackPrompt,
    });
  }

  if (input.action === "approve") {
    if (room.runStatus !== "waiting_approval") {
      throw new Error("当前团队状态不需要确认，暂时无法直接完成。");
    }

    if (openAutonomyGates.length > 0) {
      if (!manager) {
        throw new Error("当前团队缺少项目经理角色，暂时无法继续自治推进。");
      }

      const gateCheckpointTaskId = manager.currentTaskId;
      const continuationPrompt = buildAutonomyContinuationPrompt({
        goal: room.latestUserRequest || room.goal,
        gateSummary: room.autonomyPauseReason ?? openAutonomyGates[0]?.summary ?? null,
        note,
      });
      const managerReply = note
        ? "收到你的放行和补充要求。我会继续在当前安全边界内推进，命中新一轮 gate 时再停下来。"
        : "收到你的放行。我会继续在当前安全边界内推进，命中新一轮 gate 时再停下来。";

      settleProjectAutonomyGates(state, {
        projectId,
        updatedAt: now,
      });
      if (gateCheckpointTaskId) {
        updateProjectTask(state, gateCheckpointTaskId, {
          status: "completed",
          resultSummary: "用户已批准继续自治，项目经理将继续推进下一轮判断。",
          updatedAt: now,
          completedAt: now,
        });
        settleProjectReviews(state, {
          projectId,
          status: "cancelled",
          updatedAt: now,
          taskIds: [gateCheckpointTaskId],
        });
      }
      resetProjectAutonomyState(state, {
        projectId,
        now,
      });

      state.rooms = state.rooms.map((item) =>
        item.id === projectId
          ? {
              ...item,
              status: "active",
              runStatus: "running",
              currentStageLabel: "项目经理统筹",
              activeAgentId: manager.id,
              nextAgentId: null,
              latestUserRequest: continuationPrompt,
              summary: managerReply,
              lastActivityLabel: "已批准继续自治",
              updatedAt: now,
            }
          : item,
      );

      if (latestRun) {
        state.runs = state.runs.map((run) =>
          run.id === latestRun.id
            ? {
                ...run,
                status: "running",
                summary: managerReply,
                currentStepLabel: "已批准继续自治，项目经理正在判断下一步",
              }
            : run,
        );
      }

      state.events = [
        {
          id: `${projectId}-event-autonomy-approved-${crypto.randomUUID()}`,
          projectId,
          actorName: "你",
          title: "已批准继续自治",
          description: note || "继续在当前安全边界内推进。",
          visibility: "frontstage",
          createdAt: now,
        },
        {
          id: `${projectId}-event-autonomy-approved-backstage-${crypto.randomUUID()}`,
          projectId,
          actorName: manager.name,
          title: "项目经理继续在边界内推进",
          description: "项目经理会带着当前停点摘要继续判断下一棒，但仍会在下一次命中 gate 时停下。",
          visibility: "backstage",
          createdAt: now,
        },
        ...state.events,
      ];

      appendTeamConversationMessages(teamConversationId, [
        note
          ? {
              role: "user" as const,
              content: note,
            }
          : {
              role: "user" as const,
              content: "继续在当前安全边界内推进。",
            },
        {
          actorLabel: manager.name,
          content: managerReply,
        },
      ]);

      writeState(state);

      enqueueProjectRuntimeWork(
        projectId,
        async () => {
          const latest = readState();
          const latestRoom = latest.rooms.find((item) => item.id === projectId) ?? null;
          const latestAgents = latest.agents.filter((agent) => agent.projectId === projectId);
          const latestManager =
            latestAgents.find((agent) => agent.agentProfileId === "project-manager") ||
            latestAgents.find((agent) => agent.canDelegate) ||
            null;

          if (!latestRoom || !latestManager || isProjectRuntimePaused(latestRoom)) {
            return;
          }

          const latestRecentMessages = getRecentTeamConversationMessages(teamConversationId);
          const plan =
            (await planProjectConversationWithManager(
              latest,
              latestRoom,
              latestManager,
              latestAgents,
              continuationPrompt,
              latestRecentMessages,
            )) || buildFallbackManagerPlan(latest, latestRoom.id, latestManager, continuationPrompt);

          if (isProjectRuntimePaused(readState().rooms.find((item) => item.id === latestRoom.id) ?? null)) {
            return;
          }

          appendTeamConversationMessages(teamConversationId, [
            {
              actorLabel: latestManager.name,
              content: plan.groupReply,
            },
          ]);

          const followUpAt = new Date().toISOString();

          if (plan.delegations.length > 0) {
            consumeProjectAutonomyRound(latest, {
              projectId: latestRoom.id,
              now: followUpAt,
            });
            applyRuntimeDelegationState(latest, {
              projectId: latestRoom.id,
              managerId: latestManager.id,
              delegations: plan.delegations,
              fallbackStageLabel: "项目经理统筹",
            });
            latest.rooms = latest.rooms.map((item) =>
              item.id === latestRoom.id
                ? {
                    ...item,
                    summary: plan.groupReply,
                    lastActivityLabel: "项目经理刚刚更新了下一步安排",
                    updatedAt: followUpAt,
                  }
                : item,
            );
            writeState(latest);

            await continueProjectDelegationsInBackground({
              projectId: latestRoom.id,
              conversationId: teamConversationId,
              delegations: plan.delegations,
              recentMessages: [
                ...latestRecentMessages,
                {
                  role: "assistant",
                  actorLabel: latestManager.name,
                  content: plan.groupReply,
                },
              ],
            });
            return;
          }

          if (plan.decision === "waiting_user" || plan.decision === "waiting_approval") {
            applyProjectManagerCheckpoint(latest, {
              projectId: latestRoom.id,
              managerId: latestManager.id,
              decision: plan.decision,
              summary: plan.checkpointSummary || plan.groupReply,
              now: followUpAt,
            });
            writeState(latest);
            return;
          }

          clearRuntimeDelegationState(latest, {
            projectId: latestRoom.id,
            managerId: latestManager.id,
            stageLabel: "项目经理统筹",
          });
          writeState(latest);
        },
        { interrupt: true },
      );

      return getProjectDetail(projectId);
    }

    return finalizeProjectRun(state, {
      projectId,
      goal: room.latestUserRequest || room.goal,
      now,
      latestRunId: latestRun?.id ?? null,
      approvalNote: note,
    });
  }

  if (input.action === "request_changes") {
    if (room.runStatus !== "waiting_approval") {
      throw new Error("只有在等待确认时，才能要求团队补充或改方向。");
    }

    if (!note) {
      throw new Error("请先告诉团队要补充什么，或者需要调整成什么方向。");
    }

    const normalizedNote = stripTrailingSentencePunctuation(note);
    const managerId = manager?.id ?? null;
    const managerName = manager?.name ?? "项目经理";

    settleProjectAutonomyGates(state, {
      projectId,
      updatedAt: now,
    });
    settleOpenProjectTasks(state, {
      projectId,
      now,
      nextStatus: "waiting_user",
    });
    createCheckpointTask(state, {
      projectId,
      managerId,
      managerName,
      decision: "waiting_user",
      summary: normalizedNote,
      now,
    });
    const followUp = createFollowUpTasksFromPendingReviews(state, {
      projectId,
      managerId,
      managerName,
      note: normalizedNote,
      now,
    });
    settleProjectReviews(state, {
      projectId,
      status: "changes_requested",
      updatedAt: now,
      blockingComments: normalizedNote,
      followUpTaskIdByReviewId: followUp.followUpTaskIdByReviewId,
    });

    state.rooms = state.rooms.map((item) =>
      item.id === projectId
        ? {
            ...item,
            runStatus: "waiting_user",
            currentStageLabel: "等待你补充",
            activeAgentId: managerId,
            nextAgentId:
              state.tasks.find(
                (task) =>
                  task.projectId === projectId &&
                  (task.status === "reopened" || task.status === "claimed" || task.status === "ready") &&
                  task.ownerAgentId !== managerId,
              )?.ownerAgentId ?? null,
            summary: `已记录你的补充方向：${normalizedNote}。团队会等待你确认后再继续推进。`,
            latestUserRequest: note,
            autonomyStatus: "guarded",
            autonomyPauseReason: null,
            lastActivityLabel: "等待你补充后继续",
            updatedAt: now,
          }
        : item,
    );

    state.agents = state.agents.map((agent) => {
      if (agent.projectId !== projectId) {
        return agent;
      }

      if (agent.canDelegate) {
        return { ...agent, status: "planning", blockedByAgentId: null };
      }

      return { ...agent, status: "idle", currentTaskId: null, blockedByAgentId: null };
    });

    if (latestRun) {
      state.runs = state.runs.map((run) =>
        run.id === latestRun.id
          ? {
              ...run,
              status: "waiting_user",
              summary: `用户要求团队补充新方向：${normalizedNote}`,
              currentStepLabel: "等待用户补充后继续",
            }
          : run,
      );
    }

    state.events = [
      {
        id: `${projectId}-event-waiting-user-${crypto.randomUUID()}`,
        projectId,
        actorName: "你",
        title: "已要求团队补充或改方向",
        description: note,
        visibility: "frontstage",
        createdAt: now,
      },
      {
        id: `${projectId}-event-waiting-user-backstage-${crypto.randomUUID()}`,
        projectId,
        actorName: "OpenCrab PM",
        title: "已生成返工任务",
        description:
          followUp.createdTaskIds.length > 0
            ? `Lead 已根据这次复核意见生成 ${followUp.createdTaskIds.length} 条 follow-up task，恢复运行后会优先从返工链继续。`
            : "Lead 已暂停当前收尾流程，等待用户确认后按新方向重启团队协作。",
        visibility: "backstage",
        createdAt: now,
      },
      ...state.events,
    ];

    state.artifacts = upsertArtifactsAfterRun(state.artifacts, {
      projectId,
      summary: `已记录新的补充方向：${normalizedNote}。待你继续推进后，团队会重新整理最终输出。`,
      updatedAt: now,
      phase: "waiting_user",
    });
    syncProjectArtifactCount(state, projectId);
    appendTeamConversationMessages(teamConversationId, [
      {
        role: "user",
        content: note,
      },
      {
        actorLabel: findProjectActorLabel(state, projectId, "lead"),
        content: "收到新的补充方向。我会先暂停当前收尾流程，等确认后按这个更新重启团队协作。",
      },
    ]);
    writeState(state);

    return getProjectDetail(projectId);
  }

  if (room.runStatus !== "waiting_user") {
    throw new Error("当前团队状态不需要补充后继续。");
  }

  const nextPrompt = note || room.latestUserRequest || room.goal;

  state.tasks = state.tasks.map((task) =>
    task.projectId === projectId && task.status === "waiting_input"
      ? {
          ...task,
          status: "completed",
          resultSummary: task.resultSummary || "用户已补充新的方向，项目经理将继续推进下一轮。",
          updatedAt: now,
          completedAt: task.completedAt ?? now,
        }
      : task,
  );
  settleProjectReviews(state, {
    projectId,
    status: "approved",
    updatedAt: now,
  });
  settleProjectAutonomyGates(state, {
    projectId,
    updatedAt: now,
  });

  state.rooms = state.rooms.map((item) =>
    item.id === projectId
      ? {
          ...item,
          runStatus: "ready",
          latestUserRequest: nextPrompt,
          autonomyStatus: "guarded",
          autonomyPauseReason: null,
          summary: "已记录新的补充方向，准备带着这次更新重新推进团队协作。",
          lastActivityLabel: "准备继续推进",
          updatedAt: now,
        }
      : item,
  );
  resetProjectAutonomyState(state, {
    projectId,
    now,
  });

  state.events = [
    {
      id: `${projectId}-event-resume-${crypto.randomUUID()}`,
      projectId,
      actorName: "你",
      title: "已提交补充并继续推进",
      description: nextPrompt,
      visibility: "frontstage",
      createdAt: now,
    },
    {
      id: `${projectId}-event-resume-backstage-${crypto.randomUUID()}`,
      projectId,
      actorName: "OpenCrab PM",
      title: "准备按新的补充方向重启团队运行",
      description: "Manager 将根据最新补充重新委派 Researcher 和 Writer。",
      visibility: "backstage",
      createdAt: now,
    },
    ...state.events,
  ];
  appendTeamConversationMessages(teamConversationId, [
    {
      role: "user",
      content: nextPrompt,
    },
    {
      actorLabel: findProjectActorLabel(state, projectId, "lead"),
      content: "补充已收到，我会带着这次更新重新组织团队推进。",
    },
  ]);
  writeState(state);

  return runProject(projectId, {
    triggerLabel: "补充后继续",
    triggerPrompt: nextPrompt,
  });
}

export function reviewProjectLearningSuggestion(
  projectId: string,
  input: {
    suggestionId: string;
    action: "accept" | "dismiss";
    note?: string | null;
  },
) {
  const state = readState();
  const room = state.rooms.find((item) => item.id === projectId) ?? null;

  if (!room) {
    const error = new Error("这个团队模式不存在，暂时无法更新 learning suggestion。");
    (error as Error & { statusCode?: number }).statusCode = 404;
    throw error;
  }

  const suggestion =
    state.learningSuggestions.find(
      (item) => item.projectId === projectId && item.id === input.suggestionId,
    ) ?? null;

  if (!suggestion) {
    const error = new Error("这条 learning suggestion 不存在，可能已经被移除。");
    (error as Error & { statusCode?: number }).statusCode = 404;
    throw error;
  }

  if (suggestion.status !== "open") {
    throw new Error("这条 learning suggestion 已经处理过了。");
  }

  const now = new Date().toISOString();
  const note = input.note?.trim() || null;
  const nextStatus = input.action === "accept" ? "accepted" : "dismissed";
  const manager =
    state.agents.find((agent) => agent.projectId === projectId && agent.agentProfileId === "project-manager") ||
    state.agents.find((agent) => agent.projectId === projectId && agent.canDelegate) ||
    null;

  state.learningSuggestions = state.learningSuggestions.map((item) =>
    item.id === suggestion.id
      ? {
          ...item,
          status: nextStatus,
          reviewNote: note,
          reviewedAt: now,
          updatedAt: now,
        }
      : item,
  );

  settleProjectMailboxThreads(state, {
    projectId,
    updatedAt: now,
    kind: "human_review",
    relatedSuggestionId: suggestion.id,
  });

  state.events = [
    {
      id: `${projectId}-event-learning-review-${crypto.randomUUID()}`,
      projectId,
      actorName: "你",
      title: input.action === "accept" ? "已采纳学习建议" : "已忽略学习建议",
      description: note
        ? `${suggestion.title}：${note}`
        : suggestion.title,
      visibility: "frontstage",
      createdAt: now,
    },
    {
      id: `${projectId}-event-learning-review-backstage-${crypto.randomUUID()}`,
      projectId,
      actorName: manager?.name ?? "项目经理",
      title: input.action === "accept" ? "学习建议已进入默认策略" : "学习建议已被搁置",
      description:
        input.action === "accept"
          ? `${suggestion.title} 已进入后续默认判断。${note ? `备注：${note}` : ""}`.trim()
          : `${suggestion.title} 本轮不会进入默认策略。${note ? `备注：${note}` : ""}`.trim(),
      visibility: "backstage",
      createdAt: now,
    },
    ...state.events,
  ];

  if (room.teamConversationId) {
    appendTeamConversationMessages(room.teamConversationId, [
      {
        actorLabel: manager?.name ?? findProjectActorLabel(state, projectId, "lead"),
        content:
          input.action === "accept"
            ? `学习建议“${suggestion.title}”已被采纳，后续我会把它当作默认协作策略的一部分。`
            : `学习建议“${suggestion.title}”这轮先不采纳，团队会继续按现有策略推进。`,
      },
    ]);
  }

  writeState(state);
  return getProjectDetail(projectId);
}

export function reviewProjectLearningReuseCandidate(
  projectId: string,
  input: {
    candidateId: string;
    action: "confirm" | "dismiss";
    note?: string | null;
  },
) {
  const state = readState();
  const room = state.rooms.find((item) => item.id === projectId) ?? null;

  if (!room) {
    const error = new Error("这个团队模式不存在，暂时无法更新跨项目复用候选。");
    (error as Error & { statusCode?: number }).statusCode = 404;
    throw error;
  }

  const candidate =
    state.learningReuseCandidates.find(
      (item) => item.sourceProjectId === projectId && item.id === input.candidateId,
    ) ?? null;

  if (!candidate) {
    const error = new Error("这条跨项目复用候选不存在，可能已经被移除。");
    (error as Error & { statusCode?: number }).statusCode = 404;
    throw error;
  }

  if (candidate.status !== "pending_review") {
    throw new Error("这条跨项目复用候选已经处理过了。");
  }

  const now = new Date().toISOString();
  const note = input.note?.trim() || null;
  const nextStatus = input.action === "confirm" ? "confirmed" : "dismissed";
  const manager =
    state.agents.find((agent) => agent.projectId === projectId && agent.agentProfileId === "project-manager") ||
    state.agents.find((agent) => agent.projectId === projectId && agent.canDelegate) ||
    null;

  state.learningReuseCandidates = state.learningReuseCandidates.map((item) =>
    item.id === candidate.id
      ? {
          ...item,
          status: nextStatus,
          reviewNote: note,
          reviewedAt: now,
          updatedAt: now,
        }
      : item,
  );

  state.events = [
    {
      id: `${projectId}-event-learning-reuse-${crypto.randomUUID()}`,
      projectId,
      actorName: "你",
      title: input.action === "confirm" ? "已确认跨项目复用候选" : "已搁置跨项目复用候选",
      description: note ? `${candidate.title}：${note}` : candidate.title,
      visibility: "frontstage",
      createdAt: now,
    },
    {
      id: `${projectId}-event-learning-reuse-backstage-${crypto.randomUUID()}`,
      projectId,
      actorName: manager?.name ?? "项目经理",
      title: input.action === "confirm" ? "跨项目候选已进入复用库" : "跨项目候选暂不复用",
      description:
        input.action === "confirm"
          ? `${candidate.title} 已进入跨项目候选库。${note ? `备注：${note}` : ""}`.trim()
          : `${candidate.title} 当前仍只保留在本项目，不进入跨项目候选库。${note ? `备注：${note}` : ""}`.trim(),
      visibility: "backstage",
      createdAt: now,
    },
    ...state.events,
  ];

  if (room.teamConversationId) {
    appendTeamConversationMessages(room.teamConversationId, [
      {
        actorLabel: manager?.name ?? findProjectActorLabel(state, projectId, "lead"),
        content:
          input.action === "confirm"
            ? `跨项目复用候选“${candidate.title}”已确认进入候选库，后续项目可以把它当作可选模板继续复用。`
            : `跨项目复用候选“${candidate.title}”这轮先不放进候选库，暂时仍只保留在当前项目里。`,
      },
    ]);
  }

  writeState(state);
  return getProjectDetail(projectId);
}

function buildManualRoom(input: {
  projectId: string;
  goal: string;
  workspaceDir: string;
  profiles: Array<{
    id: string;
    name: string;
    summary: string;
    teamRole: string;
    defaultModel: string | null;
    defaultReasoningEffort: ProjectAgentRecord["reasoningEffort"] | null;
    defaultSandboxMode: ProjectAgentRecord["sandboxMode"] | null;
  }>;
  model: string;
  reasoningEffort: ProjectAgentRecord["reasoningEffort"];
  sandboxMode: ProjectAgentRecord["sandboxMode"];
  createdAt: string;
}) {
  const normalizedAgents = buildTeamAgents({
    projectId: input.projectId,
    profiles: input.profiles,
    defaultModel: input.model,
    defaultReasoningEffort: input.reasoningEffort,
    defaultSandboxMode: input.sandboxMode,
  });
  const conciseGoal = input.goal.replace(/\s+/g, " ").trim();
  const shortLabel = buildProjectDisplayTitle({
    goal: conciseGoal,
    fallback: "新团队",
  });
  const teamName = buildProjectTeamName(shortLabel);
  const room: ProjectRoomRecord = {
    id: input.projectId,
    title: shortLabel,
    teamName,
    goal: input.goal,
    workspaceDir: input.workspaceDir,
    sandboxMode: input.sandboxMode,
    teamConversationId: null,
    feishuChatSessionId: null,
    summary: `围绕“${stripTrailingSentencePunctuation(shortLabel)}”启动的新团队，已装配 ${normalizedAgents.length} 位智能体，默认产出目录已设置完成。`,
    status: "active",
    runStatus: "ready",
    latestUserRequest: input.goal,
    currentStageLabel: "待启动",
    activeAgentId: null,
    nextAgentId: null,
    memberCount: normalizedAgents.length,
    artifactCount: 3,
    openGateCount: 0,
    latestGateSummary: null,
    autonomyStatus: "guarded",
    autonomyRoundBudget: PROJECT_AUTONOMY_ROUND_BUDGET,
    autonomyRoundCount: 0,
    autonomyApprovedAt: input.createdAt,
    autonomyPauseReason: null,
    lastActivityLabel: "刚刚创建",
    createdAt: input.createdAt,
    updatedAt: input.createdAt,
  };

  const events: ProjectEventRecord[] = [
    {
      id: `${input.projectId}-event-1`,
      projectId: input.projectId,
      actorName: "你",
      title: "已创建团队目标",
      description: `${input.goal}\n\n工作空间目录：${input.workspaceDir}`,
      visibility: "frontstage",
      createdAt: input.createdAt,
    },
    {
      id: `${input.projectId}-event-2`,
      projectId: input.projectId,
      actorName: "Team Lead",
      title: "已装配初始成员",
      description: `当前团队包含：${normalizedAgents.map((agent) => agent.name).join("、")}。`,
      visibility: "backstage",
      createdAt: input.createdAt,
    },
    {
      id: `${input.projectId}-event-3`,
      projectId: input.projectId,
      actorName: "OpenCrab",
      title: "准备启动第一轮协作",
      description: "你可以先检查成员配置和工作空间目录，或者直接启动团队运行。",
      visibility: "frontstage",
      createdAt: input.createdAt,
    },
  ];

  const artifacts: ProjectArtifactRecord[] = [
    {
      id: `${input.projectId}-artifact-1`,
      projectId: input.projectId,
      title: "团队目标",
      typeLabel: "Brief",
      summary: `${input.goal}\n工作空间目录：${input.workspaceDir}`,
      status: "ready",
      sourceTaskId: null,
      sourceTaskTitle: null,
      ownerAgentId: null,
      ownerAgentName: null,
      reviewStatus: null,
      reviewerAgentId: null,
      reviewerAgentName: null,
      dependsOnArtifactIds: [],
      consumedByTaskIds: [],
      updatedAt: input.createdAt,
    },
    {
      id: `${input.projectId}-artifact-2`,
      projectId: input.projectId,
      title: "成员清单",
      typeLabel: "Roster",
      summary: normalizedAgents.map((agent) => `${agent.name} · ${agent.role}`).join(" / "),
      status: "ready",
      sourceTaskId: null,
      sourceTaskTitle: null,
      ownerAgentId: null,
      ownerAgentName: null,
      reviewStatus: null,
      reviewerAgentId: null,
      reviewerAgentName: null,
      dependsOnArtifactIds: [],
      consumedByTaskIds: [],
      updatedAt: input.createdAt,
    },
    {
      id: `${input.projectId}-artifact-3`,
      projectId: input.projectId,
      title: "首轮计划",
      typeLabel: "Plan",
      summary: `团队已完成初始化，后续产出默认沉淀到 ${input.workspaceDir}。`,
      status: "draft",
      sourceTaskId: null,
      sourceTaskTitle: null,
      ownerAgentId: null,
      ownerAgentName: null,
      reviewStatus: null,
      reviewerAgentId: null,
      reviewerAgentName: null,
      dependsOnArtifactIds: [],
      consumedByTaskIds: [],
      updatedAt: input.createdAt,
    },
  ];

  const tasks = buildInitialProjectTasks({
    projectId: input.projectId,
    goal: input.goal,
    manager: normalizedAgents.find((agent) => agent.canDelegate) ?? null,
    workspaceDir: input.workspaceDir,
    initialArtifactIds: artifacts.map((artifact) => artifact.id),
    createdAt: input.createdAt,
  });

  return {
    room,
    agents: normalizedAgents,
    events,
    artifacts,
    reviews: [],
    tasks,
  };
}

function buildTeamAgents(input: {
  projectId: string;
  profiles: Array<{ id: string; name: string; summary: string; source?: "system" | "custom"; teamRole: string; defaultModel: string | null; defaultReasoningEffort: ProjectAgentRecord["reasoningEffort"] | null; defaultSandboxMode: ProjectAgentRecord["sandboxMode"] | null }>;
  defaultModel: string;
  defaultReasoningEffort: ProjectAgentRecord["reasoningEffort"];
  defaultSandboxMode: ProjectAgentRecord["sandboxMode"];
}) {
  if (input.profiles.length === 0) {
    return buildFallbackAgents(input);
  }

  const managerProfileId =
    input.profiles.find((profile) => profile.id === "project-manager")?.id || input.profiles[0]?.id || null;

  return input.profiles.map((profile) => {
    const detail = getAgentProfile(profile.id);
    const storedTeamRole = detail?.teamRole || profile.teamRole;
    const isLead = profile.id === managerProfileId;
    const teamRole = isLead ? "lead" : normalizeNonManagerTeamRole(storedTeamRole);
    const prefersProjectRuntimeDefaults = (detail?.source || profile.source) === "system";

    return {
      id: `${input.projectId}-${profile.id}`,
      projectId: input.projectId,
      agentProfileId: profile.id,
      name: detail?.name || profile.name,
      role: formatProjectRoleLabel(teamRole, isLead),
      responsibility:
        detail?.files.responsibility.trim() ||
        detail?.summary ||
        profile.summary,
      status: isLead ? "planning" : "idle",
      visibility: resolveVisibility(teamRole, isLead),
      runtimeConversationId: null,
      currentTaskId: null,
      lastAssignedTask: null,
      lastResultSummary: null,
      progressLabel: isLead ? "准备统筹首轮协作" : "等待项目经理安排",
      progressDetails: isLead
        ? "团队刚创建完成，项目经理准备先读取目标和当前上下文，再安排第一棒。"
        : "当前还没有进入执行阶段，拿到 baton 后会开始工作。",
      lastHeartbeatAt: null,
      progressTrail: [],
      blockedByAgentId: null,
      lastCompletedAt: null,
      model: resolveProjectAgentRuntimeDefault({
        detailValue: detail?.defaultModel,
        profileValue: profile.defaultModel,
        projectValue: input.defaultModel,
        preferProjectDefault: prefersProjectRuntimeDefaults,
      }),
      reasoningEffort: resolveProjectAgentRuntimeDefault({
        detailValue: detail?.defaultReasoningEffort,
        profileValue: profile.defaultReasoningEffort,
        projectValue: input.defaultReasoningEffort,
        preferProjectDefault: prefersProjectRuntimeDefaults,
      }),
      sandboxMode: resolveProjectAgentRuntimeDefault({
        detailValue: detail?.defaultSandboxMode,
        profileValue: profile.defaultSandboxMode,
        projectValue: input.defaultSandboxMode,
        preferProjectDefault: prefersProjectRuntimeDefaults,
      }),
      canDelegate: isLead,
    } satisfies ProjectAgentRecord;
  });
}

function resolveProjectAgentRuntimeDefault<T>(input: {
  detailValue: T | null | undefined;
  profileValue: T | null | undefined;
  projectValue: NonNullable<T>;
  preferProjectDefault: boolean;
}) {
  if (input.preferProjectDefault) {
    return input.projectValue ?? input.detailValue ?? input.profileValue;
  }

  return (input.detailValue ?? input.profileValue ?? input.projectValue) as NonNullable<T>;
}

function buildFallbackAgents(input: {
  projectId: string;
  defaultModel: string;
  defaultReasoningEffort: ProjectAgentRecord["reasoningEffort"];
  defaultSandboxMode: ProjectAgentRecord["sandboxMode"];
}) {
  return [
    {
      id: `${input.projectId}-lead`,
      projectId: input.projectId,
      agentProfileId: null,
      name: "OpenCrab PM",
      role: "Lead",
      responsibility: "拆解目标、分配工作、汇总阶段结果。",
      status: "planning",
      visibility: "mixed",
      runtimeConversationId: null,
      currentTaskId: null,
      lastAssignedTask: null,
      lastResultSummary: null,
      progressLabel: "准备统筹首轮协作",
      progressDetails: "团队刚创建完成，项目经理准备先读取目标和当前上下文，再安排第一棒。",
      lastHeartbeatAt: null,
      progressTrail: [],
      blockedByAgentId: null,
      lastCompletedAt: null,
      model: input.defaultModel,
      reasoningEffort: input.defaultReasoningEffort,
      sandboxMode: input.defaultSandboxMode,
      canDelegate: true,
    },
    {
      id: `${input.projectId}-research`,
      projectId: input.projectId,
      agentProfileId: null,
      name: "Researcher",
      role: "Research",
      responsibility: "负责资料整理、问题拆分和证据收集。",
      status: "idle",
      visibility: "backstage",
      runtimeConversationId: null,
      currentTaskId: null,
      lastAssignedTask: null,
      lastResultSummary: null,
      progressLabel: "等待项目经理安排",
      progressDetails: "当前还没有进入执行阶段，拿到 baton 后会开始工作。",
      lastHeartbeatAt: null,
      progressTrail: [],
      blockedByAgentId: null,
      lastCompletedAt: null,
      model: input.defaultModel,
      reasoningEffort: input.defaultReasoningEffort,
      sandboxMode: input.defaultSandboxMode,
      canDelegate: false,
    },
    {
      id: `${input.projectId}-writer`,
      projectId: input.projectId,
      agentProfileId: null,
      name: "Writer",
      role: "Writer",
      responsibility: "负责把结果整理成用户可读的说明、方案或草稿。",
      status: "idle",
      visibility: "frontstage",
      runtimeConversationId: null,
      currentTaskId: null,
      lastAssignedTask: null,
      lastResultSummary: null,
      progressLabel: "等待项目经理安排",
      progressDetails: "当前还没有进入执行阶段，拿到 baton 后会开始工作。",
      lastHeartbeatAt: null,
      progressTrail: [],
      blockedByAgentId: null,
      lastCompletedAt: null,
      model: input.defaultModel,
      reasoningEffort: input.defaultReasoningEffort,
      sandboxMode: input.defaultSandboxMode,
      canDelegate: false,
    },
  ] satisfies ProjectAgentRecord[];
}

function normalizeNonManagerTeamRole(teamRole: string | null | undefined) {
  if (teamRole === "research" || teamRole === "writer" || teamRole === "specialist") {
    return teamRole;
  }

  return "specialist";
}

function inferStoredTeamRole(
  agent: ProjectAgentRecord,
  profileTeamRole: string | null | undefined,
) {
  if (profileTeamRole === "lead") {
    return "lead";
  }

  if (profileTeamRole === "research" || profileTeamRole === "writer" || profileTeamRole === "specialist") {
    return profileTeamRole;
  }

  if (agent.role === "Lead") {
    return "lead";
  }

  if (agent.role === "Research") {
    return "research";
  }

  if (agent.role === "Writer") {
    return "writer";
  }

  if (agent.visibility === "frontstage") {
    return "writer";
  }

  return "specialist";
}

function normalizeMemberStatus(
  runStatus: ProjectRoomRecord["runStatus"] | undefined,
  visibility: ProjectAgentRecord["visibility"],
) {
  if (runStatus === "running") {
    return visibility === "backstage" ? "working" : "idle";
  }

  if (runStatus === "waiting_approval") {
    return visibility === "backstage" ? "reviewing" : "idle";
  }

  if (runStatus === "completed") {
    return visibility === "frontstage" ? "reviewing" : "idle";
  }

  return "idle";
}

function normalizeStoredProjectAgents(
  agents: ProjectAgentRecord[],
  rooms: ProjectRoomRecord[],
) {
  const groupedAgents = new Map<string, ProjectAgentRecord[]>();
  const profileCache = new Map<string, ReturnType<typeof getAgentProfile>>();
  const runStatusByProject = new Map(rooms.map((room) => [room.id, room.runStatus] as const));

  agents.forEach((agent) => {
    const bucket = groupedAgents.get(agent.projectId);

    if (bucket) {
      bucket.push(agent);
      return;
    }

    groupedAgents.set(agent.projectId, [agent]);
  });

  return Array.from(groupedAgents.entries()).flatMap(([projectId, projectAgents]) => {
    if (!runStatusByProject.has(projectId)) {
      return [];
    }

    const managerId =
      projectAgents.find((agent) => agent.agentProfileId === "project-manager")?.id ||
      projectAgents.find((agent) => agent.canDelegate)?.id ||
      projectAgents[0]?.id ||
      null;

    const sortedAgents = [...projectAgents].sort((left, right) => {
      if (left.id === managerId) {
        return -1;
      }

      if (right.id === managerId) {
        return 1;
      }

      return left.name.localeCompare(right.name, "zh-Hans-CN");
    });

    return sortedAgents.map((agent) => {
      const detail = agent.agentProfileId
        ? (profileCache.has(agent.agentProfileId)
            ? profileCache.get(agent.agentProfileId)
            : (() => {
                const nextDetail = getAgentProfile(agent.agentProfileId!);
                profileCache.set(agent.agentProfileId!, nextDetail);
                return nextDetail;
              })()) ?? null
        : null;
      const isLead = agent.id === managerId;
      const storedTeamRole = inferStoredTeamRole(agent, detail?.teamRole || null);
      const teamRole = isLead ? "lead" : normalizeNonManagerTeamRole(storedTeamRole);
      const visibility = resolveVisibility(teamRole, isLead);

      return {
        ...agent,
        role: formatProjectRoleLabel(teamRole, isLead),
        visibility,
        runtimeConversationId: agent.runtimeConversationId ?? null,
        currentTaskId: agent.currentTaskId ?? null,
        lastAssignedTask: agent.lastAssignedTask ?? null,
        lastResultSummary: agent.lastResultSummary ?? null,
        progressLabel: agent.progressLabel ?? null,
        progressDetails: agent.progressDetails ?? null,
        lastHeartbeatAt: agent.lastHeartbeatAt ?? null,
        progressTrail: Array.isArray(agent.progressTrail) ? agent.progressTrail.slice(-6) : [],
        blockedByAgentId: agent.blockedByAgentId ?? null,
        lastCompletedAt: agent.lastCompletedAt ?? null,
        canDelegate: isLead,
        status: isLead
          ? agent.status
          : agent.canDelegate
            ? normalizeMemberStatus(runStatusByProject.get(projectId), visibility)
            : agent.status,
      } satisfies ProjectAgentRecord;
    });
  });
}

function formatProjectRoleLabel(teamRole: string, isLead: boolean) {
  if (isLead) {
    return "Lead";
  }

  if (teamRole === "research") {
    return "Research";
  }

  if (teamRole === "writer") {
    return "Writer";
  }

  return "Specialist";
}

function resolveVisibility(teamRole: string, isLead: boolean): ProjectAgentRecord["visibility"] {
  if (isLead) {
    return "mixed";
  }

  if (teamRole === "writer") {
    return "frontstage";
  }

  return "backstage";
}

function ensureProjectManagerAgentId(agentIds: string[]) {
  return agentIds.includes("project-manager") ? agentIds : ["project-manager", ...agentIds];
}

function ensureTeamConversation(state: ProjectStoreState, room: ProjectRoomRecord) {
  if (room.teamConversationId) {
    updateStoredConversation(room.teamConversationId, {
      projectId: room.id,
      workspaceDir: room.workspaceDir,
      sandboxMode: room.sandboxMode,
      feishuChatSessionId: room.feishuChatSessionId ?? null,
    });
    return room.teamConversationId;
  }

  const folder = ensureFolder("团队群聊");
  const created = createConversation({
    title: `${room.teamName} · 群聊`,
    folderId: folder?.id ?? null,
    workspaceDir: room.workspaceDir,
    sandboxMode: room.sandboxMode,
    projectId: room.id,
    feishuChatSessionId: room.feishuChatSessionId ?? null,
  });

  state.rooms = state.rooms.map((item) =>
    item.id === room.id
      ? {
          ...item,
          teamConversationId: created.conversationId,
        }
      : item,
  );

  addMessage(created.conversationId, {
    role: "assistant",
    actorLabel: "OpenCrab",
    content: `团队群聊已创建。后续各个 Agent 的协作过程会记录在这里。\n\n当前团队目标：${room.goal}`,
    meta: "Team Room 已启动",
    status: "done",
  });

  return created.conversationId;
}

function appendTeamConversationMessages(
  conversationId: string,
  messages: Array<{
    role?: "user" | "assistant";
    actorLabel?: string;
    content: string;
  }>,
) {
  messages.forEach((message) => {
    addMessage(conversationId, {
      role: message.role ?? "assistant",
      actorLabel: message.role === "user" ? undefined : message.actorLabel,
      content: message.content,
      meta: "团队群聊",
      status: "done",
    });
  });
}

function buildProjectConversationReplies(
  state: ProjectStoreState,
  projectId: string,
  content: string,
) {
  const projectAgents = state.agents.filter((agent) => agent.projectId === projectId);
  const manager = projectAgents.find((agent) => agent.agentProfileId === "project-manager") ||
    projectAgents.find((agent) => agent.canDelegate) ||
    null;
  const otherAgents = projectAgents.filter((agent) => agent.id !== manager?.id);
  const isDelegationRequest = matchesDelegationIntent(content);
  const explicitTargets = otherAgents.filter((agent) => matchesAgentMention(content, agent));
  const autonomousTargets = otherAgents.filter(
    (agent) => !explicitTargets.some((item) => item.id === agent.id) && shouldAgentJoinConversation(content, agent),
  );
  const routedTargets =
    explicitTargets.length > 0
      ? explicitTargets
      : isDelegationRequest
        ? otherAgents
        : autonomousTargets;

  const managerReply = manager
    ? buildManagerReply({
        managerName: manager.name,
        content,
        routedTargets,
        autonomous: explicitTargets.length === 0 && routedTargets.length > 0,
        delegationRequest: isDelegationRequest,
      })
    : null;

  const memberReplies = routedTargets.map((agent) => ({
    actorLabel: agent.name,
    content: buildMemberReply(agent, content),
  }));

  return [
    ...(managerReply
      ? [
          {
            actorLabel: managerReply.actorLabel,
            content: managerReply.content,
          },
        ]
      : []),
    ...memberReplies,
  ];
}

function buildManagerReply(input: {
  managerName: string;
  content: string;
  routedTargets: ProjectAgentRecord[];
  autonomous: boolean;
  delegationRequest: boolean;
}) {
  if (input.routedTargets.length === 0) {
    return {
      actorLabel: input.managerName,
      content:
        "收到，这一轮先由我来继续推进。我会先根据当前群聊内容收束目标、判断优先级；如果需要更细的研究或整理，我再 @ 对应成员加入。",
    };
  }

  const mentions = input.routedTargets.map((agent) => `@${agent.name}`).join("、");
  const assignments = input.routedTargets
    .map((agent) => `- @${agent.name}：${describeAgentAssignment(agent)}`)
    .join("\n");

  if (input.delegationRequest) {
    return {
      actorLabel: input.managerName,
      content: `收到，这一轮我来正式分工推进。先请 ${mentions} 接手各自工作，我负责收束节奏、同步依赖和最后汇总。\n${assignments}\n大家先各自补第一版，我再根据结果继续安排下一轮。`,
    };
  }

  return {
    actorLabel: input.managerName,
    content: input.autonomous
      ? `收到。基于当前群聊内容，我判断这轮需要请 ${mentions} 一起加入推进。我先做一轮分配：\n${assignments}\n大家先围绕这条信息继续补充，我来负责收束和下一步安排。`
      : `收到，我已经看到你点名了 ${mentions}。我会负责统筹这轮协作，先请对应成员直接补充，然后由我来收束结论和下一步。`,
  };
}

function buildInitialProjectTasks(input: {
  projectId: string;
  goal: string;
  manager: ProjectAgentRecord | null;
  workspaceDir: string | null;
  initialArtifactIds?: string[];
  createdAt: string;
}) {
  const managerName = input.manager?.name ?? "项目经理";

  return [
    {
      id: `${input.projectId}-task-bootstrap`,
      projectId: input.projectId,
      title: "项目经理收束目标并拆解首轮任务",
      description: input.workspaceDir
        ? `阅读团队目标与工作空间目录（${input.workspaceDir}），形成第一轮可执行拆解。`
        : "阅读当前目标与上下文，形成第一轮可执行拆解。",
      status: "ready",
      ownerAgentId: input.manager?.id ?? null,
      ownerAgentName: managerName,
      stageLabel: "待启动",
      acceptanceCriteria: "给出第一轮清晰分工或阶段计划。",
      queuedStatus: null,
      dependsOnTaskIds: [],
      inputArtifactIds: input.initialArtifactIds ?? [],
      blockedByTaskId: null,
      blockedReason: null,
      lockScopePaths: [],
      lockStatus: "none",
      lockBlockedByTaskId: null,
      resultSummary: null,
      artifactIds: input.initialArtifactIds ?? [],
      createdAt: input.createdAt,
      updatedAt: input.createdAt,
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
    } satisfies ProjectTaskRecord,
  ];
}

function sortProjectTasks(left: ProjectTaskRecord, right: ProjectTaskRecord) {
  const leftTerminal = isProjectTaskTerminal(left.status);
  const rightTerminal = isProjectTaskTerminal(right.status);

  if (leftTerminal !== rightTerminal) {
    return leftTerminal ? 1 : -1;
  }

  const priorityDelta = resolveProjectTaskPriority(left.status) - resolveProjectTaskPriority(right.status);

  if (priorityDelta !== 0) {
    return priorityDelta;
  }

  const rightUpdatedAt = Date.parse(right.updatedAt);
  const leftUpdatedAt = Date.parse(left.updatedAt);

  if (Number.isFinite(rightUpdatedAt) && Number.isFinite(leftUpdatedAt) && rightUpdatedAt !== leftUpdatedAt) {
    return rightUpdatedAt - leftUpdatedAt;
  }

  return right.id.localeCompare(left.id, "en");
}

function sortProjectReviews(left: ProjectReviewRecord, right: ProjectReviewRecord) {
  const leftPending = left.status === "pending";
  const rightPending = right.status === "pending";

  if (leftPending !== rightPending) {
    return leftPending ? -1 : 1;
  }

  const rightUpdatedAt = Date.parse(right.updatedAt);
  const leftUpdatedAt = Date.parse(left.updatedAt);

  if (Number.isFinite(rightUpdatedAt) && Number.isFinite(leftUpdatedAt) && rightUpdatedAt !== leftUpdatedAt) {
    return rightUpdatedAt - leftUpdatedAt;
  }

  return right.id.localeCompare(left.id, "en");
}

function isProjectTaskTerminal(status: ProjectTaskRecord["status"]) {
  return status === "completed" || status === "cancelled";
}

function resolveProjectTaskPriority(status: ProjectTaskRecord["status"]) {
  switch (status) {
    case "in_progress":
      return 0;
    case "claimed":
      return 1;
    case "ready":
    case "reopened":
      return 2;
    case "in_review":
      return 3;
    case "waiting_input":
      return 4;
    case "blocked":
      return 5;
    case "completed":
      return 6;
    case "cancelled":
      return 7;
    default:
      return 8;
  }
}

function updateProjectTask(
  state: ProjectStoreState,
  taskId: string,
  patch: Partial<ProjectTaskRecord>,
) {
  state.tasks = state.tasks.map((task) =>
    task.id === taskId
      ? {
          ...task,
          ...patch,
        }
      : task,
  );
}

function isRestorableProjectTaskStatus(
  status: ProjectTaskRecord["status"] | null | undefined,
): status is "ready" | "claimed" | "reopened" {
  return status === "ready" || status === "claimed" || status === "reopened";
}

function findNextOutstandingDependencyId(state: ProjectStoreState, dependencyIds: string[]) {
  return (
    dependencyIds.find((dependencyId) => {
      const dependencyTask = state.tasks.find((task) => task.id === dependencyId) ?? null;
      return !dependencyTask || dependencyTask.status !== "completed";
    }) ?? null
  );
}

function findNextOutstandingInputArtifactId(
  state: ProjectStoreState,
  artifactIds: string[],
) {
  return (
    artifactIds.find((artifactId) => {
      const artifact = state.artifacts.find((item) => item.id === artifactId) ?? null;
      return !artifact || artifact.status !== "ready";
    }) ?? null
  );
}

function buildTaskArtifactBlockedReason(
  state: ProjectStoreState,
  artifactId: string | null,
) {
  if (!artifactId) {
    return "等待输入交付物就绪后继续。";
  }

  const artifact = state.artifacts.find((item) => item.id === artifactId) ?? null;

  if (!artifact) {
    return "等待上游交付物同步后继续。";
  }

  return `等待交付物“${compactConversationExcerpt(artifact.title, 32)}”准备好后继续。`;
}

function getProjectWorkspaceDir(state: ProjectStoreState, projectId: string) {
  return state.rooms.find((room) => room.id === projectId)?.workspaceDir?.trim() || null;
}

function extractTaskLockScopePaths(
  state: ProjectStoreState,
  input: {
    projectId: string;
    title: string;
    description: string;
    existingLockScopePaths?: string[];
  },
) {
  if (input.existingLockScopePaths && input.existingLockScopePaths.length > 0) {
    return Array.from(new Set(input.existingLockScopePaths.map((item) => item.trim()).filter(Boolean)));
  }

  const workspaceDir = getProjectWorkspaceDir(state, input.projectId);
  const source = `${input.title}\n${input.description}`;
  const candidates = new Set<string>();

  for (const match of source.matchAll(/`([^`\n]+)`/g)) {
    const value = match[1]?.trim();
    if (looksLikeTaskLockPath(value)) {
      candidates.add(value);
    }
  }

  for (const match of source.matchAll(/(?:\/Users\/[^\s，。；、"'`()]+|\/[A-Za-z0-9._~/-]+)/g)) {
    const value = match[0]?.trim();
    if (looksLikeTaskLockPath(value)) {
      candidates.add(value);
    }
  }

  for (const match of source.matchAll(/\b(?:app|components|lib|src|pages|styles|docs|public|tests|skills|scripts|hooks|features)\/[A-Za-z0-9._/-]+\b/g)) {
    const value = match[0]?.trim();
    if (looksLikeTaskLockPath(value)) {
      candidates.add(value);
    }
  }

  return Array.from(candidates)
    .map((item) => normalizeTaskLockPath(item, workspaceDir))
    .filter(Boolean)
    .slice(0, 6) as string[];
}

function looksLikeTaskLockPath(value: string | null | undefined) {
  if (!value) {
    return false;
  }

  return (
    value.startsWith("/") ||
    /^(app|components|lib|src|pages|styles|docs|public|tests|skills|scripts|hooks|features)\//.test(value)
  );
}

function normalizeTaskLockPath(value: string, workspaceDir: string | null) {
  const normalized = value.trim().replace(/[),.;:]+$/g, "");

  if (!normalized) {
    return null;
  }

  if (normalized.startsWith("/")) {
    return path.normalize(normalized);
  }

  if (!workspaceDir) {
    return normalized;
  }

  return path.normalize(path.resolve(workspaceDir, normalized));
}

function taskLockPathsOverlap(left: string[], right: string[]) {
  return left.some((leftPath) =>
    right.some(
      (rightPath) =>
        leftPath === rightPath ||
        leftPath.startsWith(`${rightPath}${path.sep}`) ||
        rightPath.startsWith(`${leftPath}${path.sep}`),
    ),
  );
}

function compactTaskLockPathForDisplay(
  workspaceDir: string | null,
  rawPath: string,
) {
  const normalizedPath = rawPath.replace(/\\/g, "/");
  const normalizedWorkspaceDir = workspaceDir?.replace(/\\/g, "/") ?? null;

  if (normalizedWorkspaceDir && normalizedPath.startsWith(`${normalizedWorkspaceDir}/`)) {
    return normalizedPath.slice(normalizedWorkspaceDir.length + 1);
  }

  return normalizedPath;
}

function buildTaskLockBlockedReason(
  state: ProjectStoreState,
  task: ProjectTaskRecord,
  blockingTaskId: string | null,
) {
  if (!blockingTaskId) {
    return task.blockedReason ?? null;
  }

  const blockingTask = state.tasks.find((item) => item.id === blockingTaskId) ?? null;
  const lockPath = task.lockScopePaths[0] ?? null;
  const workspaceDir = getProjectWorkspaceDir(state, task.projectId);

  if (!blockingTask) {
    return lockPath ? `等待释放文件锁：${lockPath}` : "等待上游成员释放当前路径锁后继续。";
  }

  const label = lockPath ? compactTaskLockPathForDisplay(workspaceDir, lockPath) : "当前工作路径";
  return `等待 ${blockingTask.ownerAgentName || "上游成员"} 释放“${label}”的工作锁后继续。`;
}

function isTaskHoldingLock(status: ProjectTaskRecord["status"]) {
  return (
    status === "claimed" ||
    status === "in_progress" ||
    status === "in_review" ||
    status === "waiting_input"
  );
}

function buildStableMemoryId(
  projectId: string,
  scope: string,
  seed: string,
) {
  const normalized = seed
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48) || "item";

  return `${projectId}-memory-${scope}-${normalized}`;
}

function createProjectMemoryEntry(
  projectId: string,
  input: Omit<ProjectMemoryEntry, "id">,
): ProjectMemoryEntry {
  return {
    id: buildStableMemoryId(projectId, input.sourceKind, `${input.label}-${input.sourceId || input.summary}`),
    ...input,
    summary: compactConversationExcerpt(input.summary, 220),
  };
}

function dedupeProjectMemoryEntries(
  entries: Array<ProjectMemoryEntry | null | undefined>,
  limit = 4,
) {
  const seen = new Set<string>();

  return entries
    .filter(Boolean)
    .filter((entry): entry is ProjectMemoryEntry => Boolean(entry))
    .filter((entry) => {
      const key = `${entry.label}::${entry.summary}`;

      if (seen.has(key)) {
        return false;
      }

      seen.add(key);
      return true;
    })
    .slice(0, limit);
}

function maxUpdatedAt(values: Array<string | null | undefined>, fallback: string) {
  const timestamps = values
    .map((value) => (value ? Date.parse(value) : Number.NaN))
    .filter((value) => Number.isFinite(value));

  if (timestamps.length === 0) {
    return fallback;
  }

  return new Date(Math.max(...timestamps)).toISOString();
}

function upsertProjectMemoryRecord(
  state: ProjectStoreState,
  nextRecord: ProjectMemoryRecord,
) {
  const existing = state.projectMemories.find((item) => item.projectId === nextRecord.projectId) ?? null;

  if (existing) {
    state.projectMemories = state.projectMemories.map((item) =>
      item.projectId === nextRecord.projectId ? nextRecord : item,
    );
    return;
  }

  state.projectMemories = [nextRecord, ...state.projectMemories];
}

function upsertTeamMemoryRecord(
  state: ProjectStoreState,
  nextRecord: ProjectTeamMemoryRecord,
) {
  const existing = state.teamMemories.find((item) => item.projectId === nextRecord.projectId) ?? null;

  if (existing) {
    state.teamMemories = state.teamMemories.map((item) =>
      item.projectId === nextRecord.projectId ? nextRecord : item,
    );
    return;
  }

  state.teamMemories = [nextRecord, ...state.teamMemories];
}

function synchronizeRoleMemoryRecords(
  state: ProjectStoreState,
  projectId: string,
  nextRecords: ProjectRoleMemoryRecord[],
) {
  state.roleMemories = [
    ...nextRecords,
    ...state.roleMemories.filter((item) => item.projectId !== projectId),
  ];
}

function buildTeamMemoryPatterns(
  projectId: string,
  scope: "handoff" | "blocker" | "review",
  items: Array<{
    label: string;
    summary: string;
    updatedAt: string;
  }>,
) {
  const grouped = new Map<string, { label: string; summary: string; updatedAt: string; count: number }>();

  items.forEach((item) => {
    const key = item.label.trim();

    if (!key) {
      return;
    }

    const current = grouped.get(key);

    if (!current) {
      grouped.set(key, {
        label: item.label,
        summary: compactConversationExcerpt(item.summary, 180),
        updatedAt: item.updatedAt,
        count: 1,
      });
      return;
    }

    grouped.set(key, {
      ...current,
      count: current.count + 1,
      updatedAt:
        Date.parse(item.updatedAt) > Date.parse(current.updatedAt) ? item.updatedAt : current.updatedAt,
    });
  });

  return [...grouped.values()]
    .sort((left, right) => {
      if (right.count !== left.count) {
        return right.count - left.count;
      }

      return Date.parse(right.updatedAt) - Date.parse(left.updatedAt);
    })
    .slice(0, 4)
    .map((item) => ({
      id: buildStableMemoryId(projectId, scope, item.label),
      label: item.label,
      summary:
        item.count > 1
          ? `${item.summary} 最近共出现 ${item.count} 次。`
          : item.summary,
      count: item.count,
      updatedAt: item.updatedAt,
    })) satisfies ProjectTeamMemoryPattern[];
}

function buildRoleMemoryStrengths(
  agent: ProjectAgentRecord,
  tasks: ProjectTaskRecord[],
) {
  const completedTasks = tasks.filter(
    (task) => task.ownerAgentId === agent.id && task.status === "completed",
  );
  const stageCounts = new Map<string, number>();

  completedTasks.forEach((task) => {
    const label = task.stageLabel || inferRuntimeStageLabel(agent, task.title);
    stageCounts.set(label, (stageCounts.get(label) ?? 0) + 1);
  });

  const stageStrengths = [...stageCounts.entries()]
    .sort((left, right) => right[1] - left[1])
    .slice(0, 2)
    .map(([label]) => `擅长 ${label} 阶段任务`);

  if (stageStrengths.length > 0) {
    return stageStrengths;
  }

  if (agent.canDelegate) {
    return ["擅长收束上下文、判断接力顺序和整理阶段结论"];
  }

  if (agent.visibility === "frontstage") {
    return ["擅长整理对外表达、汇报结构和总结性输出"];
  }

  return ["擅长先做结构化判断，再把关键风险和下一步说清楚"];
}

function buildRoleMemoryIssues(
  agent: ProjectAgentRecord,
  tasks: ProjectTaskRecord[],
  reviews: ProjectReviewRecord[],
  stuckSignals: ProjectStuckSignalRecord[],
) {
  const issues = [
    ...tasks
      .filter(
        (task) =>
          task.ownerAgentId === agent.id &&
          (task.ownerReplacementCount > 0 || task.recoveryAttemptCount > 0 || task.status === "cancelled"),
      )
      .map((task) => `“${compactConversationExcerpt(task.title, 36)}”这类任务更容易出现恢复或返工。`),
    ...reviews
      .filter((review) => review.requesterAgentId === agent.id && review.status === "changes_requested")
      .map((review) => review.blockingComments || `“${review.reviewTargetLabel}”曾出现复核退回。`),
    ...stuckSignals
      .filter((signal) => signal.agentId === agent.id)
      .map((signal) => `${formatProjectStuckSignalKindForMemory(signal.kind)} 在这位成员身上出现过。`),
  ];

  return [...new Set(issues.filter(Boolean).map((item) => compactConversationExcerpt(item, 120)))].slice(0, 3);
}

function buildRoleMemoryPreferredInputFormat(
  agent: ProjectAgentRecord,
  tasks: ProjectTaskRecord[],
  artifactsById: Map<string, ProjectArtifactRecord>,
) {
  const linkedInputTitles = tasks
    .filter((task) => task.ownerAgentId === agent.id)
    .flatMap((task) => task.inputArtifactIds)
    .map((artifactId) => artifactsById.get(artifactId)?.title ?? null)
    .filter(Boolean) as string[];
  const artifactHint = linkedInputTitles.length > 0
    ? `最好显式挂上输入交付物，例如：${[...new Set(linkedInputTitles)].slice(0, 2).join("、")}`
    : null;

  const baseHint = agent.canDelegate
    ? "适合接收目标、最近群聊摘要、当前卡点和可复用交付物清单"
    : agent.visibility === "frontstage"
      ? "适合接收上游要点、目标受众和明确的输出格式要求"
      : "适合接收结构化目标、输入交付物和清楚的验收标准";

  return [baseHint, artifactHint].filter(Boolean) as string[];
}

function formatRecoveryActionKindForMemory(kind: ProjectRecoveryActionRecord["kind"]) {
  switch (kind) {
    case "retry_same_owner":
      return "原 owner 重试";
    case "reassign_to_peer":
      return "替补接力";
    case "rollback_to_checkpoint":
      return "从 checkpoint 重跑";
    default:
      return "PM 接管";
  }
}

function formatProjectStuckSignalKindForMemory(kind: ProjectStuckSignalKind) {
  switch (kind) {
    case "lease_expired":
      return "租约过期";
    case "runtime_missing":
      return "缺少 runtime 会话";
    default:
      return "回传超时";
  }
}

function dedupeInsightLines(
  values: Array<string | null | undefined>,
  limit = 3,
) {
  const seen = new Set<string>();

  return values
    .map((value) => value?.trim())
    .filter(Boolean)
    .map((value) => compactConversationExcerpt(value as string, 160))
    .filter((value) => {
      if (seen.has(value)) {
        return false;
      }

      seen.add(value);
      return true;
    })
    .slice(0, limit);
}

function buildTaskReflectionOutcome(
  task: ProjectTaskRecord,
  latestReview: ProjectReviewRecord | null,
): ProjectTaskReflectionRecord["outcome"] {
  if (task.status === "cancelled") {
    return "blocked";
  }

  if (task.ownerReplacementCount > 0 || task.recoveryAttemptCount > 0) {
    return "recovered";
  }

  if (latestReview?.status === "changes_requested") {
    return "needs_follow_up";
  }

  return "smooth";
}

function buildTaskReflectionSummary(
  task: ProjectTaskRecord,
  latestReview: ProjectReviewRecord | null,
) {
  if (task.status === "cancelled") {
    return task.resultSummary || task.blockedReason || "这条任务在推进过程中被取消，没有顺利形成稳定结果。";
  }

  if (latestReview?.status === "changes_requested") {
    return latestReview.blockingComments || "这条任务已经交回，但仍需要继续补充或返工。";
  }

  if (task.ownerReplacementCount > 0 || task.recoveryAttemptCount > 0) {
    return task.resultSummary || "这条任务经过恢复或改派后最终形成了可继续推进的结果。";
  }

  return task.resultSummary || "这条任务已经顺利交回，并进入下一步。";
}

function isTimestampInRange(
  timestamp: string | null | undefined,
  startAt: string,
  endAt: string | null,
) {
  if (!timestamp) {
    return false;
  }

  const target = Date.parse(timestamp);
  const start = Date.parse(startAt);
  const end = endAt ? Date.parse(endAt) : Number.NaN;

  if (!Number.isFinite(target) || !Number.isFinite(start)) {
    return false;
  }

  if (!Number.isFinite(end)) {
    return target >= start;
  }

  return target >= start && target < end;
}

function upsertTaskReflectionRecords(
  state: ProjectStoreState,
  projectId: string,
  reflections: ProjectTaskReflectionRecord[],
) {
  state.taskReflections = [
    ...reflections,
    ...state.taskReflections.filter((item) => item.projectId !== projectId),
  ];
}

function upsertStageReflectionRecords(
  state: ProjectStoreState,
  projectId: string,
  reflections: ProjectStageReflectionRecord[],
) {
  state.stageReflections = [
    ...reflections,
    ...state.stageReflections.filter((item) => item.projectId !== projectId),
  ];
}

function upsertRunSummaryRecords(
  state: ProjectStoreState,
  projectId: string,
  summaries: ProjectRunSummaryRecord[],
) {
  state.runSummaries = [
    ...summaries,
    ...state.runSummaries.filter((item) => item.projectId !== projectId),
  ];
}

function buildLearningEvidenceSource(input: {
  projectId: string;
  kind: ProjectLearningEvidenceSourceKind;
  seed: string;
  label: string;
  summary: string;
  updatedAt: string;
  relatedId?: string | null;
  relatedTaskId?: string | null;
}): ProjectLearningEvidenceSource {
  return {
    id: buildStableMemoryId(input.projectId, "learning-evidence", `${input.kind}-${input.seed}`),
    kind: input.kind,
    label: input.label,
    summary: compactConversationExcerpt(input.summary, 180),
    relatedId: input.relatedId ?? null,
    relatedTaskId: input.relatedTaskId ?? null,
    updatedAt: input.updatedAt,
  };
}

function dedupeLearningEvidenceSources(
  sources: Array<ProjectLearningEvidenceSource | null | undefined>,
  limit = 4,
) {
  const seen = new Set<string>();

  return sources
    .filter(Boolean)
    .filter((source): source is ProjectLearningEvidenceSource => Boolean(source))
    .filter((source) => {
      const key = `${source.kind}::${source.label}::${source.relatedId ?? source.summary}`;

      if (seen.has(key)) {
        return false;
      }

      seen.add(key);
      return true;
    })
    .sort((left, right) => Date.parse(right.updatedAt) - Date.parse(left.updatedAt))
    .slice(0, limit);
}

function buildLearningSuggestionWriteback(input: {
  kind: ProjectLearningSuggestionRecord["kind"];
  targetLabel: string | null;
}) {
  switch (input.kind) {
    case "failure_pattern":
      return {
        summary: "采纳后会回写到默认任务拆解提示与恢复策略判断，避免同类卡点再次等到 run 中途才暴露。",
        targets: ["默认任务拆解提示", "恢复路径判断"],
      };
    case "task_template":
      return {
        summary: "采纳后会回写到默认任务模板，把输入交付物、关键依赖和验收标准变成固定字段。",
        targets: ["任务模板", "输入交付物字段", "验收标准字段"],
      };
    case "role_tuning":
      return {
        summary: `采纳后会回写到默认派工判断${input.targetLabel ? `，优先在适合 ${input.targetLabel} 的场景里调用这类长板` : ""}。`,
        targets: ["默认派工判断", "任务描述避坑提醒"],
      };
    case "quality_gate":
      return {
        summary: "采纳后会回写到默认质量闸门，交回前会补一轮风险、依赖、边界和交付格式自查。",
        targets: ["质量闸门", "交回前自查清单"],
      };
    case "skill_upgrade":
      return {
        summary: "采纳后会回写到团队阶段交接 / 验收框架候选，后续还能继续升级为跨项目交接清单。",
        targets: ["阶段交接框架", "验收清单候选"],
      };
    default:
      return {
        summary: "采纳后会回写到 agent profile 更新候选，把长板、偏好输入和常见坑点沉淀到默认资料里。",
        targets: ["Agent Profile 候选", "偏好输入说明"],
      };
  }
}

function compressLearningSuggestionRecords(
  suggestions: ProjectLearningSuggestionRecord[],
) {
  const mergedBySignature = new Map<string, ProjectLearningSuggestionRecord>();

  suggestions.forEach((suggestion) => {
    const signature = `${suggestion.kind}::${suggestion.targetLabel || suggestion.title}`;
    const existing = mergedBySignature.get(signature) ?? null;

    if (!existing) {
      mergedBySignature.set(signature, {
        ...suggestion,
        evidenceLabels: dedupeInsightLines(suggestion.evidenceLabels),
        evidenceSources: dedupeLearningEvidenceSources(suggestion.evidenceSources),
        actionItems: dedupeInsightLines(suggestion.actionItems),
        writebackTargets: dedupeInsightLines(suggestion.writebackTargets),
      });
      return;
    }

    mergedBySignature.set(signature, {
      ...existing,
      summary:
        existing.summary.length >= suggestion.summary.length ? existing.summary : suggestion.summary,
      evidenceLabels: dedupeInsightLines([...existing.evidenceLabels, ...suggestion.evidenceLabels]).slice(0, 4),
      evidenceSources: dedupeLearningEvidenceSources([
        ...existing.evidenceSources,
        ...suggestion.evidenceSources,
      ]),
      actionItems: dedupeInsightLines([...existing.actionItems, ...suggestion.actionItems]).slice(0, 4),
      writebackTargets: dedupeInsightLines([
        ...existing.writebackTargets,
        ...suggestion.writebackTargets,
      ]).slice(0, 4),
      updatedAt: maxUpdatedAt([existing.updatedAt, suggestion.updatedAt], suggestion.updatedAt),
    });
  });

  return [...mergedBySignature.values()];
}

function upsertLearningSuggestionRecords(
  state: ProjectStoreState,
  projectId: string,
  suggestions: ProjectLearningSuggestionRecord[],
) {
  const existingById = new Map(
    state.learningSuggestions
      .filter((item) => item.projectId === projectId)
      .map((item) => [item.id, item] as const),
  );

  state.learningSuggestions = [
    ...suggestions.map((suggestion) => {
      const existing = existingById.get(suggestion.id);

      if (!existing) {
        return suggestion;
      }

      return {
        ...suggestion,
        status: existing.status,
        reviewThreadId: existing.reviewThreadId,
        reviewNote: existing.reviewNote,
        reviewedAt: existing.reviewedAt,
        updatedAt: maxUpdatedAt([existing.updatedAt, suggestion.updatedAt], suggestion.updatedAt),
      };
    }),
    ...state.learningSuggestions.filter((item) => item.projectId !== projectId),
  ];
}

function upsertLearningReuseCandidateRecords(
  state: ProjectStoreState,
  projectId: string,
  candidates: ProjectLearningReuseCandidateRecord[],
) {
  const existingById = new Map(
    state.learningReuseCandidates
      .filter((item) => item.sourceProjectId === projectId)
      .map((item) => [item.id, item] as const),
  );

  state.learningReuseCandidates = [
    ...candidates.map((candidate) => {
      const existing = existingById.get(candidate.id);

      if (!existing) {
        return candidate;
      }

      return {
        ...candidate,
        status: existing.status,
        reviewNote: existing.reviewNote,
        reviewedAt: existing.reviewedAt,
        updatedAt: maxUpdatedAt([existing.updatedAt, candidate.updatedAt], candidate.updatedAt),
      };
    }),
    ...state.learningReuseCandidates.filter((item) => item.sourceProjectId !== projectId),
  ];
}

function buildLearningSuggestionReviewSummary(
  suggestion: ProjectLearningSuggestionRecord,
  managerName: string,
) {
  const target = suggestion.targetLabel ? `目标对象：${suggestion.targetLabel}。` : "";
  const actions =
    suggestion.actionItems.length > 0
      ? `建议动作：${suggestion.actionItems.join("；")}。`
      : "建议动作：当前先按这条 suggestion 的摘要作为升级方向。";

  return `${managerName} 提交了一条需要人工确认的学习建议“${suggestion.title}”。${target}${actions} 你可以选择采纳，让它进入后续默认策略；也可以忽略，避免系统过早改变团队配置。`;
}

function formatLearningReuseCandidateLabel(kind: ProjectLearningReuseCandidateKind) {
  switch (kind) {
    case "task_template_candidate":
      return "任务模板候选";
    case "quality_gate_candidate":
      return "质量闸门候选";
    default:
      return "交接 / 复核清单候选";
  }
}

function getLearningReuseCandidateKind(
  suggestion: ProjectLearningSuggestionRecord,
): ProjectLearningReuseCandidateKind | null {
  if (suggestion.kind === "task_template") {
    return "task_template_candidate";
  }

  if (suggestion.kind === "quality_gate") {
    return "quality_gate_candidate";
  }

  if (suggestion.kind === "skill_upgrade") {
    return "handoff_review_checklist_candidate";
  }

  return null;
}

function buildLearningReuseCandidateSummary(
  suggestion: ProjectLearningSuggestionRecord,
  kind: ProjectLearningReuseCandidateKind,
) {
  switch (kind) {
    case "task_template_candidate":
      return "这条建议已经在源项目里被验证并采纳，可以作为后续项目的任务模板候选，优先复用输入交付物、关键依赖和验收标准这些固定字段。";
    case "quality_gate_candidate":
      return "这条建议已经在源项目里被验证并采纳，可以作为后续项目的质量闸门候选，重点保留交回前的风险、依赖、边界和交付格式自查。";
    default:
      return `这条建议已经在源项目里被验证并采纳，可以作为后续项目的交接 / 复核清单候选。${suggestion.writebackSummary || ""}`.trim();
  }
}

function buildLearningReuseCandidateTitle(
  suggestion: ProjectLearningSuggestionRecord,
  kind: ProjectLearningReuseCandidateKind,
) {
  const compactTitle = suggestion.title.includes("·")
    ? suggestion.title.split("·").slice(1).join("·").trim()
    : suggestion.title;

  return `${formatLearningReuseCandidateLabel(kind)} · ${compactTitle}`;
}

function compressLearningReuseCandidates(
  candidates: ProjectLearningReuseCandidateRecord[],
) {
  const mergedBySignature = new Map<string, ProjectLearningReuseCandidateRecord>();

  candidates.forEach((candidate) => {
    const signature = `${candidate.kind}::${candidate.sourceSuggestionId}`;
    const existing = mergedBySignature.get(signature) ?? null;

    if (!existing) {
      mergedBySignature.set(signature, candidate);
      return;
    }

    mergedBySignature.set(signature, {
      ...existing,
      evidenceLabels: dedupeInsightLines([...existing.evidenceLabels, ...candidate.evidenceLabels]).slice(0, 4),
      evidenceSources: dedupeLearningEvidenceSources([
        ...existing.evidenceSources,
        ...candidate.evidenceSources,
      ]),
      updatedAt: maxUpdatedAt([existing.updatedAt, candidate.updatedAt], candidate.updatedAt),
    });
  });

  return [...mergedBySignature.values()];
}

function synchronizeProjectLearningSuggestionReviews(
  state: ProjectStoreState,
  projectId: string,
) {
  const room = state.rooms.find((item) => item.id === projectId) ?? null;

  if (!room) {
    return;
  }

  const manager =
    state.agents.find((agent) => agent.projectId === projectId && agent.agentProfileId === "project-manager") ||
    state.agents.find((agent) => agent.projectId === projectId && agent.canDelegate) ||
    null;
  const managerName = manager?.name ?? "项目经理";

  state.learningSuggestions = state.learningSuggestions.map((suggestion) => {
    if (suggestion.projectId !== projectId) {
      return suggestion;
    }

    if (!suggestion.requiresHumanReview) {
      return suggestion;
    }

    if (suggestion.status === "open") {
      const threadId = upsertProjectMailboxThread(state, {
        projectId,
        kind: "human_review",
        subject: `学习建议待人审 · ${suggestion.title}`,
        summary: buildLearningSuggestionReviewSummary(suggestion, managerName),
        fromAgentId: manager?.id ?? null,
        fromAgentName: managerName,
        toAgentIds: [],
        toAgentNames: ["你"],
        relatedSuggestionId: suggestion.id,
        createdAt: suggestion.updatedAt,
      });

      if (threadId === suggestion.reviewThreadId) {
        return suggestion;
      }

      return {
        ...suggestion,
        reviewThreadId: threadId,
      };
    }

    if (suggestion.reviewThreadId) {
      settleProjectMailboxThreads(state, {
        projectId,
        updatedAt: suggestion.reviewedAt ?? suggestion.updatedAt,
        kind: "human_review",
        relatedSuggestionId: suggestion.id,
      });
    }

    return suggestion;
  });
}

function synchronizeProjectLearningReuseCandidates(
  state: ProjectStoreState,
  projectId: string,
) {
  const room = state.rooms.find((item) => item.id === projectId) ?? null;

  if (!room) {
    return;
  }

  const candidates = compressLearningReuseCandidates(
    state.learningSuggestions
      .filter((suggestion) => suggestion.projectId === projectId && suggestion.status === "accepted")
      .flatMap((suggestion) => {
        const kind = getLearningReuseCandidateKind(suggestion);
        const acceptedAt = suggestion.reviewedAt ?? suggestion.updatedAt;

        if (!kind || Math.max(suggestion.evidenceSources.length, suggestion.evidenceLabels.length) < 2) {
          return [];
        }

        return [{
          id: buildStableMemoryId(projectId, "learning-reuse", `${kind}-${suggestion.id}`),
          sourceProjectId: projectId,
          sourceProjectTitle: room.title,
          sourceSuggestionId: suggestion.id,
          sourceSuggestionTitle: suggestion.title,
          kind,
          status: "pending_review" as const,
          title: buildLearningReuseCandidateTitle(suggestion, kind),
          summary: buildLearningReuseCandidateSummary(suggestion, kind),
          targetLabel: suggestion.targetLabel,
          evidenceLabels: suggestion.evidenceLabels.slice(0, 4),
          evidenceSources: dedupeLearningEvidenceSources(suggestion.evidenceSources),
          acceptedAt,
          reviewNote: null,
          reviewedAt: null,
          updatedAt: acceptedAt,
        } satisfies ProjectLearningReuseCandidateRecord];
      }),
  );

  upsertLearningReuseCandidateRecords(state, projectId, candidates);
}

function synchronizeProjectMemoryLayer(
  state: ProjectStoreState,
  projectId: string,
) {
  const room = state.rooms.find((item) => item.id === projectId) ?? null;

  if (!room) {
    return;
  }

  const projectTasks = state.tasks.filter((task) => task.projectId === projectId);
  const projectReviews = state.reviews.filter((review) => review.projectId === projectId);
  const projectRuns = state.runs.filter((run) => run.projectId === projectId);
  const projectEvents = state.events.filter((event) => event.projectId === projectId);
  const projectRecoveryActions = state.recoveryActions.filter((action) => action.projectId === projectId);
  const projectStuckSignals = state.stuckSignals.filter((signal) => signal.projectId === projectId);
  const projectAgents = state.agents.filter((agent) => agent.projectId === projectId);
  const projectArtifacts = state.artifacts.filter((artifact) => artifact.projectId === projectId);
  const artifactsById = new Map(projectArtifacts.map((artifact) => [artifact.id, artifact] as const));
  const checkpoint = findLatestProjectCheckpoint(state, projectId);
  const latestDirectionEvent =
    projectEvents
      .filter((event) =>
        [
          "已要求团队补充或改方向",
          "已提交补充并继续推进",
          "已要求从最近 checkpoint 重跑",
        ].includes(event.title),
      )
      .sort((left, right) => Date.parse(right.createdAt) - Date.parse(left.createdAt))[0] ?? null;
  const latestCompletedRun =
    projectRuns
      .filter((run) => Boolean(run.finishedAt))
      .sort((left, right) =>
        Date.parse(right.finishedAt || right.startedAt) - Date.parse(left.finishedAt || left.startedAt),
      )[0] ?? null;

  const decisions = dedupeProjectMemoryEntries([
    createProjectMemoryEntry(projectId, {
      label: "团队目标",
      summary: room.goal,
      sourceKind: "goal",
      sourceId: null,
      updatedAt: room.createdAt,
    }),
    checkpoint.summary
      ? createProjectMemoryEntry(projectId, {
          label: checkpoint.label === "阶段总结" ? "最近 checkpoint" : "当前阶段判断",
          summary: checkpoint.summary,
          sourceKind: "checkpoint",
          sourceId: checkpoint.artifact?.id ?? checkpoint.task?.id ?? null,
          updatedAt: checkpoint.artifact?.updatedAt ?? checkpoint.task?.updatedAt ?? room.createdAt,
        })
      : null,
    latestCompletedRun
      ? createProjectMemoryEntry(projectId, {
          label: "最近已完成 run",
          summary: latestCompletedRun.summary,
          sourceKind: "checkpoint",
          sourceId: latestCompletedRun.id,
          updatedAt: latestCompletedRun.finishedAt ?? latestCompletedRun.startedAt,
        })
      : null,
  ]);
  const preferences = dedupeProjectMemoryEntries([
    latestDirectionEvent
      ? createProjectMemoryEntry(projectId, {
          label: "最近用户偏好 / 补充",
          summary: latestDirectionEvent.description,
          sourceKind: "user_note",
          sourceId: latestDirectionEvent.id,
          updatedAt: latestDirectionEvent.createdAt,
        })
      : null,
    room.workspaceDir
      ? createProjectMemoryEntry(projectId, {
          label: "默认工作空间",
          summary: `默认产出目录：${room.workspaceDir}`,
          sourceKind: "task",
          sourceId: null,
          updatedAt: room.createdAt,
        })
      : null,
  ]);
  const risks = dedupeProjectMemoryEntries([
    ...projectStuckSignals
      .sort((left, right) => Date.parse(right.updatedAt) - Date.parse(left.updatedAt))
      .slice(0, 3)
      .map((signal) =>
        createProjectMemoryEntry(projectId, {
          label: `${formatProjectStuckSignalKindForMemory(signal.kind)}风险`,
          summary: signal.summary,
          sourceKind: "recovery",
          sourceId: signal.id,
          updatedAt: signal.updatedAt,
        }),
      ),
    ...projectReviews
      .filter((review) => Boolean(review.blockingComments))
      .sort((left, right) => Date.parse(right.updatedAt) - Date.parse(left.updatedAt))
      .slice(0, 2)
      .map((review) =>
        createProjectMemoryEntry(projectId, {
          label: `复核风险 · ${review.reviewTargetLabel}`,
          summary: review.blockingComments || review.summary,
          sourceKind: "review",
          sourceId: review.id,
          updatedAt: review.updatedAt,
        }),
      ),
  ]);
  const pitfalls = dedupeProjectMemoryEntries([
    ...projectRecoveryActions
      .filter((action) => action.kind !== "rollback_to_checkpoint")
      .sort((left, right) => Date.parse(right.createdAt) - Date.parse(left.createdAt))
      .slice(0, 3)
      .map((action) =>
        createProjectMemoryEntry(projectId, {
          label: `恢复动作 · ${formatRecoveryActionKindForMemory(action.kind)}`,
          summary: action.summary,
          sourceKind: "recovery",
          sourceId: action.id,
          updatedAt: action.createdAt,
        }),
      ),
    ...projectTasks
      .filter((task) => task.ownerReplacementCount > 0 || task.recoveryAttemptCount > 0)
      .sort((left, right) => Date.parse(right.updatedAt) - Date.parse(left.updatedAt))
      .slice(0, 2)
      .map((task) =>
        createProjectMemoryEntry(projectId, {
          label: `易卡住任务 · ${compactConversationExcerpt(task.title, 36)}`,
          summary:
            task.lastReassignmentReason ||
            task.blockedReason ||
            "这条任务曾出现恢复、改派或返工，后续需要更完整的输入和验收标准。",
          sourceKind: "task",
          sourceId: task.id,
          updatedAt: task.updatedAt,
        }),
      ),
  ]);

  upsertProjectMemoryRecord(state, {
    projectId,
    decisions,
    preferences,
    risks,
    pitfalls,
    updatedAt: maxUpdatedAt(
      [
        ...decisions.map((entry) => entry.updatedAt),
        ...preferences.map((entry) => entry.updatedAt),
        ...risks.map((entry) => entry.updatedAt),
        ...pitfalls.map((entry) => entry.updatedAt),
      ],
      room.createdAt,
    ),
  });

  const taskById = new Map(projectTasks.map((task) => [task.id, task] as const));
  const handoffPatterns = buildTeamMemoryPatterns(
    projectId,
    "handoff",
    projectTasks.flatMap((task) =>
      task.dependsOnTaskIds
        .map((dependencyId) => taskById.get(dependencyId) ?? null)
        .filter(Boolean)
        .flatMap((dependencyTask) => {
          if (
            !dependencyTask?.ownerAgentName ||
            !task.ownerAgentName ||
            dependencyTask.ownerAgentName === task.ownerAgentName
          ) {
            return [];
          }

          return [
            {
              label: `${dependencyTask.ownerAgentName} -> ${task.ownerAgentName}`,
              summary: `这组接力常见于 ${task.stageLabel || dependencyTask.stageLabel || "团队推进"}，下游会承接上游结果继续推进。`,
              updatedAt: maxUpdatedAt([dependencyTask.updatedAt, task.updatedAt], room.createdAt),
            },
          ];
        }),
    ),
  );
  const blockerPatterns = buildTeamMemoryPatterns(
    projectId,
    "blocker",
    [
      ...projectStuckSignals.map((signal) => ({
        label: formatProjectStuckSignalKindForMemory(signal.kind),
        summary: signal.summary,
        updatedAt: signal.updatedAt,
      })),
      ...projectTasks
        .filter((task) => task.status === "blocked" && task.blockedReason)
        .map((task) => ({
          label: compactConversationExcerpt(task.blockedReason || "阻塞", 42),
          summary: task.blockedReason || "这条任务出现过阻塞。",
          updatedAt: task.updatedAt,
        })),
    ],
  );
  const reviewPatterns = buildTeamMemoryPatterns(
    projectId,
    "review",
    projectReviews
      .filter((review) => review.status !== "approved")
      .map((review) => ({
        label: review.reviewTargetLabel,
        summary: review.blockingComments || review.summary,
        updatedAt: review.updatedAt,
      })),
  );

  upsertTeamMemoryRecord(state, {
    projectId,
    handoffPatterns,
    blockerPatterns,
    reviewPatterns,
    updatedAt: maxUpdatedAt(
      [
        ...handoffPatterns.map((item) => item.updatedAt),
        ...blockerPatterns.map((item) => item.updatedAt),
        ...reviewPatterns.map((item) => item.updatedAt),
      ],
      room.createdAt,
    ),
  });

  synchronizeRoleMemoryRecords(
    state,
    projectId,
    projectAgents.map((agent) => {
      const strengths = buildRoleMemoryStrengths(agent, projectTasks);
      const commonIssues = buildRoleMemoryIssues(agent, projectTasks, projectReviews, projectStuckSignals);
      const preferredInputFormat = buildRoleMemoryPreferredInputFormat(agent, projectTasks, artifactsById);

      return {
        projectId,
        agentId: agent.id,
        agentName: agent.name,
        strengths,
        commonIssues,
        preferredInputFormat,
        updatedAt: maxUpdatedAt(
          [
            ...projectTasks.filter((task) => task.ownerAgentId === agent.id).map((task) => task.updatedAt),
            ...projectReviews.filter((review) => review.requesterAgentId === agent.id).map((review) => review.updatedAt),
            ...projectStuckSignals.filter((signal) => signal.agentId === agent.id).map((signal) => signal.updatedAt),
          ],
          room.createdAt,
        ),
      } satisfies ProjectRoleMemoryRecord;
    }),
  );
}

function synchronizeProjectLearningLoop(
  state: ProjectStoreState,
  projectId: string,
) {
  const room = state.rooms.find((item) => item.id === projectId) ?? null;

  if (!room) {
    return;
  }

  const projectTasks = state.tasks.filter((task) => task.projectId === projectId);
  const projectReviews = state.reviews.filter((review) => review.projectId === projectId);
  const projectArtifacts = state.artifacts.filter((artifact) => artifact.projectId === projectId);
  const projectRuns = state.runs.filter((run) => run.projectId === projectId);
  const projectRecoveryActions = state.recoveryActions.filter((action) => action.projectId === projectId);
  const projectMemory = state.projectMemories.find((item) => item.projectId === projectId) ?? null;
  const teamMemory = state.teamMemories.find((item) => item.projectId === projectId) ?? null;
  const roleMemories = state.roleMemories.filter((item) => item.projectId === projectId);
  const taskById = new Map(projectTasks.map((task) => [task.id, task] as const));

  const latestReviewByTaskId = new Map<string, ProjectReviewRecord>();
  projectReviews.forEach((review) => {
    const current = latestReviewByTaskId.get(review.taskId) ?? null;
    if (!current || Date.parse(review.updatedAt) > Date.parse(current.updatedAt)) {
      latestReviewByTaskId.set(review.taskId, review);
    }
  });

  const taskReflections = projectTasks
    .filter(
      (task) =>
        task.status === "completed" ||
        task.status === "cancelled" ||
        task.status === "in_review",
    )
    .sort((left, right) => Date.parse(right.updatedAt) - Date.parse(left.updatedAt))
    .slice(0, 16)
    .map((task) => {
      const latestReview = latestReviewByTaskId.get(task.id) ?? null;
      const outcome = buildTaskReflectionOutcome(task, latestReview);
      const wins = dedupeInsightLines([
        task.status === "completed" ? "这条任务已经形成阶段结果并交回。" : null,
        task.artifactIds.length > 0 ? `形成 ${task.artifactIds.length} 项可复用交付物。` : null,
        task.inputArtifactIds.length > 0 ? `显式复用了 ${task.inputArtifactIds.length} 项输入交付物。` : null,
        latestReview?.status === "approved" ? "结果已通过复核。" : null,
        outcome === "recovered" ? "虽然中途卡住，但最终仍形成了可继续推进的结果。" : null,
      ]);
      const issues = dedupeInsightLines([
        latestReview?.status === "changes_requested" ? latestReview.blockingComments || latestReview.summary : null,
        task.blockedReason,
        task.ownerReplacementCount > 0 ? `期间发生 ${task.ownerReplacementCount} 次 owner 改派。` : null,
        task.recoveryAttemptCount > 0 ? `期间触发 ${task.recoveryAttemptCount} 次恢复尝试。` : null,
      ]);
      const advice = dedupeInsightLines([
        latestReview?.status === "changes_requested"
          ? "下次交回前先按 quality gate 自查风险、依赖和验收标准。"
          : null,
        (task.ownerReplacementCount > 0 || task.recoveryAttemptCount > 0)
          ? "为这类任务提前准备替补 owner，或者把任务拆得更窄一些。"
          : null,
        !task.inputArtifactIds.length && /(依赖|输入|风险|依据|验收)/.test(`${latestReview?.blockingComments || ""}${task.blockedReason || ""}`)
          ? "把输入交付物、关键依赖和验收标准显式写进任务模板。"
          : null,
        issues.length === 0 ? "当前这类任务的拆解和交接方式可以继续复用。" : null,
      ]);

      return {
        id: buildStableMemoryId(projectId, "task-reflection", task.id),
        projectId,
        taskId: task.id,
        taskTitle: task.title,
        ownerAgentId: task.ownerAgentId,
        ownerAgentName: task.ownerAgentName,
        outcome,
        summary: buildTaskReflectionSummary(task, latestReview),
        wins,
        issues,
        advice,
        createdAt: task.completedAt ?? task.updatedAt,
        updatedAt: task.updatedAt,
      } satisfies ProjectTaskReflectionRecord;
    });

  upsertTaskReflectionRecords(state, projectId, taskReflections);

  const stageLabels = Array.from(
    new Set(
      projectTasks
        .map((task) => task.stageLabel || inferRuntimeStageLabel(null, task.title))
        .filter(Boolean),
    ),
  );
  const stageReflections = stageLabels
    .map((stageLabel) => {
      const stageTasks = projectTasks.filter(
        (task) => (task.stageLabel || inferRuntimeStageLabel(null, task.title)) === stageLabel,
      );
      const stageReviews = projectReviews.filter((review) => {
        const task = taskById.get(review.taskId) ?? null;
        return task && (task.stageLabel || inferRuntimeStageLabel(null, task.title)) === stageLabel;
      });
      const stageRecoveries = projectRecoveryActions.filter((action) => {
        const task = action.taskId ? taskById.get(action.taskId) ?? null : null;
        return task && (task.stageLabel || inferRuntimeStageLabel(null, task.title)) === stageLabel;
      });
      const stageArtifacts = stageTasks.flatMap((task) => task.artifactIds);
      const completedCount = stageTasks.filter((task) => task.status === "completed").length;
      const blockedCount = stageTasks.filter((task) => task.status === "blocked" || task.status === "cancelled").length;
      const pendingReviewCount = stageReviews.filter((review) => review.status === "pending").length;
      const changedReviewCount = stageReviews.filter((review) => review.status === "changes_requested").length;
      const updatedAt = maxUpdatedAt(stageTasks.map((task) => task.updatedAt), room.updatedAt);
      const highlights = dedupeInsightLines([
        completedCount > 0 ? `累计完成 ${completedCount} 条 ${stageLabel} 任务。` : null,
        stageArtifacts.length > 0 ? `这一阶段沉淀了 ${stageArtifacts.length} 项交付物。` : null,
        pendingReviewCount === 0 && changedReviewCount === 0 && completedCount > 0 ? "这一阶段当前没有额外 review 阻力。" : null,
      ]);
      const frictions = dedupeInsightLines([
        blockedCount > 0 ? `这一阶段仍有 ${blockedCount} 条任务被阻塞或取消。` : null,
        changedReviewCount > 0 ? `这一阶段出现 ${changedReviewCount} 次 changes requested。` : null,
        pendingReviewCount > 0 ? `这一阶段还有 ${pendingReviewCount} 条结果等待复核。` : null,
        stageRecoveries.length > 0 ? `这一阶段已经触发 ${stageRecoveries.length} 次恢复动作。` : null,
      ]);
      const recommendations = dedupeInsightLines([
        blockedCount > 0 ? "把上游输入、依赖关系和交付物显式挂进任务图，减少阶段内阻塞。" : null,
        changedReviewCount > 0 ? "在这一阶段交回前补一层 review checklist，先自查风险、边界和依赖。" : null,
        stageRecoveries.length > 0 ? "为这一阶段保留更清楚的替补路径，避免卡住后只能临时改派。" : null,
        frictions.length === 0 && completedCount > 0 ? "这一阶段当前节奏稳定，可以把现有拆解方式继续沉淀成默认模板。" : null,
      ]);

      return {
        id: buildStableMemoryId(projectId, "stage-reflection", stageLabel),
        projectId,
        stageLabel,
        summary: `${stageLabel} 阶段累计 ${stageTasks.length} 条任务，完成 ${completedCount} 条，当前待复核 ${pendingReviewCount} 条。`,
        highlights,
        frictions,
        recommendations,
        updatedAt,
      } satisfies ProjectStageReflectionRecord;
    })
    .sort((left, right) => Date.parse(right.updatedAt) - Date.parse(left.updatedAt))
    .slice(0, 8);

  upsertStageReflectionRecords(state, projectId, stageReflections);

  const runsAscending = [...projectRuns].sort((left, right) => Date.parse(left.startedAt) - Date.parse(right.startedAt));
  const runSummaries = runsAscending
    .map((run, index) => {
      const nextRun = runsAscending[index + 1] ?? null;
      const windowEnd = nextRun?.startedAt ?? run.finishedAt ?? room.updatedAt;
      const tasksInWindow = projectTasks.filter((task) =>
        isTimestampInRange(task.updatedAt, run.startedAt, windowEnd),
      );
      const reviewsInWindow = projectReviews.filter((review) =>
        isTimestampInRange(review.updatedAt, run.startedAt, windowEnd),
      );
      const artifactsInWindow = projectArtifacts.filter((artifact) =>
        isTimestampInRange(artifact.updatedAt, run.startedAt, windowEnd),
      );
      const recoveriesInWindow = projectRecoveryActions.filter((action) =>
        isTimestampInRange(action.createdAt, run.startedAt, windowEnd),
      );
      const wins = dedupeInsightLines([
        tasksInWindow.filter((task) => task.status === "completed").length > 0
          ? `本轮完成 ${tasksInWindow.filter((task) => task.status === "completed").length} 条任务。`
          : null,
        artifactsInWindow.filter((artifact) => artifact.status === "ready").length > 0
          ? `本轮沉淀 ${artifactsInWindow.filter((artifact) => artifact.status === "ready").length} 项可用交付物。`
          : null,
        recoveriesInWindow.length === 0 && run.status === "completed"
          ? "本轮整体推进平稳，没有额外恢复动作。"
          : null,
      ]);
      const risks = dedupeInsightLines([
        run.status === "waiting_user" ? "本轮停在 waiting_user checkpoint，仍缺用户补充。" : null,
        run.status === "waiting_approval" ? "本轮停在 waiting_approval checkpoint，仍待最终确认。" : null,
        reviewsInWindow.some((review) => review.status === "changes_requested")
          ? "本轮出现 changes requested，需要补更多风险或依赖说明。"
          : null,
        recoveriesInWindow.length > 0
          ? `${recoveriesInWindow.length} 次恢复动作说明这轮接力仍有不稳定点。`
          : null,
      ]);
      const recommendations = dedupeInsightLines([
        reviewsInWindow.some((review) => review.status === "changes_requested")
          ? "把这轮 review 中反复出现的问题前置为 quality gate。"
          : null,
        recoveriesInWindow.length > 0
          ? "为这类 run 提前准备替补路径和更细的任务拆解。"
          : null,
        run.status === "waiting_user"
          ? "在启动下一轮前先把目标、边界和验收标准说得更明确。"
          : null,
        run.status === "completed" && wins.length > 0
          ? "把这轮有效的接力顺序和任务模板沉淀到默认策略里。"
          : null,
      ]);

      return {
        id: buildStableMemoryId(projectId, "run-summary", run.id),
        projectId,
        runId: run.id,
        title: `Run · ${run.triggerLabel}`,
        outcome: run.status,
        summary: run.summary,
        wins,
        risks,
        recommendations,
        updatedAt: run.finishedAt ?? windowEnd ?? run.startedAt,
      } satisfies ProjectRunSummaryRecord;
    })
    .sort((left, right) => Date.parse(right.updatedAt) - Date.parse(left.updatedAt));

  upsertRunSummaryRecords(state, projectId, runSummaries);

  const topFailurePattern =
    teamMemory?.blockerPatterns[0] ??
    (projectMemory?.risks[0]
      ? {
          label: projectMemory.risks[0].label,
          summary: projectMemory.risks[0].summary,
          updatedAt: projectMemory.risks[0].updatedAt,
        }
      : null);
  const topReviewPattern = teamMemory?.reviewPatterns[0] ?? null;
  const topRoleMemory = roleMemories.find((memory) => memory.strengths.length > 0) ?? roleMemories[0] ?? null;
  const templateEvidenceCount = taskReflections.filter((reflection) =>
    reflection.advice.some((item) => /(输入交付物|验收标准|任务模板|quality gate)/.test(item)),
  ).length;
  const shouldSuggestSkillUpgrade =
    templateEvidenceCount > 0 || Boolean(topReviewPattern) || projectRecoveryActions.length > 0;
  const latestReviewWithBlocking =
    [...projectReviews]
      .filter((review) => review.status === "changes_requested" || Boolean(review.blockingComments))
      .sort((left, right) => Date.parse(right.updatedAt) - Date.parse(left.updatedAt))[0] ?? null;
  const latestRecoveryAction =
    [...projectRecoveryActions].sort((left, right) => Date.parse(right.createdAt) - Date.parse(left.createdAt))[0] ?? null;
  const latestRunSummary = runSummaries[0] ?? null;
  const templateEvidenceReflections = taskReflections
    .filter((reflection) => reflection.advice.some((item) => /(输入交付物|验收标准|任务模板|quality gate)/.test(item)))
    .slice(0, 3);
  const stageChecklistReflection =
    stageReflections.find((reflection) =>
      reflection.recommendations.some((item) => /(review checklist|质量闸门|自查|验收)/i.test(item)),
    ) ??
    stageReflections[0] ??
    null;
  const roleEvidenceReflection =
    topRoleMemory
      ? taskReflections.find((reflection) => reflection.ownerAgentId === topRoleMemory.agentId) ?? null
      : null;
  const failurePatternWriteback = topFailurePattern
    ? buildLearningSuggestionWriteback({
        kind: "failure_pattern",
        targetLabel: topFailurePattern.label,
      })
    : null;
  const taskTemplateWriteback = buildLearningSuggestionWriteback({
    kind: "task_template",
    targetLabel: "任务模板",
  });
  const roleTuningWriteback = topRoleMemory
    ? buildLearningSuggestionWriteback({
        kind: "role_tuning",
        targetLabel: topRoleMemory.agentName,
      })
    : null;
  const qualityGateWriteback = buildLearningSuggestionWriteback({
    kind: "quality_gate",
    targetLabel: "质量闸门",
  });
  const skillUpgradeWriteback = buildLearningSuggestionWriteback({
    kind: "skill_upgrade",
    targetLabel: "Team Skill · 阶段交接与验收框架",
  });
  const agentProfileWriteback = topRoleMemory
    ? buildLearningSuggestionWriteback({
        kind: "agent_profile_update",
        targetLabel: topRoleMemory.agentName,
      })
    : null;

  const learningSuggestionCandidates: Array<ProjectLearningSuggestionRecord | null> = [
    topFailurePattern
      ? {
          id: buildStableMemoryId(projectId, "learning", `failure-${topFailurePattern.label}`),
          projectId,
          kind: "failure_pattern" as const,
          status: "open" as const,
          title: `失败模式 · ${topFailurePattern.label}`,
          summary: `${topFailurePattern.summary} 建议把这类失败模式前置成任务拆解和恢复策略的一部分，而不是等卡住后再处理。`,
          evidenceLabels: [topFailurePattern.label],
          evidenceSources: dedupeLearningEvidenceSources([
            buildLearningEvidenceSource({
              projectId,
              kind: teamMemory?.blockerPatterns[0]?.label === topFailurePattern.label ? "team_memory" : "project_memory",
              seed: topFailurePattern.label,
              label: `失败模式 · ${topFailurePattern.label}`,
              summary: topFailurePattern.summary,
              updatedAt: topFailurePattern.updatedAt,
            }),
            latestRecoveryAction
              ? buildLearningEvidenceSource({
                  projectId,
                  kind: "recovery",
                  seed: latestRecoveryAction.id,
                  label: `恢复动作 · ${latestRecoveryAction.taskTitle || formatRecoveryActionKindForMemory(latestRecoveryAction.kind)}`,
                  summary: latestRecoveryAction.summary,
                  updatedAt: latestRecoveryAction.createdAt,
                  relatedId: latestRecoveryAction.id,
                  relatedTaskId: latestRecoveryAction.taskId,
                })
              : null,
            latestRunSummary
              ? buildLearningEvidenceSource({
                  projectId,
                  kind: "run_summary",
                  seed: latestRunSummary.id,
                  label: latestRunSummary.title,
                  summary: latestRunSummary.risks[0] || latestRunSummary.summary,
                  updatedAt: latestRunSummary.updatedAt,
                  relatedId: latestRunSummary.id,
                })
              : null,
          ]),
          targetLabel: topFailurePattern.label,
          actionItems: [
            "把这类失败模式前置写进任务拆解提示",
            "为这类风险准备更明确的恢复路径",
          ],
          writebackSummary: failurePatternWriteback?.summary ?? null,
          writebackTargets: failurePatternWriteback?.targets ?? [],
          requiresHumanReview: false,
          reviewThreadId: null,
          reviewNote: null,
          reviewedAt: null,
          updatedAt: topFailurePattern.updatedAt,
        }
      : null,
    templateEvidenceCount > 0
      ? {
          id: buildStableMemoryId(projectId, "learning", "task-template-suggestion"),
          projectId,
          kind: "task_template" as const,
          status: "open" as const,
          title: "任务模板建议 · 显式输入与验收标准",
          summary:
            "多条任务复盘都指向同一个问题：需要把输入交付物、关键依赖和验收标准显式写进任务模板，减少下游阻塞和返工。",
          evidenceLabels: templateEvidenceReflections.map((reflection) => reflection.taskTitle),
          evidenceSources: dedupeLearningEvidenceSources([
            ...templateEvidenceReflections.map((reflection) =>
              buildLearningEvidenceSource({
                projectId,
                kind: "task_reflection",
                seed: reflection.id,
                label: `任务复盘 · ${reflection.taskTitle}`,
                summary: reflection.advice[0] || reflection.summary,
                updatedAt: reflection.updatedAt,
                relatedId: reflection.id,
                relatedTaskId: reflection.taskId,
              }),
            ),
            latestReviewWithBlocking
              ? buildLearningEvidenceSource({
                  projectId,
                  kind: "review",
                  seed: latestReviewWithBlocking.id,
                  label: `Review · ${latestReviewWithBlocking.reviewTargetLabel}`,
                  summary: latestReviewWithBlocking.blockingComments || latestReviewWithBlocking.summary,
                  updatedAt: latestReviewWithBlocking.updatedAt,
                  relatedId: latestReviewWithBlocking.id,
                  relatedTaskId: latestReviewWithBlocking.taskId,
                })
              : null,
          ]),
          targetLabel: "任务模板",
          actionItems: [
            "把输入交付物写成显式字段",
            "把关键依赖和验收标准前置到任务描述里",
          ],
          writebackSummary: taskTemplateWriteback.summary,
          writebackTargets: taskTemplateWriteback.targets,
          requiresHumanReview: false,
          reviewThreadId: null,
          reviewNote: null,
          reviewedAt: null,
          updatedAt: maxUpdatedAt(taskReflections.map((reflection) => reflection.updatedAt), room.updatedAt),
        }
      : null,
    topRoleMemory
      ? {
          id: buildStableMemoryId(projectId, "learning", `role-${topRoleMemory.agentId}`),
          projectId,
          kind: "role_tuning" as const,
          status: "open" as const,
          title: `角色调优建议 · ${topRoleMemory.agentName}`,
          summary: `${
            topRoleMemory.strengths[0] || "这位成员已经形成了可复用的长板"
          }。建议在后续默认派工里更早调用这类长板，并在任务描述里避开 ${topRoleMemory.commonIssues[0] || "当前最容易卡住的输入缺口"}。`,
          evidenceLabels: [topRoleMemory.agentName, ...(topRoleMemory.strengths.slice(0, 1))],
          evidenceSources: dedupeLearningEvidenceSources([
            buildLearningEvidenceSource({
              projectId,
              kind: "role_memory",
              seed: topRoleMemory.agentId,
              label: `角色记忆 · ${topRoleMemory.agentName}`,
              summary: dedupeInsightLines([
                topRoleMemory.strengths[0] || null,
                topRoleMemory.commonIssues[0] || null,
              ]).join("；"),
              updatedAt: topRoleMemory.updatedAt,
              relatedId: topRoleMemory.agentId,
            }),
            roleEvidenceReflection
              ? buildLearningEvidenceSource({
                  projectId,
                  kind: "task_reflection",
                  seed: roleEvidenceReflection.id,
                  label: `任务复盘 · ${roleEvidenceReflection.taskTitle}`,
                  summary: roleEvidenceReflection.summary,
                  updatedAt: roleEvidenceReflection.updatedAt,
                  relatedId: roleEvidenceReflection.id,
                  relatedTaskId: roleEvidenceReflection.taskId,
                })
              : null,
          ]),
          targetLabel: topRoleMemory.agentName,
          actionItems: [
            `把 ${topRoleMemory.agentName} 的长板前置到默认派工判断里`,
            `在任务描述里显式规避 ${topRoleMemory.commonIssues[0] || "当前最容易卡住的输入缺口"}`,
          ],
          writebackSummary: roleTuningWriteback?.summary ?? null,
          writebackTargets: roleTuningWriteback?.targets ?? [],
          requiresHumanReview: false,
          reviewThreadId: null,
          reviewNote: null,
          reviewedAt: null,
          updatedAt: topRoleMemory.updatedAt,
        }
      : null,
    topReviewPattern || projectMemory?.risks[0]
      ? {
          id: buildStableMemoryId(projectId, "learning", "quality-gate-suggestion"),
          projectId,
          kind: "quality_gate" as const,
          status: "open" as const,
          title: "质量闸门建议 · 交回前补一轮自查",
          summary: `${
            topReviewPattern?.summary || projectMemory?.risks[0]?.summary || "最近的风险和 review 问题"
          } 建议在成员交回前增加一份轻量 quality gate，重点检查风险、依赖、边界和可交付格式。`,
          evidenceLabels: [
            topReviewPattern?.label || projectMemory?.risks[0]?.label || "风险 / review",
          ],
          evidenceSources: dedupeLearningEvidenceSources([
            topReviewPattern
              ? buildLearningEvidenceSource({
                  projectId,
                  kind: "team_memory",
                  seed: topReviewPattern.label,
                  label: `团队记忆 · ${topReviewPattern.label}`,
                  summary: topReviewPattern.summary,
                  updatedAt: topReviewPattern.updatedAt,
                })
              : null,
            !topReviewPattern && projectMemory?.risks[0]
              ? buildLearningEvidenceSource({
                  projectId,
                  kind: "project_memory",
                  seed: projectMemory.risks[0].id,
                  label: `项目风险 · ${projectMemory.risks[0].label}`,
                  summary: projectMemory.risks[0].summary,
                  updatedAt: projectMemory.risks[0].updatedAt,
                  relatedId: projectMemory.risks[0].id,
                })
              : null,
            latestReviewWithBlocking
              ? buildLearningEvidenceSource({
                  projectId,
                  kind: "review",
                  seed: latestReviewWithBlocking.id,
                  label: `Review · ${latestReviewWithBlocking.reviewTargetLabel}`,
                  summary: latestReviewWithBlocking.blockingComments || latestReviewWithBlocking.summary,
                  updatedAt: latestReviewWithBlocking.updatedAt,
                  relatedId: latestReviewWithBlocking.id,
                  relatedTaskId: latestReviewWithBlocking.taskId,
                })
              : null,
            stageChecklistReflection
              ? buildLearningEvidenceSource({
                  projectId,
                  kind: "stage_reflection",
                  seed: stageChecklistReflection.id,
                  label: `阶段复盘 · ${stageChecklistReflection.stageLabel}`,
                  summary: stageChecklistReflection.recommendations[0] || stageChecklistReflection.summary,
                  updatedAt: stageChecklistReflection.updatedAt,
                  relatedId: stageChecklistReflection.id,
                })
              : null,
          ]),
          targetLabel: "质量闸门",
          actionItems: [
            "交回前自查风险、依赖和边界",
            "确认输出格式能让下一棒直接接力",
          ],
          writebackSummary: qualityGateWriteback.summary,
          writebackTargets: qualityGateWriteback.targets,
          requiresHumanReview: false,
          reviewThreadId: null,
          reviewNote: null,
          reviewedAt: null,
          updatedAt: maxUpdatedAt(
            [topReviewPattern?.updatedAt, projectMemory?.risks[0]?.updatedAt],
            room.updatedAt,
          ),
        }
      : null,
    shouldSuggestSkillUpgrade
      ? {
          id: buildStableMemoryId(projectId, "learning", "skill-upgrade-suggestion"),
          projectId,
          kind: "skill_upgrade" as const,
          status: "open" as const,
          title: "技能升级建议 · 阶段交接与验收框架",
          summary:
            "当前复盘说明团队需要一套更稳定的交接 / 验收 skill，把输入交付物、风险、依赖和验收标准整理成默认工作流，减少成员之间的隐性 handoff 成本。",
          evidenceLabels: dedupeInsightLines([
            topReviewPattern?.label || null,
            topFailurePattern?.label || null,
            ...taskReflections.slice(0, 2).map((reflection) => reflection.taskTitle),
          ]).slice(0, 4),
          evidenceSources: dedupeLearningEvidenceSources([
            topReviewPattern
              ? buildLearningEvidenceSource({
                  projectId,
                  kind: "team_memory",
                  seed: topReviewPattern.label,
                  label: `团队记忆 · ${topReviewPattern.label}`,
                  summary: topReviewPattern.summary,
                  updatedAt: topReviewPattern.updatedAt,
                })
              : null,
            topFailurePattern
              ? buildLearningEvidenceSource({
                  projectId,
                  kind: teamMemory?.blockerPatterns[0]?.label === topFailurePattern.label ? "team_memory" : "project_memory",
                  seed: topFailurePattern.label,
                  label: `失败模式 · ${topFailurePattern.label}`,
                  summary: topFailurePattern.summary,
                  updatedAt: topFailurePattern.updatedAt,
                })
              : null,
            latestRecoveryAction
              ? buildLearningEvidenceSource({
                  projectId,
                  kind: "recovery",
                  seed: latestRecoveryAction.id,
                  label: `恢复动作 · ${latestRecoveryAction.taskTitle || formatRecoveryActionKindForMemory(latestRecoveryAction.kind)}`,
                  summary: latestRecoveryAction.summary,
                  updatedAt: latestRecoveryAction.createdAt,
                  relatedId: latestRecoveryAction.id,
                  relatedTaskId: latestRecoveryAction.taskId,
                })
              : null,
            templateEvidenceReflections[0]
              ? buildLearningEvidenceSource({
                  projectId,
                  kind: "task_reflection",
                  seed: templateEvidenceReflections[0].id,
                  label: `任务复盘 · ${templateEvidenceReflections[0].taskTitle}`,
                  summary: templateEvidenceReflections[0].summary,
                  updatedAt: templateEvidenceReflections[0].updatedAt,
                  relatedId: templateEvidenceReflections[0].id,
                  relatedTaskId: templateEvidenceReflections[0].taskId,
                })
              : null,
          ]),
          targetLabel: "Team Skill · 阶段交接与验收框架",
          actionItems: [
            "新增或升级一份阶段交接 skill",
            "把风险、依赖、输入 artifact 和验收标准收成固定检查单",
          ],
          writebackSummary: skillUpgradeWriteback.summary,
          writebackTargets: skillUpgradeWriteback.targets,
          requiresHumanReview: true,
          reviewThreadId: null,
          reviewNote: null,
          reviewedAt: null,
          updatedAt: maxUpdatedAt(
            [
              topReviewPattern?.updatedAt,
              topFailurePattern?.updatedAt,
              ...taskReflections.map((reflection) => reflection.updatedAt),
            ],
            room.updatedAt,
          ),
        }
      : null,
    topRoleMemory
      ? {
          id: buildStableMemoryId(projectId, "learning", `agent-profile-${topRoleMemory.agentId}`),
          projectId,
          kind: "agent_profile_update" as const,
          status: "open" as const,
          title: `Agent Profile 更新建议 · ${topRoleMemory.agentName}`,
          summary: `${
            topRoleMemory.strengths[0] || `${topRoleMemory.agentName} 已经形成一类稳定长板`
          }。建议把这位成员的长板、偏好输入和常见坑点显式回填到 agent profile，减少后续派工试错。`,
          evidenceLabels: dedupeInsightLines([
            topRoleMemory.agentName,
            topRoleMemory.strengths[0] || null,
            topRoleMemory.commonIssues[0] || null,
          ]).slice(0, 4),
          evidenceSources: dedupeLearningEvidenceSources([
            buildLearningEvidenceSource({
              projectId,
              kind: "role_memory",
              seed: topRoleMemory.agentId,
              label: `角色记忆 · ${topRoleMemory.agentName}`,
              summary: dedupeInsightLines([
                topRoleMemory.strengths[0] || null,
                topRoleMemory.commonIssues[0] || null,
                topRoleMemory.preferredInputFormat[0] || null,
              ]).join("；"),
              updatedAt: topRoleMemory.updatedAt,
              relatedId: topRoleMemory.agentId,
            }),
            roleEvidenceReflection
              ? buildLearningEvidenceSource({
                  projectId,
                  kind: "task_reflection",
                  seed: roleEvidenceReflection.id,
                  label: `任务复盘 · ${roleEvidenceReflection.taskTitle}`,
                  summary: roleEvidenceReflection.summary,
                  updatedAt: roleEvidenceReflection.updatedAt,
                  relatedId: roleEvidenceReflection.id,
                  relatedTaskId: roleEvidenceReflection.taskId,
                })
              : null,
          ]),
          targetLabel: topRoleMemory.agentName,
          actionItems: [
            "补充 responsibility.md，让默认接棒场景更清楚",
            "补充 knowledge.md 或 user.md，写明偏好输入和常见问题",
          ],
          writebackSummary: agentProfileWriteback?.summary ?? null,
          writebackTargets: agentProfileWriteback?.targets ?? [],
          requiresHumanReview: true,
          reviewThreadId: null,
          reviewNote: null,
          reviewedAt: null,
          updatedAt: topRoleMemory.updatedAt,
        }
      : null,
  ];

  const learningSuggestions = compressLearningSuggestionRecords(
    learningSuggestionCandidates
    .filter((item): item is ProjectLearningSuggestionRecord => item !== null)
    .map((item) => ({
      ...item,
      summary: compactConversationExcerpt(item.summary, 220),
      evidenceLabels: item.evidenceLabels.slice(0, 4),
      evidenceSources: dedupeLearningEvidenceSources(item.evidenceSources),
      actionItems: item.actionItems.slice(0, 4),
      writebackTargets: item.writebackTargets.slice(0, 4),
    })),
  );

  upsertLearningSuggestionRecords(state, projectId, learningSuggestions);
  synchronizeProjectLearningSuggestionReviews(state, projectId);
  synchronizeProjectLearningReuseCandidates(state, projectId);
}

function synchronizeProjectGovernanceState(state: ProjectStoreState, now: string) {
  const projectIds = Array.from(
    new Set([...state.rooms.map((room) => room.id), ...state.tasks.map((task) => task.projectId)]),
  );

  projectIds.forEach((projectId) => {
    unlockTasksWaitingOnArtifacts(state, { projectId, now });
    autoClaimReadyProjectTasks(state, { projectId, now });
    refreshProjectTaskLocks(state, projectId, now);
    synchronizeProjectArtifactGraph(state, projectId);
    synchronizeProjectMemoryLayer(state, projectId);
    synchronizeProjectLearningLoop(state, projectId);
    synchronizeProjectRuntimeHealth(state, projectId, now);
  });
}

function refreshProjectTaskLocks(
  state: ProjectStoreState,
  projectId: string,
  now: string,
) {
  const projectTasks = state.tasks
    .filter((task) => task.projectId === projectId && !isProjectTaskTerminal(task.status))
    .sort((left, right) => sortProjectTasks(left, right));
  const holders: ProjectTaskRecord[] = [];

  projectTasks.forEach((task) => {
    const lockScopePaths = extractTaskLockScopePaths(state, {
      projectId,
      title: task.title,
      description: task.description,
      existingLockScopePaths: task.lockScopePaths,
    });
    const blockingLockTask =
      lockScopePaths.length > 0
        ? holders.find((holder) => holder.id !== task.id && taskLockPathsOverlap(holder.lockScopePaths, lockScopePaths)) ?? null
        : null;
    const restoreStatus = isRestorableProjectTaskStatus(task.queuedStatus) ? task.queuedStatus : "ready";
    const dependencyStillBlocking = Boolean(task.blockedByTaskId);
    const nextPatch: Partial<ProjectTaskRecord> = {
      lockScopePaths,
      lockStatus: lockScopePaths.length === 0 ? "none" : isTaskHoldingLock(task.status) ? "held" : "none",
      lockBlockedByTaskId: null,
    };

    if (blockingLockTask) {
      nextPatch.lockStatus = "waiting";
      nextPatch.lockBlockedByTaskId = blockingLockTask.id;
      nextPatch.blockedReason = dependencyStillBlocking
        ? task.blockedReason || buildTaskBlockedReason(state, task.blockedByTaskId)
        : buildTaskLockBlockedReason(state, { ...task, lockScopePaths }, blockingLockTask.id);
      if (task.status !== "in_progress" && task.status !== "in_review" && task.status !== "waiting_input") {
        nextPatch.status = "blocked";
        nextPatch.queuedStatus = isRestorableProjectTaskStatus(task.status)
          ? task.status
          : task.queuedStatus ?? restoreStatus;
        nextPatch.updatedAt = now;
      }
    } else {
      if (task.lockBlockedByTaskId && !dependencyStillBlocking && task.status === "blocked") {
        nextPatch.status = restoreStatus;
        nextPatch.queuedStatus = null;
        nextPatch.blockedReason = null;
        nextPatch.updatedAt = now;
        if (restoreStatus === "claimed") {
          nextPatch.claimedAt = task.claimedAt ?? now;
          nextPatch.leaseAcquiredAt = task.leaseAcquiredAt ?? now;
          nextPatch.leaseHeartbeatAt = task.leaseHeartbeatAt ?? now;
          nextPatch.leaseExpiresAt = task.leaseExpiresAt ?? computeTaskLeaseExpiresAt(now);
        }
      } else if (!dependencyStillBlocking && task.lockBlockedByTaskId) {
        nextPatch.blockedReason = null;
      }
    }

    const changed = Object.entries(nextPatch).some(([key, value]) => {
      const currentValue = task[key as keyof ProjectTaskRecord];
      return Array.isArray(value)
        ? JSON.stringify(currentValue) !== JSON.stringify(value)
        : currentValue !== value;
    });

    if (changed) {
      updateProjectTask(state, task.id, nextPatch);
    }

    const latestTask = state.tasks.find((item) => item.id === task.id) ?? task;

    if (latestTask.lockScopePaths.length > 0 && isTaskHoldingLock(latestTask.status) && !latestTask.lockBlockedByTaskId) {
      holders.push(latestTask);
    }
  });
}

function reassignTaskOwner(
  state: ProjectStoreState,
  input: {
    taskId: string;
    ownerAgentId: string | null;
    ownerAgentName: string | null;
    reason: string;
    now: string;
    nextStatus?: "ready" | "claimed" | "reopened" | "blocked";
  },
) {
  const task = state.tasks.find((item) => item.id === input.taskId) ?? null;

  if (!task) {
    return null;
  }

  const nextStatus =
    input.nextStatus ??
    (task.blockedByTaskId || task.lockBlockedByTaskId ? "blocked" : task.status === "reopened" ? "reopened" : "claimed");
  const nextQueuedStatus =
    nextStatus === "blocked"
      ? isRestorableProjectTaskStatus(task.queuedStatus)
        ? task.queuedStatus
        : task.status === "reopened"
          ? "reopened"
          : "claimed"
      : null;

  updateProjectTask(state, input.taskId, {
    ownerAgentId: input.ownerAgentId,
    ownerAgentName: input.ownerAgentName,
    status: nextStatus,
    queuedStatus: nextQueuedStatus,
    claimedAt: nextStatus === "claimed" ? input.now : task.claimedAt,
    recoveryAttemptCount: 0,
    ownerReplacementCount: (task.ownerReplacementCount ?? 0) + 1,
    lastReassignedAt: input.now,
    lastReassignmentReason: compactConversationExcerpt(input.reason, 160),
    leaseAcquiredAt: nextStatus === "claimed" ? input.now : null,
    leaseHeartbeatAt: nextStatus === "claimed" ? input.now : null,
    leaseExpiresAt: nextStatus === "claimed" ? computeTaskLeaseExpiresAt(input.now) : null,
    updatedAt: input.now,
  });

  return state.tasks.find((item) => item.id === input.taskId) ?? null;
}

function buildTaskBlockedReason(
  state: ProjectStoreState,
  dependencyTaskId: string | null,
) {
  if (!dependencyTaskId) {
    return null;
  }

  const dependencyTask = state.tasks.find((task) => task.id === dependencyTaskId) ?? null;

  if (!dependencyTask) {
    return "等待上游任务完成后继续。";
  }

  return `等待 ${dependencyTask.ownerAgentName || "上游成员"} 完成“${compactConversationExcerpt(dependencyTask.title, 24)}”后继续。`;
}

function unlockProjectTaskDependents(
  state: ProjectStoreState,
  input: {
    projectId: string;
    completedTaskId: string;
    now: string;
  },
) {
  const handoffCandidates: Array<{
    fromTask: ProjectTaskRecord | null;
    toTaskId: string;
  }> = [];

  state.tasks = state.tasks.map((task) => {
    if (task.projectId !== input.projectId || isProjectTaskTerminal(task.status)) {
      return task;
    }

    if (!task.dependsOnTaskIds.includes(input.completedTaskId)) {
      return task;
    }

    const nextOutstandingDependencyId = findNextOutstandingDependencyId(state, task.dependsOnTaskIds);

    if (nextOutstandingDependencyId) {
      return {
        ...task,
        blockedByTaskId: nextOutstandingDependencyId,
        blockedReason: buildTaskBlockedReason(state, nextOutstandingDependencyId),
        inputArtifactIds: mergeArtifactIds(
          task.inputArtifactIds,
          (state.tasks.find((candidate) => candidate.id === input.completedTaskId)?.artifactIds ?? []),
        ),
        leaseAcquiredAt: null,
        leaseHeartbeatAt: null,
        leaseExpiresAt: null,
        updatedAt: input.now,
      };
    }

    if (task.status === "blocked") {
      const nextOutstandingArtifactId = findNextOutstandingInputArtifactId(
        state,
        mergeArtifactIds(
          task.inputArtifactIds,
          (state.tasks.find((candidate) => candidate.id === input.completedTaskId)?.artifactIds ?? []),
        ),
      );

      if (nextOutstandingArtifactId) {
        return {
          ...task,
          blockedByTaskId: null,
          blockedReason: buildTaskArtifactBlockedReason(state, nextOutstandingArtifactId),
          inputArtifactIds: mergeArtifactIds(
            task.inputArtifactIds,
            (state.tasks.find((candidate) => candidate.id === input.completedTaskId)?.artifactIds ?? []),
          ),
          updatedAt: input.now,
        };
      }

      const nextStatus = isRestorableProjectTaskStatus(task.queuedStatus) ? task.queuedStatus : "ready";
      if (nextStatus === "ready" || nextStatus === "claimed" || nextStatus === "reopened") {
        handoffCandidates.push({
          fromTask: state.tasks.find((candidate) => candidate.id === input.completedTaskId) ?? null,
          toTaskId: task.id,
        });
      }
      return {
        ...task,
        status: nextStatus,
        queuedStatus: null,
        blockedByTaskId: null,
        blockedReason: null,
        inputArtifactIds: mergeArtifactIds(
          task.inputArtifactIds,
          (state.tasks.find((candidate) => candidate.id === input.completedTaskId)?.artifactIds ?? []),
        ),
        claimedAt: null,
        leaseAcquiredAt: null,
        leaseHeartbeatAt: null,
        leaseExpiresAt: null,
        updatedAt: input.now,
      };
    }

    return {
      ...task,
      blockedByTaskId: null,
      blockedReason: null,
      updatedAt: input.now,
    };
  });

  handoffCandidates.forEach((item) => {
    const completedTask = item.fromTask;
    const unblockedTask = state.tasks.find((task) => task.id === item.toTaskId) ?? null;

    if (!completedTask || !unblockedTask?.ownerAgentId) {
      return;
    }

    settleProjectMailboxThreads(state, {
      projectId: input.projectId,
      updatedAt: input.now,
      kind: "request_input",
      relatedTaskId: unblockedTask.id,
    });

    upsertProjectMailboxThread(state, {
      projectId: input.projectId,
      kind: "handoff",
      subject: `任务接力 · ${unblockedTask.ownerAgentName || "下一位成员"}`,
      summary: `${completedTask.ownerAgentName || "上游成员"} 已交回结果，${
        unblockedTask.ownerAgentName || "下一位成员"
      } 可以继续处理“${unblockedTask.title}”。`,
      fromAgentId: completedTask.ownerAgentId,
      fromAgentName: completedTask.ownerAgentName,
      toAgentIds: [unblockedTask.ownerAgentId],
      toAgentNames: [unblockedTask.ownerAgentName || "下一位成员"],
      relatedTaskId: unblockedTask.id,
      relatedTaskTitle: unblockedTask.title,
      relatedArtifactIds: completedTask.artifactIds,
      createdAt: input.now,
    });
  });
}

function unlockTasksWaitingOnArtifacts(
  state: ProjectStoreState,
  input: {
    projectId: string;
    now: string;
  },
) {
  const resolvedTaskIds: string[] = [];

  state.tasks = state.tasks.map((task) => {
    if (
      task.projectId !== input.projectId ||
      task.status !== "blocked" ||
      task.blockedByTaskId ||
      task.inputArtifactIds.length === 0
    ) {
      return task;
    }

    const nextOutstandingArtifactId = findNextOutstandingInputArtifactId(state, task.inputArtifactIds);

    if (nextOutstandingArtifactId) {
      const nextReason = buildTaskArtifactBlockedReason(state, nextOutstandingArtifactId);
      return nextReason === task.blockedReason
        ? task
        : {
            ...task,
            blockedReason: nextReason,
            updatedAt: input.now,
          };
    }

    if (!isRestorableProjectTaskStatus(task.queuedStatus)) {
      return {
        ...task,
        blockedReason: null,
        updatedAt: input.now,
      };
    }

    resolvedTaskIds.push(task.id);
    return {
      ...task,
      status: task.queuedStatus,
      queuedStatus: null,
      blockedReason: null,
      updatedAt: input.now,
    };
  });

  resolvedTaskIds.forEach((taskId) => {
    settleProjectMailboxThreads(state, {
      projectId: input.projectId,
      updatedAt: input.now,
      kind: "request_input",
      relatedTaskId: taskId,
    });
  });
}

function autoClaimReadyProjectTasks(
  state: ProjectStoreState,
  input: {
    projectId: string;
    now: string;
  },
) {
  const room = state.rooms.find((item) => item.id === input.projectId) ?? null;

  if (!room || room.runStatus !== "running") {
    return;
  }

  const projectAgents = state.agents.filter((agent) => agent.projectId === input.projectId);
  const manager =
    projectAgents.find((agent) => agent.agentProfileId === "project-manager") ||
    projectAgents.find((agent) => agent.canDelegate) ||
    null;
  const hasActiveWorker = projectAgents.some(
    (agent) => !agent.canDelegate && agent.status === "working" && Boolean(agent.currentTaskId),
  );

  if (hasActiveWorker) {
    return;
  }

  const candidate =
    state.tasks
      .filter(
        (task) =>
          task.projectId === input.projectId &&
          task.status === "ready" &&
          Boolean(task.ownerAgentId) &&
          !task.blockedByTaskId &&
          !task.lockBlockedByTaskId,
      )
      .sort((left, right) => sortProjectTasks(left, right))
      .find((task) => {
        const owner = projectAgents.find((agent) => agent.id === task.ownerAgentId) ?? null;
        return owner && !owner.canDelegate && !owner.currentTaskId;
      }) ?? null;

  if (!candidate?.ownerAgentId) {
    return;
  }

  const owner = projectAgents.find((agent) => agent.id === candidate.ownerAgentId) ?? null;

  if (!owner) {
    return;
  }

  updateProjectTask(state, candidate.id, {
    status: "claimed",
    claimedAt: candidate.claimedAt ?? input.now,
    leaseAcquiredAt: input.now,
    leaseHeartbeatAt: input.now,
    leaseExpiresAt: computeTaskLeaseExpiresAt(input.now),
    updatedAt: input.now,
  });
  updateProjectAgent(state, owner.id, {
    status: "working",
    currentTaskId: candidate.id,
    blockedByAgentId: null,
    lastAssignedTask: candidate.description,
    progressLabel: "已自领下一棒",
    progressDetails: `这位成员在任务解锁后已主动接手：${compactConversationExcerpt(candidate.description, 120)}`,
    lastHeartbeatAt: input.now,
    progressTrail: appendAgentProgressTrail(owner.progressTrail, {
      label: "已自领下一棒",
      detail: `这位成员在任务解锁后已主动接手：${compactConversationExcerpt(candidate.description, 120)}`,
      createdAt: input.now,
    }),
  });
  state.rooms = state.rooms.map((item) =>
    item.id === input.projectId
      ? {
          ...item,
          activeAgentId: owner.id,
          nextAgentId: null,
          lastActivityLabel: `${owner.name} 已自领下一棒`,
          updatedAt: input.now,
        }
      : item,
  );
  upsertProjectMailboxThread(state, {
    projectId: input.projectId,
    kind: "self_claim",
    subject: `自领下一棒 · ${owner.name}`,
    summary: `${owner.name} 在任务解锁后已主动 claim “${candidate.title}”，准备继续推进。`,
    fromAgentId: owner.id,
    fromAgentName: owner.name,
    toAgentIds: manager?.id ? [manager.id] : [],
    toAgentNames: manager?.name ? [manager.name] : [],
    relatedTaskId: candidate.id,
    relatedTaskTitle: candidate.title,
    relatedArtifactIds: candidate.inputArtifactIds,
    createdAt: input.now,
  });

  const conversationId = ensureTeamConversation(state, room);
  const artifactTitlesById = new Map(state.artifacts.map((artifact) => [artifact.id, artifact.title] as const));
  const recentMessages = getRecentTeamConversationMessages(conversationId);

  enqueueProjectRuntimeWork(input.projectId, async () => {
    await continueProjectDelegationsInBackground({
      projectId: input.projectId,
      conversationId,
      delegations: [
        {
          agentName: owner.name,
          task: candidate.description,
          artifactTitles: candidate.inputArtifactIds
            .map((artifactId) => artifactTitlesById.get(artifactId) ?? null)
            .filter(Boolean) as string[],
        },
      ],
      recentMessages,
    });
  });
}

function mergeArtifactIds(currentArtifactIds: string[], nextArtifactIds: string[]) {
  return Array.from(new Set([...currentArtifactIds, ...nextArtifactIds].filter(Boolean)));
}

function computeTaskLeaseExpiresAt(at: string) {
  return new Date(Date.parse(at) + TASK_LEASE_WINDOW_MS).toISOString();
}

function refreshTaskLease(
  state: ProjectStoreState,
  taskId: string,
  at: string,
) {
  const task = state.tasks.find((item) => item.id === taskId) ?? null;

  if (!task) {
    return;
  }

  updateProjectTask(state, taskId, {
    leaseAcquiredAt: task.leaseAcquiredAt ?? task.claimedAt ?? at,
    leaseHeartbeatAt: at,
    leaseExpiresAt: computeTaskLeaseExpiresAt(at),
  });
}

function expireTaskLease(
  state: ProjectStoreState,
  taskId: string,
  at: string,
) {
  const task = state.tasks.find((item) => item.id === taskId) ?? null;

  if (!task) {
    return;
  }

  updateProjectTask(state, taskId, {
    leaseHeartbeatAt: task.leaseHeartbeatAt ?? at,
    leaseExpiresAt: at,
  });
}

function isTaskLeaseExpired(task: ProjectTaskRecord | null) {
  if (!task?.leaseExpiresAt) {
    return false;
  }

  return Date.parse(task.leaseExpiresAt) <= Date.now();
}

function attachArtifactsToTask(
  state: ProjectStoreState,
  taskId: string,
  artifactIds: string[],
) {
  if (artifactIds.length === 0) {
    return;
  }

  const currentTask = state.tasks.find((task) => task.id === taskId) ?? null;

  if (!currentTask) {
    return;
  }

  updateProjectTask(state, taskId, {
    artifactIds: mergeArtifactIds(currentTask.artifactIds, artifactIds),
  });
}

function syncProjectArtifactCount(state: ProjectStoreState, projectId: string) {
  const artifactCount = state.artifacts.filter((artifact) => artifact.projectId === projectId).length;

  state.rooms = state.rooms.map((room) =>
    room.id === projectId
      ? {
          ...room,
          artifactCount,
        }
      : room,
  );
}

function synchronizeProjectArtifactGraph(
  state: ProjectStoreState,
  projectId: string,
) {
  const projectTasks = state.tasks.filter((task) => task.projectId === projectId);
  const projectReviews = state.reviews.filter((review) => review.projectId === projectId);
  const taskById = new Map(projectTasks.map((task) => [task.id, task] as const));
  const latestReviewByTaskId = new Map<string, ProjectReviewRecord>();

  projectReviews.forEach((review) => {
    const current = latestReviewByTaskId.get(review.taskId) ?? null;
    if (!current || Date.parse(review.updatedAt) > Date.parse(current.updatedAt)) {
      latestReviewByTaskId.set(review.taskId, review);
    }
  });

  state.artifacts = state.artifacts.map((artifact) => {
    if (artifact.projectId !== projectId) {
      return artifact;
    }

    const sourceTask = artifact.sourceTaskId ? taskById.get(artifact.sourceTaskId) ?? null : null;
    const latestReview = sourceTask ? latestReviewByTaskId.get(sourceTask.id) ?? null : null;
    const consumedByTaskIds = projectTasks
      .filter((task) => task.inputArtifactIds.includes(artifact.id))
      .map((task) => task.id);
    const dependsOnArtifactIds =
      sourceTask?.inputArtifactIds?.filter((artifactId) => artifactId !== artifact.id) ?? artifact.dependsOnArtifactIds;

    return {
      ...artifact,
      sourceTaskTitle: sourceTask?.title ?? artifact.sourceTaskTitle ?? null,
      ownerAgentId: sourceTask?.ownerAgentId ?? artifact.ownerAgentId ?? null,
      ownerAgentName: sourceTask?.ownerAgentName ?? artifact.ownerAgentName ?? null,
      reviewStatus: latestReview?.status ?? artifact.reviewStatus ?? null,
      reviewerAgentId: latestReview?.reviewerAgentId ?? artifact.reviewerAgentId ?? null,
      reviewerAgentName: latestReview?.reviewerAgentName ?? artifact.reviewerAgentName ?? null,
      dependsOnArtifactIds,
      consumedByTaskIds,
    };
  });
}

function synchronizeProjectRuntimeHealth(
  state: ProjectStoreState,
  projectId: string,
  now: string,
) {
  const projectAgents = state.agents.filter((agent) => agent.projectId === projectId);
  const projectAgentIds = new Set(projectAgents.map((agent) => agent.id));
  const openStuckSignals = state.stuckSignals.filter(
    (signal) => signal.projectId === projectId && signal.status === "open",
  );

  state.heartbeats = state.heartbeats.filter(
    (heartbeat) => heartbeat.projectId !== projectId || projectAgentIds.has(heartbeat.agentId),
  );

  projectAgents.forEach((agent) => {
    const task = agent.currentTaskId ? state.tasks.find((item) => item.id === agent.currentTaskId) ?? null : null;
    const activeStuckSignal =
      openStuckSignals.find(
        (signal) => signal.agentId === agent.id && (!task || !signal.taskId || signal.taskId === task.id),
      ) ?? null;
    const status = activeStuckSignal
      ? "stalled"
      : resolveAgentHeartbeatStatus(agent);
    const summary = activeStuckSignal
      ? activeStuckSignal.summary
      : buildAgentHeartbeatSummary(agent, task);

    upsertProjectHeartbeat(state, {
      projectId,
      agentId: agent.id,
      agentName: agent.name,
      status,
      taskId: task?.id ?? null,
      taskTitle: task?.title ?? null,
      summary,
      recordedAt: agent.lastHeartbeatAt ?? task?.leaseHeartbeatAt ?? now,
      leaseExpiresAt: task?.leaseExpiresAt ?? null,
    });
  });
}

function normalizeMailboxRecipientIds(ids: string[]) {
  return [...ids].filter(Boolean).sort((left, right) => left.localeCompare(right, "en"));
}

function upsertProjectMailboxThread(
  state: ProjectStoreState,
  input: {
    projectId: string;
    kind: ProjectMailboxThreadRecord["kind"];
    subject: string;
    summary: string;
    fromAgentId: string | null;
    fromAgentName: string | null;
    toAgentIds: string[];
    toAgentNames: string[];
    relatedTaskId?: string | null;
    relatedTaskTitle?: string | null;
    relatedReviewId?: string | null;
    relatedSuggestionId?: string | null;
    relatedArtifactIds?: string[];
    createdAt: string;
  },
) {
  const nextToAgentIds = normalizeMailboxRecipientIds(input.toAgentIds);
  const nextToAgentNames = [...new Set(input.toAgentNames.filter(Boolean))].sort((left, right) =>
    left.localeCompare(right, "zh-Hans-CN"),
  );
  const nextArtifactIds = mergeArtifactIds([], input.relatedArtifactIds ?? []);
  const existingThread =
    state.mailboxThreads.find((thread) => {
      if (
        thread.projectId !== input.projectId ||
        thread.kind !== input.kind ||
        thread.status !== "open" ||
        thread.subject !== input.subject ||
        thread.fromAgentId !== input.fromAgentId ||
        thread.relatedTaskId !== (input.relatedTaskId ?? null) ||
        thread.relatedReviewId !== (input.relatedReviewId ?? null) ||
        thread.relatedSuggestionId !== (input.relatedSuggestionId ?? null)
      ) {
        return false;
      }

      return JSON.stringify(thread.toAgentIds) === JSON.stringify(nextToAgentIds);
    }) ?? null;

  if (existingThread) {
    state.mailboxThreads = state.mailboxThreads.map((thread) =>
      thread.id === existingThread.id
        ? {
            ...thread,
            summary: input.summary,
            toAgentNames: nextToAgentNames,
            relatedTaskTitle: input.relatedTaskTitle ?? thread.relatedTaskTitle ?? null,
            relatedSuggestionId: input.relatedSuggestionId ?? thread.relatedSuggestionId ?? null,
            relatedArtifactIds: mergeArtifactIds(thread.relatedArtifactIds, nextArtifactIds),
            updatedAt: input.createdAt,
          }
        : thread,
    );

    return existingThread.id;
  }

  const threadId = `${input.projectId}-mailbox-${crypto.randomUUID()}`;
  state.mailboxThreads = [
    {
      id: threadId,
      projectId: input.projectId,
      kind: input.kind,
      status: "open",
      subject: input.subject,
      summary: input.summary,
      fromAgentId: input.fromAgentId,
      fromAgentName: input.fromAgentName,
      toAgentIds: nextToAgentIds,
      toAgentNames: nextToAgentNames,
      relatedTaskId: input.relatedTaskId ?? null,
      relatedTaskTitle: input.relatedTaskTitle ?? null,
      relatedReviewId: input.relatedReviewId ?? null,
      relatedSuggestionId: input.relatedSuggestionId ?? null,
      relatedArtifactIds: nextArtifactIds,
      createdAt: input.createdAt,
      updatedAt: input.createdAt,
      resolvedAt: null,
    },
    ...state.mailboxThreads,
  ];

  return threadId;
}

function settleProjectMailboxThreads(
  state: ProjectStoreState,
  input: {
    projectId: string;
    updatedAt: string;
    status?: ProjectMailboxThreadRecord["status"];
    kind?: ProjectMailboxThreadRecord["kind"];
    relatedTaskId?: string | null;
    relatedTaskIds?: string[] | null;
    relatedReviewId?: string | null;
    relatedSuggestionId?: string | null;
  },
) {
  const relatedTaskIdSet = input.relatedTaskIds?.length ? new Set(input.relatedTaskIds) : null;
  state.mailboxThreads = state.mailboxThreads.map((thread) => {
    if (
      thread.projectId !== input.projectId ||
      thread.status !== "open" ||
      (input.kind && thread.kind !== input.kind) ||
      (input.relatedTaskId && thread.relatedTaskId !== input.relatedTaskId) ||
      (relatedTaskIdSet && !relatedTaskIdSet.has(thread.relatedTaskId || "")) ||
      (input.relatedReviewId && thread.relatedReviewId !== input.relatedReviewId) ||
      (input.relatedSuggestionId && thread.relatedSuggestionId !== input.relatedSuggestionId)
    ) {
      return thread;
    }

    return {
      ...thread,
      status: input.status ?? "resolved",
      updatedAt: input.updatedAt,
      resolvedAt: input.updatedAt,
    };
  });
}

function upsertProjectHeartbeat(
  state: ProjectStoreState,
  input: {
    projectId: string;
    agentId: string;
    agentName: string;
    status: ProjectHeartbeatRecord["status"];
    taskId: string | null;
    taskTitle: string | null;
    summary: string;
    recordedAt: string;
    leaseExpiresAt: string | null;
  },
) {
  const existing =
    state.heartbeats.find((heartbeat) => heartbeat.projectId === input.projectId && heartbeat.agentId === input.agentId) ??
    null;

  if (existing) {
    state.heartbeats = state.heartbeats.map((heartbeat) =>
      heartbeat.id === existing.id
        ? {
            ...heartbeat,
            agentName: input.agentName,
            status: input.status,
            taskId: input.taskId,
            taskTitle: input.taskTitle,
            summary: compactConversationExcerpt(input.summary, 180),
            recordedAt: input.recordedAt,
            leaseExpiresAt: input.leaseExpiresAt,
          }
        : heartbeat,
    );
    return existing.id;
  }

  const heartbeatId = `${input.projectId}-heartbeat-${crypto.randomUUID()}`;
  state.heartbeats = [
    {
      id: heartbeatId,
      projectId: input.projectId,
      agentId: input.agentId,
      agentName: input.agentName,
      status: input.status,
      taskId: input.taskId,
      taskTitle: input.taskTitle,
      summary: compactConversationExcerpt(input.summary, 180),
      recordedAt: input.recordedAt,
      leaseExpiresAt: input.leaseExpiresAt,
    },
    ...state.heartbeats,
  ];

  return heartbeatId;
}

function upsertProjectStuckSignal(
  state: ProjectStoreState,
  input: {
    projectId: string;
    agentId: string;
    agentName: string;
    taskId: string | null;
    taskTitle: string | null;
    kind: ProjectStuckSignalKind;
    summary: string;
    detectedAt: string;
  },
) {
  const existing =
    state.stuckSignals.find(
      (signal) =>
        signal.projectId === input.projectId &&
        signal.agentId === input.agentId &&
        signal.taskId === input.taskId &&
        signal.kind === input.kind &&
        signal.status === "open",
    ) ?? null;

  if (existing) {
    state.stuckSignals = state.stuckSignals.map((signal) =>
      signal.id === existing.id
        ? {
            ...signal,
            agentName: input.agentName,
            taskTitle: input.taskTitle,
            summary: compactConversationExcerpt(input.summary, 180),
            updatedAt: input.detectedAt,
          }
        : signal,
    );
    return existing.id;
  }

  const signalId = `${input.projectId}-stuck-${crypto.randomUUID()}`;
  state.stuckSignals = [
    {
      id: signalId,
      projectId: input.projectId,
      agentId: input.agentId,
      agentName: input.agentName,
      taskId: input.taskId,
      taskTitle: input.taskTitle,
      kind: input.kind,
      status: "open",
      summary: compactConversationExcerpt(input.summary, 180),
      detectedAt: input.detectedAt,
      updatedAt: input.detectedAt,
      resolvedAt: null,
    },
    ...state.stuckSignals,
  ];

  return signalId;
}

function settleProjectStuckSignals(
  state: ProjectStoreState,
  input: {
    projectId: string;
    updatedAt: string;
    agentId?: string | null;
    taskId?: string | null;
  },
) {
  state.stuckSignals = state.stuckSignals.map((signal) => {
    if (
      signal.projectId !== input.projectId ||
      signal.status !== "open" ||
      (input.agentId && signal.agentId !== input.agentId) ||
      (input.taskId && signal.taskId !== input.taskId)
    ) {
      return signal;
    }

    return {
      ...signal,
      status: "resolved",
      updatedAt: input.updatedAt,
      resolvedAt: input.updatedAt,
    };
  });
}

function appendProjectRecoveryAction(
  state: ProjectStoreState,
  input: {
    projectId: string;
    kind: ProjectRecoveryActionRecord["kind"];
    summary: string;
    taskId: string | null;
    taskTitle: string | null;
    fromAgentId: string | null;
    fromAgentName: string | null;
    toAgentId: string | null;
    toAgentName: string | null;
    createdAt: string;
  },
) {
  state.recoveryActions = [
    {
      id: `${input.projectId}-recovery-${crypto.randomUUID()}`,
      projectId: input.projectId,
      kind: input.kind,
      summary: compactConversationExcerpt(input.summary, 220),
      taskId: input.taskId,
      taskTitle: input.taskTitle,
      fromAgentId: input.fromAgentId,
      fromAgentName: input.fromAgentName,
      toAgentId: input.toAgentId,
      toAgentName: input.toAgentName,
      createdAt: input.createdAt,
    },
    ...state.recoveryActions,
  ].slice(0, 60);
}

function createProjectReview(
  state: ProjectStoreState,
  input: {
    projectId: string;
    taskId: string;
    taskTitle: string;
    reviewTargetLabel: string;
    requesterAgentId: string | null;
    requesterAgentName: string | null;
    reviewerAgentId: string | null;
    reviewerAgentName: string | null;
    summary: string;
    createdAt: string;
  },
) {
  const existingPendingReview =
    state.reviews.find(
      (review) =>
        review.projectId === input.projectId &&
        review.taskId === input.taskId &&
        review.reviewerAgentId === input.reviewerAgentId &&
        review.status === "pending",
    ) ?? null;

  if (existingPendingReview) {
    state.reviews = state.reviews.map((review) =>
      review.id === existingPendingReview.id
        ? {
            ...review,
            taskTitle: input.taskTitle,
            reviewTargetLabel: input.reviewTargetLabel,
            requesterAgentId: input.requesterAgentId,
            requesterAgentName: input.requesterAgentName,
            reviewerAgentName: input.reviewerAgentName,
            summary: compactConversationExcerpt(input.summary, 180),
            updatedAt: input.createdAt,
          }
        : review,
    );

    return existingPendingReview.id;
  }

  const reviewId = `${input.projectId}-review-${crypto.randomUUID()}`;
  const review: ProjectReviewRecord = {
    id: reviewId,
    projectId: input.projectId,
    taskId: input.taskId,
    taskTitle: input.taskTitle,
    reviewTargetLabel: input.reviewTargetLabel,
    requesterAgentId: input.requesterAgentId,
    requesterAgentName: input.requesterAgentName,
    reviewerAgentId: input.reviewerAgentId,
    reviewerAgentName: input.reviewerAgentName,
    status: "pending",
    summary: compactConversationExcerpt(input.summary, 180),
    blockingComments: null,
    followUpTaskId: null,
    createdAt: input.createdAt,
    updatedAt: input.createdAt,
    completedAt: null,
  };

  state.reviews = [review, ...state.reviews];

  if (input.reviewerAgentId) {
    upsertProjectMailboxThread(state, {
      projectId: input.projectId,
      kind: "review_request",
      subject: `请求复核 · ${input.taskTitle}`,
      summary: `${input.requesterAgentName || "成员"} 已请求 ${
        input.reviewerAgentName || "Reviewer"
      } 复核“${input.reviewTargetLabel}”。`,
      fromAgentId: input.requesterAgentId,
      fromAgentName: input.requesterAgentName,
      toAgentIds: [input.reviewerAgentId],
      toAgentNames: [input.reviewerAgentName || "Reviewer"],
      relatedTaskId: input.taskId,
      relatedTaskTitle: input.taskTitle,
      relatedReviewId: reviewId,
      createdAt: input.createdAt,
    });
  }

  return reviewId;
}

function settleProjectReviews(
  state: ProjectStoreState,
  input: {
    projectId: string;
    status: Exclude<ProjectReviewRecord["status"], "pending">;
    updatedAt: string;
    blockingComments?: string | null;
    followUpTaskId?: string | null;
    followUpTaskIdByReviewId?: Record<string, string> | null;
    taskIds?: string[] | null;
  },
) {
  const taskIdSet = input.taskIds?.length ? new Set(input.taskIds) : null;

  state.reviews = state.reviews.map((review) => {
    if (review.projectId !== input.projectId || review.status !== "pending") {
      return review;
    }

    if (taskIdSet && !taskIdSet.has(review.taskId)) {
      return review;
    }

    return {
      ...review,
      status: input.status,
      blockingComments: input.blockingComments ?? review.blockingComments,
      followUpTaskId:
        input.followUpTaskIdByReviewId?.[review.id] ??
        input.followUpTaskId ??
        review.followUpTaskId,
      updatedAt: input.updatedAt,
      completedAt: input.updatedAt,
    };
  });

  settleProjectMailboxThreads(state, {
    projectId: input.projectId,
    updatedAt: input.updatedAt,
    kind: "review_request",
    relatedTaskIds: input.taskIds ?? null,
  });
}

function createFollowUpTasksFromPendingReviews(
  state: ProjectStoreState,
  input: {
    projectId: string;
    managerId: string | null;
    managerName: string;
    note: string;
    now: string;
  },
) {
  const pendingReviews = state.reviews
    .filter((review) => review.projectId === input.projectId && review.status === "pending")
    .sort((left, right) => Date.parse(left.createdAt) - Date.parse(right.createdAt));

  if (pendingReviews.length === 0) {
    return { followUpTaskIdByReviewId: {} as Record<string, string>, createdTaskIds: [] as string[] };
  }

  const reviewTaskMap = new Map(
    pendingReviews.map((review) => [review.taskId, state.tasks.find((task) => task.id === review.taskId) ?? null] as const),
  );
  const previousFollowUpTaskIdByOriginalTaskId = new Map<string, string>();
  const followUpTaskIdByReviewId: Record<string, string> = {};
  const nextTasks = pendingReviews.map((review, index) => {
    const sourceTask = reviewTaskMap.get(review.taskId) ?? null;
    const followUpTaskId = `${input.projectId}-task-follow-up-${crypto.randomUUID()}`;
    followUpTaskIdByReviewId[review.id] = followUpTaskId;
    previousFollowUpTaskIdByOriginalTaskId.set(review.taskId, followUpTaskId);

    const remappedDependencies = (sourceTask?.dependsOnTaskIds ?? [])
      .map((dependencyId) => previousFollowUpTaskIdByOriginalTaskId.get(dependencyId) ?? null)
      .filter(Boolean) as string[];
    const fallbackDependencyId =
      remappedDependencies.length === 0 && index > 0 ? followUpTaskIdByReviewId[pendingReviews[index - 1]?.id] ?? null : null;
    const dependsOnTaskIds = remappedDependencies.length > 0 ? remappedDependencies : fallbackDependencyId ? [fallbackDependencyId] : [];
    const blockedByTaskId = dependsOnTaskIds[0] ?? null;

    return {
      id: followUpTaskId,
      projectId: input.projectId,
      title: `返工 · ${sourceTask?.title || review.taskTitle}`,
      description:
        `根据复核意见继续推进：${review.blockingComments || input.note}` +
        (sourceTask?.description ? `\n\n原任务：${sourceTask.description}` : ""),
      status: blockedByTaskId ? ("blocked" as const) : ("reopened" as const),
      ownerAgentId: sourceTask?.ownerAgentId ?? input.managerId,
      ownerAgentName: sourceTask?.ownerAgentName ?? input.managerName,
      stageLabel: sourceTask?.stageLabel || "返工处理中",
      acceptanceCriteria:
        sourceTask?.acceptanceCriteria ||
        "根据这次复核意见补充、修正并交回新的阶段结果。",
    queuedStatus: blockedByTaskId ? ("reopened" as const) : null,
    dependsOnTaskIds,
    inputArtifactIds: sourceTask?.artifactIds ?? [],
    blockedByTaskId,
      blockedReason: blockedByTaskId ? buildTaskBlockedReason(state, blockedByTaskId) : compactConversationExcerpt(review.blockingComments || input.note, 120),
      lockScopePaths: sourceTask?.lockScopePaths ?? [],
      lockStatus: "none" as const,
      lockBlockedByTaskId: null,
      resultSummary: null,
      artifactIds: [],
      createdAt: input.now,
      updatedAt: input.now,
      claimedAt: blockedByTaskId ? null : input.now,
      recoveryAttemptCount: 0,
      ownerReplacementCount: 0,
      lastReassignedAt: null,
      lastReassignmentReason: null,
      leaseAcquiredAt: blockedByTaskId ? null : input.now,
      leaseHeartbeatAt: blockedByTaskId ? null : input.now,
      leaseExpiresAt: blockedByTaskId ? null : computeTaskLeaseExpiresAt(input.now),
      startedAt: null,
      completedAt: null,
    } satisfies ProjectTaskRecord;
  });

  state.tasks = [...nextTasks, ...state.tasks];

  state.agents = state.agents.map((agent) => {
    if (agent.projectId !== input.projectId) {
      return agent;
    }

    const linkedFollowUpTask =
      nextTasks.find((task) => task.ownerAgentId === agent.id && !task.blockedByTaskId) ??
      nextTasks.find((task) => task.ownerAgentId === agent.id) ??
      null;
    const blockerTask =
      linkedFollowUpTask?.blockedByTaskId
        ? nextTasks.find((task) => task.id === linkedFollowUpTask.blockedByTaskId) ?? null
        : null;

    if (!linkedFollowUpTask) {
      return agent;
    }

    return {
      ...agent,
      currentTaskId: linkedFollowUpTask.id,
      lastAssignedTask: linkedFollowUpTask.description,
      blockedByAgentId: blockerTask?.ownerAgentId ?? null,
      status: agent.canDelegate ? "planning" : "idle",
    };
  });

  return {
    followUpTaskIdByReviewId,
    createdTaskIds: nextTasks.map((task) => task.id),
  };
}

function settleOpenProjectTasks(
  state: ProjectStoreState,
  input: {
    projectId: string;
    now: string;
    nextStatus: "completed" | "waiting_user" | "waiting_approval";
  },
) {
  state.tasks = state.tasks.map((task) => {
    if (task.projectId !== input.projectId || isProjectTaskTerminal(task.status)) {
      return task;
    }

    if (input.nextStatus === "waiting_approval") {
      const shouldReview =
        Boolean(task.resultSummary) ||
        task.status === "in_progress" ||
        task.status === "claimed" ||
        task.status === "ready" ||
        task.status === "reopened";

      return {
        ...task,
        status: shouldReview ? "in_review" : "cancelled",
        updatedAt: input.now,
        completedAt: shouldReview ? null : task.completedAt ?? input.now,
        leaseHeartbeatAt: task.leaseHeartbeatAt ?? input.now,
        leaseExpiresAt: shouldReview ? task.leaseExpiresAt : input.now,
        resultSummary:
          task.resultSummary ||
          (shouldReview
            ? "这条任务已进入阶段复核，等待项目经理整理交付结果。"
            : "这条任务在本轮阶段收束时被取消，不再继续推进。"),
      };
    }

    if (input.nextStatus === "waiting_user") {
      const shouldKeepAsDone = Boolean(task.resultSummary) || task.status === "in_review";

      return {
        ...task,
        status: shouldKeepAsDone ? "completed" : "cancelled",
        updatedAt: input.now,
        completedAt: task.completedAt ?? input.now,
        leaseHeartbeatAt: task.leaseHeartbeatAt ?? input.now,
        leaseExpiresAt: input.now,
        resultSummary:
          task.resultSummary ||
          (shouldKeepAsDone
            ? "这条任务已在等待用户补充前完成收束。"
            : "这条任务在等待用户补充前被暂停，不再继续推进。"),
      };
    }

    const shouldComplete =
      Boolean(task.resultSummary) ||
      task.status === "in_progress" ||
      task.status === "claimed" ||
      task.status === "in_review" ||
      task.status === "waiting_input";

    return {
      ...task,
      status: shouldComplete ? "completed" : "cancelled",
      updatedAt: input.now,
      completedAt: task.completedAt ?? input.now,
      leaseHeartbeatAt: task.leaseHeartbeatAt ?? input.now,
      leaseExpiresAt: input.now,
      resultSummary:
        task.resultSummary ||
        (shouldComplete
          ? "这条任务已经在本轮阶段收束时视为完成。"
          : "这条任务在项目经理新的阶段判断中被取消，不再继续推进。"),
    };
  });
}

function createCheckpointTask(
  state: ProjectStoreState,
  input: {
    projectId: string;
    managerId: string | null;
    managerName: string;
    decision: "waiting_user" | "waiting_approval";
    summary: string;
    now: string;
  },
) {
  const checkpointTask: ProjectTaskRecord = {
    id: `${input.projectId}-task-checkpoint-${crypto.randomUUID()}`,
    projectId: input.projectId,
    title:
      input.decision === "waiting_approval"
        ? "项目经理整理阶段输出，等待确认"
        : "等待用户补充方向后继续推进",
    description:
      input.decision === "waiting_approval"
        ? "当前团队已经进入阶段交付检查点，等待用户确认是否结束，或提出新的修改意见。"
        : "当前团队已停在用户输入检查点，等待新的方向、约束或验收标准后再继续推进。",
    status: input.decision === "waiting_approval" ? "in_review" : "waiting_input",
    ownerAgentId: input.managerId,
    ownerAgentName: input.managerName,
    stageLabel: input.decision === "waiting_approval" ? "等待你确认" : "等待你补充",
    acceptanceCriteria:
      input.decision === "waiting_approval"
        ? "用户确认完成，或给出明确修改意见。"
        : "用户补充新的方向、约束或验收标准。",
    queuedStatus: null,
    dependsOnTaskIds: [] as string[],
    inputArtifactIds: [] as string[],
    blockedByTaskId: null,
    blockedReason: null,
    lockScopePaths: [] as string[],
    lockStatus: "none",
    lockBlockedByTaskId: null,
    resultSummary: compactConversationExcerpt(input.summary, 180),
    artifactIds: [] as string[],
    createdAt: input.now,
    updatedAt: input.now,
    claimedAt: input.now,
    recoveryAttemptCount: 0,
    ownerReplacementCount: 0,
    lastReassignedAt: null,
    lastReassignmentReason: null,
    leaseAcquiredAt: input.now,
    leaseHeartbeatAt: input.now,
    leaseExpiresAt: computeTaskLeaseExpiresAt(input.now),
    startedAt: input.now,
    completedAt: null,
  };

  state.tasks = [checkpointTask, ...state.tasks];
  const checkpointArtifact = upsertCheckpointArtifact(state.artifacts, {
    projectId: input.projectId,
    decision: input.decision,
    summary: input.summary,
    updatedAt: input.now,
    sourceTaskId: checkpointTask.id,
    sourceTaskTitle: checkpointTask.title,
    ownerAgentId: input.managerId,
    ownerAgentName: input.managerName,
  });
  state.artifacts = checkpointArtifact.artifacts;
  attachArtifactsToTask(state, checkpointTask.id, [checkpointArtifact.artifactId]);
  syncProjectArtifactCount(state, input.projectId);
  if (input.decision === "waiting_approval") {
    createProjectReview(state, {
      projectId: input.projectId,
      taskId: checkpointTask.id,
      taskTitle: checkpointTask.title,
      reviewTargetLabel: "阶段交付总结",
      requesterAgentId: input.managerId,
      requesterAgentName: input.managerName,
      reviewerAgentId: null,
      reviewerAgentName: "你",
      summary: "项目经理已经整理好阶段总结，等待你确认是否完成，或提出修改意见。",
      createdAt: input.now,
    });
  }
  if (input.managerId) {
    updateProjectAgent(state, input.managerId, {
      currentTaskId: checkpointTask.id,
    });
  }
}

function activateManagerPlanningTask(
  state: ProjectStoreState,
  input: {
    projectId: string;
    managerId: string | null;
    managerName: string;
    taskDescription: string;
    now: string;
  },
) {
  const existingPlanningTask =
    state.tasks.find(
      (task) =>
        task.projectId === input.projectId &&
        task.ownerAgentId === input.managerId &&
        (task.status === "ready" || task.status === "reopened"),
    ) ?? null;

  if (existingPlanningTask) {
    updateProjectTask(state, existingPlanningTask.id, {
      title: `${input.managerName} · 收束目标并拆解首轮任务`,
      description: input.taskDescription,
      status: "in_progress",
      updatedAt: input.now,
      startedAt: existingPlanningTask.startedAt ?? input.now,
    });
    if (input.managerId) {
      updateProjectAgent(state, input.managerId, {
        currentTaskId: existingPlanningTask.id,
      });
    }
    return;
  }

  const planningTask: ProjectTaskRecord = {
    id: `${input.projectId}-task-bootstrap-${crypto.randomUUID()}`,
    projectId: input.projectId,
    title: `${input.managerName} · 收束目标并拆解首轮任务`,
    description: input.taskDescription,
    status: "in_progress",
    ownerAgentId: input.managerId,
    ownerAgentName: input.managerName,
    stageLabel: "项目经理统筹",
    acceptanceCriteria: "形成第一轮可执行分工，或者明确当前应该进入的 checkpoint。",
    queuedStatus: null,
    dependsOnTaskIds: [] as string[],
    inputArtifactIds: [] as string[],
    blockedByTaskId: null,
    blockedReason: null,
    lockScopePaths: [],
    lockStatus: "none",
    lockBlockedByTaskId: null,
    resultSummary: null,
    artifactIds: [] as string[],
    createdAt: input.now,
    updatedAt: input.now,
    claimedAt: input.now,
    recoveryAttemptCount: 0,
    ownerReplacementCount: 0,
    lastReassignedAt: null,
    lastReassignmentReason: null,
    leaseAcquiredAt: input.now,
    leaseHeartbeatAt: input.now,
    leaseExpiresAt: computeTaskLeaseExpiresAt(input.now),
    startedAt: input.now,
    completedAt: null,
  };

  state.tasks = [planningTask, ...state.tasks];
  if (input.managerId) {
    updateProjectAgent(state, input.managerId, {
      currentTaskId: planningTask.id,
    });
  }
}

function createDelegationTasks(
  state: ProjectStoreState,
  input: {
    projectId: string;
    managerId: string | null;
    managerName: string;
    delegations: RuntimeManagerPlan["delegations"];
    delegatedAgents: ProjectAgentRecord[];
    stageLabel: string | null;
    now: string;
  },
) {
  const openTasks = state.tasks.filter(
    (task) => task.projectId === input.projectId && !isProjectTaskTerminal(task.status),
  );
  const projectArtifacts = state.artifacts.filter((artifact) => artifact.projectId === input.projectId);

  if (openTasks.length > 0) {
    state.tasks = state.tasks.map((task) =>
      task.projectId === input.projectId && !isProjectTaskTerminal(task.status)
        ? {
            ...task,
            status: "cancelled",
            resultSummary:
              task.resultSummary ||
              "项目经理已按新的阶段判断重写任务图，这条未完成任务已由新的任务链接管。",
            updatedAt: input.now,
            completedAt: task.completedAt ?? input.now,
          }
        : task,
    );
  }

  const nextTasks = input.delegations.map((delegation, index) => {
    const owner = input.delegatedAgents[index] ?? null;
    const taskId = `${input.projectId}-task-${crypto.randomUUID()}`;
    const requestedArtifactIds = resolveArtifactIdsByTitles(projectArtifacts, delegation.artifactTitles);
    return {
      _owner: owner,
      record: {
        id: taskId,
        projectId: input.projectId,
        title: buildProjectTaskTitle(owner?.name ?? delegation.agentName, delegation.task),
        description: delegation.task,
        status: index === 0 ? "claimed" : "blocked",
        ownerAgentId: owner?.id ?? null,
        ownerAgentName: owner?.name ?? delegation.agentName,
        stageLabel: input.stageLabel,
        acceptanceCriteria: "交回一版足够让项目经理继续判断或让下一棒继续接力的阶段结果。",
        queuedStatus: index === 0 ? null : ("ready" as const),
        dependsOnTaskIds: [] as string[],
        inputArtifactIds: requestedArtifactIds,
        blockedByTaskId: null as string | null,
        blockedReason: null as string | null,
        lockScopePaths: extractTaskLockScopePaths(state, {
          projectId: input.projectId,
          title: buildProjectTaskTitle(owner?.name ?? delegation.agentName, delegation.task),
          description: delegation.task,
        }),
        lockStatus: "none" as const,
        lockBlockedByTaskId: null,
        resultSummary: null,
        artifactIds: [] as string[],
        createdAt: input.now,
        updatedAt: input.now,
        claimedAt: index === 0 ? input.now : null,
        recoveryAttemptCount: 0,
        ownerReplacementCount: 0,
        lastReassignedAt: null,
        lastReassignmentReason: null,
        leaseAcquiredAt: index === 0 ? input.now : null,
        leaseHeartbeatAt: index === 0 ? input.now : null,
        leaseExpiresAt: index === 0 ? computeTaskLeaseExpiresAt(input.now) : null,
        startedAt: null,
        completedAt: null,
      } satisfies ProjectTaskRecord,
    };
  });

  nextTasks.forEach((item, index) => {
    const blocker = nextTasks[index - 1]?.record ?? null;
    const artifactBlockerId = findNextOutstandingInputArtifactId(state, item.record.inputArtifactIds);

    item.record.dependsOnTaskIds = blocker ? [blocker.id] : [];
    item.record.blockedByTaskId = blocker?.id ?? null;

    if (blocker) {
      item.record.status = "blocked";
      item.record.queuedStatus = item.record.queuedStatus ?? "ready";
      item.record.blockedReason = buildTaskBlockedReason(state, blocker.id);
      item.record.claimedAt = null;
      item.record.leaseAcquiredAt = null;
      item.record.leaseHeartbeatAt = null;
      item.record.leaseExpiresAt = null;
      return;
    }

    if (artifactBlockerId) {
      item.record.status = "blocked";
      item.record.queuedStatus = item.record.queuedStatus ?? "ready";
      item.record.blockedByTaskId = null;
      item.record.blockedReason = buildTaskArtifactBlockedReason(state, artifactBlockerId);
      item.record.claimedAt = null;
      item.record.leaseAcquiredAt = null;
      item.record.leaseHeartbeatAt = null;
      item.record.leaseExpiresAt = null;
      return;
    }

    if (index === 0) {
      item.record.status = "claimed";
      item.record.queuedStatus = null;
      item.record.blockedReason = null;
      return;
    }
  });

  state.tasks = [
    ...nextTasks.map((item) => item.record),
    ...state.tasks,
  ];

  state.agents = state.agents.map((agent) => {
    if (agent.projectId !== input.projectId) {
      return agent;
    }

    const linkedTask = nextTasks.find((item) => item._owner?.id === agent.id)?.record ?? null;

    return {
      ...agent,
      currentTaskId: linkedTask?.id ?? null,
    };
  });

  nextTasks.forEach((item, index) => {
    if (!item._owner) {
      return;
    }

    upsertProjectMailboxThread(state, {
      projectId: input.projectId,
      kind: "direct_message",
      subject: `PM 派工 · ${item._owner.name}`,
      summary: `项目经理已把这条任务正式交给 ${item._owner.name}：${compactConversationExcerpt(
        item.record.description,
        140,
      )}`,
      fromAgentId: input.managerId,
      fromAgentName: input.managerName,
      toAgentIds: [item._owner.id],
      toAgentNames: [item._owner.name],
      relatedTaskId: item.record.id,
      relatedTaskTitle: item.record.title,
      relatedArtifactIds: item.record.inputArtifactIds,
      createdAt: input.now,
    });

    const blocker = index > 0 ? nextTasks[index - 1]?.record ?? null : null;
    if (blocker?.ownerAgentId) {
      upsertProjectMailboxThread(state, {
        projectId: input.projectId,
        kind: "request_input",
        subject: `等待上游结果 · ${item._owner.name}`,
        summary: `${item._owner.name} 这条任务需要等待 ${
          blocker.ownerAgentName || "上游成员"
        } 的结果后继续。`,
        fromAgentId: item._owner.id,
        fromAgentName: item._owner.name,
        toAgentIds: [blocker.ownerAgentId],
        toAgentNames: [blocker.ownerAgentName || "上游成员"],
        relatedTaskId: item.record.id,
        relatedTaskTitle: item.record.title,
        createdAt: input.now,
      });
    } else {
      const artifactBlockerId = findNextOutstandingInputArtifactId(state, item.record.inputArtifactIds);
      const artifactBlocker = artifactBlockerId
        ? state.artifacts.find((artifact) => artifact.id === artifactBlockerId) ?? null
        : null;
      const targetAgentId = artifactBlocker?.ownerAgentId ?? input.managerId;
      const targetAgentName = artifactBlocker?.ownerAgentName ?? input.managerName;

      if (artifactBlockerId && targetAgentId) {
        upsertProjectMailboxThread(state, {
          projectId: input.projectId,
          kind: "request_input",
          subject: `请求补充交付物 · ${item._owner.name}`,
          summary: `${item._owner.name} 正在等待交付物“${artifactBlocker?.title || "上游交付物"}”就绪后再继续。`,
          fromAgentId: item._owner.id,
          fromAgentName: item._owner.name,
          toAgentIds: [targetAgentId],
          toAgentNames: [targetAgentName],
          relatedTaskId: item.record.id,
          relatedTaskTitle: item.record.title,
          relatedArtifactIds: [artifactBlockerId],
          createdAt: input.now,
        });
      }
    }
  });

  if (input.delegatedAgents.length > 1) {
    upsertProjectMailboxThread(state, {
      projectId: input.projectId,
      kind: "broadcast",
      subject: "PM 广播 · 本轮接力安排",
      summary: `项目经理已同步本轮接力顺序：${input.delegatedAgents.map((agent) => agent.name).join(" → ")}。`,
      fromAgentId: input.managerId,
      fromAgentName: input.managerName,
      toAgentIds: input.delegatedAgents.map((agent) => agent.id),
      toAgentNames: input.delegatedAgents.map((agent) => agent.name),
      relatedTaskId: nextTasks[0]?.record.id ?? null,
      relatedTaskTitle: nextTasks[0]?.record.title ?? null,
      relatedArtifactIds: nextTasks.flatMap((item) => item.record.inputArtifactIds),
      createdAt: input.now,
    });
  }
}

function buildProjectTaskTitle(agentName: string, task: string) {
  const compactTask = compactConversationExcerpt(task, 48);

  return `${agentName} · ${compactTask}`;
}

function buildMemberReply(agent: ProjectAgentRecord, content: string) {
  const assignment = describeAgentAssignment(agent);

  if (agent.visibility === "backstage") {
    return `收到，我先处理这一部分：${assignment}。我会基于“${compactTeamChatText(content)}”补充事实、判断和执行建议，随后把关键结论交回项目经理。`;
  }

  if (agent.visibility === "frontstage") {
    return `收到，我先处理这一部分：${assignment}。我会基于“${compactTeamChatText(content)}”把内容整理成更清楚、可直接对外使用的表达，方便后续输出。`;
  }

  return `收到，我先处理这一部分：${assignment}。我会围绕“${compactTeamChatText(content)}”补充这一轮最相关的判断与执行建议。`;
}

function matchesAgentMention(content: string, agent: ProjectAgentRecord) {
  const normalized = content.toLowerCase();
  const names = [
    agent.name,
    agent.role,
    agent.agentProfileId === "project-manager" ? "项目经理" : null,
  ]
    .filter(Boolean)
    .map((item) => String(item).toLowerCase());

  return names.some((name) => normalized.includes(`@${name}`));
}

function shouldAgentJoinConversation(content: string, agent: ProjectAgentRecord) {
  const normalized = content.toLowerCase();

  if (matchesDelegationIntent(normalized)) {
    return true;
  }

  if (agent.visibility === "backstage") {
    return /(研究|调研|资料|竞品|证据|分析|搜索|验证|事实)/i.test(normalized);
  }

  if (agent.visibility === "frontstage") {
    return /(总结|整理|文案|表达|写|输出|邮件|说明|汇报)/i.test(normalized);
  }

  return /(方案|路线|优先级|排期|目标|推进|协调|决策)/i.test(normalized);
}

function matchesDelegationIntent(content: string) {
  return /(分工|安排|推进|拆解|协作|分配|统筹|推进下去|拉上|一起做|派给|安排下|跟进)/i.test(content);
}

function describeAgentAssignment(agent: ProjectAgentRecord) {
  const identity = `${agent.name} ${agent.role} ${agent.agentProfileId || ""}`.toLowerCase();
  const responsibility = agent.responsibility.toLowerCase();

  if (/(杠精|审查|review|质疑)/i.test(identity)) {
    return "从风险、漏洞、边界条件和反例角度审查当前方案";
  }

  if (/(开发工程师|开发|工程|技术)/i.test(identity)) {
    return "给出最小 MVP 的技术方案、实现边界和落地顺序";
  }

  if (/(产品|需求|体验|竞品)/i.test(identity)) {
    return "梳理用户目标、页面范围、信息架构和关键交互假设";
  }

  if (/(前台输出|writer)/i.test(identity)) {
    return "整理一版可以直接对外表达的说明、文案或汇报结构";
  }

  if (/(项目经理|lead)/i.test(identity)) {
    return "收束目标、同步分工依赖，并把阶段结果整理成下一步安排";
  }

  if (/(竞品|流程|信息架构)/i.test(responsibility)) {
    return "梳理用户目标、页面范围、信息架构和关键交互假设";
  }

  if (/(mvp|架构|实现|代码)/i.test(responsibility)) {
    return "给出最小 MVP 的技术方案、实现边界和落地顺序";
  }

  if (/(漏洞|反例|审查|质疑)/i.test(responsibility)) {
    return "从风险、漏洞、边界条件和反例角度审查当前方案";
  }

  if (agent.visibility === "frontstage") {
    return "整理一版可以直接对外表达的说明、文案或汇报结构";
  }

  return "补充这一轮最关键的分析、判断和执行建议";
}

function compactTeamChatText(value: string) {
  const normalized = value.replace(/\s+/g, " ").trim();
  return normalized.length > 28 ? `${normalized.slice(0, 28)}...` : normalized;
}

function findProjectActorLabel(
  state: ProjectStoreState,
  projectId: string,
  kind: "lead" | "research" | "frontstage",
) {
  const projectAgents = state.agents.filter((agent) => agent.projectId === projectId);

  if (kind === "lead") {
    return projectAgents.find((agent) => agent.canDelegate)?.name || "Team Lead";
  }

  if (kind === "research") {
    return (
      projectAgents.find((agent) => !agent.canDelegate && agent.visibility === "backstage")?.name ||
      "研究成员"
    );
  }

  return (
    projectAgents.find((agent) => !agent.canDelegate && agent.visibility === "frontstage")?.name ||
    "前台输出成员"
  );
}

function readState(): ProjectStoreState {
  return store.read();
}

function writeState(state: ProjectStoreState) {
  synchronizeProjectGovernanceState(state, new Date().toISOString());
  store.write(state);
}

function createInitialState(): ProjectStoreState {
  return {
    rooms: [],
    agents: [],
    events: [],
    artifacts: [],
    mailboxThreads: [],
    projectMemories: [],
    teamMemories: [],
    roleMemories: [],
    taskReflections: [],
    stageReflections: [],
    runSummaries: [],
    learningSuggestions: [],
    learningReuseCandidates: [],
    autonomyGates: [],
    heartbeats: [],
    stuckSignals: [],
    recoveryActions: [],
    reviews: [],
    tasks: [],
    runs: [],
  };
}

function normalizeProjectStoreState(parsed: Partial<ProjectStoreState>): ProjectStoreState {
  const rooms = Array.isArray(parsed.rooms)
    ? parsed.rooms.map((storedRoom) => {
        const room = stripLegacyProjectRoomFields(storedRoom);

        return {
        ...room,
        workspaceDir: room.workspaceDir
          ? normalizeProjectWorkspaceDir(room.workspaceDir)
          : null,
        sandboxMode:
          room.sandboxMode === "read-only" ||
          room.sandboxMode === "workspace-write" ||
          room.sandboxMode === "danger-full-access"
            ? room.sandboxMode
            : "workspace-write",
        teamConversationId: room.teamConversationId ?? null,
        feishuChatSessionId: normalizeFeishuChatSessionId(room.feishuChatSessionId),
        currentStageLabel: room.currentStageLabel ?? null,
        activeAgentId: room.activeAgentId ?? null,
        nextAgentId: room.nextAgentId ?? null,
        openGateCount: room.openGateCount ?? 0,
        latestGateSummary: room.latestGateSummary ?? null,
        autonomyStatus: room.autonomyStatus ?? "guarded",
        autonomyRoundBudget: room.autonomyRoundBudget ?? PROJECT_AUTONOMY_ROUND_BUDGET,
        autonomyRoundCount: room.autonomyRoundCount ?? 0,
        autonomyApprovedAt: room.autonomyApprovedAt ?? room.updatedAt ?? room.createdAt ?? null,
        autonomyPauseReason: room.autonomyPauseReason ?? null,
      };
      })
    : [];
  const agents = normalizeStoredProjectAgents(Array.isArray(parsed.agents) ? parsed.agents : [], rooms);

  const normalizedState: ProjectStoreState = {
    rooms,
    agents,
    events: Array.isArray(parsed.events) ? parsed.events : [],
    artifacts: Array.isArray(parsed.artifacts)
      ? parsed.artifacts.map((artifact) => ({
          ...artifact,
          sourceTaskId: artifact.sourceTaskId ?? null,
          sourceTaskTitle: artifact.sourceTaskTitle ?? null,
          ownerAgentId: artifact.ownerAgentId ?? null,
          ownerAgentName: artifact.ownerAgentName ?? null,
          reviewStatus: artifact.reviewStatus ?? null,
          reviewerAgentId: artifact.reviewerAgentId ?? null,
          reviewerAgentName: artifact.reviewerAgentName ?? null,
          dependsOnArtifactIds: Array.isArray(artifact.dependsOnArtifactIds) ? artifact.dependsOnArtifactIds : [],
          consumedByTaskIds: Array.isArray(artifact.consumedByTaskIds) ? artifact.consumedByTaskIds : [],
        }))
      : [],
    mailboxThreads: Array.isArray((parsed as { mailboxThreads?: unknown[] }).mailboxThreads)
      ? (parsed as { mailboxThreads: ProjectMailboxThreadRecord[] }).mailboxThreads.map((thread) => ({
          ...thread,
          fromAgentId: thread.fromAgentId ?? null,
          fromAgentName: thread.fromAgentName ?? null,
          toAgentIds: Array.isArray(thread.toAgentIds) ? thread.toAgentIds : [],
          toAgentNames: Array.isArray(thread.toAgentNames) ? thread.toAgentNames : [],
          relatedTaskId: thread.relatedTaskId ?? null,
          relatedTaskTitle: thread.relatedTaskTitle ?? null,
          relatedReviewId: thread.relatedReviewId ?? null,
          relatedSuggestionId: thread.relatedSuggestionId ?? null,
          relatedArtifactIds: Array.isArray(thread.relatedArtifactIds) ? thread.relatedArtifactIds : [],
          resolvedAt: thread.resolvedAt ?? null,
        }))
      : [],
    projectMemories: Array.isArray((parsed as { projectMemories?: unknown[] }).projectMemories)
      ? (parsed as { projectMemories: ProjectMemoryRecord[] }).projectMemories.map((memory) => ({
          ...memory,
          decisions: Array.isArray(memory.decisions) ? memory.decisions : [],
          preferences: Array.isArray(memory.preferences) ? memory.preferences : [],
          risks: Array.isArray(memory.risks) ? memory.risks : [],
          pitfalls: Array.isArray(memory.pitfalls) ? memory.pitfalls : [],
        }))
      : [],
    teamMemories: Array.isArray((parsed as { teamMemories?: unknown[] }).teamMemories)
      ? (parsed as { teamMemories: ProjectTeamMemoryRecord[] }).teamMemories.map((memory) => ({
          ...memory,
          handoffPatterns: Array.isArray(memory.handoffPatterns) ? memory.handoffPatterns : [],
          blockerPatterns: Array.isArray(memory.blockerPatterns) ? memory.blockerPatterns : [],
          reviewPatterns: Array.isArray(memory.reviewPatterns) ? memory.reviewPatterns : [],
        }))
      : [],
    roleMemories: Array.isArray((parsed as { roleMemories?: unknown[] }).roleMemories)
      ? (parsed as { roleMemories: ProjectRoleMemoryRecord[] }).roleMemories.map((memory) => ({
          ...memory,
          strengths: Array.isArray(memory.strengths) ? memory.strengths : [],
          commonIssues: Array.isArray(memory.commonIssues) ? memory.commonIssues : [],
          preferredInputFormat: Array.isArray(memory.preferredInputFormat) ? memory.preferredInputFormat : [],
        }))
      : [],
    taskReflections: Array.isArray((parsed as { taskReflections?: unknown[] }).taskReflections)
      ? (parsed as { taskReflections: ProjectTaskReflectionRecord[] }).taskReflections.map((reflection) => ({
          ...reflection,
          ownerAgentId: reflection.ownerAgentId ?? null,
          ownerAgentName: reflection.ownerAgentName ?? null,
          wins: Array.isArray(reflection.wins) ? reflection.wins : [],
          issues: Array.isArray(reflection.issues) ? reflection.issues : [],
          advice: Array.isArray(reflection.advice) ? reflection.advice : [],
        }))
      : [],
    stageReflections: Array.isArray((parsed as { stageReflections?: unknown[] }).stageReflections)
      ? (parsed as { stageReflections: ProjectStageReflectionRecord[] }).stageReflections.map((reflection) => ({
          ...reflection,
          highlights: Array.isArray(reflection.highlights) ? reflection.highlights : [],
          frictions: Array.isArray(reflection.frictions) ? reflection.frictions : [],
          recommendations: Array.isArray(reflection.recommendations) ? reflection.recommendations : [],
        }))
      : [],
    runSummaries: Array.isArray((parsed as { runSummaries?: unknown[] }).runSummaries)
      ? (parsed as { runSummaries: ProjectRunSummaryRecord[] }).runSummaries.map((summary) => ({
          ...summary,
          wins: Array.isArray(summary.wins) ? summary.wins : [],
          risks: Array.isArray(summary.risks) ? summary.risks : [],
          recommendations: Array.isArray(summary.recommendations) ? summary.recommendations : [],
        }))
      : [],
    learningSuggestions: Array.isArray((parsed as { learningSuggestions?: unknown[] }).learningSuggestions)
      ? (parsed as { learningSuggestions: ProjectLearningSuggestionRecord[] }).learningSuggestions.map((suggestion) => ({
          ...suggestion,
          evidenceLabels: Array.isArray(suggestion.evidenceLabels) ? suggestion.evidenceLabels : [],
          evidenceSources: Array.isArray(suggestion.evidenceSources) ? suggestion.evidenceSources : [],
          targetLabel: suggestion.targetLabel ?? null,
          actionItems: Array.isArray(suggestion.actionItems) ? suggestion.actionItems : [],
          writebackSummary: suggestion.writebackSummary ?? null,
          writebackTargets: Array.isArray(suggestion.writebackTargets) ? suggestion.writebackTargets : [],
          requiresHumanReview: suggestion.requiresHumanReview === true,
          reviewThreadId: suggestion.reviewThreadId ?? null,
          reviewNote: suggestion.reviewNote ?? null,
          reviewedAt: suggestion.reviewedAt ?? null,
        }))
      : [],
    learningReuseCandidates: Array.isArray((parsed as { learningReuseCandidates?: unknown[] }).learningReuseCandidates)
      ? (parsed as { learningReuseCandidates: ProjectLearningReuseCandidateRecord[] }).learningReuseCandidates.map((candidate) => ({
          ...candidate,
          targetLabel: candidate.targetLabel ?? null,
          evidenceLabels: Array.isArray(candidate.evidenceLabels) ? candidate.evidenceLabels : [],
          evidenceSources: Array.isArray(candidate.evidenceSources) ? candidate.evidenceSources : [],
          reviewNote: candidate.reviewNote ?? null,
          reviewedAt: candidate.reviewedAt ?? null,
        }))
      : [],
    autonomyGates: Array.isArray((parsed as { autonomyGates?: unknown[] }).autonomyGates)
      ? (parsed as { autonomyGates: ProjectAutonomyGateRecord[] }).autonomyGates.map((gate) => ({
          ...gate,
          resolvedAt: gate.resolvedAt ?? null,
        }))
      : [],
    heartbeats: Array.isArray((parsed as { heartbeats?: unknown[] }).heartbeats)
      ? (parsed as { heartbeats: ProjectHeartbeatRecord[] }).heartbeats.map((heartbeat) => ({
          ...heartbeat,
          taskId: heartbeat.taskId ?? null,
          taskTitle: heartbeat.taskTitle ?? null,
          leaseExpiresAt: heartbeat.leaseExpiresAt ?? null,
        }))
      : [],
    stuckSignals: Array.isArray((parsed as { stuckSignals?: unknown[] }).stuckSignals)
      ? (parsed as { stuckSignals: ProjectStuckSignalRecord[] }).stuckSignals.map((signal) => ({
          ...signal,
          taskId: signal.taskId ?? null,
          taskTitle: signal.taskTitle ?? null,
          resolvedAt: signal.resolvedAt ?? null,
        }))
      : [],
    recoveryActions: Array.isArray((parsed as { recoveryActions?: unknown[] }).recoveryActions)
      ? (parsed as { recoveryActions: ProjectRecoveryActionRecord[] }).recoveryActions.map((action) => ({
          ...action,
          taskId: action.taskId ?? null,
          taskTitle: action.taskTitle ?? null,
          fromAgentId: action.fromAgentId ?? null,
          fromAgentName: action.fromAgentName ?? null,
          toAgentId: action.toAgentId ?? null,
          toAgentName: action.toAgentName ?? null,
        }))
      : [],
    reviews: Array.isArray(parsed.reviews)
      ? parsed.reviews.map((review) => ({
          ...review,
          requesterAgentId: review.requesterAgentId ?? null,
          requesterAgentName: review.requesterAgentName ?? null,
          reviewerAgentId: review.reviewerAgentId ?? null,
          reviewerAgentName: review.reviewerAgentName ?? null,
          blockingComments: review.blockingComments ?? null,
          followUpTaskId: review.followUpTaskId ?? null,
          completedAt: review.completedAt ?? null,
        }))
      : [],
    tasks: Array.isArray(parsed.tasks)
      ? parsed.tasks.map((task) => ({
          ...task,
          ownerAgentId: task.ownerAgentId ?? null,
          ownerAgentName: task.ownerAgentName ?? null,
          stageLabel: task.stageLabel ?? null,
          acceptanceCriteria: task.acceptanceCriteria ?? null,
          queuedStatus: task.queuedStatus ?? null,
          dependsOnTaskIds: Array.isArray(task.dependsOnTaskIds) ? task.dependsOnTaskIds : [],
          inputArtifactIds: Array.isArray(task.inputArtifactIds) ? task.inputArtifactIds : [],
          blockedByTaskId: task.blockedByTaskId ?? null,
          blockedReason: task.blockedReason ?? null,
          lockScopePaths: Array.isArray(task.lockScopePaths) ? task.lockScopePaths : [],
          lockStatus: task.lockStatus ?? "none",
          lockBlockedByTaskId: task.lockBlockedByTaskId ?? null,
          resultSummary: task.resultSummary ?? null,
          artifactIds: Array.isArray(task.artifactIds) ? task.artifactIds : [],
          claimedAt: task.claimedAt ?? null,
          recoveryAttemptCount: task.recoveryAttemptCount ?? 0,
          ownerReplacementCount: task.ownerReplacementCount ?? 0,
          lastReassignedAt: task.lastReassignedAt ?? null,
          lastReassignmentReason: task.lastReassignmentReason ?? null,
          leaseAcquiredAt: task.leaseAcquiredAt ?? null,
          leaseHeartbeatAt: task.leaseHeartbeatAt ?? null,
          leaseExpiresAt: task.leaseExpiresAt ?? null,
          startedAt: task.startedAt ?? null,
          completedAt: task.completedAt ?? null,
        }))
      : [],
    runs: Array.isArray(parsed.runs) ? parsed.runs : [],
  };

  return pruneOrphanedProjectState(normalizedState);
}

function pruneOrphanedProjectState(state: ProjectStoreState): ProjectStoreState {
  const activeProjectIds = new Set(state.rooms.map((room) => room.id));

  return {
    ...state,
    agents: normalizeStoredProjectAgents(state.agents, state.rooms),
    events: filterProjectScopedRecords(state.events, activeProjectIds),
    artifacts: filterProjectScopedRecords(state.artifacts, activeProjectIds),
    mailboxThreads: filterProjectScopedRecords(state.mailboxThreads, activeProjectIds),
    projectMemories: filterProjectScopedRecords(state.projectMemories, activeProjectIds),
    teamMemories: filterProjectScopedRecords(state.teamMemories, activeProjectIds),
    roleMemories: filterProjectScopedRecords(state.roleMemories, activeProjectIds),
    taskReflections: filterProjectScopedRecords(state.taskReflections, activeProjectIds),
    stageReflections: filterProjectScopedRecords(state.stageReflections, activeProjectIds),
    runSummaries: filterProjectScopedRecords(state.runSummaries, activeProjectIds),
    learningSuggestions: filterProjectScopedRecords(state.learningSuggestions, activeProjectIds),
    learningReuseCandidates: filterSourceProjectScopedRecords(state.learningReuseCandidates, activeProjectIds),
    autonomyGates: filterProjectScopedRecords(state.autonomyGates, activeProjectIds),
    heartbeats: filterProjectScopedRecords(state.heartbeats, activeProjectIds),
    stuckSignals: filterProjectScopedRecords(state.stuckSignals, activeProjectIds),
    recoveryActions: filterProjectScopedRecords(state.recoveryActions, activeProjectIds),
    reviews: filterProjectScopedRecords(state.reviews, activeProjectIds),
    tasks: filterProjectScopedRecords(state.tasks, activeProjectIds),
    runs: filterProjectScopedRecords(state.runs, activeProjectIds),
  };
}

function filterProjectScopedRecords<T extends { projectId: string }>(
  records: T[],
  activeProjectIds: Set<string>,
) {
  return records.filter((record) => activeProjectIds.has(record.projectId));
}

function filterSourceProjectScopedRecords<T extends { sourceProjectId: string }>(
  records: T[],
  activeProjectIds: Set<string>,
) {
  return records.filter((record) => activeProjectIds.has(record.sourceProjectId));
}

function normalizeFeishuChatSessionId(value: string | null | undefined) {
  if (typeof value !== "string") {
    return null;
  }

  const normalized = value.trim();
  return normalized.length > 0 ? normalized : null;
}

function stripLegacyProjectRoomFields(
  room: ProjectRoomRecord & {
    sourceConversationId?: string | null;
    sourceConversationTitle?: string | null;
  },
) {
  const {
    sourceConversationId,
    sourceConversationTitle,
    ...nextRoom
  } = room;

  void sourceConversationId;
  void sourceConversationTitle;

  return nextRoom;
}

function finalizeProjectRun(
  state: ProjectStoreState,
  input: {
    projectId: string;
    goal: string;
    now: string;
    latestRunId: string | null;
    approvalNote: string | null;
  },
) {
  const runSummary = buildRunSummary(input.goal, input.approvalNote);
  settleProjectReviews(state, {
    projectId: input.projectId,
    status: "approved",
    updatedAt: input.now,
    blockingComments: input.approvalNote,
  });
  settleOpenProjectTasks(state, {
    projectId: input.projectId,
    now: input.now,
    nextStatus: "completed",
  });
  settleProjectMailboxThreads(state, {
    projectId: input.projectId,
    updatedAt: input.now,
  });
  const room = state.rooms.find((item) => item.id === input.projectId) ?? null;
  const teamConversationId = room ? ensureTeamConversation(state, room) : null;

  state.rooms = state.rooms.map((item) =>
    item.id === input.projectId
        ? {
          ...item,
          runStatus: "completed",
          currentStageLabel: "阶段收束",
          activeAgentId: state.agents.find((agent) => agent.projectId === input.projectId && agent.canDelegate)?.id ?? null,
          nextAgentId: null,
          summary: input.approvalNote
            ? "团队已按你的确认意见完成本轮协作，并把补充要求合并进最终结论。"
            : "团队已完成这一轮协作，项目经理已完成收口，当前结果已沉淀为最终结论。",
          lastActivityLabel: "刚刚完成一轮运行",
          updatedAt: input.now,
        }
      : item,
  );

  state.agents = state.agents.map((agent) => {
    if (agent.projectId !== input.projectId) {
      return agent;
    }

    if (agent.canDelegate) {
      return { ...agent, status: "reviewing", currentTaskId: null, blockedByAgentId: null };
    }

    if (agent.visibility === "backstage") {
      return { ...agent, status: "idle", currentTaskId: null, blockedByAgentId: null };
    }

    return { ...agent, status: "reviewing", currentTaskId: null, blockedByAgentId: null };
  });

  if (input.latestRunId) {
    state.runs = state.runs.map((run) =>
      run.id === input.latestRunId
        ? {
            ...run,
            status: "completed",
            summary: runSummary,
            currentStepLabel: "本轮已完成",
            finishedAt: input.now,
          }
        : run,
    );
  }

  state.events = [
    {
      id: `${input.projectId}-event-run-complete-${crypto.randomUUID()}`,
      projectId: input.projectId,
      actorName: "Team Lead",
      title: "已完成一轮团队运行",
      description: runSummary,
      visibility: "frontstage",
      createdAt: input.now,
    },
    {
      id: `${input.projectId}-event-run-complete-backstage-${crypto.randomUUID()}`,
      projectId: input.projectId,
      actorName: "项目经理",
      title: "已完成最终整理",
      description: input.approvalNote
        ? "项目经理已把你的确认意见一起合并进最终结论。"
        : "项目经理已将本轮阶段结果整理为最终结论并完成收尾。",
      visibility: "backstage",
      createdAt: input.now,
    },
    ...state.events,
  ];

  state.artifacts = upsertArtifactsAfterRun(state.artifacts, {
    projectId: input.projectId,
    summary: runSummary,
    updatedAt: input.now,
    phase: "completed",
  });
  syncProjectArtifactCount(state, input.projectId);
  if (teamConversationId) {
    appendTeamConversationMessages(teamConversationId, [
      input.approvalNote
        ? {
            role: "user" as const,
            content: input.approvalNote,
          }
        : {
            role: "user" as const,
            content: "确认完成这轮输出。",
          },
      {
        actorLabel: findProjectActorLabel(state, input.projectId, "lead"),
        content: "收到，我已经把这一轮结果整理为最终结论并完成收尾。后续如果有新目标或补充，我们可以继续在这个 Team Room 上启动下一轮。",
      },
    ]);
  }
  writeState(state);

  return getProjectDetail(input.projectId);
}

function buildRunSummary(goal: string, approvalNote: string | null = null) {
  if (approvalNote) {
    return `围绕“${goal}”，团队已结合你的确认意见“${approvalNote}”完成本轮协作，并更新了执行摘要与下一步建议。`;
  }

  return `围绕“${goal}”，项目经理已完成这一轮协作收口，当前产出包括阶段结论、成员执行结果摘要和下一步建议。`;
}

function buildRunStartSummary(goal: string, triggerPrompt: string | null) {
  if (!triggerPrompt) {
    return `围绕“${goal}”，项目经理已启动团队协作，正在拆解任务并安排第一阶段成员接力。`;
  }

  const normalizedPrompt = triggerPrompt.replace(/\s+/g, " ").trim();
  const compactPrompt =
    normalizedPrompt.length > 48 ? `${normalizedPrompt.slice(0, 45)}...` : normalizedPrompt;

  return `围绕“${goal}”，团队已按“${compactPrompt}”启动自动推进，项目经理正在根据当前目标安排第一阶段接力。`;
}

function stripTrailingSentencePunctuation(value: string) {
  return value.replace(/[。.!?！？]+$/u, "");
}

function buildProjectDisplayTitle(input: { goal: string; fallback: string }) {
  const normalizedGoal = stripTrailingSentencePunctuation(
    input.goal.replace(/\s+/g, " ").trim(),
  );

  if (!normalizedGoal) {
    return input.fallback;
  }

  const topicLabel = resolveProjectTopicLabel(normalizedGoal);
  const intentLabel = resolveProjectIntentLabel(normalizedGoal);

  if (topicLabel && intentLabel && !topicLabel.includes(intentLabel)) {
    return `${topicLabel}${intentLabel}`.slice(0, 16);
  }

  if (topicLabel) {
    return topicLabel.slice(0, 16);
  }

  const cleaned = normalizedGoal
    .replace(/^[\d.\-、\s]+/u, "")
    .replace(/^(请|帮我|麻烦|需要|我想|想要|希望|先|继续|围绕|关于|针对|为|给|把|将|对)\s*/u, "")
    .replace(/^(开发|设计|搭建|实现|优化|重构|整理|规划|推进|制作)(一个|一版|一套|一个新的)?/u, "")
    .replace(/^(OpenCrab|opencrab)\s*/u, "OpenCrab ")
    .replace(/[，。；：,.!?！？].*$/u, "")
    .trim();
  const compact = stripTrailingSentencePunctuation(cleaned).slice(0, 14);

  return compact || input.fallback;
}

function buildProjectTeamName(title: string) {
  const normalizedTitle = title.trim() || "新团队";

  if (/(工作组|小组|团队)$/u.test(normalizedTitle)) {
    return normalizedTitle;
  }

  return `${normalizedTitle}工作组`;
}

function resolveProjectTopicLabel(goal: string) {
  const topicMatchers = [
    { pattern: /(官网|官方网站|官方站|landing\s?page)/iu, label: "官网建设" },
    { pattern: /(team mode|团队模式)/iu, label: "Team 模式" },
    { pattern: /(智能体|agent)/iu, label: "智能体协作" },
    { pattern: /(渠道|telegram|tg|飞书|feishu)/iu, label: "渠道接入" },
    { pattern: /(文档|说明|docs?)/iu, label: "文档整理" },
    { pattern: /(runtime|编排|调度|工作流|协作流)/iu, label: "运行编排" },
    { pattern: /(前端|页面|界面|ui|交互)/iu, label: "界面体验" },
    { pattern: /(重构|架构)/iu, label: "架构重构" },
  ];

  return topicMatchers.find((item) => item.pattern.test(goal))?.label ?? null;
}

function resolveProjectIntentLabel(goal: string) {
  const intentMatchers = [
    { pattern: /(优化|改进|提升|增强)/iu, label: "优化" },
    { pattern: /(设计|方案|规划|梳理)/iu, label: "设计" },
    { pattern: /(开发|实现|搭建|构建)/iu, label: "开发" },
    { pattern: /(重构|整理|收敛)/iu, label: "重构" },
    { pattern: /(验证|测试|验收|review)/iu, label: "验证" },
  ];

  return intentMatchers.find((item) => item.pattern.test(goal))?.label ?? null;
}

function upsertArtifactsAfterRun(
  currentArtifacts: ProjectArtifactRecord[],
  input: {
    projectId: string;
    summary: string;
    updatedAt: string;
    phase: "running" | "waiting_user" | "waiting_approval" | "completed";
  },
) {
  let hasExecutionSummary = false;

  const nextArtifacts = currentArtifacts.map((artifact) => {
    if (artifact.projectId !== input.projectId) {
      return artifact;
    }

    if (artifact.title === "执行摘要") {
      hasExecutionSummary = true;

      return {
        ...artifact,
        status: input.phase === "completed" ? ("ready" as const) : ("draft" as const),
        summary: input.summary,
        sourceTaskId: artifact.sourceTaskId ?? null,
        sourceTaskTitle: artifact.sourceTaskTitle ?? null,
        ownerAgentId: artifact.ownerAgentId ?? null,
        ownerAgentName: artifact.ownerAgentName ?? null,
        reviewStatus: artifact.reviewStatus ?? null,
        reviewerAgentId: artifact.reviewerAgentId ?? null,
        reviewerAgentName: artifact.reviewerAgentName ?? null,
        dependsOnArtifactIds: artifact.dependsOnArtifactIds ?? [],
        consumedByTaskIds: artifact.consumedByTaskIds ?? [],
        updatedAt: input.updatedAt,
      };
    }

    if (artifact.title === "下一阶段实现清单") {
      return {
        ...artifact,
        status: input.phase === "completed" ? ("ready" as const) : artifact.status,
        summary:
          input.phase === "completed"
            ? "下一步建议：把 TeamRun 运行态和任务触发闭环接到真实多 Agent 编排器上。"
            : artifact.summary,
        sourceTaskId: artifact.sourceTaskId ?? null,
        sourceTaskTitle: artifact.sourceTaskTitle ?? null,
        ownerAgentId: artifact.ownerAgentId ?? null,
        ownerAgentName: artifact.ownerAgentName ?? null,
        reviewStatus: artifact.reviewStatus ?? null,
        reviewerAgentId: artifact.reviewerAgentId ?? null,
        reviewerAgentName: artifact.reviewerAgentName ?? null,
        dependsOnArtifactIds: artifact.dependsOnArtifactIds ?? [],
        consumedByTaskIds: artifact.consumedByTaskIds ?? [],
        updatedAt: input.updatedAt,
      };
    }

    return artifact;
  });

  if (!hasExecutionSummary) {
    nextArtifacts.unshift({
      id: `${input.projectId}-artifact-run-${crypto.randomUUID()}`,
      projectId: input.projectId,
      title: "执行摘要",
      typeLabel: "Summary",
      summary: input.summary,
      status: input.phase === "completed" ? "ready" : "draft",
      sourceTaskId: null,
      sourceTaskTitle: null,
      ownerAgentId: null,
      ownerAgentName: null,
      reviewStatus: null,
      reviewerAgentId: null,
      reviewerAgentName: null,
      dependsOnArtifactIds: [],
      consumedByTaskIds: [],
      updatedAt: input.updatedAt,
    });
  }

  return nextArtifacts;
}

function upsertTaskResultArtifact(
  currentArtifacts: ProjectArtifactRecord[],
  input: {
    projectId: string;
    taskId: string;
    taskTitle: string;
    sourceTaskTitle?: string;
    ownerName: string;
    ownerAgentId?: string | null;
    summary: string;
    updatedAt: string;
  },
) {
  const artifactTitle = `${input.ownerName} · ${stripTrailingSentencePunctuation(input.taskTitle)}`;
  const existingArtifact =
    currentArtifacts.find(
      (artifact) => artifact.projectId === input.projectId && artifact.title === artifactTitle,
    ) ?? null;

  if (existingArtifact) {
    return {
      artifacts: currentArtifacts.map((artifact) =>
        artifact.id === existingArtifact.id
          ? {
              ...artifact,
              typeLabel: "Task Result",
              summary: compactConversationExcerpt(input.summary, 220),
              status: "ready" as const,
              sourceTaskId: input.taskId,
              sourceTaskTitle: input.sourceTaskTitle ?? input.taskTitle,
              ownerAgentId: input.ownerAgentId ?? null,
              ownerAgentName: input.ownerName,
              updatedAt: input.updatedAt,
            }
          : artifact,
      ),
      artifactId: existingArtifact.id,
    };
  }

  const artifactId = `${input.projectId}-artifact-task-${crypto.randomUUID()}`;

  return {
    artifacts: [
      {
        id: artifactId,
        projectId: input.projectId,
        title: artifactTitle,
        typeLabel: "Task Result",
        summary: compactConversationExcerpt(input.summary, 220),
        status: "ready" as const,
        sourceTaskId: input.taskId,
        sourceTaskTitle: input.sourceTaskTitle ?? input.taskTitle,
        ownerAgentId: input.ownerAgentId ?? null,
        ownerAgentName: input.ownerName,
        reviewStatus: null,
        reviewerAgentId: null,
        reviewerAgentName: null,
        dependsOnArtifactIds: [],
        consumedByTaskIds: [],
        updatedAt: input.updatedAt,
      },
      ...currentArtifacts,
    ],
    artifactId,
  };
}

function upsertCheckpointArtifact(
  currentArtifacts: ProjectArtifactRecord[],
  input: {
    projectId: string;
    decision: "waiting_user" | "waiting_approval";
    summary: string;
    updatedAt: string;
    sourceTaskId?: string | null;
    sourceTaskTitle?: string | null;
    ownerAgentId?: string | null;
    ownerAgentName?: string | null;
  },
) {
  const artifactTitle = input.decision === "waiting_approval" ? "阶段总结" : "待补充事项";
  const existingArtifact =
    currentArtifacts.find(
      (artifact) => artifact.projectId === input.projectId && artifact.title === artifactTitle,
    ) ?? null;

  if (existingArtifact) {
    return {
      artifacts: currentArtifacts.map((artifact) =>
        artifact.id === existingArtifact.id
          ? {
              ...artifact,
              typeLabel: input.decision === "waiting_approval" ? "Checkpoint" : "Input",
              summary: compactConversationExcerpt(input.summary, 220),
              status: input.decision === "waiting_approval" ? ("ready" as const) : ("draft" as const),
              sourceTaskId: input.sourceTaskId ?? artifact.sourceTaskId ?? null,
              sourceTaskTitle: input.sourceTaskTitle ?? artifact.sourceTaskTitle ?? null,
              ownerAgentId: input.ownerAgentId ?? artifact.ownerAgentId ?? null,
              ownerAgentName: input.ownerAgentName ?? artifact.ownerAgentName ?? null,
              updatedAt: input.updatedAt,
            }
          : artifact,
      ),
      artifactId: existingArtifact.id,
    };
  }

  const artifactId = `${input.projectId}-artifact-checkpoint-${crypto.randomUUID()}`;

  return {
    artifacts: [
      {
        id: artifactId,
        projectId: input.projectId,
        title: artifactTitle,
        typeLabel: input.decision === "waiting_approval" ? "Checkpoint" : "Input",
        summary: compactConversationExcerpt(input.summary, 220),
        status: input.decision === "waiting_approval" ? ("ready" as const) : ("draft" as const),
        sourceTaskId: input.sourceTaskId ?? null,
        sourceTaskTitle: input.sourceTaskTitle ?? null,
        ownerAgentId: input.ownerAgentId ?? null,
        ownerAgentName: input.ownerAgentName ?? null,
        reviewStatus: null,
        reviewerAgentId: null,
        reviewerAgentName: null,
        dependsOnArtifactIds: [],
        consumedByTaskIds: [],
        updatedAt: input.updatedAt,
      },
      ...currentArtifacts,
    ],
    artifactId,
  };
}
