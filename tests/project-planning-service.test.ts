import { describe, expect, it, vi } from "vitest";
import { createProjectPlanningService } from "@/lib/modules/projects/project-planning-service";
import type { AgentProfileRecord } from "@/lib/agents/types";

function createAgentRecord(overrides: Partial<AgentProfileRecord> = {}): AgentProfileRecord {
  return {
    id: "agent-1",
    name: "Agent",
    avatarDataUrl: null,
    summary: "Handles tasks",
    roleLabel: "Specialist",
    description: "Handles tasks",
    source: "system",
    availability: "both",
    teamRole: "specialist",
    defaultModel: null,
    defaultReasoningEffort: "medium",
    defaultSandboxMode: "workspace-write",
    starterPrompts: [],
    familyId: "strategy-delivery",
    familyLabel: "策略与交付",
    familyDescription: "负责目标收束、方案判断、推进节奏和阶段性交付的核心岗位。",
    familyOrder: 10,
    promoted: false,
    fileCount: 5,
    createdAt: "2026-04-02T00:00:00.000Z",
    updatedAt: "2026-04-02T00:00:00.000Z",
    ...overrides,
  };
}

describe("projectPlanningService", () => {
  it("normalizes planner output and only keeps valid team agents", async () => {
    const devAgent = createAgentRecord({
      id: "dev-agent",
      name: "DEV-钢铁侠",
      summary: "负责把想法变成可运行结果。",
    });
    const criticAgent = createAgentRecord({
      id: "critic-agent",
      name: "逗逼-小特",
      summary: "负责挑战假设，逼出更清楚判断。",
    });
    const soloAgent = createAgentRecord({
      id: "solo-agent",
      name: "Solo Agent",
      availability: "solo",
    });
    const executePlanner = vi.fn(async () =>
      JSON.stringify({
        planner_summary: "当前先补齐执行成员，再启动团队会更稳。",
        brief: {
          summary: "先把新建团队流程收束成可落地方案。",
          goal: "优化 Team 模式的新建团队体验，并给出可落地的交互方案。",
          deliverable: "结构化 brief 与首轮实现建议",
          success_criteria: ["用户可以用一句模糊输入开始", "系统能推荐合适 Agent"],
          constraints: ["共享层优先", "前端不能变重"],
          out_of_scope: ["暂不改运行时调度"],
          task_type: "design",
          clarity: "medium",
          execution_mode: "explore",
        },
        questions: [],
        recommended_agents: [
          {
            agent_id: "dev-agent",
            priority: "required",
            reason: "后续实现建议和可运行最小闭环需要工程判断。",
            expected_contribution: "补齐 MVP 实现路径和边界判断。",
          },
          {
            agent_id: "missing-agent",
            priority: "optional",
            reason: "不存在的成员",
            expected_contribution: "不会被保留。",
          },
        ],
        capability_gaps: [
          {
            capability: "批判性复核",
            reason: "需要有人专门挑战方案假设。",
            blocking: false,
            suggested_agent_ids: ["critic-agent", "missing-agent"],
            suggested_new_agent_name: "",
            suggested_new_agent_summary: "",
          },
        ],
        launch_readiness: "explore_only",
      }),
    );
    const service = createProjectPlanningService({
      listAgents: () => [devAgent, criticAgent, soloAgent],
      executePlanner,
      getReadiness: async () => ({ ready: true }),
      getBrowserSession: async () => ({ ok: true, status: "ready" }),
    });

    const result = await service.plan({
      mode: "recommend",
      rawIntent: "我想把 Team 模式的新建团队交互做顺。",
      brief: {
        summary: "先把新建团队流程收束成可落地方案。",
        goal: "优化 Team 模式的新建团队体验，并给出可落地的交互方案。",
        deliverable: "结构化 brief 与首轮实现建议",
        successCriteria: ["用户可以用一句模糊输入开始", "系统能推荐合适 Agent"],
        constraints: ["共享层优先", "前端不能变重"],
        outOfScope: ["暂不改运行时调度"],
        taskType: "design",
        clarity: "medium",
        executionMode: "explore",
      },
      answers: {
        planning_mode: "explore",
      },
    });

    expect(executePlanner).toHaveBeenCalledOnce();
    const plannerCalls = executePlanner.mock.calls as unknown as Array<Array<{ prompt: string }>>;
    const plannerCall = plannerCalls[0]?.[0];
    expect(plannerCall?.prompt).toContain("dev-agent");
    expect(plannerCall?.prompt).not.toContain("solo-agent");
    expect(result.stage).toBe("review");
    expect(result.launchReadiness).toBe("explore_only");
    expect(result.recommendedAgents).toEqual([
      {
        agentId: "dev-agent",
        priority: "required",
        reason: "后续实现建议和可运行最小闭环需要工程判断。",
        expectedContribution: "补齐 MVP 实现路径和边界判断。",
      },
    ]);
    expect(result.capabilityGaps).toEqual([
      {
        capability: "批判性复核",
        reason: "需要有人专门挑战方案假设。",
        blocking: false,
        suggestedAgentIds: ["critic-agent"],
        suggestedNewAgentName: null,
        suggestedNewAgentSummary: null,
      },
    ]);
  });

  it("falls back to clarify mode when planner output is invalid", async () => {
    const service = createProjectPlanningService({
      listAgents: () => [],
      executePlanner: async () => "这不是 JSON",
      getReadiness: async () => ({ ready: true }),
      getBrowserSession: async () => ({ ok: true, status: "ready" }),
    });

    const result = await service.plan({
      rawIntent: "我想推进一个新功能，但还没想清楚怎么做。",
    });

    expect(result.stage).toBe("clarify");
    expect(result.launchReadiness).toBe("explore_only");
    expect(result.questions.length).toBeGreaterThan(0);
    expect(result.recommendedAgents).toEqual([]);
  });

  it("does not include agent roster during clarify mode", async () => {
    const teamAgent = createAgentRecord({
      id: "team-agent",
      name: "Team Agent",
    });
    const executePlanner = vi.fn(async () =>
      JSON.stringify({
        planner_summary: "先把目标补清楚。",
        brief: {
          summary: "先确认目标和交付物。",
          goal: "把目标和交付物讲清楚。",
          deliverable: "",
          success_criteria: [],
          constraints: [],
          out_of_scope: [],
          task_type: "unknown",
          clarity: "low",
          execution_mode: "explore",
        },
        questions: [
          {
            id: "deliverable",
            title: "这次最想拿到什么结果？",
            description: "先对齐交付物。",
            kind: "single_select",
            required: true,
            options: [
              {
                value: "spec",
                label: "方案",
                description: "先产出方案。",
              },
            ],
          },
        ],
        recommended_agents: [
          {
            agent_id: "team-agent",
            priority: "required",
            reason: "clarify 阶段不应保留。",
            expected_contribution: "clarify 阶段不应保留。",
          },
        ],
        capability_gaps: [
          {
            capability: "某项能力",
            reason: "clarify 阶段不应保留。",
            blocking: true,
            suggested_agent_ids: ["team-agent"],
            suggested_new_agent_name: "",
            suggested_new_agent_summary: "",
          },
        ],
        launch_readiness: "need_agents",
      }),
    );
    const service = createProjectPlanningService({
      listAgents: () => [teamAgent],
      executePlanner,
      getReadiness: async () => ({ ready: true }),
      getBrowserSession: async () => ({ ok: true, status: "ready" }),
    });

    const result = await service.plan({
      mode: "clarify",
      rawIntent: "我想推进一个新方向。",
    });

    const plannerCalls = executePlanner.mock.calls as unknown as Array<Array<{ prompt: string }>>;
    const plannerCall = plannerCalls[0]?.[0];

    expect(plannerCall?.prompt).not.toContain("team-agent");
    expect(result.stage).toBe("clarify");
    expect(result.recommendedAgents).toEqual([]);
    expect(result.capabilityGaps).toEqual([]);
    expect(result.launchReadiness).toBe("explore_only");
  });

  it("falls back gracefully when planner execution throws", async () => {
    const service = createProjectPlanningService({
      listAgents: () => [],
      executePlanner: async () => {
        throw new Error("planner unavailable");
      },
      getReadiness: async () => ({ ready: true }),
      getBrowserSession: async () => ({ ok: true, status: "ready" }),
    });

    const result = await service.plan({
      mode: "clarify",
      rawIntent: "我想推进一个方向，但当前外部 planner 不可用。",
    });

    expect(result.stage).toBe("clarify");
    expect(result.questions.length).toBeGreaterThan(0);
    expect(result.launchReadiness).toBe("explore_only");
  });

  it("uses answered fallback data to finish clarify mode when planner is unavailable", async () => {
    const service = createProjectPlanningService({
      listAgents: () => [],
      executePlanner: async () => {
        throw new Error("planner unavailable");
      },
      getReadiness: async () => ({ ready: true }),
      getBrowserSession: async () => ({ ok: true, status: "ready" }),
    });

    const result = await service.plan({
      mode: "clarify",
      rawIntent: "我想推进一个方向，但当前外部 planner 不可用。",
      answers: {
        planning_mode: "explore",
        deliverable_type: "spec",
        constraints: "先不要改前端，只想先把方案定清楚。",
      },
    });

    expect(result.stage).toBe("review");
    expect(result.questions).toEqual([]);
    expect(result.launchReadiness).toBe("ready");
    expect(result.brief.deliverable).toBe("方案或 brief");
    expect(result.brief.constraints).toEqual(["先不要改前端，只想先把方案定清楚。"]);
  });

  it("short-circuits to fallback when runtime is not ready", async () => {
    const executePlanner = vi.fn(async () => "{}");
    const service = createProjectPlanningService({
      listAgents: () => [],
      executePlanner,
      getReadiness: async () => ({ ready: false }),
      getBrowserSession: async () => ({ ok: false, status: "launching" }),
    });

    const result = await service.plan({
      mode: "clarify",
      rawIntent: "我想推进一个方向。",
    });

    expect(executePlanner).not.toHaveBeenCalled();
    expect(result.stage).toBe("clarify");
    expect(result.questions.length).toBeGreaterThan(0);
  });
});
