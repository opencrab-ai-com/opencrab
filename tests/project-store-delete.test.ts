import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { STRATEGY_AGENT_ID, seedTestTeamAgents } from "@/tests/helpers/team-agents";

type ProjectStoreModule = Awaited<typeof import("@/lib/projects/project-store")>;

async function loadProjectStore(): Promise<ProjectStoreModule> {
  vi.resetModules();
  return import("@/lib/projects/project-store");
}

describe("project store deletion cleanup", () => {
  const originalOpencrabHome = process.env.OPENCRAB_HOME;
  const tempHomes: string[] = [];

  beforeEach(() => {
    tempHomes.length = 0;
  });

  afterEach(() => {
    if (originalOpencrabHome === undefined) {
      delete process.env.OPENCRAB_HOME;
    } else {
      process.env.OPENCRAB_HOME = originalOpencrabHome;
    }

    tempHomes.forEach((homePath) => {
      rmSync(homePath, { recursive: true, force: true });
    });
  });

  it("cascades project-scoped records on delete while preserving workspace output files", async () => {
    const tempHome = mkdtempSync(path.join(os.tmpdir(), "opencrab-project-delete-"));
    const workspaceDir = path.join(tempHome, "workspace");
    const markerPath = path.join(workspaceDir, "keep-me.txt");
    tempHomes.push(tempHome);
    process.env.OPENCRAB_HOME = tempHome;
    seedTestTeamAgents(tempHome);
    mkdirSync(workspaceDir, { recursive: true });
    writeFileSync(markerPath, "keep workspace output");

    const projectStore = await loadProjectStore();
    const created = projectStore.createProject({
      goal: "清理删除 Team 的级联数据",
      workspaceDir,
      agentProfileIds: ["project-manager", STRATEGY_AGENT_ID],
    });
    const projectId = created?.project?.id ?? null;
    const projectTitle = created?.project?.title ?? "project";

    expect(projectId).toBeTruthy();

    if (!projectId) {
      throw new Error("projectId should exist after createProject");
    }

    const storePath = path.join(tempHome, "state", "projects.json");
    const rawState = JSON.parse(readFileSync(storePath, "utf8")) as {
      agents: Array<Record<string, unknown>>;
      mailboxThreads: Array<Record<string, unknown>>;
      projectMemories: Array<Record<string, unknown>>;
      teamMemories: Array<Record<string, unknown>>;
      roleMemories: Array<Record<string, unknown>>;
      taskReflections: Array<Record<string, unknown>>;
      stageReflections: Array<Record<string, unknown>>;
      runSummaries: Array<Record<string, unknown>>;
      learningSuggestions: Array<Record<string, unknown>>;
      learningReuseCandidates: Array<Record<string, unknown>>;
      autonomyGates: Array<Record<string, unknown>>;
      heartbeats: Array<Record<string, unknown>>;
      stuckSignals: Array<Record<string, unknown>>;
      recoveryActions: Array<Record<string, unknown>>;
      tasks: Array<Record<string, unknown>>;
      reviews: Array<Record<string, unknown>>;
      runs: Array<Record<string, unknown>>;
    };
    const manager =
      rawState.agents.find(
        (agent) => agent.projectId === projectId && agent.agentProfileId === "project-manager",
      ) ?? null;
    const task = rawState.tasks.find((item) => item.projectId === projectId) ?? null;
    const now = "2026-03-24T03:00:00.000Z";

    if (!manager || !task) {
      throw new Error("expected seeded manager and task records");
    }

    rawState.mailboxThreads.push({
      id: "thread-delete-1",
      projectId,
      kind: "handoff",
      status: "open",
      subject: "handoff",
      summary: "delete me",
      fromAgentId: manager.id ?? null,
      fromAgentName: manager.name ?? null,
      toAgentIds: [],
      toAgentNames: [],
      relatedTaskId: task.id ?? null,
      relatedTaskTitle: task.title ?? null,
      relatedReviewId: null,
      relatedSuggestionId: "suggestion-delete-1",
      relatedArtifactIds: [],
      createdAt: now,
      updatedAt: now,
      resolvedAt: null,
    });
    rawState.projectMemories.push({
      id: "project-memory-delete-1",
      projectId,
      summary: "project memory",
      decisions: [],
      preferences: [],
      risks: [],
      pitfalls: [],
      updatedAt: now,
    });
    rawState.teamMemories.push({
      id: "team-memory-delete-1",
      projectId,
      summary: "team memory",
      handoffPatterns: [],
      blockerPatterns: [],
      reviewPatterns: [],
      updatedAt: now,
    });
    rawState.roleMemories.push({
      id: "role-memory-delete-1",
      projectId,
      agentId: manager.id,
      agentName: manager.name,
      strengths: [],
      commonIssues: [],
      preferredInputFormat: [],
      updatedAt: now,
    });
    rawState.taskReflections.push({
      id: "task-reflection-delete-1",
      projectId,
      taskId: task.id,
      taskTitle: task.title,
      ownerAgentId: manager.id,
      ownerAgentName: manager.name,
      outcome: "smooth",
      summary: "task reflection",
      wins: [],
      issues: [],
      advice: [],
      createdAt: now,
      updatedAt: now,
    });
    rawState.stageReflections.push({
      id: "stage-reflection-delete-1",
      projectId,
      stageLabel: "项目经理统筹",
      summary: "stage reflection",
      highlights: [],
      frictions: [],
      recommendations: [],
      updatedAt: now,
    });
    rawState.runSummaries.push({
      id: "run-summary-delete-1",
      projectId,
      runId: "run-delete-1",
      title: "run summary",
      outcome: "completed",
      summary: "run summary",
      wins: [],
      risks: [],
      recommendations: [],
      updatedAt: now,
    });
    rawState.learningSuggestions.push({
      id: "suggestion-delete-1",
      projectId,
      kind: "task_template",
      status: "accepted",
      title: "learning suggestion",
      summary: "learning suggestion",
      evidenceLabels: [],
      evidenceSources: [],
      targetLabel: null,
      actionItems: [],
      writebackSummary: null,
      writebackTargets: [],
      requiresHumanReview: false,
      reviewThreadId: null,
      reviewNote: null,
      reviewedAt: null,
      updatedAt: now,
    });
    rawState.learningReuseCandidates.push({
      id: "reuse-delete-1",
      sourceProjectId: projectId,
      sourceProjectTitle: projectTitle,
      sourceSuggestionId: "suggestion-delete-1",
      sourceSuggestionTitle: "learning suggestion",
      kind: "task_template_candidate",
      status: "pending_review",
      title: "reuse candidate",
      summary: "reuse candidate",
      targetLabel: null,
      evidenceLabels: [],
      evidenceSources: [],
      acceptedAt: now,
      reviewNote: null,
      reviewedAt: null,
      updatedAt: now,
    });
    rawState.autonomyGates.push({
      id: "gate-delete-1",
      projectId,
      kind: "autonomy_budget",
      status: "open",
      title: "gate",
      summary: "gate",
      openedAt: now,
      updatedAt: now,
      resolvedAt: null,
    });
    rawState.heartbeats.push({
      id: "heartbeat-delete-1",
      projectId,
      agentId: manager.id,
      agentName: manager.name,
      status: "warning",
      taskId: task.id,
      taskTitle: task.title,
      summary: "heartbeat",
      recordedAt: now,
      leaseExpiresAt: null,
    });
    rawState.stuckSignals.push({
      id: "stuck-delete-1",
      projectId,
      agentId: manager.id,
      agentName: manager.name,
      taskId: task.id,
      taskTitle: task.title,
      kind: "reply_timeout",
      status: "open",
      summary: "stuck",
      detectedAt: now,
      updatedAt: now,
      resolvedAt: null,
    });
    rawState.recoveryActions.push({
      id: "recovery-delete-1",
      projectId,
      kind: "reassign_to_peer",
      summary: "recovery",
      taskId: task.id,
      taskTitle: task.title,
      fromAgentId: manager.id,
      fromAgentName: manager.name,
      toAgentId: null,
      toAgentName: null,
      createdAt: now,
    });
    writeFileSync(storePath, JSON.stringify(rawState, null, 2));

    expect(projectStore.deleteProject(projectId)).toBe(true);

    const nextState = JSON.parse(readFileSync(storePath, "utf8")) as {
      rooms: Array<Record<string, unknown>>;
      agents: Array<Record<string, unknown>>;
      events: Array<Record<string, unknown>>;
      artifacts: Array<Record<string, unknown>>;
      mailboxThreads: Array<Record<string, unknown>>;
      projectMemories: Array<Record<string, unknown>>;
      teamMemories: Array<Record<string, unknown>>;
      roleMemories: Array<Record<string, unknown>>;
      taskReflections: Array<Record<string, unknown>>;
      stageReflections: Array<Record<string, unknown>>;
      runSummaries: Array<Record<string, unknown>>;
      learningSuggestions: Array<Record<string, unknown>>;
      learningReuseCandidates: Array<Record<string, unknown>>;
      autonomyGates: Array<Record<string, unknown>>;
      heartbeats: Array<Record<string, unknown>>;
      stuckSignals: Array<Record<string, unknown>>;
      recoveryActions: Array<Record<string, unknown>>;
      reviews: Array<Record<string, unknown>>;
      tasks: Array<Record<string, unknown>>;
      runs: Array<Record<string, unknown>>;
    };

    const projectScopedKeys = [
      "agents",
      "events",
      "artifacts",
      "mailboxThreads",
      "projectMemories",
      "teamMemories",
      "roleMemories",
      "taskReflections",
      "stageReflections",
      "runSummaries",
      "learningSuggestions",
      "autonomyGates",
      "heartbeats",
      "stuckSignals",
      "recoveryActions",
      "reviews",
      "tasks",
      "runs",
    ] as const;

    expect(nextState.rooms.some((item) => item.id === projectId)).toBe(false);

    projectScopedKeys.forEach((key) => {
      expect(nextState[key].some((item) => item.projectId === projectId)).toBe(false);
    });

    expect(nextState.learningReuseCandidates.some((item) => item.sourceProjectId === projectId)).toBe(false);
    expect(existsSync(markerPath)).toBe(true);
  });

  it("prunes orphaned project records from already deleted Teams during normalization", async () => {
    const tempHome = mkdtempSync(path.join(os.tmpdir(), "opencrab-project-prune-"));
    const workspaceDir = path.join(tempHome, "workspace");
    tempHomes.push(tempHome);
    process.env.OPENCRAB_HOME = tempHome;
    seedTestTeamAgents(tempHome);

    const projectStore = await loadProjectStore();
    const created = projectStore.createProject({
      goal: "保留当前有效 Team",
      workspaceDir,
      agentProfileIds: ["project-manager", STRATEGY_AGENT_ID],
    });
    const activeProjectId = created?.project?.id ?? null;

    expect(activeProjectId).toBeTruthy();

    if (!activeProjectId) {
      throw new Error("activeProjectId should exist after createProject");
    }

    const storePath = path.join(tempHome, "state", "projects.json");
    const rawState = JSON.parse(readFileSync(storePath, "utf8")) as {
      agents: Array<Record<string, unknown>>;
      mailboxThreads: Array<Record<string, unknown>>;
      projectMemories: Array<Record<string, unknown>>;
      teamMemories: Array<Record<string, unknown>>;
      roleMemories: Array<Record<string, unknown>>;
      taskReflections: Array<Record<string, unknown>>;
      stageReflections: Array<Record<string, unknown>>;
      runSummaries: Array<Record<string, unknown>>;
      learningSuggestions: Array<Record<string, unknown>>;
      learningReuseCandidates: Array<Record<string, unknown>>;
      autonomyGates: Array<Record<string, unknown>>;
      heartbeats: Array<Record<string, unknown>>;
      stuckSignals: Array<Record<string, unknown>>;
      recoveryActions: Array<Record<string, unknown>>;
      reviews: Array<Record<string, unknown>>;
      tasks: Array<Record<string, unknown>>;
      runs: Array<Record<string, unknown>>;
    };
    const activeAgent =
      rawState.agents.find(
        (agent) => agent.projectId === activeProjectId && agent.agentProfileId === "project-manager",
      ) ?? null;
    const deletedProjectId = "project-deleted-orphan";
    const now = "2026-03-24T04:00:00.000Z";

    if (!activeAgent) {
      throw new Error("expected active manager agent");
    }

    rawState.agents.push({
      ...activeAgent,
      id: "agent-orphan-1",
      projectId: deletedProjectId,
    });
    rawState.mailboxThreads.push({
      id: "thread-orphan-1",
      projectId: deletedProjectId,
      kind: "handoff",
      status: "open",
      subject: "orphan",
      summary: "orphan",
      fromAgentId: null,
      fromAgentName: null,
      toAgentIds: [],
      toAgentNames: [],
      relatedTaskId: null,
      relatedTaskTitle: null,
      relatedReviewId: null,
      relatedSuggestionId: null,
      relatedArtifactIds: [],
      createdAt: now,
      updatedAt: now,
      resolvedAt: null,
    });
    rawState.projectMemories.push({
      id: "project-memory-orphan-1",
      projectId: deletedProjectId,
      summary: "orphan",
      decisions: [],
      preferences: [],
      risks: [],
      pitfalls: [],
      updatedAt: now,
    });
    rawState.teamMemories.push({
      id: "team-memory-orphan-1",
      projectId: deletedProjectId,
      summary: "orphan",
      handoffPatterns: [],
      blockerPatterns: [],
      reviewPatterns: [],
      updatedAt: now,
    });
    rawState.roleMemories.push({
      id: "role-memory-orphan-1",
      projectId: deletedProjectId,
      agentId: "agent-orphan-1",
      agentName: "orphan",
      strengths: [],
      commonIssues: [],
      preferredInputFormat: [],
      updatedAt: now,
    });
    rawState.taskReflections.push({
      id: "task-reflection-orphan-1",
      projectId: deletedProjectId,
      taskId: "task-orphan-1",
      taskTitle: "orphan",
      ownerAgentId: null,
      ownerAgentName: null,
      outcome: "smooth",
      summary: "orphan",
      wins: [],
      issues: [],
      advice: [],
      createdAt: now,
      updatedAt: now,
    });
    rawState.stageReflections.push({
      id: "stage-reflection-orphan-1",
      projectId: deletedProjectId,
      stageLabel: "orphan",
      summary: "orphan",
      highlights: [],
      frictions: [],
      recommendations: [],
      updatedAt: now,
    });
    rawState.runSummaries.push({
      id: "run-summary-orphan-1",
      projectId: deletedProjectId,
      runId: "run-orphan-1",
      title: "orphan",
      outcome: "completed",
      summary: "orphan",
      wins: [],
      risks: [],
      recommendations: [],
      updatedAt: now,
    });
    rawState.learningSuggestions.push({
      id: "suggestion-orphan-1",
      projectId: deletedProjectId,
      kind: "task_template",
      status: "accepted",
      title: "orphan",
      summary: "orphan",
      evidenceLabels: [],
      evidenceSources: [],
      targetLabel: null,
      actionItems: [],
      writebackSummary: null,
      writebackTargets: [],
      requiresHumanReview: false,
      reviewThreadId: null,
      reviewNote: null,
      reviewedAt: null,
      updatedAt: now,
    });
    rawState.learningReuseCandidates.push({
      id: "reuse-orphan-1",
      sourceProjectId: deletedProjectId,
      sourceProjectTitle: "deleted",
      sourceSuggestionId: "suggestion-orphan-1",
      sourceSuggestionTitle: "orphan",
      kind: "task_template_candidate",
      status: "pending_review",
      title: "orphan",
      summary: "orphan",
      targetLabel: null,
      evidenceLabels: [],
      evidenceSources: [],
      acceptedAt: now,
      reviewNote: null,
      reviewedAt: null,
      updatedAt: now,
    });
    rawState.autonomyGates.push({
      id: "gate-orphan-1",
      projectId: deletedProjectId,
      kind: "autonomy_budget",
      status: "open",
      title: "orphan",
      summary: "orphan",
      openedAt: now,
      updatedAt: now,
      resolvedAt: null,
    });
    rawState.heartbeats.push({
      id: "heartbeat-orphan-1",
      projectId: deletedProjectId,
      agentId: "agent-orphan-1",
      agentName: "orphan",
      status: "warning",
      taskId: null,
      taskTitle: null,
      summary: "orphan",
      recordedAt: now,
      leaseExpiresAt: null,
    });
    rawState.stuckSignals.push({
      id: "stuck-orphan-1",
      projectId: deletedProjectId,
      agentId: "agent-orphan-1",
      agentName: "orphan",
      taskId: null,
      taskTitle: null,
      kind: "reply_timeout",
      status: "open",
      summary: "orphan",
      detectedAt: now,
      updatedAt: now,
      resolvedAt: null,
    });
    rawState.recoveryActions.push({
      id: "recovery-orphan-1",
      projectId: deletedProjectId,
      kind: "reassign_to_peer",
      summary: "orphan",
      taskId: null,
      taskTitle: null,
      fromAgentId: null,
      fromAgentName: null,
      toAgentId: null,
      toAgentName: null,
      createdAt: now,
    });
    writeFileSync(storePath, JSON.stringify(rawState, null, 2));

    const projects = projectStore.listProjects();
    expect(projects.some((project) => project.id === activeProjectId)).toBe(true);

    const normalizedState = JSON.parse(readFileSync(storePath, "utf8")) as {
      agents: Array<Record<string, unknown>>;
      mailboxThreads: Array<Record<string, unknown>>;
      projectMemories: Array<Record<string, unknown>>;
      teamMemories: Array<Record<string, unknown>>;
      roleMemories: Array<Record<string, unknown>>;
      taskReflections: Array<Record<string, unknown>>;
      stageReflections: Array<Record<string, unknown>>;
      runSummaries: Array<Record<string, unknown>>;
      learningSuggestions: Array<Record<string, unknown>>;
      learningReuseCandidates: Array<Record<string, unknown>>;
      autonomyGates: Array<Record<string, unknown>>;
      heartbeats: Array<Record<string, unknown>>;
      stuckSignals: Array<Record<string, unknown>>;
      recoveryActions: Array<Record<string, unknown>>;
      reviews: Array<Record<string, unknown>>;
      tasks: Array<Record<string, unknown>>;
      runs: Array<Record<string, unknown>>;
    };

    const projectScopedKeys = [
      "agents",
      "mailboxThreads",
      "projectMemories",
      "teamMemories",
      "roleMemories",
      "taskReflections",
      "stageReflections",
      "runSummaries",
      "learningSuggestions",
      "autonomyGates",
      "heartbeats",
      "stuckSignals",
      "recoveryActions",
      "reviews",
      "tasks",
      "runs",
    ] as const;

    projectScopedKeys.forEach((key) => {
      expect(normalizedState[key].some((item) => item.projectId === deletedProjectId)).toBe(false);
    });

    expect(
      normalizedState.learningReuseCandidates.some((item) => item.sourceProjectId === deletedProjectId),
    ).toBe(false);
    expect(projectStore.getProjectDetail(activeProjectId)?.project?.id).toBe(activeProjectId);
  });
});
