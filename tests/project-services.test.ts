import { mkdtempSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it, vi } from "vitest";
import { createProjectQueryService } from "@/lib/modules/projects/project-query-service";
import { createProjectRuntimeService } from "@/lib/modules/projects/project-runtime-service";
import type { ProjectDetail, ProjectRoomRecord } from "@/lib/projects/types";

function createProjectRoom(overrides: Partial<ProjectRoomRecord> = {}): ProjectRoomRecord {
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
    latestUserRequest: "Ship it",
    currentStageLabel: "项目经理统筹",
    activeAgentId: null,
    nextAgentId: null,
    memberCount: 3,
    artifactCount: 1,
    lastActivityLabel: "刚刚更新",
    createdAt: "2026-03-23T00:00:00.000Z",
    updatedAt: "2026-03-23T00:00:00.000Z",
    ...overrides,
  };
}

function createProjectDetail(overrides: Partial<ProjectDetail> = {}): ProjectDetail {
  return {
    project: createProjectRoom(),
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

describe("project module services", () => {
  it("delegates project queries through the query service", () => {
    const room = createProjectRoom();
    const detail = createProjectDetail({ project: room });
    const list = vi.fn(() => [room]);
    const getDetail = vi.fn(() => detail);
    const service = createProjectQueryService({ list, getDetail });

    expect(service.list()).toEqual([room]);
    expect(service.getDetail("project-1")).toEqual(detail);
    expect(list).toHaveBeenCalledOnce();
    expect(getDetail).toHaveBeenCalledWith("project-1");
  });

  it("delegates create and delete through the management service", async () => {
    const originalOpencrabHome = process.env.OPENCRAB_HOME;
    const tempHome = mkdtempSync(path.join(os.tmpdir(), "opencrab-project-services-"));
    process.env.OPENCRAB_HOME = tempHome;
    vi.resetModules();

    const detail = createProjectDetail();
    const create = vi.fn(() => detail);
    const remove = vi.fn(() => true);
    const updateWorkspaceDir = vi.fn(() => detail);
    const updateSandboxMode = vi.fn(() => detail);
    const updateFeishuChatSessionId = vi.fn(() => detail);
    const { createProjectManagementService } = await import(
      "@/lib/modules/projects/project-management-service"
    );
    const service = createProjectManagementService({
      create,
      remove,
      updateWorkspaceDir,
      updateSandboxMode,
      updateFeishuChatSessionId,
    });

    try {
      expect(
        service.create({
          goal: "Ship a feature",
          workspaceDir: "/tmp/team-alpha",
          agentProfileIds: ["project-manager"],
          model: "gpt-5.4",
          reasoningEffort: "high",
          sandboxMode: "workspace-write",
        }),
      ).toEqual(detail);
      expect(service.remove("project-1")).toBe(true);
      expect(service.updateWorkspaceDir("project-1", "/tmp/team-beta")).toEqual(detail);
      expect(service.updateSandboxMode("project-1", "read-only")).toEqual(detail);
      await expect(
        service.updateFeishuChatSessionId("project-1", "oc_team_room"),
      ).resolves.toEqual(detail);
      expect(create).toHaveBeenCalledWith({
        goal: "Ship a feature",
        workspaceDir: "/tmp/team-alpha",
        agentProfileIds: ["project-manager"],
        model: "gpt-5.4",
        reasoningEffort: "high",
        sandboxMode: "workspace-write",
      });
      expect(remove).toHaveBeenCalledWith("project-1");
      expect(updateWorkspaceDir).toHaveBeenCalledWith("project-1", "/tmp/team-beta");
      expect(updateSandboxMode).toHaveBeenCalledWith("project-1", "read-only");
      expect(updateFeishuChatSessionId).toHaveBeenCalledWith("project-1", "oc_team_room");
    } finally {
      if (originalOpencrabHome === undefined) {
        delete process.env.OPENCRAB_HOME;
      } else {
        process.env.OPENCRAB_HOME = originalOpencrabHome;
      }

      rmSync(tempHome, { recursive: true, force: true });
    }
  });

  it("delegates run and checkpoint actions through the runtime service", async () => {
    const detail = createProjectDetail();
    const run = vi.fn(async () => detail);
    const updateCheckpoint = vi.fn(async () => detail);
    const reviewLearningSuggestion = vi.fn(() => detail);
    const reviewLearningReuseCandidate = vi.fn(() => detail);
    const service = createProjectRuntimeService({
      run,
      updateCheckpoint,
      reviewLearningSuggestion,
      reviewLearningReuseCandidate,
    });

    await expect(
      service.run("project-1", {
        triggerLabel: "手动启动",
        triggerPrompt: "继续推进",
      }),
    ).resolves.toEqual(detail);
    await expect(
      service.updateCheckpoint("project-1", {
        action: "pause",
        note: "先停一下",
      }),
    ).resolves.toEqual(detail);
    expect(
      service.reviewLearningSuggestion("project-1", {
        suggestionId: "suggestion-1",
        action: "accept",
      }),
    ).toEqual(detail);
    expect(
      service.reviewLearningReuseCandidate("project-1", {
        candidateId: "candidate-1",
        action: "confirm",
      }),
    ).toEqual(detail);
    expect(run).toHaveBeenCalledWith("project-1", {
      triggerLabel: "手动启动",
      triggerPrompt: "继续推进",
    });
    expect(updateCheckpoint).toHaveBeenCalledWith("project-1", {
      action: "pause",
      note: "先停一下",
    });
    expect(reviewLearningSuggestion).toHaveBeenCalledWith("project-1", {
      suggestionId: "suggestion-1",
      action: "accept",
    });
    expect(reviewLearningReuseCandidate).toHaveBeenCalledWith("project-1", {
      candidateId: "candidate-1",
      action: "confirm",
    });
  });
});
