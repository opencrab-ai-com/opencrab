import { describe, expect, it } from "vitest";
import { buildProjectRoomProjection } from "@/lib/modules/projects/project-room-projection";
import type {
  ProjectAgentRecord,
  ProjectDetail,
  ProjectRoomRecord,
} from "@/lib/projects/types";
import type { ConversationMessage } from "@/lib/seed-data";

function createProject(overrides: Partial<ProjectRoomRecord> = {}): ProjectRoomRecord {
  return {
    id: "project-1",
    title: "Team Alpha",
    teamName: "Team Alpha",
    goal: "Ship a feature",
    workspaceDir: "/tmp/team-alpha",
    sandboxMode: "workspace-write",
    teamConversationId: "conversation-1",
    summary: "Running",
    status: "active",
    runStatus: "running",
    latestUserRequest: "补充验收标准",
    currentStageLabel: "项目经理统筹",
    activeAgentId: "agent-manager",
    nextAgentId: null,
    memberCount: 2,
    artifactCount: 0,
    lastActivityLabel: "刚刚更新",
    createdAt: "2026-03-31T00:00:00.000Z",
    updatedAt: "2026-03-31T00:00:00.000Z",
    ...overrides,
  };
}

function createAgent(overrides: Partial<ProjectAgentRecord> = {}): ProjectAgentRecord {
  return {
    id: "agent-1",
    projectId: "project-1",
    name: "成员甲",
    role: "工程师",
    responsibility: "实现",
    status: "idle",
    visibility: "frontstage",
    model: "gpt-5.4",
    reasoningEffort: "high",
    sandboxMode: "workspace-write",
    canDelegate: false,
    ...overrides,
  };
}

function createDetail(overrides: Partial<ProjectDetail> = {}): ProjectDetail {
  return {
    project: createProject(),
    agents: [],
    events: [],
    artifacts: [],
    mailboxThreads: [],
    projectMemory: null,
    teamMemory: null,
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
    ...overrides,
  };
}

function createMessage(overrides: Partial<ConversationMessage> = {}): ConversationMessage {
  return {
    id: "message-1",
    role: "assistant",
    actorLabel: "项目经理",
    content: "默认消息",
    timestamp: "2026-03-31T10:00:00.000Z",
    ...overrides,
  };
}

describe("project room projection", () => {
  it("derives structured activity descriptors and anchors from runtime messages", () => {
    const detail = createDetail({
      project: createProject({
        runStatus: "waiting_user",
        latestUserRequest: "补充验收标准",
      }),
      agents: [
        createAgent({
          id: "agent-manager",
          name: "项目经理",
          canDelegate: true,
        }),
      ],
      learningSuggestions: [
        {
          id: "suggestion-1",
          projectId: "project-1",
          kind: "quality_gate",
          targetLabel: "验收标准",
          title: "补齐验收标准",
          summary: "需要显式写出验收标准。",
          status: "open",
          actionItems: ["补齐验收标准模板"],
          writebackSummary: null,
          writebackTargets: [],
          requiresHumanReview: false,
          evidenceLabels: ["验收标准"],
          evidenceSources: [],
          reviewThreadId: null,
          reviewedAt: null,
          reviewNote: null,
          updatedAt: "2026-03-31T09:00:00.000Z",
        },
      ],
      recoveryActions: [
        {
          id: "recovery-1",
          projectId: "project-1",
          taskId: null,
          taskTitle: "回滚任务",
          kind: "rollback_to_checkpoint",
          summary: "回滚到最近 checkpoint 重新推进",
          fromAgentId: null,
          fromAgentName: null,
          toAgentId: null,
          toAgentName: null,
          createdAt: "2026-03-31T08:00:00.000Z",
        },
      ],
    });
    const teamMessages = [
      createMessage({
        id: "message-learning",
        actorLabel: "项目经理",
        content: "等待你先补充验收标准后再继续。",
        timestamp: "2026-03-31T10:02:00.000Z",
      }),
      createMessage({
        id: "message-user",
        role: "user",
        actorLabel: undefined,
        content: "补充验收标准",
        timestamp: "2026-03-31T10:01:00.000Z",
      }),
      createMessage({
        id: "message-recovery",
        actorLabel: "项目经理",
        content: "先回滚到最近 checkpoint。",
        timestamp: "2026-03-31T10:00:00.000Z",
      }),
    ];

    const projection = buildProjectRoomProjection({ detail, teamMessages });

    expect(projection.runtimeMessages.map((message) => message.id)).toEqual([
      "message-learning",
      "message-user",
      "message-recovery",
    ]);
    expect(projection.activityDescriptorsByMessageId["message-user"]).toEqual({
      kind: "user_checkpoint_update",
    });
    expect(projection.activityAnchorsByMessageId["message-learning"]).toEqual({
      kind: "learning",
      suggestionId: "suggestion-1",
    });
    expect(projection.activityAnchorsByMessageId["message-recovery"]).toEqual({
      kind: "checkpoint",
    });
    expect(projection.latestActivityDescriptor).toEqual({
      kind: "manager_waiting_user",
    });
  });

  it("projects structured agent trajectories and room-level statuses", () => {
    const detail = createDetail({
      project: createProject({
        runStatus: "running",
        activeAgentId: "agent-manager",
        nextAgentId: "agent-worker",
      }),
      agents: [
        createAgent({
          id: "agent-manager",
          name: "项目经理",
          canDelegate: true,
        }),
        createAgent({
          id: "agent-worker",
          name: "成员甲",
          status: "working",
        }),
        createAgent({
          id: "agent-reviewer",
          name: "成员乙",
          status: "reviewing",
          lastCompletedAt: "2026-03-31T09:30:00.000Z",
        }),
        createAgent({
          id: "agent-blocked",
          name: "成员丙",
          blockedByAgentId: "agent-worker",
        }),
      ],
    });

    const projection = buildProjectRoomProjection({
      detail,
      teamMessages: [],
    });

    expect(projection.agentTrajectoriesByAgentId["agent-manager"]).toEqual({
      kind: "manager_coordinating_handoff",
      nextAgentName: "成员甲",
    });
    expect(projection.agentTrajectoriesByAgentId["agent-worker"]).toEqual({
      kind: "agent_working",
    });
    expect(projection.agentTrajectoriesByAgentId["agent-reviewer"]).toEqual({
      kind: "agent_handed_back",
      completedAt: "2026-03-31T09:30:00.000Z",
    });
    expect(projection.agentTrajectoriesByAgentId["agent-blocked"]).toEqual({
      kind: "agent_waiting_upstream",
      blockerName: "成员甲",
    });
    expect(projection.agentProjectStatusesByAgentId["agent-worker"]).toBe("running");
    expect(projection.agentProjectStatusesByAgentId["agent-reviewer"]).toBe("completed");
  });
});
