import { describe, expect, it, vi } from "vitest";
import { setupProjectStoreTestHome } from "@/tests/helpers/project-store-runtime";
import type { ProjectPlanningSnapshot } from "@/lib/projects/project-planning";

const runConversationTurnMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/conversations/run-conversation-turn", () => ({
  runConversationTurn: runConversationTurnMock,
}));

const { createTempHome } = setupProjectStoreTestHome(runConversationTurnMock);

describe("project-store createProject with planning snapshot", () => {
  it("persists the structured planning snapshot and auto-adds the project manager", async () => {
    const { workspaceDir } = createTempHome("opencrab-project-planning-");
    const { createProject } = await import("@/lib/projects/project-store");
    const planningSnapshot: ProjectPlanningSnapshot = {
      rawIntent: "我想把 Team 模式的新建团队流程做顺。",
      answers: {
        planning_mode: "explore",
        deliverable_type: "spec",
      },
      plannerSummary: "先用探索团队把 brief 和阵容收束清楚，再进入执行。",
      brief: {
        summary: "先明确任务边界、交付物和推荐阵容。",
        goal: "优化 Team 模式的新建团队体验，并形成一版可落地方案。",
        deliverable: "结构化 brief 与推荐团队",
        successCriteria: ["用户能从模糊输入开始", "系统能推荐合适 Agent"],
        constraints: ["共享层优先", "不把推荐逻辑写进 UI"],
        outOfScope: ["暂不改团队运行时"],
        taskType: "design",
        clarity: "medium",
        executionMode: "explore",
      },
      recommendedAgents: [],
      capabilityGaps: [],
      launchReadiness: "explore_only",
      createdAt: "2026-04-02T12:00:00.000Z",
    };

    const detail = createProject({
      goal: "",
      workspaceDir,
      agentProfileIds: [],
      planningSnapshot,
    });

    expect(detail?.project?.planningSnapshot).toEqual(planningSnapshot);
    expect(detail?.project?.goal).toContain("任务目标：优化 Team 模式的新建团队体验，并形成一版可落地方案。");
    expect(detail?.project?.summary).toBe("先用探索团队把 brief 和阵容收束清楚，再进入执行。");
    expect(detail?.project?.memberCount).toBe(1);
    expect(detail?.agents.map((agent) => agent.agentProfileId)).toContain("project-manager");
  });
});
