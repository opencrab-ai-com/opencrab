import { getAgentProfile, listAgentProfiles } from "@/lib/agents/agent-store";
import { isSelectableTeamAgent } from "@/lib/agents/display";
import type { AgentProfileRecord } from "@/lib/agents/types";
import { getBrowserSessionStatus } from "@/lib/codex/browser-session";
import { generateCodexReply } from "@/lib/codex/sdk";
import { getRuntimeReadiness } from "@/lib/runtime/first-run-readiness";
import {
  type ProjectPlanningAgentRecommendation,
  type ProjectPlanningAnswerValue,
  type ProjectPlanningAnswers,
  type ProjectPlanningBrief,
  type ProjectPlanningCapabilityGap,
  type ProjectPlanningMode,
  type ProjectPlanningQuestion,
  type ProjectPlanningQuestionKind,
  type ProjectPlanningQuestionOption,
  type ProjectPlanningResult,
} from "@/lib/projects/project-planning";
import type { CodexReasoningEffort } from "@/lib/resources/opencrab-api-types";

const PLANNER_AGENT_ID = "project-manager";

type PlannerExecutor = (input: {
  prompt: string;
  model?: string;
  reasoningEffort?: CodexReasoningEffort;
}) => Promise<string>;

type ProjectPlanningInput = {
  mode?: ProjectPlanningMode;
  rawIntent: string;
  answers?: ProjectPlanningAnswers;
  brief?: ProjectPlanningBrief;
  model?: string;
  reasoningEffort?: CodexReasoningEffort;
};

type ProjectPlanningServiceDependencies = {
  listAgents?: () => AgentProfileRecord[];
  executePlanner?: PlannerExecutor;
  getReadiness?: () => Promise<{ ready: boolean }>;
  getBrowserSession?: () => Promise<{ ok: boolean; status: "ready" | "launching" | "missing_browser" | "unreachable" }>;
};

export function createProjectPlanningService(
  dependencies: ProjectPlanningServiceDependencies = {},
) {
  const listAgents = dependencies.listAgents ?? listAgentProfiles;
  const executePlanner = dependencies.executePlanner ?? defaultPlannerExecutor;
  const getReadiness = dependencies.getReadiness ?? getRuntimeReadiness;
  const getBrowserSession = dependencies.getBrowserSession ?? getBrowserSessionStatus;

  return {
    async plan(input: ProjectPlanningInput): Promise<ProjectPlanningResult> {
      const rawIntent = input.rawIntent.trim();

      if (!rawIntent) {
        throw new Error("请先写下你现在想推进的事情。");
      }

      const mode = input.mode === "recommend" ? "recommend" : "clarify";
      const answers = normalizeAnswers(input.answers);
      const brief = input.brief ? normalizeBrief(input.brief, rawIntent) : null;
      const candidateAgents =
        mode === "recommend" ? listAgents().filter(isSelectableTeamAgent) : [];
      const prompt =
        mode === "recommend"
          ? buildRecommendationPrompt({
              rawIntent,
              answers,
              brief,
              candidateAgents,
            })
          : buildClarifyPrompt({
              rawIntent,
              answers,
            });

      const [readiness, browserSession] = await Promise.all([
        getReadiness(),
        getBrowserSession(),
      ]);

      if (!readiness.ready || !browserSession.ok) {
        return mode === "recommend"
          ? buildFallbackRecommendationPlan(rawIntent, brief)
          : buildFallbackClarifyPlan(rawIntent, answers);
      }

      let replyText = "";

      try {
        replyText = await executePlanner({
          prompt,
          model: input.model,
          reasoningEffort: resolvePlannerReasoningEffort(input.reasoningEffort),
        });
      } catch {
        return mode === "recommend"
          ? buildFallbackRecommendationPlan(rawIntent, brief)
          : buildFallbackClarifyPlan(rawIntent, answers);
      }

      return normalizePlanningResult({
        mode,
        rawIntent,
        answers,
        brief,
        candidateAgents,
        replyText,
      });
    },
  };
}

export const projectPlanningService = createProjectPlanningService();

async function defaultPlannerExecutor(input: {
  prompt: string;
  model?: string;
  reasoningEffort?: CodexReasoningEffort;
}) {
  const plannerAgent = getAgentProfile(PLANNER_AGENT_ID);
  const result = await generateCodexReply({
    conversationTitle: "Team 创建规划",
    content: input.prompt,
    agentProfile: plannerAgent,
    model: input.model,
    reasoningEffort: input.reasoningEffort,
    sandboxMode: "read-only",
  });

  return result.text;
}

function buildClarifyPrompt(input: {
  rawIntent: string;
  answers: ProjectPlanningAnswers;
}) {
  const answerLines = formatAnswerLines(input.answers);
  return `你正在为 OpenCrab 的“新建团队”流程做 intake clarification。目标是先通过多轮澄清，把用户的一句模糊想法收束成一个稳定的任务 brief。

你的任务：
1. 把用户当前这句模糊意图收束成一个可执行 brief。
2. 判断现在更适合“先探索收束”还是“直接进入执行”。
3. 如果信息还不够，先提出最关键的补充问题。
4. 这一阶段先不要推荐 Agent，只专注于把需求讲清楚。

当前用户原始意图：
${input.rawIntent}

当前已回答的补充信息：
${answerLines || "- 暂无"}

请只输出一个 JSON 对象，不要加代码块，不要加解释。格式如下：
{
  "planner_summary": "一句话说明当前判断",
  "brief": {
    "summary": "对本次任务的简要概括",
    "goal": "这次团队真正要完成的目标",
    "deliverable": "本次希望产出的交付物，没有就填空字符串",
    "success_criteria": ["成功标准 1"],
    "constraints": ["已知约束 1"],
    "out_of_scope": ["暂不处理 1"],
    "task_type": "feature | bugfix | research | design | implementation | optimization | unknown",
    "clarity": "low | medium | high",
    "execution_mode": "explore | execute"
  },
  "questions": [
    {
      "id": "question_id",
      "title": "要问用户的问题",
      "description": "为什么要问，或如何理解这个问题",
      "kind": "single_select | multi_select | text",
      "required": true,
      "placeholder": "仅 text 可选",
      "options": [
        {
          "value": "option_1",
          "label": "选项文案",
          "description": "这个选项的含义"
        }
      ]
    }
  ],
  "recommended_agents": [],
  "capability_gaps": [],
  "launch_readiness": "ready | explore_only"
}

输出规则：
1. 如果当前信息仍不足以让团队稳定开工，questions 里提出 1 到 4 个最关键问题，不要一口气问很多。
2. 如果 questions 非空，launch_readiness 必须是 explore_only，不要假装已经完全清楚。
3. 只有在 brief 已经足够稳定时，launch_readiness 才能是 ready。
4. recommended_agents 必须始终返回空数组。
5. capability_gaps 必须始终返回空数组。
6. 所有文案都用自然中文，简洁直接。`;
}

function buildRecommendationPrompt(input: {
  rawIntent: string;
  answers: ProjectPlanningAnswers;
  brief: ProjectPlanningBrief | null;
  candidateAgents: AgentProfileRecord[];
}) {
  const answerLines = formatAnswerLines(input.answers);
  const brief = input.brief ?? buildFallbackBrief(input.rawIntent);
  const agentLines = input.candidateAgents.map((agent) =>
    `- ${agent.id} | ${agent.name} | ${agent.roleLabel} | ${agent.teamRole} | ${agent.collectionLabel} / ${agent.groupLabel} | ${compactText(agent.summary, 56)}`,
  );

  return `你正在为 OpenCrab 的“新建团队”流程做 team composition planning。系统项目经理会默认自动加入团队，你这次只需要判断是否还需要额外加入其他 Agent。

你的任务：
1. 基于已经澄清好的任务 brief，推荐最小可行团队。
2. 判断当前更适合“先启动探索团队”还是“可以直接启动执行团队”。
3. 如果当前 Agent 覆盖不了任务所需能力，明确指出能力缺口，并建议先添加什么 Agent。
4. 这一阶段不要再反问用户问题，直接给出团队规划结论。

用户原始意图：
${input.rawIntent}

已确认的任务 brief：
- summary: ${brief.summary}
- goal: ${brief.goal}
- deliverable: ${brief.deliverable || "暂无"}
- success_criteria: ${brief.successCriteria.join(" / ") || "暂无"}
- constraints: ${brief.constraints.join(" / ") || "暂无"}
- out_of_scope: ${brief.outOfScope.join(" / ") || "暂无"}
- task_type: ${brief.taskType}
- clarity: ${brief.clarity}
- execution_mode: ${brief.executionMode}

用户此前已回答的补充信息：
${answerLines || "- 暂无"}

当前可加入团队的 Agent 名册（系统 PM 已自动加入，这里都是额外成员候选）：
${agentLines.join("\n") || "- 当前没有任何可加入 Team 的额外 Agent"}

请只输出一个 JSON 对象，不要加代码块，不要加解释。格式如下：
{
  "planner_summary": "一句话说明当前判断",
  "brief": {
    "summary": "对本次任务的简要概括",
    "goal": "这次团队真正要完成的目标",
    "deliverable": "本次希望产出的交付物，没有就填空字符串",
    "success_criteria": ["成功标准 1"],
    "constraints": ["已知约束 1"],
    "out_of_scope": ["暂不处理 1"],
    "task_type": "feature | bugfix | research | design | implementation | optimization | unknown",
    "clarity": "low | medium | high",
    "execution_mode": "explore | execute"
  },
  "questions": [],
  "recommended_agents": [
    {
      "agent_id": "必须严格等于名册里的 id",
      "priority": "required | optional",
      "reason": "为什么现在推荐这个 Agent",
      "expected_contribution": "他会补齐什么工作"
    }
  ],
  "capability_gaps": [
    {
      "capability": "当前缺失的能力",
      "reason": "为什么这是缺口",
      "blocking": true,
      "suggested_agent_ids": ["如果当前名册里已有可补齐的候选，就填这些 id；否则空数组"],
      "suggested_new_agent_name": "如果当前名册没有合适候选，建议新增的 Agent 名称；否则空字符串",
      "suggested_new_agent_summary": "建议新增 Agent 的一句话职责简介；否则空字符串"
    }
  ],
  "launch_readiness": "ready | explore_only | need_agents"
}

输出规则：
1. questions 必须始终返回空数组，这一步不要继续追问用户。
2. 推荐 Agent 时要追求最小可行团队，不要为了看起来完整就把很多人一起叫上。
3. 只有当某个 Agent 对当前阶段确实关键时，才标记为 required；否则标记 optional。
4. 不能编造名册里不存在的 agent_id。
5. 如果当前名册不足以完成用户想要的事情，必须显式写出 capability_gaps，而不是勉强推荐不合适的 Agent。
6. 当现有成员只够做问题澄清、方案收束或方向判断，但还不适合真正执行时，launch_readiness 应该是 explore_only。
7. 当现有成员连探索收束都明显不够，或者用户明确要求执行而当前名册没有合适执行者时，launch_readiness 应该是 need_agents。
8. 所有文案都用自然中文，简洁直接。`;
}

function normalizePlanningResult(input: {
  mode: ProjectPlanningMode;
  rawIntent: string;
  answers: ProjectPlanningAnswers;
  brief: ProjectPlanningBrief | null;
  candidateAgents: AgentProfileRecord[];
  replyText: string;
}): ProjectPlanningResult {
  const payload = extractJsonObject(input.replyText);

  if (!payload) {
    return input.mode === "recommend"
      ? buildFallbackRecommendationPlan(input.rawIntent, input.brief)
      : buildFallbackClarifyPlan(input.rawIntent, input.answers);
  }

  const validAgentIds = new Set(input.candidateAgents.map((agent) => agent.id));
  const fallbackGoal = input.brief?.goal || input.rawIntent;
  const brief = normalizeBrief(payload.brief, fallbackGoal);
  const questions =
    input.mode === "recommend" ? [] : normalizeQuestions(payload.questions);
  const recommendedAgents =
    input.mode === "recommend"
      ? normalizeRecommendations(payload.recommended_agents, validAgentIds)
      : [];
  const capabilityGaps =
    input.mode === "recommend"
      ? normalizeCapabilityGaps(payload.capability_gaps, validAgentIds)
      : [];
  const plannerSummary =
    typeof payload.planner_summary === "string" && payload.planner_summary.trim()
      ? payload.planner_summary.trim()
      : brief.summary;

  let launchReadiness =
    input.mode === "recommend"
      ? normalizeLaunchReadiness(payload.launch_readiness)
      : questions.length > 0
        ? "explore_only"
        : "ready";

  if (input.mode !== "recommend") {
    return {
      stage: questions.length > 0 ? "clarify" : "review",
      plannerSummary,
      brief,
      questions,
      recommendedAgents: [],
      capabilityGaps: [],
      launchReadiness,
    };
  }

  if (
    launchReadiness === "ready" &&
    capabilityGaps.some((gap) => gap.blocking) &&
    brief.executionMode === "execute"
  ) {
    launchReadiness = recommendedAgents.length > 0 ? "explore_only" : "need_agents";
  }

  if (questions.length > 0 && launchReadiness === "ready" && brief.clarity === "low") {
    launchReadiness = brief.executionMode === "execute" ? "explore_only" : "ready";
  }

  if (launchReadiness === "need_agents" && capabilityGaps.length === 0) {
    capabilityGaps.push({
      capability: "关键执行能力",
      reason: "当前名册还不足以稳定推进这次任务。",
      blocking: true,
      suggestedAgentIds: [],
      suggestedNewAgentName: "补齐关键能力的执行 Agent",
      suggestedNewAgentSummary: "补齐当前任务最缺的专业执行能力，再进入下一阶段。",
    });
  }

  return {
    stage: launchReadiness === "need_agents" ? "agent_gap" : "review",
    plannerSummary,
    brief,
    questions: [],
    recommendedAgents,
    capabilityGaps,
    launchReadiness,
  };
}

function buildFallbackClarifyPlan(
  rawIntent: string,
  answers: ProjectPlanningAnswers = {},
): ProjectPlanningResult {
  const planningMode =
    typeof answers.planning_mode === "string" ? answers.planning_mode : "";
  const deliverableType =
    typeof answers.deliverable_type === "string" ? answers.deliverable_type : "";
  const constraintsValue = answers.constraints;
  const constraints = Array.isArray(constraintsValue)
    ? constraintsValue
    : typeof constraintsValue === "string" && constraintsValue.trim()
      ? [constraintsValue.trim()]
      : [];
  const hasRequiredAnswers = Boolean(planningMode && deliverableType);
  const executionMode = planningMode === "execute" ? "execute" : "explore";
  const brief: ProjectPlanningBrief = {
    ...buildFallbackBrief(rawIntent),
    summary: hasRequiredAnswers
      ? `先以${executionMode === "execute" ? "快速落地" : "探索收束"}为主，围绕“${formatFallbackDeliverable(deliverableType)}”推进这一轮任务。`
      : rawIntent,
    deliverable: formatFallbackDeliverable(deliverableType) || null,
    constraints,
    taskType: mapFallbackTaskType(deliverableType),
    clarity: hasRequiredAnswers ? "medium" : "low",
    executionMode,
  };
  const questions = [
    !planningMode
      ? buildFallbackQuestion({
          id: "planning_mode",
          title: "这次你更想先收束方向，还是直接推进落地？",
          description: "这个选择会直接影响团队先做探索还是先做执行。",
          options: [
            ["explore", "先想清楚方向", "先形成 brief、方案或取舍判断。"],
            ["execute", "尽快做出结果", "目标足够清楚时，直接推进 MVP 或实现。"],
          ],
        })
      : null,
    !deliverableType
      ? buildFallbackQuestion({
          id: "deliverable_type",
          title: "这次最希望拿到什么交付物？",
          description: "明确交付物后，系统才能判断该配哪些成员。",
          options: [
            ["spec", "方案或 brief", "先产出结构化方案、PRD 或任务边界。"],
            ["prototype", "原型或页面方向", "先产出关键页面、交互或视觉方向。"],
            ["implementation", "代码或可运行结果", "希望直接落到实现、修复或 MVP。"],
          ],
        })
      : null,
    !constraints.length
      ? {
          id: "constraints",
          title: "有没有特别重要的限制或担心？",
          description: "比如时间、范围、只能改哪一层，或最担心方向跑偏。",
          kind: "text",
          required: false,
          placeholder: "例如：这周内先做出 MVP，只改共享层，不希望前端变重。",
          options: [],
        }
      : null,
  ].filter(Boolean) as ProjectPlanningQuestion[];

  return {
    stage: hasRequiredAnswers ? "review" : "clarify",
    plannerSummary: hasRequiredAnswers
      ? "基础澄清已经足够形成一版任务草案，下一步可以进入 Agent 推荐。"
      : "先把本次任务的交付物、边界和推进方式补清楚，再决定阵容。",
    brief,
    questions,
    recommendedAgents: [],
    capabilityGaps: [],
    launchReadiness: hasRequiredAnswers ? "ready" : "explore_only",
  };
}

function buildFallbackRecommendationPlan(
  rawIntent: string,
  brief: ProjectPlanningBrief | null,
): ProjectPlanningResult {
  return {
    stage: "review",
    plannerSummary: "暂时无法稳定推荐额外成员，你可以先用系统 PM 启动探索团队，或稍后再试一次。",
    brief: brief ?? buildFallbackBrief(rawIntent),
    questions: [],
    recommendedAgents: [],
    capabilityGaps: [],
    launchReadiness: "explore_only",
  };
}

function buildFallbackBrief(rawIntent: string): ProjectPlanningBrief {
  return {
    summary: rawIntent,
    goal: rawIntent,
    deliverable: null,
    successCriteria: [],
    constraints: [],
    outOfScope: [],
    taskType: "unknown",
    clarity: "low",
    executionMode: "explore",
  };
}

function formatFallbackDeliverable(value: string) {
  switch (value) {
    case "spec":
      return "方案或 brief";
    case "prototype":
      return "原型或页面方向";
    case "implementation":
      return "代码或可运行结果";
    default:
      return "";
  }
}

function mapFallbackTaskType(
  value: string,
): ProjectPlanningBrief["taskType"] {
  switch (value) {
    case "prototype":
      return "design";
    case "implementation":
      return "implementation";
    case "spec":
      return "research";
    default:
      return "unknown";
  }
}

function buildFallbackQuestion(input: {
  id: string;
  title: string;
  description: string;
  options: Array<[string, string, string]>;
}): ProjectPlanningQuestion {
  return {
    id: input.id,
    title: input.title,
    description: input.description,
    kind: "single_select",
    required: true,
    placeholder: null,
    options: input.options.map(([value, label, description]) => ({
      value,
      label,
      description,
    })),
  };
}

function normalizeAnswers(value: ProjectPlanningAnswers | undefined): ProjectPlanningAnswers {
  if (!value) {
    return {};
  }

  return Object.fromEntries(
    Object.entries(value)
      .map(([key, entry]) => {
        if (typeof entry === "string") {
          const trimmed = entry.trim();
          return trimmed ? [key, trimmed] : null;
        }

        if (Array.isArray(entry)) {
          const items = entry
            .filter((item): item is string => typeof item === "string")
            .map((item) => item.trim())
            .filter(Boolean);

          return items.length > 0 ? [key, items] : null;
        }

        return null;
      })
      .filter(Boolean) as Array<[string, ProjectPlanningAnswerValue]>,
  );
}

function normalizeBrief(value: unknown, fallbackGoal: string): ProjectPlanningBrief {
  const candidate = value && typeof value === "object" ? (value as Record<string, unknown>) : {};
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
    successCriteria: normalizeStringList(candidate.success_criteria),
    constraints: normalizeStringList(candidate.constraints),
    outOfScope: normalizeStringList(candidate.out_of_scope),
    taskType: normalizeTaskType(candidate.task_type),
    clarity: normalizeClarity(candidate.clarity),
    executionMode: candidate.execution_mode === "execute" ? "execute" : "explore",
  };
}

function normalizeQuestions(value: unknown): ProjectPlanningQuestion[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((item, index) => normalizeQuestion(item, index))
    .filter(Boolean)
    .slice(0, 4) as ProjectPlanningQuestion[];
}

function normalizeQuestion(
  value: unknown,
  index: number,
): ProjectPlanningQuestion | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  const candidate = value as Record<string, unknown>;
  const title = typeof candidate.title === "string" ? candidate.title.trim() : "";

  if (!title) {
    return null;
  }

  const kind = normalizeQuestionKind(candidate.kind);
  const options = normalizeQuestionOptions(candidate.options, kind);

  return {
    id:
      typeof candidate.id === "string" && candidate.id.trim()
        ? candidate.id.trim()
        : `question_${index + 1}`,
    title,
    description:
      typeof candidate.description === "string" && candidate.description.trim()
        ? candidate.description.trim()
        : "请补充这部分关键信息，方便系统更稳地规划团队。",
    kind,
    required: candidate.required !== false,
    placeholder:
      typeof candidate.placeholder === "string" && candidate.placeholder.trim()
        ? candidate.placeholder.trim()
        : null,
    options,
  };
}

function normalizeQuestionOptions(
  value: unknown,
  kind: ProjectPlanningQuestionKind,
): ProjectPlanningQuestionOption[] {
  if (kind === "text") {
    return [];
  }

  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((item) => {
      if (!item || typeof item !== "object") {
        return null;
      }

      const candidate = item as Record<string, unknown>;
      const nextValue = typeof candidate.value === "string" ? candidate.value.trim() : "";
      const label = typeof candidate.label === "string" ? candidate.label.trim() : "";

      if (!nextValue || !label) {
        return null;
      }

      return {
        value: nextValue,
        label,
        description:
          typeof candidate.description === "string" && candidate.description.trim()
            ? candidate.description.trim()
            : null,
      };
    })
    .filter(Boolean)
    .slice(0, 4) as ProjectPlanningQuestionOption[];
}

function normalizeRecommendations(
  value: unknown,
  validAgentIds: Set<string>,
): ProjectPlanningAgentRecommendation[] {
  if (!Array.isArray(value)) {
    return [];
  }

  const seen = new Set<string>();

  return value
    .map((item) => {
      if (!item || typeof item !== "object") {
        return null;
      }

      const candidate = item as Record<string, unknown>;
      const agentId =
        typeof candidate.agent_id === "string" ? candidate.agent_id.trim() : "";

      if (!agentId || !validAgentIds.has(agentId) || seen.has(agentId)) {
        return null;
      }

      seen.add(agentId);

      return {
        agentId,
        priority: candidate.priority === "optional" ? "optional" : "required",
        reason:
          typeof candidate.reason === "string" && candidate.reason.trim()
            ? candidate.reason.trim()
            : "当前阶段适合参与这次协作。",
        expectedContribution:
          typeof candidate.expected_contribution === "string" &&
          candidate.expected_contribution.trim()
            ? candidate.expected_contribution.trim()
            : "补齐当前任务的一块关键推进能力。",
      } satisfies ProjectPlanningAgentRecommendation;
    })
    .filter(Boolean) as ProjectPlanningAgentRecommendation[];
}

function normalizeCapabilityGaps(
  value: unknown,
  validAgentIds: Set<string>,
): ProjectPlanningCapabilityGap[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((item) => {
      if (!item || typeof item !== "object") {
        return null;
      }

      const candidate = item as Record<string, unknown>;
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
            : "当前名册里缺少这项关键能力。",
        blocking: candidate.blocking === true,
        suggestedAgentIds: normalizeStringList(candidate.suggested_agent_ids).filter((id) =>
          validAgentIds.has(id),
        ),
        suggestedNewAgentName:
          typeof candidate.suggested_new_agent_name === "string" &&
          candidate.suggested_new_agent_name.trim()
            ? candidate.suggested_new_agent_name.trim()
            : null,
        suggestedNewAgentSummary:
          typeof candidate.suggested_new_agent_summary === "string" &&
          candidate.suggested_new_agent_summary.trim()
            ? candidate.suggested_new_agent_summary.trim()
            : null,
      } satisfies ProjectPlanningCapabilityGap;
    })
    .filter(Boolean) as ProjectPlanningCapabilityGap[];
}

function normalizeTaskType(value: unknown): ProjectPlanningBrief["taskType"] {
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

function normalizeClarity(value: unknown): ProjectPlanningBrief["clarity"] {
  switch (value) {
    case "medium":
    case "high":
      return value;
    default:
      return "low";
  }
}

function normalizeQuestionKind(value: unknown): ProjectPlanningQuestionKind {
  switch (value) {
    case "single_select":
    case "multi_select":
      return value;
    default:
      return "text";
  }
}

function normalizeLaunchReadiness(
  value: unknown,
): ProjectPlanningResult["launchReadiness"] {
  switch (value) {
    case "explore_only":
    case "need_agents":
      return value;
    default:
      return "ready";
  }
}

function normalizeStringList(value: unknown) {
  return Array.isArray(value)
    ? value
        .filter((item): item is string => typeof item === "string")
        .map((item) => item.trim())
        .filter(Boolean)
    : [];
}

function formatAnswerLines(answers: ProjectPlanningAnswers) {
  return Object.entries(answers)
    .map(([key, value]) =>
      Array.isArray(value)
        ? `- ${key}: ${value.join(" / ")}`
        : `- ${key}: ${value}`,
    )
    .join("\n");
}

function resolvePlannerReasoningEffort(
  reasoningEffort: CodexReasoningEffort | undefined,
): CodexReasoningEffort {
  switch (reasoningEffort) {
    case "minimal":
    case "low":
      return reasoningEffort;
    case "medium":
    case "high":
    case "xhigh":
    default:
      return "low";
  }
}

function compactText(value: string, limit: number) {
  const normalized = value.replace(/\s+/g, " ").trim();
  return normalized.length > limit ? `${normalized.slice(0, limit - 1)}…` : normalized;
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
    return JSON.parse(source.slice(start, end + 1)) as Record<string, unknown>;
  } catch {
    return null;
  }
}
