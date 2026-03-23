import { existsSync, mkdirSync } from "node:fs";
import path from "node:path";
import { getAgentProfile, getSuggestedTeamAgents } from "@/lib/agents/agent-store";
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
import { createSyncJsonFileStore } from "@/lib/infrastructure/json-store/sync-json-file-store";
import type {
  ProjectAgentRecord,
  ProjectArtifactRecord,
  ProjectCheckpointAction,
  ProjectDetail,
  ProjectEventRecord,
  ProjectRoomRecord,
  ProjectStoreState,
} from "@/lib/projects/types";

const STORE_PATH = OPENCRAB_PROJECTS_STORE_PATH;
const store = createSyncJsonFileStore<ProjectStoreState>({
  filePath: STORE_PATH,
  seed: createInitialState,
  normalize: normalizeProjectStoreState,
});

declare global {
  var __opencrabProjectRuntimeQueues: Map<string, Promise<void>> | undefined;
}

export function listProjects() {
  return readState().rooms.map((room) => structuredClone(room));
}

export function getProjectDetail(projectId: string): ProjectDetail | null {
  const state = readState();
  const room = state.rooms.find((item) => item.id === projectId) ?? null;

  if (!room) {
    return null;
  }

  const snapshot = getSnapshot();
  const sourceConversation = room.sourceConversationId
    ? snapshot.conversations.find((item) => item.id === room.sourceConversationId) ?? null
    : null;
  const sourceMessages =
    room.sourceConversationId && snapshot.conversationMessages[room.sourceConversationId]
      ? structuredClone(snapshot.conversationMessages[room.sourceConversationId])
      : [];

  return {
    project: structuredClone(room),
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
    runs: state.runs
      .filter((item) => item.projectId === projectId)
      .sort((left, right) => Date.parse(right.startedAt) - Date.parse(left.startedAt))
      .map((item) => structuredClone(item)),
    sourceConversation,
    sourceMessages,
  };
}

export function createProjectFromConversation(conversationId: string) {
  const state = readState();
  const existing = state.rooms.find((item) => item.sourceConversationId === conversationId);

  if (existing) {
    return getProjectDetail(existing.id);
  }

  const snapshot = getSnapshot();
  const sourceConversation =
    snapshot.conversations.find((item) => item.id === conversationId) ?? null;

  if (!sourceConversation) {
    const error = new Error("原始对话不存在，暂时无法升级为团队模式。");
    (error as Error & { statusCode?: number }).statusCode = 404;
    throw error;
  }

  const sourceMessages = snapshot.conversationMessages[conversationId] ?? [];
  const latestUserMessage =
    [...sourceMessages].reverse().find((message) => message.role === "user")?.content?.trim() ||
    sourceConversation.preview ||
    sourceConversation.title;
  const now = new Date().toISOString();
  const projectId = `project-${crypto.randomUUID()}`;
  const room = buildRoom({
    projectId,
    conversationId,
    title: sourceConversation.title,
    latestUserMessage,
    leadAgentProfileId: sourceConversation.agentProfileId ?? null,
    model: snapshot.settings.defaultModel,
    reasoningEffort: snapshot.settings.defaultReasoningEffort,
    sandboxMode: snapshot.settings.defaultSandboxMode,
    createdAt: now,
  });

  state.rooms = [room.room, ...state.rooms];
  state.agents = [...room.agents, ...state.agents];
  state.events = [...room.events, ...state.events];
  state.artifacts = [...room.artifacts, ...state.artifacts];
  writeState(state);

  return getProjectDetail(projectId);
}

export function createProject(input: { goal: string; workspaceDir: string; agentProfileIds: string[] }) {
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
      teamRole: detail.teamRole,
      defaultModel: detail.defaultModel,
      defaultReasoningEffort: detail.defaultReasoningEffort,
      defaultSandboxMode: detail.defaultSandboxMode,
    };
  });

  const snapshot = getSnapshot();
  const now = new Date().toISOString();
  const projectId = `project-${crypto.randomUUID()}`;
  const room = buildManualRoom({
    projectId,
    goal,
    workspaceDir,
    profiles: selectedProfiles,
    model: snapshot.settings.defaultModel,
    reasoningEffort: snapshot.settings.defaultReasoningEffort,
    sandboxMode: snapshot.settings.defaultSandboxMode,
    createdAt: now,
  });
  const state = readState();

  state.rooms = [room.room, ...state.rooms];
  state.agents = [...room.agents, ...state.agents];
  state.events = [...room.events, ...state.events];
  state.artifacts = [...room.artifacts, ...state.artifacts];
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
    deleteConversation(conversationId);
  });

  globalThis.__opencrabProjectRuntimeQueues?.delete(projectId);

  state.rooms = state.rooms.filter((item) => item.id !== projectId);
  state.agents = state.agents.filter((item) => item.projectId !== projectId);
  state.events = state.events.filter((item) => item.projectId !== projectId);
  state.artifacts = state.artifacts.filter((item) => item.projectId !== projectId);
  state.runs = state.runs.filter((item) => item.projectId !== projectId);
  writeState(state);

  return true;
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
  const prompt = buildManagerPlanningPrompt(room, otherAgents, content, recentMessages);
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
  const plan = parseManagerPlan(result.assistant.text, otherAgents);

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
  content: string,
  recentMessages: RuntimeConversationMessage[],
) {
  const memberLines = otherAgents
    .map((agent) => `- ${agent.name}: ${compactAgentResponsibility(agent)}`)
    .join("\n");
  const messageLines = buildRuntimeRecentMessageLines(recentMessages, {
    limit: 5,
    maxLength: 180,
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
      "task": "分配给这个成员的具体任务，必须可执行、不可空泛"
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
10. 不要编造不存在的成员名字。`;
}

function parseManagerPlan(text: string, agents: ProjectAgentRecord[]): RuntimeManagerPlan {
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

          const candidate = item as { agentName?: unknown; task?: unknown };
          const agentName = typeof candidate.agentName === "string" ? candidate.agentName.trim() : "";
          const task = typeof candidate.task === "string" ? candidate.task.trim() : "";

          if (!agentName || !task || !validAgentNames.has(agentName) || seenAgentNames.has(agentName)) {
            return null;
          }

          seenAgentNames.add(agentName);

          return {
            agentName,
            task,
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

  updateProjectAgent(state, agent.id, {
    status: "working",
    lastAssignedTask: task,
    progressLabel: "准备开始执行",
    progressDetails: `已接到新任务：${compactConversationExcerpt(task, 120)}`,
    lastHeartbeatAt: new Date().toISOString(),
    progressTrail: appendAgentProgressTrail(agent.progressTrail, {
      label: "准备开始执行",
      detail: `已接到新任务：${compactConversationExcerpt(task, 120)}`,
    }),
  });
  writeState(state);

  const prompt = buildWorkerExecutionPrompt(room, agent, task, recentMessages);
  const result = await runConversationTurn({
    conversationId: runtimeConversationId,
    content: prompt,
    model: agent.model,
    reasoningEffort: agent.reasoningEffort,
    sandboxMode: agent.sandboxMode,
    onThreadReady: () => {
      const nextState = readState();
      updateAgentPublicProgress(nextState, agent.id, {
        label: "已接入运行时",
        detail: "已经拿到新的 runtime 会话，开始读取上下文和当前这棒任务。",
      });
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
      writeState(nextState);
    },
    onAssistantText: (text) => {
      const nextState = readState();
      updateAgentPublicProgress(nextState, agent.id, summarizeAssistantDraftProgress(text, {
        fallbackLabel: "正在整理阶段结果",
        fallbackDetail: "已经进入产出阶段，正在把当前这棒的结果整理成可交付说明。",
      }));
      writeState(nextState);
    },
  });
  const replyText = result.assistant.text.trim();
  syncMutableProjectState(state, readState());
  const latestState = readState();
  const latestAgent = latestState.agents.find((item) => item.id === agent.id) ?? null;

  if (latestAgent?.runtimeConversationId !== runtimeConversationId) {
    throw new ProjectRuntimeReplacedError();
  }

  updateProjectAgent(state, agent.id, {
    status: "reviewing",
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
  writeState(state);

  return replyText;
}

function syncMutableProjectState(target: ProjectStoreState, source: ProjectStoreState) {
  target.rooms = source.rooms;
  target.agents = source.agents;
  target.events = source.events;
  target.artifacts = source.artifacts;
  target.runs = source.runs;
}

function buildWorkerExecutionPrompt(
  room: ProjectRoomRecord,
  agent: ProjectAgentRecord,
  task: string,
  recentMessages: RuntimeConversationMessage[],
) {
  const messageLines = buildRuntimeRecentMessageLines(recentMessages, {
    limit: 5,
    maxLength: 180,
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

项目经理分配给你的任务：
${task}

输出要求：
1. 直接给出这项子任务的第一版结果。
2. 优先提供具体判断、方案、步骤、结构或内容，而不是承诺。
3. 如果信息不够，也先给最有价值的初版，并明确缺口。
4. 不要说“收到”“我会先”“稍后回传”这类过程性空话。`;
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
      return agent.runtimeConversationId;
    }

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
    updateProjectAgent(state, agent.id, {
      runtimeConversationId: existing.id,
    });
    writeState(state);
    return existing.id;
  }

  const created = createConversation({
    title: `${room.teamName} · ${agent.name} runtime`,
    hidden: true,
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
) {
  const ordered: Array<{ agentName: string; task: string }> = [];
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
  delegations: Array<{
    agentName: string;
    task: string;
  }>;
  recentMessages: RuntimeConversationMessage[];
}) {
  let recentMessages = [...input.recentMessages];
  let pendingDelegations = [...input.delegations];
  let cycleCount = 0;

  while (pendingDelegations.length > 0 && cycleCount < 4) {
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

    if (cycleCount >= 4) {
      const state = readState();
      const room = state.rooms.find((item) => item.id === input.projectId) ?? null;
      const manager =
        state.agents.find((agent) => agent.projectId === input.projectId && agent.agentProfileId === "project-manager") ||
        state.agents.find((agent) => agent.projectId === input.projectId && agent.canDelegate) ||
        null;

      if (!isProjectRuntimePaused(room) && manager) {
        const now = new Date().toISOString();
        appendTeamConversationMessages(input.conversationId, [
          {
            actorLabel: manager.name,
            content:
              "这一轮我先收口到这里。当前已经拿到了连续几步成员结果，我先整理成阶段结论，等你确认是否结束，或告诉我还要继续补什么。",
          },
        ]);
        applyProjectManagerCheckpoint(state, {
          projectId: input.projectId,
          managerId: manager.id,
          decision: "waiting_approval",
          summary:
            "项目经理已在多轮连续协作后完成阶段收束，当前已有可交付结果，等待用户确认是否结束或提出新的补充方向。",
          now,
        });
        writeState(state);
      }
      return;
    }

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

  if (activeAgent.runtimeConversationId) {
    deleteConversation(activeAgent.runtimeConversationId);
  }

  const now = new Date().toISOString();
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
      detail: "当前成员还没有可用的 runtime 会话记录。",
    };
  }

  const snapshot = getSnapshot();
  const conversation =
    snapshot.conversations.find((item) => item.id === agent.runtimeConversationId) ?? null;
  const messages = snapshot.conversationMessages[agent.runtimeConversationId] ?? [];
  const lastMessage = messages[messages.length - 1] ?? null;
  const hasAssistantReply = messages.some((message) => message.role === "assistant");
  const lastTimestamp = lastMessage?.timestamp ?? null;
  const ageMs = lastTimestamp ? Date.now() - Date.parse(lastTimestamp) : Number.POSITIVE_INFINITY;
  const isLikelyStalled =
    agent.status === "working" &&
    (!conversation?.codexThreadId || !hasAssistantReply) &&
    ageMs > 5 * 60 * 1000;

  if (isLikelyStalled) {
    return {
      status: "stalled" as const,
      detail: conversation?.codexThreadId
        ? "runtime 会话已经创建，但超过 5 分钟都没有新的成员结果写回。"
        : "runtime 会话里只有任务下发，没有拿到有效 thread 回传或成员输出。",
    };
  }

  return {
    status: "running" as const,
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
  const delegatedAgents = input.delegations
    .map((delegation) => projectAgents.find((agent) => agent.name === delegation.agentName) ?? null)
    .filter(Boolean) as ProjectAgentRecord[];
  const primaryAgent = delegatedAgents[0] ?? null;
  const secondaryAgent = delegatedAgents[1] ?? null;
  const primaryDelegation = input.delegations[0] ?? null;

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
        blockedByAgentId: null,
        progressLabel: input.delegations.length > 0 ? "已完成本轮派工" : agent.progressLabel ?? null,
        progressDetails:
          input.delegations.length > 0
            ? `当前先由 ${delegatedAgents.map((item) => item.name).join("、")} 接力推进，项目经理会等结果回来后继续判断。`
            : agent.progressDetails ?? null,
        lastHeartbeatAt: new Date().toISOString(),
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

    if (delegationIndex === 0) {
      return {
        ...agent,
        status: "working",
        blockedByAgentId: null,
        lastAssignedTask: input.delegations[delegationIndex]?.task || agent.lastAssignedTask || null,
        progressLabel: "等待开始执行",
        progressDetails: `项目经理已把当前这棒交给他：${compactConversationExcerpt(
          input.delegations[delegationIndex]?.task || agent.lastAssignedTask || "当前任务待同步。",
          120,
        )}`,
        lastHeartbeatAt: new Date().toISOString(),
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
        lastAssignedTask: input.delegations[delegationIndex]?.task || agent.lastAssignedTask || null,
        progressLabel: "等待上游结果",
        progressDetails: `这位成员已经在接力链上，但需要等 ${
          delegatedAgents[delegationIndex - 1]?.name || primaryAgent?.name || "上游成员"
        } 先交回结果后才会真正开工。`,
        lastHeartbeatAt: new Date().toISOString(),
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
      progressLabel: agent.lastResultSummary ? "已交回阶段结果" : "尚未上场",
      progressDetails: agent.lastResultSummary
        ? compactConversationExcerpt(agent.lastResultSummary, 120)
        : primaryAgent
          ? `当前不在这轮接力链里，项目经理会先观察 ${primaryAgent.name} 这棒的结果。`
          : "当前还没有进入这轮接力链。",
      lastHeartbeatAt: agent.lastHeartbeatAt ?? new Date().toISOString(),
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
    const pendingDelegations = collectPendingDelegationsForResume(projectAgents, manager.id, room);
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

  state.agents = state.agents.map((agent) =>
    agent.projectId === projectId
      ? {
          ...agent,
          status: agent.canDelegate ? "planning" : "idle",
          blockedByAgentId: null,
        }
      : agent,
  );

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

  if (input.action === "pause") {
    if (room.runStatus !== "running") {
      throw new Error("当前团队没有在运行中，暂时不需要暂停。");
    }

    const manager =
      state.agents.find((agent) => agent.projectId === projectId && agent.agentProfileId === "project-manager") ||
      state.agents.find((agent) => agent.projectId === projectId && agent.canDelegate) ||
      null;
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

  if (input.action === "approve") {
    if (room.runStatus !== "waiting_approval") {
      throw new Error("当前团队状态不需要确认，暂时无法直接完成。");
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

    state.rooms = state.rooms.map((item) =>
      item.id === projectId
        ? {
            ...item,
            runStatus: "waiting_user",
            currentStageLabel: "等待你补充",
            activeAgentId:
              state.agents.find((agent) => agent.projectId === projectId && agent.canDelegate)?.id ?? null,
            nextAgentId: null,
            summary: `已记录你的补充方向：${normalizedNote}。团队会等待你确认后再继续推进。`,
            latestUserRequest: note,
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

      return { ...agent, status: "idle", blockedByAgentId: null };
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
        title: "已记录新的用户补充",
        description: "Lead 已暂停当前收尾流程，等待用户确认后按新方向重启团队协作。",
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

  state.rooms = state.rooms.map((item) =>
    item.id === projectId
      ? {
          ...item,
          runStatus: "ready",
          latestUserRequest: nextPrompt,
          summary: "已记录新的补充方向，准备带着这次更新重新推进团队协作。",
          lastActivityLabel: "准备继续推进",
          updatedAt: now,
        }
      : item,
  );

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

function buildRoom(input: {
  projectId: string;
  conversationId: string;
  title: string;
  latestUserMessage: string;
  leadAgentProfileId: string | null;
  model: string;
  reasoningEffort: ProjectAgentRecord["reasoningEffort"];
  sandboxMode: ProjectAgentRecord["sandboxMode"];
  createdAt: string;
}) {
  const teamProfiles = getSuggestedTeamAgents(input.leadAgentProfileId);
  const normalizedAgents = buildTeamAgents({
    projectId: input.projectId,
    profiles: teamProfiles,
    defaultModel: input.model,
    defaultReasoningEffort: input.reasoningEffort,
    defaultSandboxMode: input.sandboxMode,
  });
  const projectTitle = buildProjectDisplayTitle({
    goal: input.latestUserMessage,
    fallback: input.title,
  });
  const teamName = buildProjectTeamName(projectTitle);
  const room: ProjectRoomRecord = {
    id: input.projectId,
    title: projectTitle,
    teamName,
    goal: input.latestUserMessage,
    workspaceDir: null,
    teamConversationId: null,
    summary: "当前以“先把需求拆清楚，再让成员分头推进”的协作方式启动。",
    status: "active",
    runStatus: "ready",
    sourceConversationId: input.conversationId,
    sourceConversationTitle: input.title,
    latestUserRequest: input.latestUserMessage,
    currentStageLabel: "待启动",
    activeAgentId: null,
    nextAgentId: null,
    memberCount: normalizedAgents.length,
    artifactCount: 3,
    lastActivityLabel: "刚刚升级",
    createdAt: input.createdAt,
    updatedAt: input.createdAt,
  };
  const agents = normalizedAgents;

  const events: ProjectEventRecord[] = [
    {
      id: `${input.projectId}-event-1`,
      projectId: input.projectId,
      actorName: "OpenCrab PM",
      title: "已接收团队目标",
      description: "把当前对话里的最新需求识别为项目 brief，并准备拆解执行计划。",
      visibility: "frontstage",
      createdAt: input.createdAt,
    },
    {
      id: `${input.projectId}-event-2`,
      projectId: input.projectId,
      actorName: "OpenCrab PM",
      title: "正在组织成员分工",
      description: "优先把需求拆成研究、汇总和对外表达三块，以避免前台对话过吵。",
      visibility: "backstage",
      createdAt: input.createdAt,
    },
    {
      id: `${input.projectId}-event-3`,
      projectId: input.projectId,
      actorName: "Writer",
      title: "已准备 frontstage 输出位",
      description: "后续会把总结、关键提问和最终结论优先放在主对话层展示。",
      visibility: "backstage",
      createdAt: input.createdAt,
    },
  ];

  const artifacts: ProjectArtifactRecord[] = [
    {
      id: `${input.projectId}-artifact-1`,
      projectId: input.projectId,
      title: "项目简报",
      typeLabel: "Brief",
      summary: input.latestUserMessage,
      status: "ready",
      updatedAt: input.createdAt,
    },
    {
      id: `${input.projectId}-artifact-2`,
      projectId: input.projectId,
      title: "成员分工草案",
      typeLabel: "Plan",
      summary: `已从智能体库装配 ${agents.map((agent) => agent.name).join("、")} 三位成员，先按轻量团队推进。`,
      status: "draft",
      updatedAt: input.createdAt,
    },
    {
      id: `${input.projectId}-artifact-3`,
      projectId: input.projectId,
      title: "Runtime 协作方式",
      typeLabel: "Runtime",
      summary:
        "团队会以前台群聊为协作入口，由项目经理负责分工，并把后台成员 runtime 的结果逐步回流到 Team Room。",
      status: "ready",
      updatedAt: input.createdAt,
    },
  ];

  return {
    room,
    agents,
    events,
    artifacts,
  };
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
    teamConversationId: null,
    summary: `围绕“${stripTrailingSentencePunctuation(shortLabel)}”启动的新团队，已装配 ${normalizedAgents.length} 位智能体，默认产出目录已设置完成。`,
    status: "active",
    runStatus: "ready",
    sourceConversationId: null,
    sourceConversationTitle: null,
    latestUserRequest: input.goal,
    currentStageLabel: "待启动",
    activeAgentId: null,
    nextAgentId: null,
    memberCount: normalizedAgents.length,
    artifactCount: 3,
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
      updatedAt: input.createdAt,
    },
    {
      id: `${input.projectId}-artifact-2`,
      projectId: input.projectId,
      title: "成员清单",
      typeLabel: "Roster",
      summary: normalizedAgents.map((agent) => `${agent.name} · ${agent.role}`).join(" / "),
      status: "ready",
      updatedAt: input.createdAt,
    },
    {
      id: `${input.projectId}-artifact-3`,
      projectId: input.projectId,
      title: "首轮计划",
      typeLabel: "Plan",
      summary: `团队已完成初始化，后续产出默认沉淀到 ${input.workspaceDir}。`,
      status: "draft",
      updatedAt: input.createdAt,
    },
  ];

  return {
    room,
    agents: normalizedAgents,
    events,
    artifacts,
  };
}

function buildTeamAgents(input: {
  projectId: string;
  profiles: Array<{ id: string; name: string; summary: string; teamRole: string; defaultModel: string | null; defaultReasoningEffort: ProjectAgentRecord["reasoningEffort"] | null; defaultSandboxMode: ProjectAgentRecord["sandboxMode"] | null }>;
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
      model: detail?.defaultModel || profile.defaultModel || input.defaultModel,
      reasoningEffort:
        detail?.defaultReasoningEffort ||
        profile.defaultReasoningEffort ||
        input.defaultReasoningEffort,
      sandboxMode:
        detail?.defaultSandboxMode || profile.defaultSandboxMode || input.defaultSandboxMode,
      canDelegate: isLead,
    } satisfies ProjectAgentRecord;
  });
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
      sandboxMode: "workspace-write",
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
      sandboxMode: "read-only",
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
      const detail = agent.agentProfileId ? getAgentProfile(agent.agentProfileId) : null;
      const isLead = agent.id === managerId;
      const storedTeamRole = inferStoredTeamRole(agent, detail?.teamRole || null);
      const teamRole = isLead ? "lead" : normalizeNonManagerTeamRole(storedTeamRole);
      const visibility = resolveVisibility(teamRole, isLead);

      return {
        ...agent,
        role: formatProjectRoleLabel(teamRole, isLead),
        visibility,
        runtimeConversationId: agent.runtimeConversationId ?? null,
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

function normalizeProjectWorkspaceDir(value: string) {
  const raw = value.trim();

  if (!raw) {
    throw new Error("请先指定这个团队的工作空间目录。");
  }

  const resolved = path.resolve(process.cwd(), raw);

  if (!existsSync(resolved)) {
    mkdirSync(resolved, { recursive: true });
  }

  return resolved;
}

function ensureProjectManagerAgentId(agentIds: string[]) {
  return agentIds.includes("project-manager") ? agentIds : ["project-manager", ...agentIds];
}

function ensureTeamConversation(state: ProjectStoreState, room: ProjectRoomRecord) {
  if (room.teamConversationId) {
    updateStoredConversation(room.teamConversationId, {
      projectId: room.id,
    });
    return room.teamConversationId;
  }

  const folder = ensureFolder("团队群聊");
  const created = createConversation({
    title: `${room.teamName} · 群聊`,
    folderId: folder?.id ?? null,
    projectId: room.id,
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
  store.write(state);
}

function createInitialState(): ProjectStoreState {
  return {
    rooms: [],
    agents: [],
    events: [],
    artifacts: [],
    runs: [],
  };
}

function normalizeProjectStoreState(parsed: Partial<ProjectStoreState>): ProjectStoreState {
  const rooms = Array.isArray(parsed.rooms)
    ? parsed.rooms.map((room) => ({
        ...room,
        workspaceDir: room.workspaceDir ?? null,
        teamConversationId: room.teamConversationId ?? null,
        currentStageLabel: room.currentStageLabel ?? null,
        activeAgentId: room.activeAgentId ?? null,
        nextAgentId: room.nextAgentId ?? null,
      }))
    : [];
  const agents = normalizeStoredProjectAgents(Array.isArray(parsed.agents) ? parsed.agents : [], rooms);

  return {
    rooms,
    agents,
    events: Array.isArray(parsed.events) ? parsed.events : [],
    artifacts: Array.isArray(parsed.artifacts) ? parsed.artifacts : [],
    runs: Array.isArray(parsed.runs) ? parsed.runs : [],
  };
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
      return { ...agent, status: "reviewing", blockedByAgentId: null };
    }

    if (agent.visibility === "backstage") {
      return { ...agent, status: "idle", blockedByAgentId: null };
    }

    return { ...agent, status: "reviewing", blockedByAgentId: null };
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
      updatedAt: input.updatedAt,
    });
  }

  return nextArtifacts;
}
