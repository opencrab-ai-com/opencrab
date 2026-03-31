import type {
  ProjectAgentRecord,
  ProjectAgentStatus,
  ProjectDetail,
  ProjectRunStatus,
} from "@/lib/projects/types";
import type { ConversationMessage } from "@/lib/seed-data";

export type ProjectRoomProjectionTone = "default" | "info" | "warning" | "success";

export type ProjectRoomActivityDescriptor =
  | { kind: "user_checkpoint_update" }
  | { kind: "user_instruction" }
  | { kind: "manager_assignment" }
  | { kind: "manager_waiting_user" }
  | { kind: "manager_waiting_approval" }
  | { kind: "manager_coordination" }
  | { kind: "agent_result"; agentName: string }
  | { kind: "team_activity" };

export type ProjectRoomActivityAnchor =
  | { kind: "learning"; suggestionId: string }
  | { kind: "checkpoint" }
  | { kind: "runtime_health" };

export type ProjectRoomAgentTrajectory =
  | { kind: "manager_waiting_approval" }
  | { kind: "manager_waiting_user" }
  | { kind: "manager_coordinating_handoff"; nextAgentName: string | null }
  | { kind: "manager_standby" }
  | { kind: "agent_working" }
  | { kind: "agent_waiting_upstream"; blockerName: string | null }
  | { kind: "agent_handed_back"; completedAt: string | null }
  | { kind: "agent_idle" };

export type ProjectRoomProjection = {
  runtimeMessages: ConversationMessage[];
  latestActivityDescriptor: ProjectRoomActivityDescriptor | null;
  activityDescriptorsByMessageId: Record<string, ProjectRoomActivityDescriptor>;
  activityAnchorsByMessageId: Record<string, ProjectRoomActivityAnchor | null>;
  agentTrajectoriesByAgentId: Record<string, ProjectRoomAgentTrajectory>;
  agentProjectStatusesByAgentId: Record<string, ProjectRunStatus>;
};

export function buildProjectRoomProjection(input: {
  detail: ProjectDetail | null;
  teamMessages: ConversationMessage[];
}): ProjectRoomProjection {
  const project = input.detail?.project ?? null;
  const runtimeMessages = buildRuntimeMessages(input.teamMessages);

  if (!project) {
    return {
      runtimeMessages,
      latestActivityDescriptor: null,
      activityDescriptorsByMessageId: {},
      activityAnchorsByMessageId: {},
      agentTrajectoriesByAgentId: {},
      agentProjectStatusesByAgentId: {},
    };
  }

  const agents = input.detail?.agents ?? [];
  const agentsById = new Map(agents.map((agent) => [agent.id, agent] as const));
  const learningSuggestions = input.detail?.learningSuggestions ?? [];
  const recoveryActions = input.detail?.recoveryActions ?? [];

  const activityDescriptorsByMessageId: Record<string, ProjectRoomActivityDescriptor> = {};
  const activityAnchorsByMessageId: Record<string, ProjectRoomActivityAnchor | null> = {};

  runtimeMessages.forEach((message) => {
    activityDescriptorsByMessageId[message.id] = resolveActivityDescriptor(message, project, agentsById);
    activityAnchorsByMessageId[message.id] = resolveActivityAnchorTarget(
      message,
      project.latestUserRequest ?? null,
      learningSuggestions,
      recoveryActions,
    );
  });

  const agentTrajectoriesByAgentId: Record<string, ProjectRoomAgentTrajectory> = {};
  const agentProjectStatusesByAgentId: Record<string, ProjectRunStatus> = {};

  agents.forEach((agent) => {
    agentTrajectoriesByAgentId[agent.id] = resolveAgentTrajectory(agent, project, agentsById);
    agentProjectStatusesByAgentId[agent.id] = mapAgentStatusToProjectStatus(agent.status);
  });

  const latestActivityDescriptor =
    runtimeMessages[0] ? activityDescriptorsByMessageId[runtimeMessages[0].id] ?? null : null;

  return {
    runtimeMessages,
    latestActivityDescriptor,
    activityDescriptorsByMessageId,
    activityAnchorsByMessageId,
    agentTrajectoriesByAgentId,
    agentProjectStatusesByAgentId,
  };
}

function buildRuntimeMessages(messages: ConversationMessage[]) {
  return [...messages]
    .filter((message) => message.role === "assistant" || message.role === "user")
    .sort((left, right) => {
      const rightTime = Date.parse(right.timestamp || "");
      const leftTime = Date.parse(left.timestamp || "");

      if (Number.isFinite(rightTime) && Number.isFinite(leftTime) && rightTime !== leftTime) {
        return rightTime - leftTime;
      }

      if (Number.isFinite(rightTime) && !Number.isFinite(leftTime)) {
        return -1;
      }

      if (!Number.isFinite(rightTime) && Number.isFinite(leftTime)) {
        return 1;
      }

      return right.id.localeCompare(left.id, "en");
    })
    .slice(0, 8);
}

function resolveActivityAnchorTarget(
  message: ConversationMessage,
  latestUserRequest: string | null,
  learningSuggestions: NonNullable<ProjectDetail["learningSuggestions"]>,
  recoveryActions: NonNullable<ProjectDetail["recoveryActions"]>,
): ProjectRoomActivityAnchor | null {
  const linkedSuggestion =
    learningSuggestions.find(
      (suggestion) =>
        message.content.includes(suggestion.title) ||
        suggestion.evidenceLabels.some((label) => label && message.content.includes(label)),
    ) ?? null;

  if (linkedSuggestion) {
    return {
      kind: "learning",
      suggestionId: linkedSuggestion.id,
    };
  }

  if (
    (latestUserRequest && message.role === "user" && message.content.trim() === latestUserRequest.trim()) ||
    /(确认|补充|等待你|checkpoint|待确认|待补充)/.test(message.content)
  ) {
    return {
      kind: "checkpoint",
    };
  }

  const linkedRecovery =
    recoveryActions.find(
      (action) =>
        (action.taskTitle && message.content.includes(action.taskTitle)) ||
        message.content.includes(compactActivityText(action.summary, 24)),
    ) ?? null;

  if (linkedRecovery || /(恢复|改派|回滚|卡住|阻塞|接力仍有不稳定点)/.test(message.content)) {
    return {
      kind: "runtime_health",
    };
  }

  return null;
}

function resolveActivityDescriptor(
  message: ConversationMessage,
  project: NonNullable<ProjectDetail["project"]>,
  agentsById: Map<string, ProjectAgentRecord>,
): ProjectRoomActivityDescriptor {
  if (message.role === "user") {
    const normalized = message.content.trim();

    if (project.runStatus === "waiting_user" && normalized === (project.latestUserRequest || "").trim()) {
      return { kind: "user_checkpoint_update" };
    }

    return { kind: "user_instruction" };
  }

  const actor =
    [...agentsById.values()].find((agent) => agent.name === message.actorLabel) ?? null;

  if (actor?.canDelegate) {
    if (/@\S+/.test(message.content)) {
      return { kind: "manager_assignment" };
    }

    if (/(确认|结束|补充|反馈|告诉我|等待你)/.test(message.content)) {
      return {
        kind: project.runStatus === "waiting_user" ? "manager_waiting_user" : "manager_waiting_approval",
      };
    }

    return { kind: "manager_coordination" };
  }

  if (actor) {
    return {
      kind: "agent_result",
      agentName: actor.name,
    };
  }

  return { kind: "team_activity" };
}

function resolveAgentTrajectory(
  agent: ProjectAgentRecord,
  project: NonNullable<ProjectDetail["project"]>,
  agentsById: Map<string, ProjectAgentRecord>,
): ProjectRoomAgentTrajectory {
  if (agent.canDelegate) {
    if (project.runStatus === "waiting_approval") {
      return { kind: "manager_waiting_approval" };
    }

    if (project.runStatus === "waiting_user") {
      return { kind: "manager_waiting_user" };
    }

    if (project.activeAgentId === agent.id || project.nextAgentId) {
      return {
        kind: "manager_coordinating_handoff",
        nextAgentName: project.nextAgentId ? agentsById.get(project.nextAgentId)?.name || null : null,
      };
    }

    return { kind: "manager_standby" };
  }

  if (agent.status === "working") {
    return { kind: "agent_working" };
  }

  if (agent.blockedByAgentId) {
    return {
      kind: "agent_waiting_upstream",
      blockerName: agentsById.get(agent.blockedByAgentId)?.name || null,
    };
  }

  if (agent.lastCompletedAt || agent.status === "reviewing") {
    return {
      kind: "agent_handed_back",
      completedAt: agent.lastCompletedAt ?? null,
    };
  }

  return { kind: "agent_idle" };
}

function mapAgentStatusToProjectStatus(status: ProjectAgentStatus): ProjectRunStatus {
  switch (status) {
    case "working":
      return "running";
    case "reviewing":
      return "completed";
    case "planning":
      return "waiting_approval";
    default:
      return "ready";
  }
}

function compactActivityText(value: string, maxLength = 180) {
  const normalized = value.replace(/\s+/g, " ").trim();
  return normalized.length > maxLength ? `${normalized.slice(0, maxLength - 3)}...` : normalized;
}
