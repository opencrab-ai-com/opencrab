export type ProjectPlanningTaskType =
  | "feature"
  | "bugfix"
  | "research"
  | "design"
  | "implementation"
  | "optimization"
  | "unknown";

export type ProjectPlanningMode = "clarify" | "recommend";
export type ProjectPlanningClarity = "low" | "medium" | "high";
export type ProjectPlanningExecutionMode = "explore" | "execute";
export type ProjectPlanningLaunchReadiness = "ready" | "explore_only" | "need_agents";
export type ProjectPlanningStage = "clarify" | "review" | "agent_gap";
export type ProjectPlanningQuestionKind = "single_select" | "multi_select" | "text";
export type ProjectPlanningRecommendationPriority = "required" | "optional";

export type ProjectPlanningAnswerValue = string | string[];
export type ProjectPlanningAnswers = Record<string, ProjectPlanningAnswerValue>;

export type ProjectPlanningQuestionOption = {
  value: string;
  label: string;
  description: string | null;
};

export type ProjectPlanningQuestion = {
  id: string;
  title: string;
  description: string;
  kind: ProjectPlanningQuestionKind;
  required: boolean;
  placeholder: string | null;
  options: ProjectPlanningQuestionOption[];
};

export type ProjectPlanningBrief = {
  summary: string;
  goal: string;
  deliverable: string | null;
  successCriteria: string[];
  constraints: string[];
  outOfScope: string[];
  taskType: ProjectPlanningTaskType;
  clarity: ProjectPlanningClarity;
  executionMode: ProjectPlanningExecutionMode;
};

export type ProjectPlanningAgentRecommendation = {
  agentId: string;
  reason: string;
  expectedContribution: string;
  priority: ProjectPlanningRecommendationPriority;
};

export type ProjectPlanningCapabilityGap = {
  capability: string;
  reason: string;
  blocking: boolean;
  suggestedAgentIds: string[];
  suggestedNewAgentName: string | null;
  suggestedNewAgentSummary: string | null;
};

export type ProjectPlanningResult = {
  stage: ProjectPlanningStage;
  plannerSummary: string;
  brief: ProjectPlanningBrief;
  questions: ProjectPlanningQuestion[];
  recommendedAgents: ProjectPlanningAgentRecommendation[];
  capabilityGaps: ProjectPlanningCapabilityGap[];
  launchReadiness: ProjectPlanningLaunchReadiness;
};

export type ProjectPlanningSnapshot = {
  rawIntent: string;
  answers: ProjectPlanningAnswers;
  plannerSummary: string;
  brief: ProjectPlanningBrief;
  recommendedAgents: ProjectPlanningAgentRecommendation[];
  capabilityGaps: ProjectPlanningCapabilityGap[];
  launchReadiness: ProjectPlanningLaunchReadiness;
  createdAt: string;
};

export type ProjectPlanningResponse = {
  plan: ProjectPlanningResult;
};

export function formatProjectGoalFromBrief(brief: ProjectPlanningBrief) {
  const sections = [
    `任务目标：${brief.goal}`,
    brief.summary ? `任务摘要：${brief.summary}` : null,
    brief.deliverable ? `本次交付：${brief.deliverable}` : null,
    brief.successCriteria.length > 0
      ? [`成功标准：`, ...brief.successCriteria.map((item) => `- ${item}`)].join("\n")
      : null,
    brief.constraints.length > 0
      ? [`已知约束：`, ...brief.constraints.map((item) => `- ${item}`)].join("\n")
      : null,
    brief.outOfScope.length > 0
      ? [`暂不处理：`, ...brief.outOfScope.map((item) => `- ${item}`)].join("\n")
      : null,
    `当前模式：${brief.executionMode === "explore" ? "先做探索与收束" : "直接推进执行"}`,
  ];

  return sections.filter(Boolean).join("\n\n");
}

export function normalizeProjectPlanningSnapshot(
  value: unknown,
): ProjectPlanningSnapshot | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  const candidate = value as Partial<ProjectPlanningSnapshot>;
  const rawIntent = typeof candidate.rawIntent === "string" ? candidate.rawIntent.trim() : "";
  const createdAt = typeof candidate.createdAt === "string" ? candidate.createdAt : "";

  if (!rawIntent || !createdAt) {
    return null;
  }

  return {
    rawIntent,
    answers: normalizeAnswers(candidate.answers),
    plannerSummary:
      typeof candidate.plannerSummary === "string" && candidate.plannerSummary.trim()
        ? candidate.plannerSummary.trim()
        : rawIntent,
    brief: normalizeBrief(candidate.brief, rawIntent),
    recommendedAgents: Array.isArray(candidate.recommendedAgents)
      ? candidate.recommendedAgents
          .map((item) => normalizeRecommendation(item))
          .filter((item): item is ProjectPlanningAgentRecommendation => Boolean(item))
      : [],
    capabilityGaps: Array.isArray(candidate.capabilityGaps)
      ? candidate.capabilityGaps
          .map((item) => normalizeGap(item))
          .filter((item): item is ProjectPlanningCapabilityGap => Boolean(item))
      : [],
    launchReadiness: normalizeLaunchReadiness(candidate.launchReadiness),
    createdAt,
  };
}

function normalizeAnswers(value: unknown): ProjectPlanningAnswers {
  if (!value || typeof value !== "object") {
    return {};
  }

  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>)
      .map(([key, entry]) => {
        if (typeof entry === "string") {
          const trimmed = entry.trim();
          return trimmed ? [key, trimmed] : null;
        }

        if (Array.isArray(entry)) {
          const values = entry
            .filter((item): item is string => typeof item === "string")
            .map((item) => item.trim())
            .filter(Boolean);

          return values.length > 0 ? [key, values] : null;
        }

        return null;
      })
      .filter(Boolean) as Array<[string, ProjectPlanningAnswerValue]>,
  );
}

function normalizeBrief(value: unknown, fallbackGoal: string): ProjectPlanningBrief {
  const candidate = value && typeof value === "object" ? (value as Partial<ProjectPlanningBrief>) : {};
  const goal =
    typeof candidate.goal === "string" && candidate.goal.trim()
      ? candidate.goal.trim()
      : fallbackGoal;

  return {
    summary:
      typeof candidate.summary === "string" && candidate.summary.trim()
        ? candidate.summary.trim()
        : goal,
    goal,
    deliverable:
      typeof candidate.deliverable === "string" && candidate.deliverable.trim()
        ? candidate.deliverable.trim()
        : null,
    successCriteria: normalizeStringList(candidate.successCriteria),
    constraints: normalizeStringList(candidate.constraints),
    outOfScope: normalizeStringList(candidate.outOfScope),
    taskType: normalizeTaskType(candidate.taskType),
    clarity: normalizeClarity(candidate.clarity),
    executionMode: normalizeExecutionMode(candidate.executionMode),
  };
}

function normalizeRecommendation(
  value: unknown,
): ProjectPlanningAgentRecommendation | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  const candidate = value as Partial<ProjectPlanningAgentRecommendation>;
  const agentId = typeof candidate.agentId === "string" ? candidate.agentId.trim() : "";

  if (!agentId) {
    return null;
  }

  return {
    agentId,
    reason:
      typeof candidate.reason === "string" && candidate.reason.trim()
        ? candidate.reason.trim()
        : "当前阶段适合参与这次协作。",
    expectedContribution:
      typeof candidate.expectedContribution === "string" && candidate.expectedContribution.trim()
        ? candidate.expectedContribution.trim()
        : "补齐当前任务的一部分关键推进能力。",
    priority: candidate.priority === "optional" ? "optional" : "required",
  };
}

function normalizeGap(value: unknown): ProjectPlanningCapabilityGap | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  const candidate = value as Partial<ProjectPlanningCapabilityGap>;
  const capability =
    typeof candidate.capability === "string" ? candidate.capability.trim() : "";

  if (!capability) {
    return null;
  }

  return {
    capability,
    reason:
      typeof candidate.reason === "string" && candidate.reason.trim()
        ? candidate.reason.trim()
        : "当前能力覆盖仍然不足。",
    blocking: candidate.blocking === true,
    suggestedAgentIds: normalizeStringList(candidate.suggestedAgentIds),
    suggestedNewAgentName:
      typeof candidate.suggestedNewAgentName === "string" &&
      candidate.suggestedNewAgentName.trim()
        ? candidate.suggestedNewAgentName.trim()
        : null,
    suggestedNewAgentSummary:
      typeof candidate.suggestedNewAgentSummary === "string" &&
      candidate.suggestedNewAgentSummary.trim()
        ? candidate.suggestedNewAgentSummary.trim()
        : null,
  };
}

function normalizeStringList(value: unknown) {
  return Array.isArray(value)
    ? value
        .filter((item): item is string => typeof item === "string")
        .map((item) => item.trim())
        .filter(Boolean)
    : [];
}

function normalizeTaskType(value: unknown): ProjectPlanningTaskType {
  switch (value) {
    case "feature":
    case "bugfix":
    case "research":
    case "design":
    case "implementation":
    case "optimization":
      return value;
    default:
      return "unknown";
  }
}

function normalizeClarity(value: unknown): ProjectPlanningClarity {
  switch (value) {
    case "medium":
    case "high":
      return value;
    default:
      return "low";
  }
}

function normalizeExecutionMode(value: unknown): ProjectPlanningExecutionMode {
  return value === "execute" ? "execute" : "explore";
}

function normalizeLaunchReadiness(value: unknown): ProjectPlanningLaunchReadiness {
  switch (value) {
    case "explore_only":
    case "need_agents":
      return value;
    default:
      return "ready";
  }
}
