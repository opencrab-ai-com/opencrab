import { describe, expect, it } from "vitest";
import { buildArtifactDependencyEdges, compactArtifactLabel } from "@/lib/projects/project-room-view-model";
import type { ProjectArtifactRecord, ProjectTaskRecord } from "@/lib/projects/types";

function createArtifact(overrides: Partial<ProjectArtifactRecord> = {}): ProjectArtifactRecord {
  return {
    id: "artifact-1",
    projectId: "project-1",
    title: "阶段总结",
    typeLabel: "Checkpoint",
    summary: "阶段结果",
    status: "ready",
    sourceTaskId: "task-1",
    sourceTaskTitle: "整理阶段总结",
    ownerAgentId: "agent-1",
    ownerAgentName: "项目经理",
    reviewStatus: "approved",
    reviewerAgentId: "agent-2",
    reviewerAgentName: "评审成员",
    dependsOnArtifactIds: [],
    consumedByTaskIds: [],
    updatedAt: "2026-03-23T00:00:00.000Z",
    ...overrides,
  };
}

function createTask(overrides: Partial<ProjectTaskRecord> = {}): ProjectTaskRecord {
  return {
    id: "task-1",
    projectId: "project-1",
    title: "整理阶段总结",
    description: "整理结果",
    status: "completed",
    ownerAgentId: "agent-1",
    ownerAgentName: "项目经理",
    stageLabel: "结果整理",
    acceptanceCriteria: "整理出阶段总结",
    queuedStatus: null,
    dependsOnTaskIds: [],
    inputArtifactIds: [],
    blockedByTaskId: null,
    blockedReason: null,
    lockScopePaths: [],
    lockStatus: "none",
    lockBlockedByTaskId: null,
    resultSummary: "已整理",
    artifactIds: [],
    createdAt: "2026-03-23T00:00:00.000Z",
    updatedAt: "2026-03-23T00:00:00.000Z",
    claimedAt: null,
    recoveryAttemptCount: 0,
    ownerReplacementCount: 0,
    lastReassignedAt: null,
    lastReassignmentReason: null,
    leaseAcquiredAt: null,
    leaseHeartbeatAt: null,
    leaseExpiresAt: null,
    startedAt: null,
    completedAt: "2026-03-23T00:00:00.000Z",
    ...overrides,
  };
}

describe("projectRoomViewModel", () => {
  it("builds artifact graph edges for upstream artifacts and downstream task consumers", () => {
    const upstreamArtifact = createArtifact({
      id: "artifact-upstream",
      title: "设计草图",
      consumedByTaskIds: ["task-2"],
    });
    const derivedArtifact = createArtifact({
      id: "artifact-derived",
      title: "页面实现结果",
      sourceTaskId: "task-2",
      sourceTaskTitle: "实现页面第一版",
      dependsOnArtifactIds: ["artifact-upstream"],
      consumedByTaskIds: ["task-3"],
    });
    const taskTwo = createTask({
      id: "task-2",
      title: "实现页面第一版",
    });
    const taskThree = createTask({
      id: "task-3",
      title: "验收页面实现",
    });

    expect(
      buildArtifactDependencyEdges(
        [upstreamArtifact, derivedArtifact],
        new Map([
          [upstreamArtifact.id, upstreamArtifact],
          [derivedArtifact.id, derivedArtifact],
        ]),
        new Map([
          [taskTwo.id, taskTwo],
          [taskThree.id, taskThree],
        ]),
      ),
    ).toEqual([
      {
        id: "task-1-artifact-upstream",
        from: "整理阶段总结",
        to: "设计草图",
        reason: "产出交付物",
      },
      {
        id: "artifact-upstream-task-2",
        from: "设计草图",
        to: "实现页面第一版",
        reason: "作为输入交付物",
      },
      {
        id: "task-2-artifact-derived",
        from: "实现页面第一版",
        to: "页面实现结果",
        reason: "产出交付物",
      },
      {
        id: "artifact-upstream-artifact-derived",
        from: "设计草图",
        to: "页面实现结果",
        reason: "经由 实现页面第一版 汇入",
      },
      {
        id: "artifact-derived-task-3",
        from: "页面实现结果",
        to: "验收页面实现",
        reason: "作为输入交付物",
      },
    ]);
  });

  it("compacts overly long artifact labels for dense Team Room cards", () => {
    expect(compactArtifactLabel("这是一个很长很长的交付物标题，用来验证会被压缩显示")).toBe(
      "这是一个很长很长的交付物标题，用来验...",
    );
  });
});
