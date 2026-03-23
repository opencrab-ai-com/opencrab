"use client";

import { Fragment, type ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { useOpenCrabApp } from "@/components/app-shell/opencrab-provider";
import { buttonClassName } from "@/components/ui/button";
import { MetaPill as UnifiedMetaPill, StatusPill as UnifiedStatusPill } from "@/components/ui/pill";
import {
  DialogActions,
  DialogHeader,
  DialogPrimaryButton,
  DialogSecondaryButton,
  DialogShell,
} from "@/components/ui/dialog";
import {
  deleteProject as deleteProjectResource,
  getProjectDetail,
  pauseProject as pauseProjectResource,
  reviewProjectLearningReuseCandidate as reviewProjectLearningReuseCandidateResource,
  reviewProjectLearningSuggestion as reviewProjectLearningSuggestionResource,
  runProject,
  updateProjectCheckpoint,
} from "@/lib/resources/opencrab-api";
import { buildArtifactDependencyEdges, compactArtifactLabel } from "@/lib/projects/project-room-view-model";
import type {
  ProjectAgentStatus,
  ProjectAgentRecord,
  ProjectAutonomyGateRecord,
  ProjectArtifactRecord,
  ProjectDetail,
  ProjectHeartbeatRecord,
  ProjectLearningReuseCandidateRecord,
  ProjectLearningSuggestionRecord,
  ProjectMailboxThreadRecord,
  ProjectMemoryRecord,
  ProjectRecoveryActionRecord,
  ProjectReviewRecord,
  ProjectRoleMemoryRecord,
  ProjectRunStatus,
  ProjectRunSummaryRecord,
  ProjectStageReflectionRecord,
  ProjectStuckSignalRecord,
  ProjectTaskRecord,
  ProjectTaskReflectionRecord,
  ProjectTeamMemoryRecord,
} from "@/lib/projects/types";
import type { ConversationMessage } from "@/lib/seed-data";

const RUNNING_PROJECT_SYNC_INTERVAL_MS = 6_000;
const IDLE_PROJECT_SYNC_INTERVAL_MS = 20_000;
const PROJECT_GLOBAL_SNAPSHOT_SYNC_INTERVAL_MS = 45_000;

export function ProjectRoomScreen({ detail: initialDetail }: { detail: ProjectDetail | null }) {
  const router = useRouter();
  const { conversationMessages, refreshSnapshot } = useOpenCrabApp();
  const [detail, setDetail] = useState<ProjectDetail | null>(initialDetail);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isRunning, setIsRunning] = useState(false);
  const [isPausing, setIsPausing] = useState(false);
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [checkpointNote, setCheckpointNote] = useState("");
  const [isCheckpointSubmitting, setIsCheckpointSubmitting] = useState(false);
  const [isDeleteDialogVisible, setIsDeleteDialogVisible] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [learningSuggestionActionId, setLearningSuggestionActionId] = useState<string | null>(null);
  const [learningSuggestionActionKind, setLearningSuggestionActionKind] = useState<"accept" | "dismiss" | null>(null);
  const [learningReuseCandidateActionId, setLearningReuseCandidateActionId] = useState<string | null>(null);
  const [learningReuseCandidateActionKind, setLearningReuseCandidateActionKind] = useState<"confirm" | "dismiss" | null>(null);
  const [selectedAgentId, setSelectedAgentId] = useState<string | null>(null);
  const [focusedArtifactId, setFocusedArtifactId] = useState<string | null>(null);
  const [focusedLearningSuggestionId, setFocusedLearningSuggestionId] = useState<string | null>(null);
  const [selectedArtifactId, setSelectedArtifactId] = useState<string | null>(null);
  const [selectedMailboxThreadId, setSelectedMailboxThreadId] = useState<string | null>(null);
  const [selectedActivityMessageId, setSelectedActivityMessageId] = useState<string | null>(null);
  const checkpointSectionRef = useRef<HTMLElement | null>(null);
  const runtimeHealthSectionRef = useRef<HTMLElement | null>(null);
  const learningSectionRef = useRef<HTMLElement | null>(null);
  const memorySectionRef = useRef<HTMLElement | null>(null);
  const coordinationSectionRef = useRef<HTMLElement | null>(null);
  const activitySectionRef = useRef<HTMLElement | null>(null);
  const artifactSectionRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (detail?.project?.runStatus === "waiting_user") {
      setCheckpointNote(detail.project.latestUserRequest || "");
      return;
    }

    setCheckpointNote("");
  }, [detail?.project?.id, detail?.project?.latestUserRequest, detail?.project?.runStatus]);

  const projectId = detail?.project?.id ?? null;
  const projectRunStatus = detail?.project?.runStatus ?? null;
  const agents = useMemo(() => detail?.agents ?? [], [detail?.agents]);
  const artifacts = useMemo(() => detail?.artifacts ?? [], [detail?.artifacts]);
  const mailboxThreads = useMemo(() => detail?.mailboxThreads ?? [], [detail?.mailboxThreads]);
  const projectMemory = useMemo(() => detail?.projectMemory ?? null, [detail?.projectMemory]);
  const teamMemory = useMemo(() => detail?.teamMemory ?? null, [detail?.teamMemory]);
  const roleMemories = useMemo(() => detail?.roleMemories ?? [], [detail?.roleMemories]);
  const taskReflections = useMemo(() => detail?.taskReflections ?? [], [detail?.taskReflections]);
  const stageReflections = useMemo(() => detail?.stageReflections ?? [], [detail?.stageReflections]);
  const runSummaries = useMemo(() => detail?.runSummaries ?? [], [detail?.runSummaries]);
  const learningSuggestions = useMemo(() => detail?.learningSuggestions ?? [], [detail?.learningSuggestions]);
  const learningReuseCandidates = useMemo(
    () => detail?.learningReuseCandidates ?? [],
    [detail?.learningReuseCandidates],
  );
  const autonomyGates = useMemo(() => detail?.autonomyGates ?? [], [detail?.autonomyGates]);
  const heartbeats = useMemo(() => detail?.heartbeats ?? [], [detail?.heartbeats]);
  const stuckSignals = useMemo(() => detail?.stuckSignals ?? [], [detail?.stuckSignals]);
  const recoveryActions = useMemo(() => detail?.recoveryActions ?? [], [detail?.recoveryActions]);
  const reviews = useMemo(() => detail?.reviews ?? [], [detail?.reviews]);
  const tasks = useMemo(() => detail?.tasks ?? [], [detail?.tasks]);
  const runs = useMemo(() => detail?.runs ?? [], [detail?.runs]);

  useEffect(() => {
    if (!projectId) {
      return;
    }

    let cancelled = false;
    let lastGlobalSnapshotSyncAt = 0;
    const intervalMs =
      projectRunStatus === "running"
        ? RUNNING_PROJECT_SYNC_INTERVAL_MS
        : IDLE_PROJECT_SYNC_INTERVAL_MS;

    const syncRuntimeView = async (options: { includeGlobalSnapshot?: boolean } = {}) => {
      if (
        cancelled ||
        document.visibilityState !== "visible" ||
        isInteractiveInputFocused()
      ) {
        return;
      }

      try {
        const now = Date.now();
        const shouldSyncGlobalSnapshot =
          options.includeGlobalSnapshot === true ||
          now - lastGlobalSnapshotSyncAt >= PROJECT_GLOBAL_SNAPSHOT_SYNC_INTERVAL_MS;
        const next = await getProjectDetail(projectId);

        if (shouldSyncGlobalSnapshot) {
          await refreshSnapshot();
          lastGlobalSnapshotSyncAt = now;
        }

        if (!cancelled && hasProjectDetailMeaningfulChange(detail, next)) {
          setDetail(next);
        }
      } catch {
        // Keep runtime polling quiet. Manual refresh is still available.
      }
    };

    const intervalId = window.setInterval(() => {
      void syncRuntimeView();
    }, intervalMs);

    function handleVisibilityChange() {
      if (document.visibilityState === "visible") {
        void syncRuntimeView({ includeGlobalSnapshot: true });
      }
    }

    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("focus", handleVisibilityChange);

    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("focus", handleVisibilityChange);
    };
  }, [detail, projectId, projectRunStatus, refreshSnapshot]);

  const project = detail?.project ?? null;
  const sourceConversation = detail?.sourceConversation ?? null;
  const teamMessages = useMemo(
    () =>
      project?.teamConversationId
        ? conversationMessages[project.teamConversationId] ?? []
        : [],
    [conversationMessages, project?.teamConversationId],
  );
  const agentsById = useMemo(
    () => new Map(agents.map((agent) => [agent.id, agent] as const)),
    [agents],
  );
  const sortedAgents = useMemo(
    () =>
      project
        ? [...agents].sort((left, right) => {
            if (left.id === project.activeAgentId) {
              return -1;
            }

            if (right.id === project.activeAgentId) {
              return 1;
            }

            if (left.canDelegate) {
              return -1;
            }

            if (right.canDelegate) {
              return 1;
            }

            return left.name.localeCompare(right.name, "zh-Hans-CN");
          })
        : [],
    [agents, project],
  );
  const activeAgent = project?.activeAgentId ? agentsById.get(project.activeAgentId) ?? null : null;
  const nextAgent = project?.nextAgentId ? agentsById.get(project.nextAgentId) ?? null : null;
  const runtimeMessages = useMemo(
    () =>
      [...teamMessages]
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
        .slice(0, 8),
    [teamMessages],
  );
  const selectedAgent = selectedAgentId ? agentsById.get(selectedAgentId) ?? null : null;
  const selectedAgentTrajectory =
    selectedAgent && project ? resolveAgentTrajectory(selectedAgent, project, agentsById) : null;
  const previewActiveAgent =
    activeAgent ||
    sortedAgents.find((agent) => agent.status === "working") ||
    sortedAgents.find((agent) => agent.canDelegate) ||
    null;
  const activeAgentProgressTrail = useMemo(
    () =>
      [...(previewActiveAgent?.progressTrail ?? [])]
        .sort((left, right) => Date.parse(right.createdAt) - Date.parse(left.createdAt))
        .slice(0, 4),
    [previewActiveAgent?.progressTrail],
  );
  const selectedActivityMessage =
    teamMessages.find((message) => message.id === selectedActivityMessageId) ?? null;
  const selectedActivityDescriptor =
    selectedActivityMessage && project
      ? resolveActivityDescriptor(selectedActivityMessage, project, agentsById)
      : null;
  const selectedActivityAnchor = useMemo(
    () =>
      selectedActivityMessage
        ? resolveActivityAnchorTarget(
            selectedActivityMessage,
            detail?.project?.latestUserRequest ?? null,
            learningSuggestions,
            recoveryActions,
          )
        : null,
    [detail?.project?.latestUserRequest, learningSuggestions, recoveryActions, selectedActivityMessage],
  );
  const tasksById = useMemo(
    () => new Map(tasks.map((task) => [task.id, task] as const)),
    [tasks],
  );
  const artifactsById = useMemo(
    () => new Map(artifacts.map((artifact) => [artifact.id, artifact] as const)),
    [artifacts],
  );
  const mailboxThreadsById = useMemo(
    () => new Map(mailboxThreads.map((thread) => [thread.id, thread] as const)),
    [mailboxThreads],
  );
  const learningSuggestionsById = useMemo(
    () => new Map(learningSuggestions.map((suggestion) => [suggestion.id, suggestion] as const)),
    [learningSuggestions],
  );
  const learningReuseCandidatesBySuggestionId = useMemo(() => {
    const map = new Map<string, ProjectLearningReuseCandidateRecord[]>();

    learningReuseCandidates.forEach((candidate) => {
      const current = map.get(candidate.sourceSuggestionId) ?? [];
      current.push(candidate);
      map.set(candidate.sourceSuggestionId, current);
    });

    map.forEach((items, suggestionId) => {
      map.set(
        suggestionId,
        [...items].sort((left, right) => Date.parse(right.updatedAt) - Date.parse(left.updatedAt)),
      );
    });

    return map;
  }, [learningReuseCandidates]);
  const selectedArtifact = selectedArtifactId ? artifactsById.get(selectedArtifactId) ?? null : null;
  const selectedMailboxThread =
    selectedMailboxThreadId ? mailboxThreadsById.get(selectedMailboxThreadId) ?? null : null;
  const selectedMailboxSuggestion =
    selectedMailboxThread?.relatedSuggestionId
      ? learningSuggestionsById.get(selectedMailboxThread.relatedSuggestionId) ?? null
      : null;
  const dependencyRailTasks = useMemo(
    () => buildDependencyRailTasks(tasks, tasksById).slice(0, 6),
    [tasks, tasksById],
  );
  const dependencyEdges = useMemo(
    () => buildTaskDependencyEdges(tasks, tasksById).slice(0, 6),
    [tasks, tasksById],
  );
  const artifactDependencyEdges = useMemo(
    () => buildArtifactDependencyEdges(artifacts, artifactsById, tasksById).slice(0, 8),
    [artifacts, artifactsById, tasksById],
  );
  const reviewsByTaskId = useMemo(() => {
    const map = new Map<string, ProjectReviewRecord[]>();

    reviews.forEach((review) => {
      const current = map.get(review.taskId) ?? [];
      current.push(review);
      map.set(review.taskId, current);
    });

    map.forEach((items, taskId) => {
      map.set(
        taskId,
        [...items].sort((left, right) => Date.parse(right.updatedAt) - Date.parse(left.updatedAt)),
      );
    });

    return map;
  }, [reviews]);
  const pendingReviewTaskIds = useMemo(
    () =>
      new Set(
        reviews
          .filter((review) => review.status === "pending")
          .map((review) => review.taskId),
      ),
    [reviews],
  );
  const executionTasks = useMemo(
    () =>
      tasks
        .filter(
          (task) =>
            task.status === "in_progress" ||
            task.status === "claimed" ||
            task.status === "ready" ||
            task.status === "reopened",
        )
        .slice(0, 4),
    [tasks],
  );
  const reviewTasks = useMemo(
    () =>
      tasks
        .filter((task) => task.status === "in_review" || pendingReviewTaskIds.has(task.id))
        .slice(0, 4),
    [pendingReviewTaskIds, tasks],
  );
  const stalledTasks = useMemo(
    () => tasks.filter((task) => task.status === "blocked" || task.status === "waiting_input").slice(0, 4),
    [tasks],
  );
  const completedTasks = useMemo(
    () => tasks.filter((task) => task.status === "completed" && !pendingReviewTaskIds.has(task.id)).slice(0, 4),
    [pendingReviewTaskIds, tasks],
  );
  const artifactReadyCount = useMemo(
    () => artifacts.filter((artifact) => artifact.status === "ready").length,
    [artifacts],
  );
  const artifactDraftCount = useMemo(
    () => artifacts.filter((artifact) => artifact.status === "draft").length,
    [artifacts],
  );
  const artifactLinkedTaskCount = useMemo(
    () =>
      new Set(
        artifacts.flatMap((artifact) => artifact.consumedByTaskIds),
      ).size,
    [artifacts],
  );
  const openMailboxThreadCount = useMemo(
    () => mailboxThreads.filter((thread) => thread.status === "open").length,
    [mailboxThreads],
  );
  const mailboxKindCount = useMemo(
    () =>
      new Set(
        mailboxThreads.map((thread) => thread.kind),
      ).size,
    [mailboxThreads],
  );
  const mailboxTaskLinkedCount = useMemo(
    () => mailboxThreads.filter((thread) => thread.relatedTaskId).length,
    [mailboxThreads],
  );
  const stalledSignalCount = useMemo(
    () => stuckSignals.filter((signal) => signal.status === "open").length,
    [stuckSignals],
  );
  const heartbeatHealthyCount = useMemo(
    () => heartbeats.filter((heartbeat) => heartbeat.status === "healthy").length,
    [heartbeats],
  );
  const heartbeatRiskCount = useMemo(
    () => heartbeats.filter((heartbeat) => heartbeat.status === "warning" || heartbeat.status === "stalled").length,
    [heartbeats],
  );
  const projectMemoryEntryCount = useMemo(
    () =>
      (projectMemory?.decisions.length ?? 0) +
      (projectMemory?.preferences.length ?? 0) +
      (projectMemory?.risks.length ?? 0) +
      (projectMemory?.pitfalls.length ?? 0),
    [projectMemory],
  );
  const learningSuggestionOpenCount = useMemo(
    () => learningSuggestions.filter((suggestion) => suggestion.status === "open").length,
    [learningSuggestions],
  );
  const pendingLearningReuseCandidateCount = useMemo(
    () => learningReuseCandidates.filter((candidate) => candidate.status === "pending_review").length,
    [learningReuseCandidates],
  );
  const confirmedLearningReuseCandidateCount = useMemo(
    () => learningReuseCandidates.filter((candidate) => candidate.status === "confirmed").length,
    [learningReuseCandidates],
  );
  const openAutonomyGates = useMemo(
    () => autonomyGates.filter((gate) => gate.status === "open"),
    [autonomyGates],
  );
  const autonomyRoundBudget = detail?.project?.autonomyRoundBudget ?? 4;
  const autonomyRoundCount = detail?.project?.autonomyRoundCount ?? 0;
  const isAutonomyGatePaused =
    detail?.project?.runStatus === "waiting_approval" && (detail?.project?.openGateCount ?? 0) > 0;
  const pendingHumanReviewSuggestionCount = useMemo(
    () =>
      learningSuggestions.filter(
        (suggestion) => suggestion.requiresHumanReview && suggestion.status === "open",
      ).length,
    [learningSuggestions],
  );
  const openMailboxThreads = useMemo(
    () => mailboxThreads.filter((thread) => thread.status === "open"),
    [mailboxThreads],
  );
  const visibleLearningSuggestions = useMemo(
    () =>
      [...learningSuggestions].sort((left, right) => {
        if (left.status !== right.status) {
          if (left.status === "open") {
            return -1;
          }

          if (right.status === "open") {
            return 1;
          }

          if (left.status === "accepted") {
            return -1;
          }

          if (right.status === "accepted") {
            return 1;
          }
        }

        if (left.requiresHumanReview !== right.requiresHumanReview) {
          return left.requiresHumanReview ? -1 : 1;
        }

        return Date.parse(right.updatedAt) - Date.parse(left.updatedAt);
      }),
    [learningSuggestions],
  );
  const displayedLearningSuggestions = useMemo(() => {
    if (!focusedLearningSuggestionId) {
      return visibleLearningSuggestions.slice(0, 6);
    }

    const focusedSuggestion =
      visibleLearningSuggestions.find((suggestion) => suggestion.id === focusedLearningSuggestionId) ?? null;

    if (!focusedSuggestion) {
      return visibleLearningSuggestions.slice(0, 6);
    }

    return [
      focusedSuggestion,
      ...visibleLearningSuggestions.filter((suggestion) => suggestion.id !== focusedLearningSuggestionId),
    ].slice(0, 6);
  }, [focusedLearningSuggestionId, visibleLearningSuggestions]);
  const projectOwnedLearningReuseCandidates = useMemo(
    () =>
      learningReuseCandidates.filter(
        (candidate) => candidate.sourceProjectId === (detail?.project?.id ?? ""),
      ),
    [detail?.project?.id, learningReuseCandidates],
  );
  const visibleLearningReuseCandidates = useMemo(
    () =>
      [...projectOwnedLearningReuseCandidates].sort((left, right) => {
        if (left.status !== right.status) {
          if (left.status === "pending_review") {
            return -1;
          }

          if (right.status === "pending_review") {
            return 1;
          }

          if (left.status === "confirmed") {
            return -1;
          }

          if (right.status === "confirmed") {
            return 1;
          }
        }

        return Date.parse(right.updatedAt) - Date.parse(left.updatedAt);
      }),
    [projectOwnedLearningReuseCandidates],
  );
  const displayedLearningReuseCandidates = useMemo(
    () => visibleLearningReuseCandidates.slice(0, 6),
    [visibleLearningReuseCandidates],
  );
  const latestTaskReflections = useMemo(() => taskReflections.slice(0, 4), [taskReflections]);
  const latestStageReflections = useMemo(() => stageReflections.slice(0, 4), [stageReflections]);
  const latestRunSummaries = useMemo(() => runSummaries.slice(0, 4), [runSummaries]);
  const latestRecoveryActions = useMemo(() => recoveryActions.slice(0, 4), [recoveryActions]);
  const latestRuns = useMemo(() => runs.slice(0, 4), [runs]);
  const latestOpenMailboxThread = useMemo(
    () => openMailboxThreads[0] ?? mailboxThreads[0] ?? null,
    [mailboxThreads, openMailboxThreads],
  );
  const externalConfirmedLearningReuseCandidates = useMemo(
    () =>
      learningReuseCandidates
        .filter(
          (candidate) =>
            candidate.status === "confirmed" &&
            candidate.sourceProjectId !== (detail?.project?.id ?? ""),
        )
        .slice(0, 4),
    [detail?.project?.id, learningReuseCandidates],
  );
  const primaryPendingHumanReviewSuggestion = useMemo(
    () =>
      visibleLearningSuggestions.find(
        (suggestion) => suggestion.requiresHumanReview && suggestion.status === "open",
      ) ?? null,
    [visibleLearningSuggestions],
  );
  const primaryPendingLearningReuseCandidate = useMemo(
    () =>
      projectOwnedLearningReuseCandidates.find((candidate) => candidate.status === "pending_review") ?? null,
    [projectOwnedLearningReuseCandidates],
  );
  const primaryLearningSuggestion = useMemo(
    () => visibleLearningSuggestions.find((suggestion) => suggestion.status === "open") ?? visibleLearningSuggestions[0] ?? null,
    [visibleLearningSuggestions],
  );
  const latestRecoveryAction = latestRecoveryActions[0] ?? null;
  const memoryFocusEntry = useMemo(
    () =>
      projectMemory?.risks[0] ??
      projectMemory?.preferences[0] ??
      projectMemory?.decisions[0] ??
      projectMemory?.pitfalls[0] ??
      teamMemory?.blockerPatterns[0] ??
      teamMemory?.reviewPatterns[0] ??
      teamMemory?.handoffPatterns[0] ??
      null,
    [projectMemory, teamMemory],
  );
  const latestActivityDescriptor = useMemo(
    () => (runtimeMessages[0] && project ? resolveActivityDescriptor(runtimeMessages[0], project, agentsById) : null),
    [agentsById, project, runtimeMessages],
  );

  useEffect(() => {
    if (focusedArtifactId && !artifactsById.has(focusedArtifactId)) {
      setFocusedArtifactId(null);
    }

    if (selectedArtifactId && !artifactsById.has(selectedArtifactId)) {
      setSelectedArtifactId(null);
    }

    if (selectedMailboxThreadId && !mailboxThreadsById.has(selectedMailboxThreadId)) {
      setSelectedMailboxThreadId(null);
    }
  }, [artifactsById, focusedArtifactId, mailboxThreadsById, selectedArtifactId, selectedMailboxThreadId]);

  useEffect(() => {
    if (focusedLearningSuggestionId && !learningSuggestionsById.has(focusedLearningSuggestionId)) {
      setFocusedLearningSuggestionId(null);
    }
  }, [focusedLearningSuggestionId, learningSuggestionsById]);

  if (!project) {
    return (
      <section className="rounded-[28px] border border-line bg-surface p-8 shadow-soft">
        <h1 className="text-[26px] font-semibold tracking-[-0.05em] text-text">团队模式不存在</h1>
        <p className="mt-3 text-[14px] leading-7 text-muted-strong">
          这个团队房间可能还没创建成功，或者已经被删除了。
        </p>
      </section>
    );
  }

  const currentProject = project;
  const checkpointHeadline =
    project.runStatus === "waiting_approval"
      ? isAutonomyGatePaused
        ? "当前命中了自治边界，继续前先决定是否放行"
        : "这轮已经可以确认完成，或者继续提修改意见"
      : "先补充方向，再继续推进下一轮";
  const checkpointDescription =
    project.runStatus === "waiting_approval"
      ? isAutonomyGatePaused
        ? project.autonomyPauseReason ||
          "团队已经跑到当前安全边界。你现在可以批准继续自治，也可以直接改方向后再继续。"
        : "我已经把团队的阶段总结收口好了。你现在可以直接去确认，也可以带着补充意见继续推进。"
      : "当前团队不会继续盲跑。你补充这轮新方向后，再从检查点继续。";
  const checkpointPrimaryButtonLabel =
    project.runStatus === "waiting_approval"
      ? isAutonomyGatePaused
        ? "去处理自治 gate"
        : "去确认这轮输出"
      : "去补充后继续";
  const checkpointApproveLabel =
    project.runStatus === "waiting_approval"
      ? isAutonomyGatePaused
        ? "批准继续自治"
        : "直接确认完成"
      : "";

  async function handleRefresh() {
    setIsRefreshing(true);
    setActionMessage(null);

    try {
      const next = await getProjectDetail(currentProject.id);
      setDetail(next);
    } catch (error) {
      setActionMessage(error instanceof Error ? error.message : "刷新团队状态失败。");
    } finally {
      setIsRefreshing(false);
    }
  }

  async function handleRun() {
    setIsRunning(true);
    setActionMessage(null);

    try {
      const next = await runProject(currentProject.id);
      setDetail(next);
      setActionMessage(getRunFeedbackMessage(next.project?.runStatus ?? "ready"));
    } catch (error) {
      setActionMessage(error instanceof Error ? error.message : "启动团队运行失败。");
    } finally {
      setIsRunning(false);
    }
  }

  async function handlePause() {
    setIsPausing(true);
    setActionMessage(null);

    try {
      const next = await pauseProjectResource(currentProject.id);
      setDetail(next);
      setActionMessage("团队已暂停。当前上下文、分工和成员结果都会被保留，恢复后会尽量从当前进度继续。");
    } catch (error) {
      setActionMessage(error instanceof Error ? error.message : "暂停团队失败。");
    } finally {
      setIsPausing(false);
    }
  }

  async function handleCheckpointAction(action: "approve" | "request_changes" | "resume" | "rollback") {
    const note = checkpointNote.trim();

    if (action === "request_changes" && !note) {
      setActionMessage("请先写下这次需要团队补充或改方向的内容。");
      return;
    }

    setIsCheckpointSubmitting(true);
    setActionMessage(null);

    try {
      const next = await updateProjectCheckpoint(currentProject.id, {
        action,
        note: note || null,
      });
      setDetail(next);
      setActionMessage(
        action === "approve" && (currentProject.openGateCount ?? 0) > 0
          ? "已批准继续自治。团队会继续在当前安全边界内推进，命中新一轮 gate 时再停下来。"
          : getCheckpointFeedbackMessage(action, next.project?.runStatus ?? "ready"),
      );

      if (action !== "request_changes") {
        setCheckpointNote("");
      }
    } catch (error) {
      setActionMessage(error instanceof Error ? error.message : "更新团队检查点失败。");
    } finally {
      setIsCheckpointSubmitting(false);
    }
  }

  async function handleDeleteProject() {
    setIsDeleting(true);
    setActionMessage(null);

    try {
      const response = await deleteProjectResource(currentProject.id);

      if (!response.ok) {
        throw new Error("删除团队失败。");
      }

      router.push("/projects");
      router.refresh();
    } catch (error) {
      setActionMessage(error instanceof Error ? error.message : "删除团队失败。");
      setIsDeleteDialogVisible(false);
    } finally {
      setIsDeleting(false);
    }
  }

  async function handleLearningSuggestionReview(
    suggestionId: string,
    action: "accept" | "dismiss",
  ) {
    setLearningSuggestionActionId(suggestionId);
    setLearningSuggestionActionKind(action);
    setActionMessage(null);

    try {
      const next = await reviewProjectLearningSuggestionResource(currentProject.id, suggestionId, {
        action,
      });
      setDetail(next);
      setActionMessage(
        action === "accept"
          ? "这条学习建议已采纳，后续会进入默认协作判断。"
          : "这条学习建议已忽略，本轮不会进入默认策略。",
      );
    } catch (error) {
      setActionMessage(error instanceof Error ? error.message : "处理学习建议失败。");
    } finally {
      setLearningSuggestionActionId(null);
      setLearningSuggestionActionKind(null);
    }
  }

  async function handleLearningReuseCandidateReview(
    candidateId: string,
    action: "confirm" | "dismiss",
  ) {
    setLearningReuseCandidateActionId(candidateId);
    setLearningReuseCandidateActionKind(action);
    setActionMessage(null);

    try {
      const next = await reviewProjectLearningReuseCandidateResource(currentProject.id, candidateId, {
        action,
      });
      setDetail(next);
      setActionMessage(
        action === "confirm"
          ? "这条跨项目复用候选已确认，后续项目现在可以把它当作候选模板继续复用。"
          : "这条跨项目复用候选已搁置，当前仍只保留在本项目里。",
      );
    } catch (error) {
      setActionMessage(error instanceof Error ? error.message : "处理跨项目复用候选失败。");
    } finally {
      setLearningReuseCandidateActionId(null);
      setLearningReuseCandidateActionKind(null);
    }
  }

  function scrollToCheckpoint() {
    checkpointSectionRef.current?.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });
  }

  function scrollToArtifactGraph() {
    artifactSectionRef.current?.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });
  }

  function scrollToRuntimeHealth() {
    runtimeHealthSectionRef.current?.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });
  }

  function scrollToLearning() {
    learningSectionRef.current?.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });
  }

  function scrollToMemory() {
    memorySectionRef.current?.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });
  }

  function scrollToCoordination() {
    coordinationSectionRef.current?.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });
  }

  function scrollToActivity() {
    activitySectionRef.current?.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });
  }

  function focusLearningSuggestion(suggestionId: string) {
    setFocusedLearningSuggestionId(suggestionId);
    scrollToLearning();
  }

  function openMailboxThread(threadId: string) {
    setSelectedMailboxThreadId(threadId);
    scrollToCoordination();
  }

  function openActivityAnchor() {
    if (!selectedActivityAnchor) {
      return;
    }

    setSelectedActivityMessageId(null);

    if (selectedActivityAnchor.kind === "learning") {
      focusLearningSuggestion(selectedActivityAnchor.suggestionId);
      return;
    }

    if (selectedActivityAnchor.kind === "runtime_health") {
      scrollToRuntimeHealth();
      return;
    }

    scrollToCheckpoint();
  }

  function focusArtifact(artifactId: string) {
    setFocusedArtifactId(artifactId);
    scrollToArtifactGraph();
  }

  const showTopRunButton = currentProject.runStatus !== "waiting_approval";
  const canRollbackToCheckpoint =
    currentProject.runStatus === "waiting_approval" ||
    currentProject.runStatus === "waiting_user" ||
    currentProject.runStatus === "completed";
  const displayActiveAgent =
    activeAgent ||
    sortedAgents.find((agent) => agent.status === "working") ||
    sortedAgents.find((agent) => agent.canDelegate) ||
    null;
  const displayNextAgent =
    nextAgent ||
    (displayActiveAgent
      ? sortedAgents.find((agent) => agent.blockedByAgentId === displayActiveAgent.id) ||
        sortedAgents.find(
          (agent) => !agent.canDelegate && currentProject.summary.includes(`@${agent.name}`),
        ) ||
        null
      : null);
  const displayStageLabel = resolveDisplayedStageLabel(currentProject, displayActiveAgent, displayNextAgent);
  const managerDecision = resolveManagerDecision(currentProject, displayActiveAgent, displayNextAgent);
  const projectSummaryPreview = buildProjectSummaryPreview(currentProject.summary);
  const projectSummaryPanelText = buildProjectSummaryPanelText(currentProject.summary);
  const compactGoal = compactActivityText(currentProject.goal, 180);
  const compactProjectSummary = compactActivityText(projectSummaryPanelText, 220);
  const runStopSummary = buildRunStopSummary(currentProject, {
    activeAgentName: displayActiveAgent?.name ?? null,
    activeAgentProgressLabel: displayActiveAgent?.progressLabel ?? null,
    isAutonomyGatePaused,
  });
  const recoverySummary = buildRecoveryFocusSummary(latestRecoveryAction, currentProject.openStuckSignalCount ?? 0);
  const memorySummary = buildMemoryFocusSummary(memoryFocusEntry);
  const learningSummary = buildLearningFocusSummary(
    primaryPendingHumanReviewSuggestion ?? primaryLearningSuggestion,
    pendingHumanReviewSuggestionCount,
  );
  const coordinationSummary = buildCoordinationFocusSummary(
    latestOpenMailboxThread,
    runtimeMessages[0] ?? null,
    latestActivityDescriptor,
  );

  return (
    <>
      <div className="space-y-8">
        <div className="flex flex-wrap gap-3">
          <Link href="/projects" className={buttonClassName({ variant: "secondary" })}>
            返回团队页
          </Link>
          {sourceConversation ? (
            <Link href={`/conversations/${sourceConversation.id}`} className={buttonClassName({ variant: "secondary" })}>
              返回原对话
            </Link>
          ) : null}
        </div>

        <section className="rounded-[28px] border border-line bg-surface p-6 shadow-soft">
          <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_auto] xl:items-start">
            <div className="min-w-0">
              <div className="flex flex-wrap gap-2 text-[12px] text-muted-strong">
                <MetaPill>Team Mode</MetaPill>
                <StatusPill status={project.runStatus}>{formatProjectStatus(project.runStatus)}</StatusPill>
                <MetaPill>{project.memberCount} 位成员</MetaPill>
                <MetaPill>{displayStageLabel}</MetaPill>
                <MetaPill>最近活动：{project.lastActivityLabel}</MetaPill>
                <MetaPill>{project.teamConversationId ? "已连接团队群聊" : "启动后生成群聊"}</MetaPill>
              </div>
              <h1 className="mt-5 max-w-[18ch] text-[32px] font-semibold leading-[1.14] tracking-[-0.05em] text-text sm:max-w-[24ch] xl:max-w-[22ch]">
                {project.title}
              </h1>
              <p className="mt-3 max-w-[70ch] text-[14px] leading-7 text-muted-strong">
                {projectSummaryPreview}
              </p>
            </div>

            <div className="flex w-full flex-wrap items-center gap-2 xl:w-auto xl:max-w-[420px] xl:justify-end">
              {showTopRunButton ? (
                <button
                  type="button"
                  onClick={() => void handleRun()}
                  className={buttonClassName({ variant: "primary", size: "sm" })}
                  disabled={isRunning || isRefreshing || isCheckpointSubmitting || isPausing}
                >
                  {isRunning ? "处理中..." : getRunActionLabel(project.runStatus)}
                </button>
              ) : null}
              {project.runStatus === "running" ? (
                <button
                  type="button"
                  onClick={() => void handlePause()}
                  className={buttonClassName({ variant: "secondary", size: "sm" })}
                  disabled={isPausing || isRunning || isRefreshing || isCheckpointSubmitting}
                >
                  {isPausing ? "暂停中..." : "暂停团队"}
                </button>
              ) : null}
              {canRollbackToCheckpoint ? (
                <button
                  type="button"
                  onClick={() => void handleCheckpointAction("rollback")}
                  className={buttonClassName({ variant: "secondary", size: "sm" })}
                  disabled={isCheckpointSubmitting || isRefreshing || isRunning || isPausing}
                >
                  {isCheckpointSubmitting ? "处理中..." : "从 checkpoint 重跑"}
                </button>
              ) : null}
              <button
                type="button"
                onClick={() => void handleRefresh()}
                className={buttonClassName({ variant: "secondary", size: "sm" })}
                disabled={isRefreshing || isRunning || isPausing}
              >
                {isRefreshing ? "刷新中..." : "刷新状态"}
              </button>
              {project.teamConversationId ? (
                <Link
                  href={`/conversations/${project.teamConversationId}`}
                  className={buttonClassName({ variant: "secondary", size: "sm" })}
                >
                  打开团队群聊
                </Link>
              ) : null}
              <button
                type="button"
                onClick={() => setIsDeleteDialogVisible(true)}
                className={buttonClassName({ variant: "danger", size: "sm" })}
                disabled={isDeleting || isRunning || isRefreshing || isCheckpointSubmitting || isPausing}
              >
                {isDeleting ? "删除中..." : "删除团队"}
              </button>
            </div>
          </div>

          <div className="mt-6 grid gap-3 lg:grid-cols-[1.35fr_0.95fr]">
            <article className="rounded-[22px] border border-line bg-background p-5">
              <div className="text-[11px] uppercase tracking-[0.14em] text-muted">当前目标</div>
              <p className="mt-2 text-[14px] leading-7 text-text">{compactGoal}</p>
            </article>
            <article className="rounded-[22px] border border-line bg-background p-5">
              <div className="text-[11px] uppercase tracking-[0.14em] text-muted">工作空间目录</div>
              <p className="mt-2 break-all text-[14px] leading-7 text-text">
                {project.workspaceDir || "未指定"}
              </p>
            </article>
          </div>
          {actionMessage ? (
            <div className="mt-4 rounded-[18px] border border-[#d7e4ff] bg-[#eef4ff] px-4 py-3 text-[13px] text-[#2d56a3]">
              {actionMessage}
            </div>
          ) : null}
        </section>

        {(project.runStatus === "waiting_approval" || project.runStatus === "waiting_user") ? (
          <section className="rounded-[24px] border border-[#e7dcc7] bg-[linear-gradient(135deg,#fffaf2_0%,#fffdf9_100%)] p-5 shadow-soft">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded-full border border-[#efd9b5] bg-[#fff3dc] px-3 py-1.5 text-[12px] font-medium text-[#9a6513]">
                    {project.runStatus === "waiting_approval"
                      ? isAutonomyGatePaused
                        ? "待你放行"
                        : "待你确认"
                      : "待你补充"}
                  </span>
                  <span className="text-[12px] text-muted-strong">
                    {project.runStatus === "waiting_approval"
                      ? isAutonomyGatePaused
                        ? "团队已经命中自治边界"
                        : "团队已经交付了阶段结果"
                      : "团队已经停在你的补充检查点"}
                  </span>
                </div>
                <h2 className="mt-3 text-[20px] font-semibold tracking-[-0.03em] text-text">
                  {checkpointHeadline}
                </h2>
                <p className="mt-2 max-w-[74ch] text-[14px] leading-7 text-muted-strong">
                  {checkpointDescription}
                </p>
              </div>
              <div className="flex shrink-0 flex-wrap gap-2">
                <button
                  type="button"
                  onClick={scrollToCheckpoint}
                  className={buttonClassName({ variant: "primary" })}
                >
                  {checkpointPrimaryButtonLabel}
                </button>
                {project.runStatus === "waiting_approval" ? (
                  <button
                    type="button"
                    onClick={() => void handleCheckpointAction("approve")}
                    className={buttonClassName({ variant: "secondary" })}
                    disabled={isCheckpointSubmitting || isRefreshing || isRunning || isPausing}
                  >
                    {isCheckpointSubmitting ? "提交中..." : checkpointApproveLabel}
                  </button>
                ) : null}
                <button
                  type="button"
                  onClick={() => void handleCheckpointAction("rollback")}
                  className={buttonClassName({ variant: "secondary" })}
                  disabled={isCheckpointSubmitting || isRefreshing || isRunning || isPausing}
                >
                  {isCheckpointSubmitting ? "处理中..." : "从当前 checkpoint 重跑"}
                </button>
              </div>
            </div>
          </section>
        ) : null}

        <section className="rounded-[28px] border border-line bg-surface p-6 shadow-soft">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <p className="text-[12px] font-medium uppercase tracking-[0.14em] text-muted">
                Convergence
              </p>
              <h2 className="mt-2 text-[24px] font-semibold tracking-[-0.04em] text-text">
                收口导航
              </h2>
              <p className="mt-2 max-w-[72ch] text-[14px] leading-7 text-muted-strong">
                这一层不再只告诉你“团队做了很多”，而是先把当前停点、最近恢复、人审建议和协作焦点收成一个入口，再决定该往哪一块看。
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full border border-line bg-surface-muted px-3 py-1.5 text-[12px] text-muted-strong">
                {openMailboxThreadCount} 条待处理线程
              </span>
              <span className="rounded-full border border-line bg-surface-muted px-3 py-1.5 text-[12px] text-muted-strong">
                {pendingHumanReviewSuggestionCount} 条待人审建议
              </span>
              <span className="rounded-full border border-line bg-surface-muted px-3 py-1.5 text-[12px] text-muted-strong">
                {recoveryActions.length} 条恢复动作
              </span>
            </div>
          </div>

          <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <ConvergenceFocusCard
              label="当前停点"
              title={runStopSummary.title}
              summary={runStopSummary.summary}
              tone={runStopSummary.tone}
              actionLabel={runStopSummary.actionLabel}
              onAction={runStopSummary.actionTarget === "checkpoint"
                ? scrollToCheckpoint
                : runStopSummary.actionTarget === "activity"
                  ? scrollToActivity
                  : scrollToRuntimeHealth}
            />
            <ConvergenceFocusCard
              label="最近恢复"
              title={recoverySummary.title}
              summary={recoverySummary.summary}
              tone={recoverySummary.tone}
              actionLabel="看运行健康"
              onAction={scrollToRuntimeHealth}
            />
            <ConvergenceFocusCard
              label="记忆焦点"
              title={memorySummary.title}
              summary={memorySummary.summary}
              tone={memorySummary.tone}
              actionLabel="看团队记忆"
              onAction={scrollToMemory}
            />
            <ConvergenceFocusCard
              label="学习 / 协作焦点"
              title={learningSummary.title}
              summary={buildConvergenceLearningAndCoordinationSummary(learningSummary.summary, coordinationSummary.summary)}
              tone={learningSummary.tone}
              actionLabel={
                primaryPendingHumanReviewSuggestion || primaryLearningSuggestion ? "看学习闭环" : "看协作线程"
              }
              onAction={
                primaryPendingHumanReviewSuggestion || primaryLearningSuggestion
                  ? () =>
                      focusLearningSuggestion(
                        (primaryPendingHumanReviewSuggestion ?? primaryLearningSuggestion)?.id ?? "",
                      )
                  : scrollToCoordination
              }
            />
          </div>

          <div className="mt-5 rounded-[22px] border border-line bg-background p-5">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <div className="text-[11px] uppercase tracking-[0.14em] text-muted">快速定位</div>
                <p className="mt-2 text-[13px] leading-6 text-muted-strong">
                  想知道为什么停在这里，通常先看 Checkpoint / Runtime Health；想知道接下来该怎么改，再看 Team Memory、Learning Loop 和最近活动。
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                {(project.runStatus === "waiting_approval" || project.runStatus === "waiting_user") ? (
                  <button
                    type="button"
                    onClick={scrollToCheckpoint}
                    className={buttonClassName({ variant: "secondary", size: "sm" })}
                  >
                    Checkpoint
                  </button>
                ) : null}
                <button
                  type="button"
                  onClick={scrollToRuntimeHealth}
                  className={buttonClassName({ variant: "secondary", size: "sm" })}
                >
                  Runtime Health
                </button>
                <button
                  type="button"
                  onClick={scrollToMemory}
                  className={buttonClassName({ variant: "secondary", size: "sm" })}
                >
                  Team Memory
                </button>
                <button
                  type="button"
                  onClick={scrollToLearning}
                  className={buttonClassName({ variant: "secondary", size: "sm" })}
                >
                  Learning Loop
                </button>
                <button
                  type="button"
                  onClick={scrollToCoordination}
                  className={buttonClassName({ variant: "secondary", size: "sm" })}
                >
                  协作线程
                </button>
                <button
                  type="button"
                  onClick={scrollToActivity}
                  className={buttonClassName({ variant: "secondary", size: "sm" })}
                >
                  最近活动
                </button>
                {project.teamConversationId ? (
                  <Link
                    href={`/conversations/${project.teamConversationId}`}
                    className={buttonClassName({ variant: "secondary", size: "sm" })}
                  >
                    打开群聊
                  </Link>
                ) : null}
              </div>
            </div>
          </div>
        </section>

        <div className="space-y-6">
          <div className="space-y-6">
            <section
              ref={runtimeHealthSectionRef}
              className="rounded-[28px] border border-line bg-surface p-6 shadow-soft"
            >
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div>
                  <p className="text-[12px] font-medium uppercase tracking-[0.14em] text-muted">
                    Mission Control
                  </p>
                  <h2 className="mt-2 text-[24px] font-semibold tracking-[-0.04em] text-text">
                    实时态势
                  </h2>
                  <p className="mt-2 max-w-[68ch] text-[14px] leading-7 text-muted-strong">
                    这里只看整体局势，不把长消息和过程细节直接铺满页面。
                  </p>
                </div>
                <span className="rounded-full border border-line bg-surface-muted px-3 py-1.5 text-[12px] text-muted-strong">
                  自动刷新中
                </span>
              </div>

              <div className="mt-5">
                <StageRail currentStage={displayStageLabel} />
              </div>

              <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                <RuntimeOverviewCard
                  label="当前阶段"
                  value={displayStageLabel}
                  description={getProjectStatusDescription(project.runStatus)}
                />
                <RuntimeOverviewCard
                  label="当前 Baton"
                  value={displayActiveAgent?.name || "项目经理待命"}
                  description={
                    displayActiveAgent
                      ? `${displayActiveAgent.role} · ${formatRuntimeCardStatus(displayActiveAgent, agentsById)}`
                      : "当前还没有进入具体成员执行。"
                  }
                />
                <RuntimeOverviewCard
                  label="下一棒"
                  value={displayNextAgent?.name || "等待项目经理判断"}
                  description={
                    displayNextAgent
                      ? `预计由 ${displayNextAgent.role} 接力。`
                      : "当前阶段完成后，由项目经理决定是否继续派工。"
                  }
                />
                <RuntimeOverviewCard
                  label="PM 判断"
                  value={managerDecision.label}
                  description={managerDecision.description}
                  tone={managerDecision.tone}
                />
              </div>

              <div className={`mt-4 rounded-[22px] border px-5 py-5 ${getDecisionPanelTone(managerDecision.tone)}`}>
                <div className="flex flex-wrap items-center gap-2">
                  <div className="text-[11px] uppercase tracking-[0.14em] text-muted">项目经理摘要</div>
                  <span className="rounded-full border border-current/10 bg-white/65 px-2.5 py-1 text-[11px] font-medium">
                    {managerDecision.label}
                  </span>
                </div>
                <p className="mt-3 text-[14px] leading-7 text-text">
                  {compactProjectSummary}
                </p>
              </div>

              {displayActiveAgent ? (
                <div className="mt-4 rounded-[22px] border border-line bg-background p-5">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <div className="text-[11px] uppercase tracking-[0.14em] text-muted">当前执行过程</div>
                      <div className="mt-2 flex flex-wrap items-center gap-2">
                        <h3 className="text-[18px] font-semibold tracking-[-0.03em] text-text">
                          {displayActiveAgent.name}
                        </h3>
                        <MetaPill>{displayActiveAgent.role}</MetaPill>
                        {displayActiveAgent.progressLabel ? (
                          <span className="rounded-full border border-[#d7e4ff] bg-[#eef4ff] px-2.5 py-1 text-[11px] font-medium text-[#2d56a3]">
                            {displayActiveAgent.progressLabel}
                          </span>
                        ) : null}
                      </div>
                      <p className="mt-2 max-w-[74ch] text-[14px] leading-7 text-muted-strong">
                        {displayActiveAgent.progressDetails ||
                          displayActiveAgent.lastAssignedTask ||
                          "当前还没有同步出更细的执行过程。"}
                      </p>
                    </div>
                    <div className="text-[12px] text-muted-strong">
                      {displayActiveAgent.lastHeartbeatAt
                        ? `最近心跳：${formatActivityTimestamp(displayActiveAgent.lastHeartbeatAt)}`
                        : "最近心跳：等待同步"}
                    </div>
                  </div>

                  <div className="mt-4 grid gap-3 lg:grid-cols-2">
                    {activeAgentProgressTrail.length > 0 ? (
                      activeAgentProgressTrail.map((entry, index) => (
                        <div
                          key={entry.id}
                          className="rounded-[18px] border border-line bg-surface-muted px-4 py-4"
                        >
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="text-[11px] uppercase tracking-[0.14em] text-muted">
                                {index === 0 ? "最新进展" : `过程 ${index + 1}`}
                              </span>
                              <span className="rounded-full border border-line bg-background px-2.5 py-1 text-[11px] font-medium text-text">
                                {entry.label}
                              </span>
                            </div>
                            <span className="text-[11px] text-muted-strong">
                              {formatActivityTimestamp(entry.createdAt)}
                            </span>
                          </div>
                          <p className="mt-2 text-[13px] leading-6 text-muted-strong">
                            {entry.detail}
                          </p>
                        </div>
                      ))
                    ) : (
                      <div className="rounded-[18px] border border-dashed border-line bg-surface-muted/60 px-4 py-4 text-[13px] leading-6 text-muted-strong">
                        当前这位成员还没有同步出更多过程轨迹。开始运行后，这里会持续显示它最新的公开进展。
                      </div>
                    )}
                  </div>
                </div>
              ) : null}
            </section>

            <section
              ref={learningSectionRef}
              className="rounded-[28px] border border-line bg-surface p-6 shadow-soft"
            >
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-[12px] font-medium uppercase tracking-[0.14em] text-muted">
                    Autonomy Guardrails
                  </p>
                  <h2 className="mt-2 text-[24px] font-semibold tracking-[-0.04em] text-text">
                    受控自治
                  </h2>
                  <p className="mt-2 text-[14px] leading-7 text-muted-strong">
                    这里看团队还能在当前边界内自主推进多少轮，以及它为什么停下来等你放行。
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded-full border border-line bg-surface-muted px-3 py-1.5 text-[12px] text-muted-strong">
                    已用 {autonomyRoundCount} / {autonomyRoundBudget} 轮
                  </span>
                  <span className="rounded-full border border-line bg-surface-muted px-3 py-1.5 text-[12px] text-muted-strong">
                    {openAutonomyGates.length} 条开放 gate
                  </span>
                </div>
              </div>

              <div className="mt-5 grid gap-3 md:grid-cols-3">
                <RuntimeOverviewCard
                  label="自治模式"
                  value={project.autonomyStatus === "gated" ? "等待放行" : "受控推进"}
                  description={
                    project.autonomyStatus === "gated"
                      ? "团队已经停在当前 gate，继续前需要你决定是否放行。"
                      : "团队会在预算和风险边界内自动推进，但不会无限制盲跑。"
                  }
                  tone={project.autonomyStatus === "gated" ? "warning" : "success"}
                />
                <RuntimeOverviewCard
                  label="自治预算"
                  value={`${autonomyRoundCount}/${autonomyRoundBudget}`}
                  description="每次 manager 再次自主派工，都会消耗一轮自治预算。"
                  tone={autonomyRoundCount >= autonomyRoundBudget ? "warning" : "info"}
                />
                <RuntimeOverviewCard
                  label="开放 Gate"
                  value={`${openAutonomyGates.length} 条`}
                  description="命中风险边界或预算上限时，团队会在这里显式停下。"
                  tone={openAutonomyGates.length > 0 ? "warning" : "default"}
                />
              </div>

              <div className="mt-5 grid gap-3 xl:grid-cols-2">
                {(openAutonomyGates.length > 0 ? openAutonomyGates : autonomyGates.slice(0, 2)).length > 0 ? (
                  (openAutonomyGates.length > 0 ? openAutonomyGates : autonomyGates.slice(0, 2)).map((gate) => (
                    <AutonomyGateCard key={gate.id} gate={gate} />
                  ))
                ) : (
                  <div className="rounded-[18px] border border-dashed border-line bg-surface-muted/60 px-4 py-4 text-[13px] leading-6 text-muted-strong xl:col-span-2">
                    当前还没有自治 gate。团队会先在安全边界里自动推进，只有命中预算或风险边界时才会停下来等你放行。
                  </div>
                )}
              </div>
            </section>

            <section
              ref={memorySectionRef}
              className="rounded-[28px] border border-line bg-surface p-6 shadow-soft"
            >
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-[12px] font-medium uppercase tracking-[0.14em] text-muted">
                    Runtime Health
                  </p>
                  <h2 className="mt-2 text-[24px] font-semibold tracking-[-0.04em] text-text">
                    运行健康
                  </h2>
                  <p className="mt-2 text-[14px] leading-7 text-muted-strong">
                    把 heartbeat、卡住信号和恢复动作收成同一层，不再只从成员卡片里猜当前 runtime 到底健不健康。
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded-full border border-line bg-surface-muted px-3 py-1.5 text-[12px] text-muted-strong">
                    {heartbeats.length} 条 heartbeat
                  </span>
                  <span className="rounded-full border border-line bg-surface-muted px-3 py-1.5 text-[12px] text-muted-strong">
                    {recoveryActions.length} 条恢复记录
                  </span>
                </div>
              </div>

              <div className="mt-5 grid gap-3 md:grid-cols-3">
                <RuntimeOverviewCard
                  label="健康心跳"
                  value={`${heartbeatHealthyCount} 条`}
                  description="最近仍在稳定推进或刚交回结果的成员心跳。"
                  tone={heartbeatHealthyCount > 0 ? "success" : "default"}
                />
                <RuntimeOverviewCard
                  label="风险信号"
                  value={`${heartbeatRiskCount} 条`}
                  description="正在等待依赖或已经出现 stalled 征兆的 runtime 信号。"
                  tone={heartbeatRiskCount > 0 ? "warning" : "default"}
                />
                <RuntimeOverviewCard
                  label="当前卡点"
                  value={`${stalledSignalCount} 条`}
                  description="仍处于 open 的 stuck signal，会等待恢复动作或新心跳收束。"
                  tone={stalledSignalCount > 0 ? "warning" : "default"}
                />
              </div>

              <div className="mt-5 grid gap-3 xl:grid-cols-2">
                <div className="rounded-[22px] border border-line bg-background p-5">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <div className="text-[11px] uppercase tracking-[0.14em] text-muted">Heartbeat</div>
                      <p className="mt-2 text-[13px] leading-6 text-muted-strong">
                        当前每位成员最近一次可见 runtime 心跳。
                      </p>
                    </div>
                    <MetaPill>{heartbeats.length} 条</MetaPill>
                  </div>
                  <div className="mt-4 space-y-3">
                    {heartbeats.length > 0 ? (
                      heartbeats.slice(0, 6).map((heartbeat) => (
                        <div key={heartbeat.id} className="rounded-[18px] border border-line bg-surface-muted px-4 py-4">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className={`rounded-full border px-2.5 py-1 text-[11px] font-medium ${getHeartbeatTone(heartbeat.status)}`}>
                              {formatHeartbeatStatus(heartbeat.status)}
                            </span>
                            <MetaPill>{heartbeat.agentName}</MetaPill>
                            {heartbeat.taskTitle ? <MetaPill>{compactTaskRailLabel(heartbeat.taskTitle)}</MetaPill> : null}
                          </div>
                          <p className="mt-2 text-[13px] leading-6 text-muted-strong">
                            {heartbeat.summary}
                          </p>
                          <div className="mt-3 flex flex-wrap gap-3 text-[11px] text-muted-strong">
                            <span>记录于 {formatActivityTimestamp(heartbeat.recordedAt)}</span>
                            {heartbeat.leaseExpiresAt ? (
                              <span>租约到期 {formatActivityTimestamp(heartbeat.leaseExpiresAt)}</span>
                            ) : null}
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="rounded-[18px] border border-dashed border-line bg-surface-muted/60 px-4 py-4 text-[13px] leading-6 text-muted-strong">
                        当前还没有结构化 heartbeat。启动团队后，这里会先显示 PM 和当前 baton 的最近心跳。
                      </div>
                    )}
                  </div>
                </div>

                <div className="space-y-3">
                  <div className="rounded-[22px] border border-line bg-background p-5">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <div className="text-[11px] uppercase tracking-[0.14em] text-muted">Stuck Signals</div>
                        <p className="mt-2 text-[13px] leading-6 text-muted-strong">
                          这里只看真正的卡住判断，不和普通 blocked task 混在一起。
                        </p>
                      </div>
                      <MetaPill>{stuckSignals.length} 条</MetaPill>
                    </div>
                    <div className="mt-4 space-y-3">
                      {stuckSignals.length > 0 ? (
                        stuckSignals.slice(0, 4).map((signal) => (
                          <div key={signal.id} className="rounded-[18px] border border-line bg-surface-muted px-4 py-4">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className={`rounded-full border px-2.5 py-1 text-[11px] font-medium ${getStuckSignalTone(signal.status)}`}>
                                {formatStuckSignalStatus(signal.status)}
                              </span>
                              <MetaPill>{formatStuckSignalKind(signal.kind)}</MetaPill>
                              <MetaPill>{signal.agentName}</MetaPill>
                            </div>
                            <p className="mt-2 text-[13px] leading-6 text-muted-strong">
                              {signal.summary}
                            </p>
                            <div className="mt-3 flex flex-wrap gap-3 text-[11px] text-muted-strong">
                              <span>发现于 {formatActivityTimestamp(signal.detectedAt)}</span>
                              {signal.resolvedAt ? <span>已于 {formatActivityTimestamp(signal.resolvedAt)} 收束</span> : null}
                            </div>
                          </div>
                        ))
                      ) : (
                        <div className="rounded-[18px] border border-dashed border-line bg-surface-muted/60 px-4 py-4 text-[13px] leading-6 text-muted-strong">
                          当前还没有结构化 stuck signal，说明这一轮暂时没出现需要单独升级的 runtime 卡点。
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="rounded-[22px] border border-line bg-background p-5">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <div className="text-[11px] uppercase tracking-[0.14em] text-muted">Recovery Actions</div>
                        <p className="mt-2 text-[13px] leading-6 text-muted-strong">
                          最近几次恢复动作，能直接看出是重试、替补继续，还是 PM 接管。
                        </p>
                      </div>
                      <MetaPill>{recoveryActions.length} 条</MetaPill>
                    </div>
                    <div className="mt-4 space-y-3">
                      {latestRecoveryActions.length > 0 ? (
                        latestRecoveryActions.map((action) => (
                          <div key={action.id} className="rounded-[18px] border border-line bg-surface-muted px-4 py-4">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className={`rounded-full border px-2.5 py-1 text-[11px] font-medium ${getRecoveryActionTone(action.kind)}`}>
                                {formatRecoveryActionKind(action.kind)}
                              </span>
                              {action.fromAgentName ? <MetaPill>{action.fromAgentName}</MetaPill> : null}
                              {action.toAgentName ? <MetaPill>{action.toAgentName}</MetaPill> : null}
                            </div>
                            <p className="mt-2 text-[13px] leading-6 text-muted-strong">
                              {action.summary}
                            </p>
                            <div className="mt-3 text-[11px] text-muted-strong">
                              {formatActivityTimestamp(action.createdAt)}
                            </div>
                          </div>
                        ))
                      ) : (
                        <div className="rounded-[18px] border border-dashed border-line bg-surface-muted/60 px-4 py-4 text-[13px] leading-6 text-muted-strong">
                          当前还没有恢复动作记录。真正发生 retry、替补接力或 PM takeover 时，这里会留下轨迹。
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </section>

            <section
              ref={coordinationSectionRef}
              className="rounded-[28px] border border-line bg-surface p-6 shadow-soft"
            >
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-[12px] font-medium uppercase tracking-[0.14em] text-muted">
                    Learning Loop
                  </p>
                  <h2 className="mt-2 text-[24px] font-semibold tracking-[-0.04em] text-text">
                    学习闭环
                  </h2>
                  <p className="mt-2 text-[14px] leading-7 text-muted-strong">
                    这里把任务级微复盘、阶段级复盘、run summary 和 learning suggestions 收在一起，方便直接看团队最近学到了什么。
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded-full border border-line bg-surface-muted px-3 py-1.5 text-[12px] text-muted-strong">
                    {taskReflections.length} 条任务复盘
                  </span>
                  <span className="rounded-full border border-line bg-surface-muted px-3 py-1.5 text-[12px] text-muted-strong">
                    {learningSuggestionOpenCount} 条开放建议
                  </span>
                  <span className="rounded-full border border-line bg-surface-muted px-3 py-1.5 text-[12px] text-muted-strong">
                    {pendingHumanReviewSuggestionCount} 条待人审
                  </span>
                  <span className="rounded-full border border-line bg-surface-muted px-3 py-1.5 text-[12px] text-muted-strong">
                    {pendingLearningReuseCandidateCount} 条待确认复用候选
                  </span>
                </div>
              </div>

              <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                <RuntimeOverviewCard
                  label="任务级微复盘"
                  value={`${taskReflections.length} 条`}
                  description="每条任务完成、返工或恢复后，都会留下简短复盘。"
                  tone={taskReflections.length > 0 ? "info" : "default"}
                />
                <RuntimeOverviewCard
                  label="阶段级复盘"
                  value={`${stageReflections.length} 条`}
                  description="按阶段收束 highlights、frictions 和下一步建议。"
                  tone={stageReflections.length > 0 ? "success" : "default"}
                />
                <RuntimeOverviewCard
                  label="Run Summary"
                  value={`${runSummaries.length} 轮`}
                  description="每轮运行都会整理 wins、risks 和 recommendations。"
                  tone={runSummaries.length > 0 ? "success" : "default"}
                />
                <RuntimeOverviewCard
                  label="开放建议"
                  value={`${learningSuggestionOpenCount} 条`}
                  description="建议已经从复盘层浮出来，下一步是决定哪些进入默认策略。"
                  tone={learningSuggestionOpenCount > 0 ? "warning" : "default"}
                />
                <RuntimeOverviewCard
                  label="复用候选"
                  value={`${confirmedLearningReuseCandidateCount} 条`}
                  description="已被确认的候选可以安全出现在后续项目里，但仍只作为可选模板。"
                  tone={confirmedLearningReuseCandidateCount > 0 ? "success" : "default"}
                />
              </div>

              {(primaryPendingHumanReviewSuggestion || primaryPendingLearningReuseCandidate || latestOpenMailboxThread) ? (
                <div className="mt-5 rounded-[22px] border border-line bg-background p-5">
                  <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                    <div>
                      <div className="text-[11px] uppercase tracking-[0.14em] text-muted">当前最需要处理的建议</div>
                      <p className="mt-2 text-[13px] leading-6 text-muted-strong">
                        {primaryPendingHumanReviewSuggestion
                          ? `当前优先看的不是“再生成更多建议”，而是先处理“${primaryPendingHumanReviewSuggestion.title}”。这条建议已经进入人审边界，后续是否进入默认策略取决于这里的判断。`
                          : primaryPendingLearningReuseCandidate
                            ? `当前开放建议已经有一部分进入默认策略，但“${primaryPendingLearningReuseCandidate.title}”还停在跨项目复用确认边界。先决定它是否进入候选库，再谈下一步复用。`
                          : "当前没有待人审建议，但最近的协作线程里已经出现与学习闭环相关的收束信号，可以从这里继续回看。"}
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {primaryPendingHumanReviewSuggestion ? (
                        <button
                          type="button"
                          onClick={() => focusLearningSuggestion(primaryPendingHumanReviewSuggestion.id)}
                          className={buttonClassName({ variant: "primary", size: "sm" })}
                        >
                          定位这条建议
                        </button>
                      ) : primaryPendingLearningReuseCandidate ? (
                        <button
                          type="button"
                          onClick={scrollToLearning}
                          className={buttonClassName({ variant: "primary", size: "sm" })}
                        >
                          看复用候选
                        </button>
                      ) : null}
                      {primaryPendingHumanReviewSuggestion?.reviewThreadId ? (
                        <button
                          type="button"
                          onClick={() => openMailboxThread(primaryPendingHumanReviewSuggestion.reviewThreadId!)}
                          className={buttonClassName({ variant: "secondary", size: "sm" })}
                        >
                          打开人审线程
                        </button>
                      ) : latestOpenMailboxThread ? (
                        <button
                          type="button"
                          onClick={() => openMailboxThread(latestOpenMailboxThread.id)}
                          className={buttonClassName({ variant: "secondary", size: "sm" })}
                        >
                          看协作线程
                        </button>
                      ) : null}
                    </div>
                  </div>
                </div>
              ) : null}

              <div className="mt-5 grid gap-3 xl:grid-cols-2">
                <div className="rounded-[22px] border border-line bg-background p-5">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <div className="text-[11px] uppercase tracking-[0.14em] text-muted">Task Reflections</div>
                      <p className="mt-2 text-[13px] leading-6 text-muted-strong">
                        最近几条任务级微复盘，重点看这棒是顺滑交回、需要补充，还是靠恢复动作才跑完。
                      </p>
                    </div>
                    <MetaPill>{latestTaskReflections.length} 条</MetaPill>
                  </div>
                  <div className="mt-4 space-y-3">
                    {latestTaskReflections.length > 0 ? (
                      latestTaskReflections.map((reflection) => (
                        <TaskReflectionCard key={reflection.id} reflection={reflection} />
                      ))
                    ) : (
                      <div className="rounded-[18px] border border-dashed border-line bg-surface-muted/60 px-4 py-4 text-[13px] leading-6 text-muted-strong">
                        当前还没有任务级复盘。随着任务完成、返工和恢复动作发生，这里会逐步补齐。
                      </div>
                    )}
                  </div>
                </div>

                <div className="space-y-3">
                  <div className="rounded-[22px] border border-line bg-background p-5">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <div className="text-[11px] uppercase tracking-[0.14em] text-muted">Stage Reflections</div>
                        <p className="mt-2 text-[13px] leading-6 text-muted-strong">
                          阶段维度的 highlights、frictions 和 recommendations。
                        </p>
                      </div>
                      <MetaPill>{latestStageReflections.length} 条</MetaPill>
                    </div>
                    <div className="mt-4 space-y-3">
                      {latestStageReflections.length > 0 ? (
                        latestStageReflections.map((reflection) => (
                          <StageReflectionCard key={reflection.id} reflection={reflection} />
                        ))
                      ) : (
                        <div className="rounded-[18px] border border-dashed border-line bg-surface-muted/60 px-4 py-4 text-[13px] leading-6 text-muted-strong">
                          当前还没有阶段级复盘。进入更多阶段后，这里会开始沉淀每个 stage 的经验。
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="rounded-[22px] border border-line bg-background p-5">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <div className="text-[11px] uppercase tracking-[0.14em] text-muted">Suggestions</div>
                        <p className="mt-2 text-[13px] leading-6 text-muted-strong">
                          failure pattern、模板、quality gate、skill 升级和 profile 更新建议，会在这里决定是否落地。
                        </p>
                      </div>
                      <MetaPill>{learningSuggestions.length} 条</MetaPill>
                    </div>
                    <div className="mt-4 space-y-3">
                      {displayedLearningSuggestions.length > 0 ? (
                        displayedLearningSuggestions.map((suggestion) => (
                          <LearningSuggestionCard
                            key={suggestion.id}
                            suggestion={suggestion}
                            isFocused={focusedLearningSuggestionId === suggestion.id}
                            isActing={learningSuggestionActionId === suggestion.id}
                            actingAction={learningSuggestionActionKind}
                            reuseCandidates={learningReuseCandidatesBySuggestionId.get(suggestion.id) ?? []}
                            onOpenReviewThread={
                              suggestion.reviewThreadId
                                ? () => openMailboxThread(suggestion.reviewThreadId!)
                                : undefined
                            }
                            onAccept={() => handleLearningSuggestionReview(suggestion.id, "accept")}
                            onDismiss={() => handleLearningSuggestionReview(suggestion.id, "dismiss")}
                          />
                        ))
                      ) : (
                        <div className="rounded-[18px] border border-dashed border-line bg-surface-muted/60 px-4 py-4 text-[13px] leading-6 text-muted-strong">
                          当前还没有 learning suggestion。更多复盘积累后，这里会逐步给出结构化建议。
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="rounded-[22px] border border-line bg-background p-5">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <div className="text-[11px] uppercase tracking-[0.14em] text-muted">Reuse Candidates</div>
                        <p className="mt-2 text-[13px] leading-6 text-muted-strong">
                          这里只有“已采纳”且证据足够稳定的建议才会长成跨项目复用候选，并且仍然需要你显式确认后才会进入候选库。
                        </p>
                      </div>
                      <MetaPill>{learningReuseCandidates.length} 条</MetaPill>
                    </div>
                    <div className="mt-4 flex flex-wrap gap-2">
                      <MetaPill>待确认 {pendingLearningReuseCandidateCount} 条</MetaPill>
                      <MetaPill>已确认 {confirmedLearningReuseCandidateCount} 条</MetaPill>
                    </div>
                    <div className="mt-4 space-y-3">
                      {displayedLearningReuseCandidates.length > 0 ? (
                        displayedLearningReuseCandidates.map((candidate) => (
                          <LearningReuseCandidateCard
                            key={candidate.id}
                            candidate={candidate}
                            isActing={learningReuseCandidateActionId === candidate.id}
                            actingAction={learningReuseCandidateActionKind}
                            canReview={candidate.sourceProjectId === currentProject.id}
                            onConfirm={() => handleLearningReuseCandidateReview(candidate.id, "confirm")}
                            onDismiss={() => handleLearningReuseCandidateReview(candidate.id, "dismiss")}
                          />
                        ))
                      ) : (
                        <div className="rounded-[18px] border border-dashed border-line bg-surface-muted/60 px-4 py-4 text-[13px] leading-6 text-muted-strong">
                          当前还没有从本项目长出来的跨项目复用候选。只有建议先被采纳、证据也足够稳定后，这里才会开始出现候选。
                        </div>
                      )}
                    </div>
                    {externalConfirmedLearningReuseCandidates.length > 0 ? (
                      <div className="mt-5 border-t border-line/70 pt-5">
                        <div className="text-[11px] uppercase tracking-[0.14em] text-muted">已确认候选库</div>
                        <p className="mt-2 text-[13px] leading-6 text-muted-strong">
                          这些候选来自其他项目，已经完成人工确认。当前项目可以把它们当作可选模板参考，但不需要机械照搬。
                        </p>
                        <div className="mt-4 space-y-3">
                          {externalConfirmedLearningReuseCandidates.map((candidate) => (
                            <LearningReuseCandidateCard key={candidate.id} candidate={candidate} canReview={false} />
                          ))}
                        </div>
                      </div>
                    ) : null}
                  </div>
                </div>
              </div>

              <div className="mt-5 rounded-[22px] border border-line bg-background p-5">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="text-[11px] uppercase tracking-[0.14em] text-muted">Run Summaries</div>
                    <p className="mt-2 text-[13px] leading-6 text-muted-strong">
                      最近几轮运行的 wins、risks 和 recommendations。
                    </p>
                  </div>
                  <MetaPill>{latestRunSummaries.length} 轮</MetaPill>
                </div>
                <div className="mt-4 grid gap-3 xl:grid-cols-2">
                  {latestRunSummaries.length > 0 ? (
                    latestRunSummaries.map((summary) => (
                      <RunSummaryCard key={summary.id} summary={summary} />
                    ))
                  ) : (
                    <div className="rounded-[18px] border border-dashed border-line bg-surface-muted/60 px-4 py-4 text-[13px] leading-6 text-muted-strong">
                      当前还没有 run summary。完成更多轮运行后，这里会开始沉淀项目级总结。
                    </div>
                  )}
                </div>
              </div>
            </section>

            <section className="rounded-[28px] border border-line bg-surface p-6 shadow-soft">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-[12px] font-medium uppercase tracking-[0.14em] text-muted">
                    Run Log
                  </p>
                  <h2 className="mt-2 text-[24px] font-semibold tracking-[-0.04em] text-text">
                    运行记录
                  </h2>
                  <p className="mt-2 text-[14px] leading-7 text-muted-strong">
                    这里不只看当前 runStatus，也能回看最近几轮是如何启动、停在哪个 checkpoint、又如何收束的。
                  </p>
                </div>
                <span className="rounded-full border border-line bg-surface-muted px-3 py-1.5 text-[12px] text-muted-strong">
                  最近 {latestRuns.length} 轮
                </span>
              </div>

              <div className="mt-5 grid gap-3 xl:grid-cols-2">
                {latestRuns.length > 0 ? (
                  latestRuns.map((run) => (
                    <div key={run.id} className="rounded-[22px] border border-line bg-background p-5">
                      <div className="flex flex-wrap items-center gap-2">
                        <StatusPill status={run.status}>{formatProjectStatus(run.status)}</StatusPill>
                        <MetaPill>{run.triggerLabel}</MetaPill>
                      </div>
                      <h3 className="mt-3 text-[16px] font-semibold tracking-[-0.02em] text-text">
                        {run.currentStepLabel}
                      </h3>
                      <p className="mt-2 text-[13px] leading-6 text-muted-strong">
                        {run.summary}
                      </p>
                      <div className="mt-3 flex flex-wrap gap-3 text-[11px] text-muted-strong">
                        <span>开始于 {formatActivityTimestamp(run.startedAt)}</span>
                        <span>{run.finishedAt ? `结束于 ${formatActivityTimestamp(run.finishedAt)}` : "当前仍在进行或等待下一步"}</span>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="rounded-[20px] border border-dashed border-line bg-surface-muted/60 px-4 py-4 text-[13px] leading-6 text-muted-strong">
                    当前还没有 run 记录。启动团队后，这里会开始沉淀每一轮运行的入口、当前步和最终停点。
                  </div>
                )}
              </div>
            </section>

            <section className="rounded-[28px] border border-line bg-surface p-6 shadow-soft">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-[12px] font-medium uppercase tracking-[0.14em] text-muted">
                    Memory Layer
                  </p>
                  <h2 className="mt-2 text-[24px] font-semibold tracking-[-0.04em] text-text">
                    团队记忆
                  </h2>
                  <p className="mt-2 text-[14px] leading-7 text-muted-strong">
                    这里把项目记忆、团队记忆和角色记忆收成结构化对象，后续每轮派工和执行都会拿它们做参考。
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded-full border border-line bg-surface-muted px-3 py-1.5 text-[12px] text-muted-strong">
                    {projectMemoryEntryCount} 条项目记忆
                  </span>
                  <span className="rounded-full border border-line bg-surface-muted px-3 py-1.5 text-[12px] text-muted-strong">
                    {roleMemories.length} 位角色记忆
                  </span>
                </div>
              </div>

              <div className="mt-5 grid gap-3 xl:grid-cols-3">
                <div className="rounded-[22px] border border-line bg-background p-5">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <div className="text-[11px] uppercase tracking-[0.14em] text-muted">Project Memory</div>
                      <p className="mt-2 text-[13px] leading-6 text-muted-strong">
                        关键决策、偏好、风险和历史坑点。
                      </p>
                    </div>
                    <MetaPill>{projectMemoryEntryCount} 条</MetaPill>
                  </div>
                  <div className="mt-4 space-y-3">
                    <MemoryEntryGroup title="关键决策" entries={projectMemory?.decisions ?? []} />
                    <MemoryEntryGroup title="用户偏好" entries={projectMemory?.preferences ?? []} />
                    <MemoryEntryGroup title="风险" entries={projectMemory?.risks ?? []} />
                    <MemoryEntryGroup title="历史坑点" entries={projectMemory?.pitfalls ?? []} />
                  </div>
                </div>

                <div className="rounded-[22px] border border-line bg-background p-5">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <div className="text-[11px] uppercase tracking-[0.14em] text-muted">Team Memory</div>
                      <p className="mt-2 text-[13px] leading-6 text-muted-strong">
                        团队层面的接力经验、常见卡点和 review 模式。
                      </p>
                    </div>
                    <MetaPill>
                      {(teamMemory?.handoffPatterns.length ?? 0) +
                        (teamMemory?.blockerPatterns.length ?? 0) +
                        (teamMemory?.reviewPatterns.length ?? 0)}{" "}
                      条
                    </MetaPill>
                  </div>
                  <div className="mt-4 space-y-3">
                    <MemoryPatternGroup title="最佳接力顺序" patterns={teamMemory?.handoffPatterns ?? []} />
                    <MemoryPatternGroup title="常见卡点" patterns={teamMemory?.blockerPatterns ?? []} />
                    <MemoryPatternGroup title="常见 review 问题" patterns={teamMemory?.reviewPatterns ?? []} />
                  </div>
                </div>

                <div className="rounded-[22px] border border-line bg-background p-5">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <div className="text-[11px] uppercase tracking-[0.14em] text-muted">Role Memory</div>
                      <p className="mt-2 text-[13px] leading-6 text-muted-strong">
                        每位成员更擅长什么、容易在哪里卡住，以及更适合怎样的输入格式。
                      </p>
                    </div>
                    <MetaPill>{roleMemories.length} 位</MetaPill>
                  </div>
                  <div className="mt-4 space-y-3">
                    {roleMemories.length > 0 ? (
                      roleMemories.slice(0, 4).map((memory) => (
                        <div key={memory.agentId} className="rounded-[18px] border border-line bg-surface-muted px-4 py-4">
                          <div className="flex flex-wrap items-center gap-2">
                            <MetaPill>{memory.agentName}</MetaPill>
                          </div>
                          <div className="mt-3 space-y-2 text-[13px] leading-6 text-muted-strong">
                            <p>擅长 · {memory.strengths[0] || "还没有稳定模式"}</p>
                            <p>常见问题 · {memory.commonIssues[0] || "当前没有明显重复问题"}</p>
                            <p>输入偏好 · {memory.preferredInputFormat[0] || "先给清楚目标和验收标准"}</p>
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="rounded-[18px] border border-dashed border-line bg-surface-muted/60 px-4 py-4 text-[13px] leading-6 text-muted-strong">
                        当前还没有角色记忆。随着更多任务、复核和恢复动作发生，这里会逐步长出来。
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </section>

            <section className="rounded-[28px] border border-line bg-surface p-6 shadow-soft">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-[12px] font-medium uppercase tracking-[0.14em] text-muted">
                    Task Graph
                  </p>
                  <h2 className="mt-2 text-[24px] font-semibold tracking-[-0.04em] text-text">
                    任务图摘要
                  </h2>
                  <p className="mt-2 text-[14px] leading-7 text-muted-strong">
                    这里开始把团队推进从消息驱动收成任务驱动。现在除了任务状态，也会把复核动作独立显示出来。
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded-full border border-line bg-surface-muted px-3 py-1.5 text-[12px] text-muted-strong">
                    共 {tasks.length} 条任务
                  </span>
                  <span className="rounded-full border border-line bg-surface-muted px-3 py-1.5 text-[12px] text-muted-strong">
                    {reviews.filter((review) => review.status === "pending").length} 条待复核
                  </span>
                </div>
              </div>

              {dependencyRailTasks.length > 0 ? (
                <div className="mt-5 rounded-[22px] border border-line bg-background px-4 py-4">
                  <div className="text-[11px] uppercase tracking-[0.14em] text-muted">接力依赖</div>
                  <div className="mt-3 flex flex-wrap items-center gap-2 text-[12px] text-muted-strong">
                    {dependencyRailTasks.map((task, index) => (
                      <Fragment key={task.id}>
                        <span className={`rounded-full border px-3 py-1.5 ${getTaskTone(task.status)}`}>
                          {task.ownerAgentName || "未分配"} · {compactTaskRailLabel(task.title)}
                        </span>
                        {index < dependencyRailTasks.length - 1 ? (
                          <span className="text-muted">→</span>
                        ) : null}
                      </Fragment>
                    ))}
                  </div>
                </div>
              ) : null}

              {dependencyEdges.length > 0 ? (
                <div className="mt-3 rounded-[22px] border border-line bg-background px-4 py-4">
                  <div className="text-[11px] uppercase tracking-[0.14em] text-muted">依赖边</div>
                  <div className="mt-3 space-y-2">
                    {dependencyEdges.map((edge) => (
                      <div
                        key={edge.id}
                        className="flex flex-wrap items-center gap-2 text-[12px] leading-6 text-muted-strong"
                      >
                        <span className="rounded-full border border-line bg-surface-muted px-2.5 py-1 text-[11px] text-text">
                          {edge.from}
                        </span>
                        <span>完成后开始</span>
                        <span className="rounded-full border border-line bg-surface-muted px-2.5 py-1 text-[11px] text-text">
                          {edge.to}
                        </span>
                        {edge.reason ? <span className="text-muted">· {edge.reason}</span> : null}
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}

              <div className="mt-5 grid gap-3 xl:grid-cols-2 2xl:grid-cols-4">
                <TaskColumn
                  title="当前执行"
                  description="正在跑、已 ready 或刚 reopen 的任务"
                  tasks={executionTasks}
                  emptyState="当前还没有进入可执行任务阶段。项目经理下一次派工后，这里会先出现第一棒任务。"
                  tasksById={tasksById}
                  reviewsByTaskId={reviewsByTaskId}
                  artifactsById={artifactsById}
                  onFocusArtifact={focusArtifact}
                />
                <TaskColumn
                  title="待复核"
                  description="已经交回结果，等待项目经理或用户确认"
                  tasks={reviewTasks}
                  emptyState="当前没有进入复核队列的任务。"
                  tasksById={tasksById}
                  reviewsByTaskId={reviewsByTaskId}
                  artifactsById={artifactsById}
                  onFocusArtifact={focusArtifact}
                />
                <TaskColumn
                  title="等补充 / 阻塞"
                  description="等待用户输入，或还挂在依赖上的任务"
                  tasks={stalledTasks}
                  emptyState="当前没有等待补充或阻塞中的任务。"
                  tasksById={tasksById}
                  reviewsByTaskId={reviewsByTaskId}
                  artifactsById={artifactsById}
                  onFocusArtifact={focusArtifact}
                />
                <TaskColumn
                  title="最近完成"
                  description="已经完成收束的任务"
                  tasks={completedTasks}
                  emptyState="当前还没有可回看的已完成任务。"
                  tasksById={tasksById}
                  reviewsByTaskId={reviewsByTaskId}
                  artifactsById={artifactsById}
                  onFocusArtifact={focusArtifact}
                />
              </div>
            </section>

            <section
              ref={artifactSectionRef}
              className="rounded-[28px] border border-line bg-surface p-6 shadow-soft"
            >
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-[12px] font-medium uppercase tracking-[0.14em] text-muted">
                    Artifact Graph
                  </p>
                  <h2 className="mt-2 text-[24px] font-semibold tracking-[-0.04em] text-text">
                    交付物图谱
                  </h2>
                  <p className="mt-2 text-[14px] leading-7 text-muted-strong">
                    这里把任务产出、交付物流向和下游消费关系一起收口，让 Team Room 不只知道谁在做事，也知道结果如何进入下一棒。
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded-full border border-line bg-surface-muted px-3 py-1.5 text-[12px] text-muted-strong">
                    共 {artifacts.length} 项交付物
                  </span>
                  <span className="rounded-full border border-line bg-surface-muted px-3 py-1.5 text-[12px] text-muted-strong">
                    {artifactReadyCount} 项已可用
                  </span>
                  <span className="rounded-full border border-line bg-surface-muted px-3 py-1.5 text-[12px] text-muted-strong">
                    {artifactLinkedTaskCount} 条下游任务已接入
                  </span>
                </div>
              </div>

              <div className="mt-5 grid gap-3 md:grid-cols-3">
                <RuntimeOverviewCard
                  label="已可用"
                  value={`${artifactReadyCount} 项`}
                  description="已经形成当前阶段可回看、可复用的产出。"
                  tone="success"
                />
                <RuntimeOverviewCard
                  label="待整理"
                  value={`${artifactDraftCount} 项`}
                  description="仍在草稿态或仍需经过下一步整理、确认。"
                  tone={artifactDraftCount > 0 ? "warning" : "default"}
                />
                <RuntimeOverviewCard
                  label="已接入下一棒"
                  value={`${artifactLinkedTaskCount} 条`}
                  description="这些任务已经把交付物当成输入，而不是只靠聊天上下文继续。"
                  tone={artifactLinkedTaskCount > 0 ? "info" : "default"}
                />
              </div>

              {artifactDependencyEdges.length > 0 ? (
                <div className="mt-5 rounded-[22px] border border-line bg-background px-4 py-4">
                  <div className="text-[11px] uppercase tracking-[0.14em] text-muted">交付物流向</div>
                  <div className="mt-3 space-y-2">
                    {artifactDependencyEdges.map((edge) => (
                      <div
                        key={edge.id}
                        className="flex flex-wrap items-center gap-2 text-[12px] leading-6 text-muted-strong"
                      >
                        <span className="rounded-full border border-line bg-surface-muted px-2.5 py-1 text-[11px] text-text">
                          {edge.from}
                        </span>
                        <span>流向</span>
                        <span className="rounded-full border border-line bg-surface-muted px-2.5 py-1 text-[11px] text-text">
                          {edge.to}
                        </span>
                        <span className="text-muted">· {edge.reason}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}

              <div className="mt-5 grid gap-3 xl:grid-cols-2">
                {artifacts.length > 0 ? (
                  artifacts.slice(0, 6).map((artifact) => {
                    const upstreamArtifactSummary = formatArtifactReferenceSummary(
                      artifact.dependsOnArtifactIds,
                      artifactsById,
                    );
                    const downstreamTaskSummary = formatTaskReferenceSummary(
                      artifact.consumedByTaskIds,
                      tasksById,
                    );
                    const isFocused = artifact.id === focusedArtifactId;

                    return (
                      <button
                        key={artifact.id}
                        type="button"
                        onClick={() => {
                          setFocusedArtifactId(artifact.id);
                          setSelectedArtifactId(artifact.id);
                        }}
                        className={`rounded-[22px] border p-5 text-left transition ${
                          isFocused
                            ? "border-[#c9dafd] bg-[#f4f8ff] shadow-soft"
                            : "border-line bg-background hover:bg-surface-muted"
                        }`}
                      >
                        <div className="flex flex-wrap items-center gap-2">
                          <span
                            className={`rounded-full border px-2.5 py-1 text-[11px] font-medium ${getArtifactTone(artifact.status)}`}
                          >
                            {formatArtifactStatus(artifact.status)}
                          </span>
                          <MetaPill>{artifact.typeLabel}</MetaPill>
                          {artifact.ownerAgentName ? <MetaPill>{artifact.ownerAgentName}</MetaPill> : null}
                          {artifact.reviewStatus ? (
                            <span
                              className={`rounded-full border px-2.5 py-1 text-[11px] font-medium ${getReviewTone(artifact.reviewStatus)}`}
                            >
                              复核：{formatReviewStatus(artifact.reviewStatus)}
                            </span>
                          ) : null}
                          {isFocused ? <MetaPill>已定位</MetaPill> : null}
                        </div>
                        <h3 className="mt-3 text-[16px] font-semibold tracking-[-0.02em] text-text">
                          {artifact.title}
                        </h3>
                        <p className="mt-2 line-clamp-3 text-[13px] leading-6 text-muted-strong">
                          {artifact.summary}
                        </p>
                        {artifact.sourceTaskTitle ? (
                          <p className="mt-2 line-clamp-2 text-[12px] leading-6 text-muted-strong">
                            来源任务：{artifact.sourceTaskTitle}
                          </p>
                        ) : null}
                        {artifact.reviewerAgentName ? (
                          <p className="mt-2 text-[12px] leading-6 text-muted-strong">
                            Reviewer：{artifact.reviewerAgentName}
                          </p>
                        ) : null}
                        {upstreamArtifactSummary ? (
                          <p className="mt-2 line-clamp-2 text-[12px] leading-6 text-muted-strong">
                            上游交付物：{upstreamArtifactSummary}
                          </p>
                        ) : null}
                        {downstreamTaskSummary ? (
                          <p className="mt-2 line-clamp-2 text-[12px] leading-6 text-muted-strong">
                            下游任务：{downstreamTaskSummary}
                          </p>
                        ) : null}
                        <div className="mt-3 text-[11px] text-muted-strong">
                          更新于 {formatActivityTimestamp(artifact.updatedAt)}
                        </div>
                      </button>
                    );
                  })
                ) : (
                  <div className="rounded-[20px] border border-dashed border-line bg-surface-muted/60 px-4 py-4 text-[13px] leading-6 text-muted-strong">
                    当前还没有可展示的交付物。团队开始推进后，这里会逐步沉淀阶段总结、成员结果和下游依赖关系。
                  </div>
                )}
              </div>
            </section>

            <section className="rounded-[28px] border border-line bg-surface p-6 shadow-soft">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-[12px] font-medium uppercase tracking-[0.14em] text-muted">
                    Coordination
                  </p>
                  <h2 className="mt-2 text-[24px] font-semibold tracking-[-0.04em] text-text">
                    协作信号
                  </h2>
                  <p className="mt-2 text-[14px] leading-7 text-muted-strong">
                    这里展示 Team Runtime 内部真正发生的成员协作，不再只靠 PM 在群聊里转述。当前包括 mailbox、handoff、review request、escalation 和有限 self-claim。
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded-full border border-line bg-surface-muted px-3 py-1.5 text-[12px] text-muted-strong">
                    共 {mailboxThreads.length} 条协作线程
                  </span>
                  <span className="rounded-full border border-line bg-surface-muted px-3 py-1.5 text-[12px] text-muted-strong">
                    {openMailboxThreadCount} 条待处理
                  </span>
                </div>
              </div>

              <div className="mt-5 grid gap-3 md:grid-cols-3">
                <RuntimeOverviewCard
                  label="待处理线程"
                  value={`${openMailboxThreadCount} 条`}
                  description="当前仍未收束的 mailbox / review / escalation 信号。"
                  tone={openMailboxThreadCount > 0 ? "warning" : "default"}
                />
                <RuntimeOverviewCard
                  label="协作类型"
                  value={`${mailboxKindCount} 类`}
                  description="已经进入 Team Runtime 的结构化协作类别数。"
                  tone={mailboxKindCount > 0 ? "info" : "default"}
                />
                <RuntimeOverviewCard
                  label="关联任务"
                  value={`${mailboxTaskLinkedCount} 条`}
                  description="这些协作线程已经和任务图显式挂接，而不是散在聊天里。"
                  tone={mailboxTaskLinkedCount > 0 ? "success" : "default"}
                />
              </div>

              <div className="mt-5 grid gap-3 xl:grid-cols-2">
                {mailboxThreads.length > 0 ? (
                  mailboxThreads.slice(0, 6).map((thread) => {
                    const relatedSuggestion = thread.relatedSuggestionId
                      ? learningSuggestionsById.get(thread.relatedSuggestionId) ?? null
                      : null;

                    return (
                      <button
                        key={thread.id}
                        type="button"
                        onClick={() => setSelectedMailboxThreadId(thread.id)}
                        className="rounded-[22px] border border-line bg-background p-5 text-left transition hover:bg-surface-muted"
                      >
                        <div className="flex flex-wrap items-center gap-2">
                          <span
                            className={`rounded-full border px-2.5 py-1 text-[11px] font-medium ${getMailboxThreadTone(thread.kind, thread.status)}`}
                          >
                            {formatMailboxThreadKind(thread.kind)}
                          </span>
                          <MetaPill>{formatMailboxThreadStatus(thread.status)}</MetaPill>
                          {thread.fromAgentName ? <MetaPill>{thread.fromAgentName}</MetaPill> : null}
                        </div>
                        <h3 className="mt-3 text-[16px] font-semibold tracking-[-0.02em] text-text">
                          {thread.subject}
                        </h3>
                        <p className="mt-2 line-clamp-3 text-[13px] leading-6 text-muted-strong">
                          {thread.summary}
                        </p>
                        {thread.toAgentNames.length > 0 ? (
                          <p className="mt-2 line-clamp-2 text-[12px] leading-6 text-muted-strong">
                            发送给：{thread.toAgentNames.join("、")}
                          </p>
                        ) : null}
                        {thread.relatedTaskTitle ? (
                          <p className="mt-2 line-clamp-2 text-[12px] leading-6 text-muted-strong">
                            关联任务：{thread.relatedTaskTitle}
                          </p>
                        ) : null}
                        {thread.relatedArtifactIds.length > 0 ? (
                          <p className="mt-2 line-clamp-2 text-[12px] leading-6 text-muted-strong">
                            关联交付物：{formatArtifactReferenceSummary(thread.relatedArtifactIds, artifactsById)}
                          </p>
                        ) : null}
                        {relatedSuggestion ? (
                          <p className="mt-2 line-clamp-2 text-[12px] leading-6 text-muted-strong">
                            关联建议：{relatedSuggestion.title}
                          </p>
                        ) : null}
                        <div className="mt-3 text-[11px] text-muted-strong">
                          更新于 {formatActivityTimestamp(thread.updatedAt)}
                        </div>
                      </button>
                    );
                  })
                ) : (
                  <div className="rounded-[20px] border border-dashed border-line bg-surface-muted/60 px-4 py-4 text-[13px] leading-6 text-muted-strong">
                    当前还没有结构化协作线程。开始运行后，成员之间的派工、handoff、review request 和升级信号会在这里沉淀。
                  </div>
                )}
              </div>
            </section>

            <section className="rounded-[28px] border border-line bg-surface p-6 shadow-soft">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-[12px] font-medium uppercase tracking-[0.14em] text-muted">
                    Team Board
                  </p>
                  <h2 className="mt-2 text-[24px] font-semibold tracking-[-0.04em] text-text">
                    成员推进看板
                  </h2>
                  <p className="mt-2 text-[14px] leading-7 text-muted-strong">
                    主页面只看谁在推进、谁在等待。更细的任务和结果放到成员详情里。
                  </p>
                </div>
                <span className="rounded-full border border-line bg-surface-muted px-3 py-1.5 text-[12px] text-muted-strong">
                  {sortedAgents.length} 位成员
                </span>
              </div>

              <div className="mt-5 grid gap-3 lg:grid-cols-2">
                {sortedAgents.map((agent) => {
                  const trajectory = resolveAgentTrajectory(agent, project, agentsById);

                  return (
                    <button
                      key={agent.id}
                      type="button"
                      onClick={() => setSelectedAgentId(agent.id)}
                      className={`rounded-[24px] border p-5 text-left transition ${
                        agent.id === project.activeAgentId
                          ? "border-[#c9dafd] bg-[#f4f8ff] shadow-soft"
                          : "border-line bg-background hover:bg-surface-muted"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="flex flex-wrap items-center gap-2">
                            <h3 className="text-[18px] font-semibold tracking-[-0.03em] text-text">
                              {agent.name}
                            </h3>
                            <MetaPill>{agent.role}</MetaPill>
                            {agent.canDelegate ? <MetaPill>项目经理</MetaPill> : null}
                          </div>
                          <p className="mt-2 text-[13px] leading-6 text-muted-strong">
                            {formatRuntimeCardStatus(agent, agentsById)}
                          </p>
                        </div>
                        <StatusPill status={mapAgentStatusToProjectStatus(agent.status)}>
                          {formatAgentStatus(agent.status)}
                        </StatusPill>
                      </div>

                      <div className={`mt-4 rounded-[18px] border px-4 py-3 ${getTrajectoryTone(trajectory.tone)}`}>
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-[11px] uppercase tracking-[0.14em] text-muted">接力轨迹</span>
                          <span className={`rounded-full border px-2.5 py-1 text-[11px] font-medium ${getActivityTone(trajectory.tone)}`}>
                            {trajectory.label}
                          </span>
                        </div>
                        <p className="mt-2 line-clamp-2 text-[13px] leading-6 text-muted-strong">
                          {trajectory.description}
                        </p>
                      </div>

                      <div className="mt-4">
                        <div className="text-[11px] uppercase tracking-[0.14em] text-muted">当前进展</div>
                        <p className="mt-1 line-clamp-2 text-[13px] leading-6 text-muted-strong">
                          {agent.progressLabel
                            ? `${agent.progressLabel} · ${agent.progressDetails || "过程细节正在同步"}`
                            : "当前还没有同步出更细的执行过程。"}
                        </p>
                      </div>

                      <div className="mt-4">
                        <div className="text-[11px] uppercase tracking-[0.14em] text-muted">当前任务</div>
                        <p className="mt-1 line-clamp-2 text-[13px] leading-6 text-muted-strong">
                          {agent.lastAssignedTask ||
                            (agent.canDelegate ? "收束群聊、判断下一步派工" : "等待项目经理安排")}
                        </p>
                      </div>
                    </button>
                  );
                })}
              </div>
            </section>

            {(project.runStatus === "waiting_approval" || project.runStatus === "waiting_user") ? (
              <section
                ref={checkpointSectionRef}
                className="rounded-[28px] border border-line bg-surface p-6 shadow-soft"
              >
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <p className="text-[12px] font-medium uppercase tracking-[0.14em] text-muted">
                      Checkpoint
                    </p>
                    <h2 className="mt-2 text-[24px] font-semibold tracking-[-0.04em] text-text">
                      {project.runStatus === "waiting_approval"
                        ? isAutonomyGatePaused
                          ? "处理自治 gate"
                          : "确认这轮输出"
                        : "补充后继续推进"}
                    </h2>
                    <p className="mt-2 max-w-[68ch] text-[14px] leading-7 text-muted-strong">
                      {project.runStatus === "waiting_approval"
                        ? isAutonomyGatePaused
                          ? "团队已经停在当前自治边界。你可以批准继续自动推进，也可以直接改方向后再继续。"
                          : "团队已经交回阶段结果。你可以直接确认完成，或者告诉项目经理还需要补充什么。"
                        : "团队已经停在你的补充检查点。更新一下方向后，再让它继续推进下一轮。"}
                    </p>
                  </div>
                  <span className="rounded-full border border-line bg-surface-muted px-3 py-1.5 text-[12px] text-muted-strong">
                    {project.runStatus === "waiting_approval"
                      ? isAutonomyGatePaused
                        ? "等待你放行或改方向"
                        : "需要你决定下一步"
                      : "等待你的补充"}
                  </span>
                </div>

                <div className="mt-5 rounded-[22px] border border-line bg-[linear-gradient(135deg,#fffaf5_0%,#ffffff_55%,#f6f8fe_100%)] p-5">
                  <div className="text-[11px] uppercase tracking-[0.14em] text-muted">当前聚焦点</div>
                  <p className="mt-2 whitespace-pre-wrap text-[14px] leading-7 text-text">
                    {project.latestUserRequest || project.goal}
                  </p>

                  <label className="mt-5 block">
                    <span className="text-[12px] font-medium text-muted-strong">
                      {project.runStatus === "waiting_approval"
                        ? isAutonomyGatePaused
                          ? "如果要继续放行，可附带新的边界要求"
                          : "如果需要补充，请告诉团队"
                        : "更新这次补充方向"}
                    </span>
                    <textarea
                      value={checkpointNote}
                      onChange={(event) => setCheckpointNote(event.target.value)}
                      rows={4}
                      placeholder={
                        project.runStatus === "waiting_approval"
                          ? isAutonomyGatePaused
                            ? "例如：可以继续自动推进，但请把并行人数控制在 1 人，并优先做低风险收口。"
                            : "例如：请补上风险判断，并把最终输出改成更适合产品评审会的结构。"
                          : "例如：保留原结论，但请把重点改成里程碑风险、依赖项和可交付时间。"
                      }
                      className="mt-2 w-full rounded-[16px] border border-line bg-background px-4 py-3 text-[14px] leading-7 text-text outline-none transition focus:border-text"
                    />
                  </label>

                  <div className="mt-4 flex flex-wrap gap-2">
                    {project.runStatus === "waiting_approval" ? (
                      <>
                        <button
                          type="button"
                          onClick={() => void handleCheckpointAction("approve")}
                          className={buttonClassName({ variant: "primary" })}
                          disabled={isCheckpointSubmitting || isRefreshing || isRunning}
                        >
                          {isCheckpointSubmitting ? "提交中..." : checkpointApproveLabel}
                        </button>
                        <button
                          type="button"
                          onClick={() => void handleCheckpointAction("request_changes")}
                          className={buttonClassName({ variant: "secondary" })}
                          disabled={isCheckpointSubmitting || isRefreshing || isRunning}
                        >
                          {isAutonomyGatePaused ? "改方向后再继续" : "要求补充或改方向"}
                        </button>
                        <button
                          type="button"
                          onClick={() => void handleCheckpointAction("rollback")}
                          className={buttonClassName({ variant: "secondary" })}
                          disabled={isCheckpointSubmitting || isRefreshing || isRunning}
                        >
                          {isCheckpointSubmitting ? "提交中..." : "从当前 checkpoint 重跑"}
                        </button>
                      </>
                    ) : (
                      <>
                        <button
                          type="button"
                          onClick={() => void handleCheckpointAction("resume")}
                          className={buttonClassName({ variant: "primary" })}
                          disabled={isCheckpointSubmitting || isRefreshing || isRunning}
                        >
                          {isCheckpointSubmitting ? "提交中..." : "带着补充继续推进"}
                        </button>
                        <button
                          type="button"
                          onClick={() => void handleCheckpointAction("rollback")}
                          className={buttonClassName({ variant: "secondary" })}
                          disabled={isCheckpointSubmitting || isRefreshing || isRunning}
                        >
                          {isCheckpointSubmitting ? "提交中..." : "不改方向，直接重跑"}
                        </button>
                      </>
                    )}
                  </div>
                </div>
              </section>
            ) : null}

          </div>

          <section
            ref={activitySectionRef}
            className="rounded-[28px] border border-line bg-surface p-6 shadow-soft"
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-[12px] font-medium uppercase tracking-[0.14em] text-muted">
                  Activity Feed
                </p>
                <h2 className="mt-2 text-[24px] font-semibold tracking-[-0.04em] text-text">
                  最近活动
                </h2>
                <p className="mt-2 text-[14px] leading-7 text-muted-strong">
                  这里只看压缩后的过程流。想看完整正文，再点开某一条活动。
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-full border border-line bg-surface-muted px-3 py-1.5 text-[12px] text-muted-strong">
                  最近 {runtimeMessages.length} 条
                </span>
                <button
                  type="button"
                  onClick={scrollToRuntimeHealth}
                  className={buttonClassName({ variant: "secondary", size: "sm" })}
                >
                  先看 Runtime Health
                </button>
                <button
                  type="button"
                  onClick={scrollToLearning}
                  className={buttonClassName({ variant: "secondary", size: "sm" })}
                >
                  再看 Learning
                </button>
              </div>
            </div>

            <div className="mt-5 space-y-3">
              {runtimeMessages.length > 0 ? (
                runtimeMessages.map((message) => {
                  const descriptor = resolveActivityDescriptor(message, project, agentsById);

                  return (
                    <button
                      key={message.id}
                      type="button"
                      onClick={() => setSelectedActivityMessageId(message.id)}
                      className="w-full rounded-[22px] border border-line bg-background px-4 py-4 text-left transition hover:bg-surface-muted"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <div className="text-[12px] font-medium text-text">
                              {message.role === "user" ? "你" : message.actorLabel || "OpenCrab"}
                            </div>
                            <span className={`rounded-full border px-2.5 py-1 text-[11px] font-medium ${getActivityTone(descriptor.tone)}`}>
                              {descriptor.label}
                            </span>
                            <span className="text-[11px] text-muted-strong">
                              {formatActivityTimestamp(message.timestamp)}
                            </span>
                          </div>
                          <p className="mt-2 line-clamp-3 text-[13px] leading-6 text-muted-strong">
                            {compactActivityText(message.content)}
                          </p>
                        </div>
                        <span className="rounded-full border border-line bg-surface-muted px-2.5 py-1 text-[11px] text-muted-strong">
                          {message.meta || "团队群聊"}
                        </span>
                      </div>
                    </button>
                  );
                })
              ) : (
                <div className="rounded-[20px] border border-dashed border-line bg-surface-muted/60 px-4 py-4 text-[13px] leading-6 text-muted-strong">
                  团队活动还没有开始。启动团队后，这里会先显示项目经理的派工，再逐步显示成员接力结果。
                </div>
              )}
            </div>
          </section>
        </div>
      </div>
      {selectedAgent ? (
        <DialogShell
          onClose={() => setSelectedAgentId(null)}
          panelClassName="flex h-[min(82vh,860px)] max-w-[min(720px,calc(100vw-32px))] flex-col overflow-hidden px-0 py-0"
        >
          <div className="shrink-0 border-b border-line px-6 py-5">
            <DialogHeader
              title={selectedAgent.name}
              description={`${selectedAgent.role} · ${formatRuntimeCardStatus(selectedAgent, agentsById)}`}
            />
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">
            <div className="space-y-4">
            {selectedAgentTrajectory ? (
              <div className={`rounded-[18px] border px-4 py-4 ${getTrajectoryTone(selectedAgentTrajectory.tone)}`}>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-[11px] uppercase tracking-[0.14em] text-muted">接力轨迹</span>
                  <span className={`rounded-full border px-2.5 py-1 text-[11px] font-medium ${getActivityTone(selectedAgentTrajectory.tone)}`}>
                    {selectedAgentTrajectory.label}
                  </span>
                </div>
                <p className="mt-2 text-[13px] leading-6 text-muted-strong">
                  {selectedAgentTrajectory.description}
                </p>
              </div>
            ) : null}
            <div className="rounded-[18px] border border-line bg-surface-muted px-4 py-4">
              <div className="text-[11px] uppercase tracking-[0.14em] text-muted">当前公开进展</div>
              <p className="mt-2 whitespace-pre-wrap text-[14px] leading-7 text-text">
                {selectedAgent.progressLabel
                  ? `${selectedAgent.progressLabel}${selectedAgent.progressDetails ? `\n\n${selectedAgent.progressDetails}` : ""}`
                  : "当前还没有同步出更细的执行过程。"}
              </p>
              <p className="mt-3 text-[12px] text-muted-strong">
                {selectedAgent.lastHeartbeatAt
                  ? `最近心跳：${formatActivityTimestamp(selectedAgent.lastHeartbeatAt)}`
                  : "最近心跳：等待同步"}
              </p>
            </div>
            <div className="rounded-[18px] border border-line bg-surface-muted px-4 py-4">
              <div className="text-[11px] uppercase tracking-[0.14em] text-muted">当前任务</div>
              <p className="mt-2 whitespace-pre-wrap text-[14px] leading-7 text-text">
                {selectedAgent.lastAssignedTask || "当前还没有具体任务。"}
              </p>
            </div>
            <div className="rounded-[18px] border border-line bg-surface-muted px-4 py-4">
              <div className="text-[11px] uppercase tracking-[0.14em] text-muted">依赖关系</div>
              <p className="mt-2 text-[14px] leading-7 text-text">
                {formatAgentDependency(selectedAgent, agentsById)}
              </p>
            </div>
            <div className="rounded-[18px] border border-line bg-surface-muted px-4 py-4">
              <div className="text-[11px] uppercase tracking-[0.14em] text-muted">最近结果摘要</div>
              <p className="mt-2 whitespace-pre-wrap text-[14px] leading-7 text-text">
                {selectedAgent.lastResultSummary || "这位成员还没有交回阶段结果。"}
              </p>
            </div>
            <div className="rounded-[18px] border border-line bg-surface-muted px-4 py-4">
              <div className="text-[11px] uppercase tracking-[0.14em] text-muted">最近执行轨迹</div>
              <div className="mt-3 space-y-3">
                {(selectedAgent.progressTrail ?? []).length > 0 ? (
                  [...(selectedAgent.progressTrail ?? [])]
                    .sort((left, right) => Date.parse(right.createdAt) - Date.parse(left.createdAt))
                    .map((entry) => (
                      <div key={entry.id} className="rounded-[14px] border border-line bg-background px-3 py-3">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <span className="rounded-full border border-line bg-surface-muted px-2.5 py-1 text-[11px] font-medium text-text">
                            {entry.label}
                          </span>
                          <span className="text-[11px] text-muted-strong">
                            {formatActivityTimestamp(entry.createdAt)}
                          </span>
                        </div>
                        <p className="mt-2 text-[13px] leading-6 text-muted-strong">
                          {entry.detail}
                        </p>
                      </div>
                    ))
                ) : (
                  <p className="text-[13px] leading-6 text-muted-strong">
                    这位成员还没有留下更多可公开展示的执行轨迹。
                  </p>
                )}
              </div>
            </div>
            <div className="flex flex-wrap gap-2 text-[12px] text-muted-strong">
              {selectedAgent.agentProfileId ? (
                <Link
                  href={`/agents/${selectedAgent.agentProfileId}`}
                  className="rounded-full border border-[#d7e4ff] bg-[#eef4ff] px-3 py-1.5 text-[#2d56a3] transition hover:opacity-90"
                >
                  查看智能体资产
                </Link>
              ) : null}
              <MetaPill>{selectedAgent.model}</MetaPill>
              <MetaPill>{selectedAgent.reasoningEffort}</MetaPill>
              <MetaPill>{selectedAgent.sandboxMode}</MetaPill>
              <MetaPill>{formatAgentVisibility(selectedAgent.visibility)}</MetaPill>
            </div>
          </div>
          </div>
          <div className="shrink-0 border-t border-line px-6 py-4">
            <div className="flex items-center justify-end gap-3">
              <DialogPrimaryButton onClick={() => setSelectedAgentId(null)}>关闭</DialogPrimaryButton>
            </div>
          </div>
        </DialogShell>
      ) : null}
      {selectedArtifact ? (
        <DialogShell
          onClose={() => setSelectedArtifactId(null)}
          panelClassName="flex h-[min(78vh,760px)] max-w-[min(720px,calc(100vw-32px))] flex-col overflow-hidden px-0 py-0"
        >
          <div className="shrink-0 border-b border-line px-6 py-5">
            <DialogHeader
              title={selectedArtifact.title}
              description={`${selectedArtifact.typeLabel} · ${formatArtifactStatus(selectedArtifact.status)}`}
            />
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">
            <div className="space-y-4">
              <div className={`rounded-[18px] border px-4 py-4 ${getRuntimeCardTone(
                selectedArtifact.status === "ready"
                  ? "success"
                  : selectedArtifact.status === "draft"
                    ? "warning"
                    : "default",
              )}`}>
                <div className="flex flex-wrap items-center gap-2">
                  <span
                    className={`rounded-full border px-2.5 py-1 text-[11px] font-medium ${getArtifactTone(selectedArtifact.status)}`}
                  >
                    {formatArtifactStatus(selectedArtifact.status)}
                  </span>
                  {selectedArtifact.ownerAgentName ? <MetaPill>{selectedArtifact.ownerAgentName}</MetaPill> : null}
                  {selectedArtifact.reviewStatus ? (
                    <span
                      className={`rounded-full border px-2.5 py-1 text-[11px] font-medium ${getReviewTone(selectedArtifact.reviewStatus)}`}
                    >
                      复核：{formatReviewStatus(selectedArtifact.reviewStatus)}
                    </span>
                  ) : null}
                </div>
                <p className="mt-3 whitespace-pre-wrap text-[14px] leading-7 text-text">
                  {selectedArtifact.summary}
                </p>
              </div>
              <div className="grid gap-3 md:grid-cols-2">
                <div className="rounded-[18px] border border-line bg-surface-muted px-4 py-4">
                  <div className="text-[11px] uppercase tracking-[0.14em] text-muted">来源任务</div>
                  <p className="mt-2 text-[14px] leading-7 text-text">
                    {selectedArtifact.sourceTaskTitle || "当前还没有显式来源任务。"}
                  </p>
                </div>
                <div className="rounded-[18px] border border-line bg-surface-muted px-4 py-4">
                  <div className="text-[11px] uppercase tracking-[0.14em] text-muted">Owner / Reviewer</div>
                  <p className="mt-2 text-[14px] leading-7 text-text">
                    {selectedArtifact.ownerAgentName || "未标记 owner"}
                    {selectedArtifact.reviewerAgentName ? ` · ${selectedArtifact.reviewerAgentName}` : ""}
                  </p>
                </div>
                <div className="rounded-[18px] border border-line bg-surface-muted px-4 py-4">
                  <div className="text-[11px] uppercase tracking-[0.14em] text-muted">上游交付物</div>
                  <p className="mt-2 text-[14px] leading-7 text-text">
                    {formatArtifactReferenceSummary(selectedArtifact.dependsOnArtifactIds, artifactsById) ||
                      "当前没有显式上游交付物。"}
                  </p>
                </div>
                <div className="rounded-[18px] border border-line bg-surface-muted px-4 py-4">
                  <div className="text-[11px] uppercase tracking-[0.14em] text-muted">下游任务</div>
                  <p className="mt-2 text-[14px] leading-7 text-text">
                    {formatTaskReferenceSummary(selectedArtifact.consumedByTaskIds, tasksById) ||
                      "当前还没有下游任务消费这项交付物。"}
                  </p>
                </div>
              </div>
              <div className="rounded-[18px] border border-line bg-surface-muted px-4 py-4">
                <div className="text-[11px] uppercase tracking-[0.14em] text-muted">最近更新时间</div>
                <p className="mt-2 text-[14px] leading-7 text-text">
                  {formatActivityTimestamp(selectedArtifact.updatedAt)}
                </p>
              </div>
            </div>
          </div>
          <div className="shrink-0 border-t border-line px-6 py-4">
            <div className="flex items-center justify-end gap-3">
              <DialogPrimaryButton onClick={() => setSelectedArtifactId(null)}>关闭</DialogPrimaryButton>
            </div>
          </div>
        </DialogShell>
      ) : null}
      {selectedMailboxThread ? (
        <DialogShell
          onClose={() => setSelectedMailboxThreadId(null)}
          panelClassName="flex h-[min(78vh,760px)] max-w-[min(720px,calc(100vw-32px))] flex-col overflow-hidden px-0 py-0"
        >
          <div className="shrink-0 border-b border-line px-6 py-5">
            <DialogHeader
              title={selectedMailboxThread.subject}
              description={`${formatMailboxThreadKind(selectedMailboxThread.kind)} · ${formatMailboxThreadStatus(selectedMailboxThread.status)}`}
            />
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">
            <div className="space-y-4">
              <div
                className={`rounded-[18px] border px-4 py-4 ${getRuntimeCardTone(
                  selectedMailboxThread.status === "open" ? "warning" : "default",
                )}`}
              >
                <div className="flex flex-wrap items-center gap-2">
                  <span
                    className={`rounded-full border px-2.5 py-1 text-[11px] font-medium ${getMailboxThreadTone(
                      selectedMailboxThread.kind,
                      selectedMailboxThread.status,
                    )}`}
                  >
                    {formatMailboxThreadKind(selectedMailboxThread.kind)}
                  </span>
                  <MetaPill>{formatMailboxThreadStatus(selectedMailboxThread.status)}</MetaPill>
                </div>
                <p className="mt-3 whitespace-pre-wrap text-[14px] leading-7 text-text">
                  {selectedMailboxThread.summary}
                </p>
              </div>
              <div className="grid gap-3 md:grid-cols-2">
                <div className="rounded-[18px] border border-line bg-surface-muted px-4 py-4">
                  <div className="text-[11px] uppercase tracking-[0.14em] text-muted">发起方</div>
                  <p className="mt-2 text-[14px] leading-7 text-text">
                    {selectedMailboxThread.fromAgentName || "系统"}
                  </p>
                </div>
                <div className="rounded-[18px] border border-line bg-surface-muted px-4 py-4">
                  <div className="text-[11px] uppercase tracking-[0.14em] text-muted">接收方</div>
                  <p className="mt-2 text-[14px] leading-7 text-text">
                    {selectedMailboxThread.toAgentNames.length > 0
                      ? selectedMailboxThread.toAgentNames.join("、")
                      : "当前没有显式接收方"}
                  </p>
                </div>
                <div className="rounded-[18px] border border-line bg-surface-muted px-4 py-4">
                  <div className="text-[11px] uppercase tracking-[0.14em] text-muted">关联任务</div>
                  <p className="mt-2 text-[14px] leading-7 text-text">
                    {selectedMailboxThread.relatedTaskTitle || "当前没有关联任务。"}
                  </p>
                </div>
                <div className="rounded-[18px] border border-line bg-surface-muted px-4 py-4">
                  <div className="text-[11px] uppercase tracking-[0.14em] text-muted">关联交付物</div>
                  <p className="mt-2 text-[14px] leading-7 text-text">
                    {formatArtifactReferenceSummary(selectedMailboxThread.relatedArtifactIds, artifactsById) ||
                      "当前没有关联交付物。"}
                  </p>
                </div>
                <div className="rounded-[18px] border border-line bg-surface-muted px-4 py-4 md:col-span-2">
                  <div className="text-[11px] uppercase tracking-[0.14em] text-muted">关联建议</div>
                  <p className="mt-2 text-[14px] leading-7 text-text">
                    {selectedMailboxSuggestion ? selectedMailboxSuggestion.title : "当前没有关联 learning suggestion。"}
                  </p>
                </div>
              </div>
              <div className="rounded-[18px] border border-line bg-surface-muted px-4 py-4">
                <div className="text-[11px] uppercase tracking-[0.14em] text-muted">时间</div>
                <p className="mt-2 text-[14px] leading-7 text-text">
                  创建于 {formatActivityTimestamp(selectedMailboxThread.createdAt)}
                  {selectedMailboxThread.resolvedAt
                    ? ` · 已于 ${formatActivityTimestamp(selectedMailboxThread.resolvedAt)} 收束`
                    : ""}
                </p>
              </div>
            </div>
          </div>
          <div className="shrink-0 border-t border-line px-6 py-4">
            <div className="flex items-center justify-end gap-3">
              {selectedMailboxSuggestion ? (
                <DialogSecondaryButton
                  onClick={() => {
                    setSelectedMailboxThreadId(null);
                    focusLearningSuggestion(selectedMailboxSuggestion.id);
                  }}
                >
                  定位关联建议
                </DialogSecondaryButton>
              ) : null}
              <DialogPrimaryButton onClick={() => setSelectedMailboxThreadId(null)}>关闭</DialogPrimaryButton>
            </div>
          </div>
        </DialogShell>
      ) : null}
      {selectedActivityMessage ? (
        <DialogShell
          onClose={() => setSelectedActivityMessageId(null)}
          panelClassName="flex h-[min(78vh,760px)] max-w-[min(680px,calc(100vw-32px))] flex-col overflow-hidden px-0 py-0"
        >
          <div className="shrink-0 border-b border-line px-6 py-5">
            <DialogHeader
              title={selectedActivityMessage.role === "user" ? "你的消息" : selectedActivityMessage.actorLabel || "团队活动"}
              description={buildActivityDialogDescription(selectedActivityMessage, selectedActivityDescriptor?.description)}
            />
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">
            <div className="space-y-4">
            {selectedActivityDescriptor ? (
              <div className={`rounded-[18px] border px-4 py-4 ${getActivityPanelTone(selectedActivityDescriptor.tone)}`}>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-[11px] uppercase tracking-[0.14em] text-muted">活动类型</span>
                  <span className={`rounded-full border px-2.5 py-1 text-[11px] font-medium ${getActivityTone(selectedActivityDescriptor.tone)}`}>
                    {selectedActivityDescriptor.label}
                  </span>
                </div>
                <p className="mt-2 text-[13px] leading-6 text-muted-strong">
                  {selectedActivityDescriptor.description}
                </p>
              </div>
            ) : null}
            <div className="rounded-[18px] border border-line bg-surface-muted px-4 py-4">
              <p className="whitespace-pre-wrap break-words text-[14px] leading-7 text-text">
                {selectedActivityMessage.content}
              </p>
            </div>
          </div>
          </div>
          <div className="shrink-0 border-t border-line px-6 py-4">
            <div className="flex items-center justify-end gap-3">
              {selectedActivityAnchor ? (
                <DialogSecondaryButton onClick={openActivityAnchor}>
                  {selectedActivityAnchor.label}
                </DialogSecondaryButton>
              ) : null}
              <DialogPrimaryButton onClick={() => setSelectedActivityMessageId(null)}>关闭</DialogPrimaryButton>
            </div>
          </div>
        </DialogShell>
      ) : null}
      {isDeleteDialogVisible ? (
        <DialogShell onClose={() => (isDeleting ? null : setIsDeleteDialogVisible(false))}>
          <DialogHeader
            title="删除团队"
            description="删除后，这个 Team Room 的成员、事件、结果和运行记录都会一起移除。这个操作当前不可恢复。"
          />
          <DialogActions>
            <DialogSecondaryButton onClick={() => setIsDeleteDialogVisible(false)} disabled={isDeleting}>
              取消
            </DialogSecondaryButton>
            <DialogPrimaryButton onClick={() => void handleDeleteProject()} disabled={isDeleting}>
              {isDeleting ? "删除中..." : "确认删除"}
            </DialogPrimaryButton>
          </DialogActions>
        </DialogShell>
      ) : null}
    </>
  );
}

function TaskColumn(input: {
  title: string;
  description: string;
  tasks: ProjectTaskRecord[];
  emptyState: string;
  tasksById: Map<string, ProjectTaskRecord>;
  reviewsByTaskId: Map<string, ProjectReviewRecord[]>;
  artifactsById: Map<string, ProjectArtifactRecord>;
  onFocusArtifact: (artifactId: string) => void;
}) {
  return (
    <div className="rounded-[22px] border border-line bg-background p-4">
      <div>
        <div className="text-[11px] uppercase tracking-[0.14em] text-muted">{input.title}</div>
        <p className="mt-2 text-[13px] leading-6 text-muted-strong">{input.description}</p>
      </div>

      <div className="mt-4 space-y-3">
        {input.tasks.length > 0 ? (
          input.tasks.map((task) => {
            const blocker =
              task.blockedByTaskId ? input.tasksById.get(task.blockedByTaskId) ?? null : null;
            const lockHolder =
              task.lockBlockedByTaskId ? input.tasksById.get(task.lockBlockedByTaskId) ?? null : null;
            const latestReview = input.reviewsByTaskId.get(task.id)?.[0] ?? null;

            return (
              <article key={task.id} className="rounded-[18px] border border-line bg-surface-muted/70 px-4 py-4">
                <div className="flex flex-wrap items-center gap-2">
                  <span className={`rounded-full border px-2.5 py-1 text-[11px] font-medium ${getTaskTone(task.status)}`}>
                    {formatTaskStatus(task.status)}
                  </span>
                  {task.stageLabel ? <MetaPill>{task.stageLabel}</MetaPill> : null}
                  {task.ownerAgentName ? <MetaPill>{task.ownerAgentName}</MetaPill> : null}
                  {latestReview ? (
                    <span
                      className={`rounded-full border px-2.5 py-1 text-[11px] font-medium ${getReviewTone(latestReview.status)}`}
                    >
                      复核：{formatReviewStatus(latestReview.status)}
                    </span>
                  ) : null}
                </div>
                <h3 className="mt-3 text-[15px] font-semibold tracking-[-0.02em] text-text">
                  {task.title}
                </h3>
                <p className="mt-2 line-clamp-3 text-[13px] leading-6 text-muted-strong">
                  {task.description}
                </p>
                {blocker ? (
                  <p className="mt-2 text-[12px] leading-6 text-muted-strong">
                    依赖：{blocker.title}
                  </p>
                ) : null}
                {task.blockedReason ? (
                  <p className="mt-2 line-clamp-2 text-[12px] leading-6 text-muted-strong">
                    阻塞：{task.blockedReason}
                  </p>
                ) : null}
                {task.lockScopePaths.length > 0 ? (
                  <p className="mt-2 line-clamp-2 text-[12px] leading-6 text-muted-strong">
                    锁定范围：{formatTaskLockScope(task.lockScopePaths)}
                  </p>
                ) : null}
                {lockHolder ? (
                  <p className="mt-2 line-clamp-2 text-[12px] leading-6 text-muted-strong">
                    锁占用：{lockHolder.ownerAgentName || "上游成员"} 正在处理相同路径
                  </p>
                ) : null}
                {renderTaskLeaseStatus(task)}
                {task.lastReassignmentReason ? (
                  <p className="mt-2 line-clamp-2 text-[12px] leading-6 text-muted-strong">
                    接管：{task.lastReassignmentReason}
                  </p>
                ) : null}
                {task.acceptanceCriteria ? (
                  <p className="mt-2 line-clamp-2 text-[12px] leading-6 text-muted-strong">
                    验收：{task.acceptanceCriteria}
                  </p>
                ) : null}
                {task.resultSummary ? (
                  <p className="mt-2 line-clamp-2 text-[12px] leading-6 text-muted-strong">
                    结果：{task.resultSummary}
                  </p>
                ) : null}
                <TaskArtifactShortcutRow
                  label="输入交付物"
                  artifactIds={task.inputArtifactIds}
                  artifactsById={input.artifactsById}
                  onFocusArtifact={input.onFocusArtifact}
                />
                <TaskArtifactShortcutRow
                  label="产出交付物"
                  artifactIds={task.artifactIds}
                  artifactsById={input.artifactsById}
                  onFocusArtifact={input.onFocusArtifact}
                />
                {latestReview ? (
                  <p className="mt-2 line-clamp-2 text-[12px] leading-6 text-muted-strong">
                    复核说明：{latestReview.blockingComments || latestReview.summary}
                  </p>
                ) : null}
                {latestReview?.followUpTaskId ? (
                  <p className="mt-2 text-[12px] leading-6 text-muted-strong">
                    返工：已生成后续 follow-up task
                  </p>
                ) : null}
                <div className="mt-3 text-[11px] text-muted-strong">
                  更新于 {formatActivityTimestamp(task.updatedAt)}
                </div>
              </article>
            );
          })
        ) : (
          <div className="rounded-[18px] border border-dashed border-line bg-surface-muted/60 px-4 py-4 text-[13px] leading-6 text-muted-strong">
            {input.emptyState}
          </div>
        )}
      </div>
    </div>
  );
}

function TaskArtifactShortcutRow(input: {
  label: string;
  artifactIds: string[];
  artifactsById: Map<string, ProjectArtifactRecord>;
  onFocusArtifact: (artifactId: string) => void;
}) {
  const linkedArtifacts = input.artifactIds
    .map((artifactId) => input.artifactsById.get(artifactId) ?? null)
    .filter(Boolean) as ProjectArtifactRecord[];

  if (linkedArtifacts.length === 0) {
    return null;
  }

  const visibleArtifacts = linkedArtifacts.slice(0, 2);
  const remainingCount = linkedArtifacts.length - visibleArtifacts.length;

  return (
    <div className="mt-2">
      <div className="text-[11px] uppercase tracking-[0.14em] text-muted">{input.label}</div>
      <div className="mt-2 flex flex-wrap gap-2">
        {visibleArtifacts.map((artifact) => (
          <button
            key={artifact.id}
            type="button"
            onClick={() => input.onFocusArtifact(artifact.id)}
            className="rounded-full border border-[#d7e4ff] bg-[#eef4ff] px-2.5 py-1 text-[11px] font-medium text-[#2d56a3] transition hover:opacity-90"
          >
            {compactArtifactLabel(artifact.title)}
          </button>
        ))}
        {remainingCount > 0 ? (
          <span className="rounded-full border border-line bg-surface-muted px-2.5 py-1 text-[11px] text-muted-strong">
            +{remainingCount} 项
          </span>
        ) : null}
      </div>
    </div>
  );
}

function formatProjectStatus(status: ProjectRunStatus) {
  switch (status) {
    case "running":
      return "运行中";
    case "paused":
      return "已暂停";
    case "waiting_user":
      return "等待你补充";
    case "waiting_approval":
      return "等待确认";
    case "completed":
      return "已完成";
    default:
      return "准备中";
  }
}

function getProjectStatusDescription(status: ProjectRunStatus) {
  switch (status) {
    case "running":
      return "团队正在分工推进，本轮结果会继续写回当前房间。";
    case "paused":
      return "团队已经暂停，当前上下文、分工状态和成员结果都已保留，恢复后会从当前进度继续。";
    case "waiting_user":
      return "团队已经停在你的补充检查点，等待你给出新的方向。";
    case "waiting_approval":
      return "团队已经整理完阶段结果，等待你确认是否完成这一轮。";
    case "completed":
      return "这一轮协作已经结束，当前房间更适合回看结果或发起下一轮。";
    default:
      return "团队已经准备好，随时可以开始第一轮协作。";
  }
}

function buildRunStopSummary(
  project: Exclude<ProjectDetail["project"], null>,
  input: {
    activeAgentName: string | null;
    activeAgentProgressLabel: string | null;
    isAutonomyGatePaused: boolean;
  },
) {
  switch (project.runStatus) {
    case "waiting_approval":
      return {
        title: input.isAutonomyGatePaused ? "停在自治边界" : "等待你确认",
        summary: input.isAutonomyGatePaused
          ? "这一轮不是普通暂停，而是团队命中了当前自治 gate，后续是否继续推进要先由你决定。"
          : "团队已经交回阶段结果，当前最直接的下一步是去 Checkpoint 决定确认完成还是要求补充。",
        tone: "warning" as const,
        actionLabel: "去 Checkpoint",
        actionTarget: "checkpoint" as const,
      };
    case "waiting_user":
      return {
        title: "等待你补充",
        summary: "团队已经把这一轮停在补充检查点。现在最重要的不是继续翻过程，而是先更新方向、边界或验收标准。",
        tone: "warning" as const,
        actionLabel: "补充后继续",
        actionTarget: "checkpoint" as const,
      };
    case "running":
      return {
        title: input.activeAgentName ? `${input.activeAgentName} 正在推进` : "团队推进中",
        summary:
          input.activeAgentProgressLabel
            ? `当前最值得先看的，是这位成员的最新公开进展：${input.activeAgentProgressLabel}。如果节奏异常，再往下看 Runtime Health。`
            : "当前没有停在人工检查点，先看最近 heartbeat、stuck signal 和恢复动作，更容易判断这一轮是不是顺滑推进。",
        tone: "info" as const,
        actionLabel: "看运行健康",
        actionTarget: "runtime" as const,
      };
    case "completed":
      return {
        title: "本轮已收口",
        summary: "这一轮已经不是等操作，而是适合回看最近活动、最终结论和后续是否要启动下一轮。",
        tone: "success" as const,
        actionLabel: "看最近活动",
        actionTarget: "activity" as const,
      };
    case "paused":
      return {
        title: "团队已暂停",
        summary: "暂停意味着上下文还在，但不会继续推进。现在先看 Runtime Health 和最近活动，再决定要不要恢复。",
        tone: "default" as const,
        actionLabel: "看运行健康",
        actionTarget: "runtime" as const,
      };
    default:
      return {
        title: "等待启动",
        summary: "当前还没有真正进入一轮运行。先看 Mission Control 理清目标和成员分工，再决定是否启动。",
        tone: "default" as const,
        actionLabel: "看运行健康",
        actionTarget: "runtime" as const,
      };
  }
}

function buildRecoveryFocusSummary(
  action: ProjectRecoveryActionRecord | null,
  openStuckSignalCount: number,
) {
  if (!action) {
    return {
      title: openStuckSignalCount > 0 ? `仍有 ${openStuckSignalCount} 条卡点` : "当前没有恢复动作",
      summary:
        openStuckSignalCount > 0
          ? "虽然还没有新的恢复动作，但 runtime 已经出现未收束的卡点，先去看 stuck signal 更容易知道为什么停住。"
          : "这轮暂时没有发生 retry、替补接力或 PM takeover，说明当前没有明显的恢复痕迹需要优先排查。",
      tone: openStuckSignalCount > 0 ? ("warning" as const) : ("default" as const),
    };
  }

  return {
    title: formatRecoveryActionKind(action.kind),
    summary: `${action.summary} 这条恢复动作通常会直接影响后续的 memory、learning 和下一轮派工判断。`,
    tone:
      action.kind === "reassign_to_peer"
        ? ("success" as const)
        : action.kind === "retry_same_owner"
          ? ("info" as const)
          : ("warning" as const),
  };
}

function buildMemoryFocusSummary(
  entry:
    | ProjectMemoryRecord["decisions"][number]
    | ProjectMemoryRecord["preferences"][number]
    | ProjectMemoryRecord["risks"][number]
    | ProjectMemoryRecord["pitfalls"][number]
    | ProjectTeamMemoryRecord["handoffPatterns"][number]
    | null,
) {
  if (!entry) {
    return {
      title: "当前还没有焦点记忆",
      summary: "项目记忆和团队记忆都还在继续长。等出现更多 checkpoint、review 和恢复动作后，这里会更像真正能指导下一轮的记忆层。",
      tone: "default" as const,
    };
  }

  return {
    title: entry.label,
    summary: `${entry.summary} 这条记忆已经是下一轮派工和结果判断的重要背景，不需要再从长活动流里人工回忆。`,
    tone: "info" as const,
  };
}

function buildLearningFocusSummary(
  suggestion: ProjectLearningSuggestionRecord | null,
  pendingHumanReviewSuggestionCount: number,
) {
  if (!suggestion) {
    return {
      title: pendingHumanReviewSuggestionCount > 0 ? `还有 ${pendingHumanReviewSuggestionCount} 条待人审` : "当前没有开放建议",
      summary:
        pendingHumanReviewSuggestionCount > 0
          ? "当前虽然没有定位到单条优先建议，但人审队列已经存在，先去 Learning Loop 收口这些建议再谈默认策略。"
          : "这一轮还没有新的 learning 焦点浮出来，说明当前更适合先看 runtime 和活动流。",
      tone: pendingHumanReviewSuggestionCount > 0 ? ("warning" as const) : ("default" as const),
    };
  }

  const statusLabel =
    suggestion.requiresHumanReview && suggestion.status === "open"
      ? "这条建议已经进入人审边界。"
      : suggestion.status === "accepted"
        ? "这条建议已经进入默认策略。"
        : suggestion.status === "dismissed"
          ? "这条建议已经被搁置。"
          : "这条建议仍处在开放中。";

  return {
    title: suggestion.title,
    summary: `${statusLabel} ${suggestion.summary}`,
    tone:
      suggestion.requiresHumanReview && suggestion.status === "open"
        ? ("warning" as const)
        : suggestion.status === "accepted"
          ? ("success" as const)
          : ("info" as const),
  };
}

function buildCoordinationFocusSummary(
  thread: ProjectMailboxThreadRecord | null,
  latestMessage: ConversationMessage | null,
  descriptor: ReturnType<typeof resolveActivityDescriptor> | null,
) {
  if (thread) {
    return {
      title: thread.subject,
      summary: `当前最值得先看的协作线程是“${thread.subject}”。它已经把这轮需要继续处理的协作信号收成了结构化对象，不必再从群聊里手动捞上下文。`,
      tone: thread.status === "open" ? ("warning" as const) : ("default" as const),
    };
  }

  if (latestMessage && descriptor) {
    return {
      title: descriptor.label,
      summary: `最近活动来自${latestMessage.actorLabel || "团队"}，当前更适合直接回到活动流看压缩后的 replay，而不是从最早消息开始通读。`,
      tone: descriptor.tone,
    };
  }

  return {
    title: "当前没有协作焦点",
    summary: "这一轮还没有沉淀出新的协作线程或显著活动，说明当前更适合先看 Mission Control 和运行健康。",
    tone: "default" as const,
  };
}

function buildConvergenceLearningAndCoordinationSummary(
  learningSummary: string,
  coordinationSummary: string,
) {
  return `${learningSummary} ${coordinationSummary}`;
}

function formatAgentStatus(status: ProjectAgentStatus) {
  switch (status) {
    case "planning":
      return "规划中";
    case "working":
      return "执行中";
    case "reviewing":
      return "复核中";
    default:
      return "待命";
  }
}

function formatAgentVisibility(visibility: "frontstage" | "backstage" | "mixed") {
  switch (visibility) {
    case "frontstage":
      return "前台";
    case "backstage":
      return "后台";
    default:
      return "前后台";
  }
}

function getRunActionLabel(status: ProjectRunStatus) {
  switch (status) {
    case "running":
      return "推进到待确认";
    case "paused":
      return "恢复团队运行";
    case "waiting_user":
      return "带着补充继续推进";
    case "waiting_approval":
      return "确认并完成";
    default:
      return "启动团队运行";
  }
}

function getRunFeedbackMessage(status: ProjectRunStatus) {
  switch (status) {
    case "running":
      return "团队已开始协作，项目经理正在判断第一棒并安排成员接力。";
    case "paused":
      return "团队已暂停，当前上下文、分工和成员结果都会保留。";
    case "waiting_user":
      return "新的补充方向已经记录完成，团队会等待你继续推进。";
    case "waiting_approval":
      return "团队已整理出阶段结果，项目经理正在等待你确认是否结束这一轮。";
    case "completed":
      return "团队已完成本轮协作，运行记录、事件流和结果面板都已更新。";
    default:
      return "团队状态已更新。";
  }
}

function getCheckpointFeedbackMessage(
  action: "approve" | "request_changes" | "resume" | "rollback",
  nextStatus: ProjectRunStatus,
) {
  if (action === "approve") {
    return "已确认这轮输出，团队已完成最终整理。";
  }

  if (action === "request_changes") {
    return nextStatus === "waiting_user"
      ? "已记录你的补充方向。团队会停在这里，等你确认后继续推进。"
      : "已记录补充方向。";
  }

  if (action === "rollback") {
    return nextStatus === "running"
      ? "团队已从最近 checkpoint 重新启动，项目经理会据此重新组织下一轮接力。"
      : "已从最近 checkpoint 重新准备重跑。";
  }

  return nextStatus === "running"
    ? "团队已带着新的补充方向重新开始协作。"
    : "团队状态已更新。";
}

function MemoryEntryGroup({
  title,
  entries,
}: {
  title: string;
  entries: ProjectMemoryRecord["decisions"];
}) {
  return (
    <div className="rounded-[18px] border border-line bg-surface-muted px-4 py-4">
      <div className="flex items-center justify-between gap-3">
        <div className="text-[11px] uppercase tracking-[0.14em] text-muted">{title}</div>
        <MetaPill>{entries.length} 条</MetaPill>
      </div>
      <div className="mt-3 space-y-2">
        {entries.length > 0 ? (
          entries.slice(0, 2).map((entry) => (
            <div key={entry.id}>
              <div className="text-[12px] font-medium text-text">{entry.label}</div>
              <p className="mt-1 text-[13px] leading-6 text-muted-strong">{entry.summary}</p>
            </div>
          ))
        ) : (
          <div className="text-[13px] leading-6 text-muted-strong">当前还没有相关记忆。</div>
        )}
      </div>
    </div>
  );
}

function MemoryPatternGroup({
  title,
  patterns,
}: {
  title: string;
  patterns: ProjectTeamMemoryRecord["handoffPatterns"];
}) {
  return (
    <div className="rounded-[18px] border border-line bg-surface-muted px-4 py-4">
      <div className="flex items-center justify-between gap-3">
        <div className="text-[11px] uppercase tracking-[0.14em] text-muted">{title}</div>
        <MetaPill>{patterns.length} 条</MetaPill>
      </div>
      <div className="mt-3 space-y-2">
        {patterns.length > 0 ? (
          patterns.slice(0, 2).map((pattern) => (
            <div key={pattern.id}>
              <div className="text-[12px] font-medium text-text">
                {pattern.label} · {pattern.count} 次
              </div>
              <p className="mt-1 text-[13px] leading-6 text-muted-strong">{pattern.summary}</p>
            </div>
          ))
        ) : (
          <div className="text-[13px] leading-6 text-muted-strong">当前还没有相关模式。</div>
        )}
      </div>
    </div>
  );
}

function TaskReflectionCard({
  reflection,
}: {
  reflection: ProjectTaskReflectionRecord;
}) {
  return (
    <div className="rounded-[18px] border border-line bg-surface-muted px-4 py-4">
      <div className="flex flex-wrap items-center gap-2">
        <span className={`rounded-full border px-2.5 py-1 text-[11px] font-medium ${getTaskReflectionTone(reflection.outcome)}`}>
          {formatTaskReflectionOutcome(reflection.outcome)}
        </span>
        {reflection.ownerAgentName ? <MetaPill>{reflection.ownerAgentName}</MetaPill> : null}
      </div>
      <h3 className="mt-3 text-[14px] font-semibold tracking-[-0.02em] text-text">{reflection.taskTitle}</h3>
      <p className="mt-2 text-[13px] leading-6 text-muted-strong">{reflection.summary}</p>
      <InsightList label="亮点" items={reflection.wins} />
      <InsightList label="问题" items={reflection.issues} />
      <InsightList label="建议" items={reflection.advice} />
    </div>
  );
}

function StageReflectionCard({
  reflection,
}: {
  reflection: ProjectStageReflectionRecord;
}) {
  return (
    <div className="rounded-[18px] border border-line bg-surface-muted px-4 py-4">
      <div className="flex flex-wrap items-center gap-2">
        <MetaPill>{reflection.stageLabel}</MetaPill>
      </div>
      <p className="mt-2 text-[13px] leading-6 text-muted-strong">{reflection.summary}</p>
      <InsightList label="Highlights" items={reflection.highlights} />
      <InsightList label="Frictions" items={reflection.frictions} />
      <InsightList label="Recommendations" items={reflection.recommendations} />
    </div>
  );
}

function AutonomyGateCard({
  gate,
}: {
  gate: ProjectAutonomyGateRecord;
}) {
  return (
    <div className="rounded-[18px] border border-line bg-surface-muted px-4 py-4">
      <div className="flex flex-wrap items-center gap-2">
        <span className={`rounded-full border px-2.5 py-1 text-[11px] font-medium ${getAutonomyGateTone(gate.kind, gate.status)}`}>
          {formatAutonomyGateKind(gate.kind)}
        </span>
        <MetaPill>{gate.status === "open" ? "等待放行" : "已收束"}</MetaPill>
      </div>
      <h3 className="mt-3 text-[14px] font-semibold tracking-[-0.02em] text-text">{gate.title}</h3>
      <p className="mt-2 text-[13px] leading-6 text-muted-strong">{gate.summary}</p>
      <div className="mt-3 flex flex-wrap gap-3 text-[11px] text-muted-strong">
        <span>打开于 {formatActivityTimestamp(gate.openedAt)}</span>
        {gate.resolvedAt ? <span>已于 {formatActivityTimestamp(gate.resolvedAt)} 收束</span> : null}
      </div>
    </div>
  );
}

function LearningSuggestionCard({
  suggestion,
  reuseCandidates = [],
  isFocused = false,
  isActing = false,
  actingAction = null,
  onOpenReviewThread,
  onAccept,
  onDismiss,
}: {
  suggestion: ProjectLearningSuggestionRecord;
  reuseCandidates?: ProjectLearningReuseCandidateRecord[];
  isFocused?: boolean;
  isActing?: boolean;
  actingAction?: "accept" | "dismiss" | null;
  onOpenReviewThread?: () => void;
  onAccept?: () => void;
  onDismiss?: () => void;
}) {
  return (
    <div
      className={`rounded-[18px] border px-4 py-4 ${
        isFocused ? "border-[#c9dafd] bg-[#f4f8ff] shadow-soft" : "border-line bg-surface-muted"
      }`}
    >
      <div className="flex flex-wrap items-center gap-2">
        <span className={`rounded-full border px-2.5 py-1 text-[11px] font-medium ${getLearningSuggestionTone(suggestion.kind)}`}>
          {formatLearningSuggestionKind(suggestion.kind)}
        </span>
        <MetaPill>{formatLearningSuggestionStatus(suggestion)}</MetaPill>
        {isFocused ? <MetaPill>已定位</MetaPill> : null}
      </div>
      <h3 className="mt-3 text-[14px] font-semibold tracking-[-0.02em] text-text">{suggestion.title}</h3>
      <p className="mt-2 text-[13px] leading-6 text-muted-strong">{suggestion.summary}</p>
      {suggestion.targetLabel ? (
        <p className="mt-2 text-[12px] leading-6 text-muted-strong">目标对象：{suggestion.targetLabel}</p>
      ) : null}
      {suggestion.evidenceLabels.length > 0 ? (
        <div className="mt-3 flex flex-wrap gap-2">
          {suggestion.evidenceLabels.map((label) => (
            <MetaPill key={label}>{label}</MetaPill>
          ))}
        </div>
      ) : null}
      <EvidenceSourceList sources={suggestion.evidenceSources} />
      <InsightList label="落地动作" items={suggestion.actionItems} />
      {suggestion.writebackTargets.length > 0 ? (
        <InsightList
          label={suggestion.status === "accepted" ? "已回写到" : "采纳后会回写到"}
          items={suggestion.writebackTargets}
        />
      ) : null}
      {suggestion.writebackSummary ? (
        <p className="mt-3 text-[12px] leading-6 text-muted-strong">{suggestion.writebackSummary}</p>
      ) : null}
      {reuseCandidates.length > 0 ? (
        <p className="mt-3 text-[12px] leading-6 text-muted-strong">
          跨项目复用：{summarizeLearningReuseCandidateState(reuseCandidates)}
        </p>
      ) : null}
      {suggestion.reviewNote ? (
        <p className="mt-3 text-[12px] leading-6 text-muted-strong">人审备注：{suggestion.reviewNote}</p>
      ) : null}
      {suggestion.reviewedAt ? (
        <p className="mt-2 text-[12px] leading-6 text-muted-strong">
          处理于：{formatActivityTimestamp(suggestion.reviewedAt)}
        </p>
      ) : null}
      {suggestion.reviewThreadId ? (
        <div className="mt-4 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={onOpenReviewThread}
            className={buttonClassName({ variant: "secondary", size: "sm" })}
          >
            打开关联线程
          </button>
        </div>
      ) : null}
      {suggestion.requiresHumanReview && suggestion.status === "open" ? (
        <div className="mt-4 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={onAccept}
            disabled={isActing}
            className={buttonClassName({ variant: "primary", size: "sm" })}
          >
            {isActing && actingAction === "accept" ? "采纳中..." : "采纳建议"}
          </button>
          <button
            type="button"
            onClick={onDismiss}
            disabled={isActing}
            className={buttonClassName({ variant: "secondary", size: "sm" })}
          >
            {isActing && actingAction === "dismiss" ? "处理中..." : "忽略建议"}
          </button>
        </div>
      ) : null}
    </div>
  );
}

function LearningReuseCandidateCard({
  candidate,
  isActing = false,
  actingAction = null,
  canReview = false,
  onConfirm,
  onDismiss,
}: {
  candidate: ProjectLearningReuseCandidateRecord;
  isActing?: boolean;
  actingAction?: "confirm" | "dismiss" | null;
  canReview?: boolean;
  onConfirm?: () => void;
  onDismiss?: () => void;
}) {
  return (
    <div className="rounded-[18px] border border-line bg-surface-muted px-4 py-4">
      <div className="flex flex-wrap items-center gap-2">
        <span className={`rounded-full border px-2.5 py-1 text-[11px] font-medium ${getLearningReuseCandidateTone(candidate.kind, candidate.status)}`}>
          {formatLearningReuseCandidateKind(candidate.kind)}
        </span>
        <MetaPill>{formatLearningReuseCandidateStatus(candidate.status)}</MetaPill>
        <MetaPill>来源项目：{candidate.sourceProjectTitle}</MetaPill>
      </div>
      <h3 className="mt-3 text-[14px] font-semibold tracking-[-0.02em] text-text">{candidate.title}</h3>
      <p className="mt-2 text-[13px] leading-6 text-muted-strong">{candidate.summary}</p>
      <div className="mt-3 flex flex-wrap gap-3 text-[11px] text-muted-strong">
        <span>来源建议：{candidate.sourceSuggestionTitle}</span>
        <span>采纳于 {formatActivityTimestamp(candidate.acceptedAt)}</span>
      </div>
      {candidate.targetLabel ? (
        <p className="mt-2 text-[12px] leading-6 text-muted-strong">候选对象：{candidate.targetLabel}</p>
      ) : null}
      {candidate.evidenceLabels.length > 0 ? (
        <div className="mt-3 flex flex-wrap gap-2">
          {candidate.evidenceLabels.map((label) => (
            <MetaPill key={label}>{label}</MetaPill>
          ))}
        </div>
      ) : null}
      <EvidenceSourceList sources={candidate.evidenceSources} />
      {candidate.reviewNote ? (
        <p className="mt-3 text-[12px] leading-6 text-muted-strong">确认备注：{candidate.reviewNote}</p>
      ) : null}
      {candidate.reviewedAt ? (
        <p className="mt-2 text-[12px] leading-6 text-muted-strong">
          处理于：{formatActivityTimestamp(candidate.reviewedAt)}
        </p>
      ) : null}
      {canReview && candidate.status === "pending_review" ? (
        <div className="mt-4 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={onConfirm}
            disabled={isActing}
            className={buttonClassName({ variant: "primary", size: "sm" })}
          >
            {isActing && actingAction === "confirm" ? "确认中..." : "确认进入候选库"}
          </button>
          <button
            type="button"
            onClick={onDismiss}
            disabled={isActing}
            className={buttonClassName({ variant: "secondary", size: "sm" })}
          >
            {isActing && actingAction === "dismiss" ? "处理中..." : "暂不复用"}
          </button>
        </div>
      ) : null}
    </div>
  );
}

function RunSummaryCard({
  summary,
}: {
  summary: ProjectRunSummaryRecord;
}) {
  return (
    <div className="rounded-[18px] border border-line bg-surface-muted px-4 py-4">
      <div className="flex flex-wrap items-center gap-2">
        <StatusPill status={summary.outcome}>{formatProjectStatus(summary.outcome)}</StatusPill>
        <MetaPill>{summary.title}</MetaPill>
      </div>
      <p className="mt-3 text-[13px] leading-6 text-muted-strong">{summary.summary}</p>
      <InsightList label="Wins" items={summary.wins} />
      <InsightList label="Risks" items={summary.risks} />
      <InsightList label="Recommendations" items={summary.recommendations} />
    </div>
  );
}

function InsightList({
  label,
  items,
}: {
  label: string;
  items: string[];
}) {
  if (items.length === 0) {
    return null;
  }

  return (
    <div className="mt-3">
      <div className="text-[11px] uppercase tracking-[0.14em] text-muted">{label}</div>
      <div className="mt-2 space-y-1.5">
        {items.slice(0, 3).map((item) => (
          <p key={item} className="text-[13px] leading-6 text-muted-strong">
            {item}
          </p>
        ))}
      </div>
    </div>
  );
}

function EvidenceSourceList({
  sources,
}: {
  sources: Array<ProjectLearningSuggestionRecord["evidenceSources"][number]>;
}) {
  if (sources.length === 0) {
    return null;
  }

  return (
    <div className="mt-3">
      <div className="text-[11px] uppercase tracking-[0.14em] text-muted">证据来源</div>
      <div className="mt-2 space-y-2">
        {sources.slice(0, 3).map((source) => (
          <div key={source.id} className="rounded-[14px] border border-line/70 bg-background px-3 py-3">
            <div className="text-[12px] font-medium text-text">
              {formatLearningEvidenceSourceKind(source.kind)} · {source.label}
            </div>
            <p className="mt-1 text-[12px] leading-6 text-muted-strong">{source.summary}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

function StageRail({ currentStage }: { currentStage: string }) {
  const stages = ["待启动", "项目经理统筹", "产品定义", "开发实现", "验收复核", "结果整理", "阶段收束"];
  const currentIndex = Math.max(
    stages.findIndex((stage) => currentStage.includes(stage)),
    0,
  );

  return (
    <div className="grid gap-2 md:grid-cols-7">
      {stages.map((stage, index) => {
        const isPast = index <= currentIndex;
        const isCurrent = index === currentIndex;

        return (
          <div
            key={stage}
            className={`rounded-[18px] border px-3 py-3 text-center text-[12px] ${
              isCurrent
                ? "border-[#c9dafd] bg-[#edf4ff] text-[#2959b8]"
                : isPast
                  ? "border-[#d8e5d9] bg-[#f2faf3] text-[#2f6a41]"
                  : "border-line bg-background text-muted-strong"
            }`}
          >
            {stage}
          </div>
        );
      })}
    </div>
  );
}

function RuntimeOverviewCard({
  label,
  value,
  description,
  tone = "default",
}: {
  label: string;
  value: string;
  description: string;
  tone?: "default" | "info" | "warning" | "success";
}) {
  return (
    <article className={`rounded-[20px] border p-4 ${getRuntimeCardTone(tone)}`}>
      <div className="text-[11px] uppercase tracking-[0.18em] text-muted">{label}</div>
      <div className="mt-3 text-[18px] font-semibold tracking-[-0.03em] text-text">{value}</div>
      <p className="mt-2 text-[13px] leading-6 text-muted-strong">{description}</p>
    </article>
  );
}

function ConvergenceFocusCard({
  label,
  title,
  summary,
  tone = "default",
  actionLabel,
  onAction,
}: {
  label: string;
  title: string;
  summary: string;
  tone?: "default" | "info" | "warning" | "success";
  actionLabel: string;
  onAction: () => void;
}) {
  return (
    <article className={`rounded-[20px] border p-4 ${getRuntimeCardTone(tone)}`}>
      <div className="text-[11px] uppercase tracking-[0.18em] text-muted">{label}</div>
      <div className="mt-3 text-[16px] font-semibold tracking-[-0.03em] text-text">{title}</div>
      <p className="mt-2 text-[13px] leading-6 text-muted-strong">{summary}</p>
      <button
        type="button"
        onClick={onAction}
        className={`${buttonClassName({ variant: "secondary", size: "sm" })} mt-4`}
      >
        {actionLabel}
      </button>
    </article>
  );
}

function compactActivityText(value: string, maxLength = 180) {
  const normalized = value.replace(/\s+/g, " ").trim();
  return normalized.length > maxLength ? `${normalized.slice(0, maxLength - 3)}...` : normalized;
}

function formatActivityTimestamp(timestamp?: string | null) {
  if (!timestamp) {
    return "时间未知";
  }

  const parsed = new Date(timestamp);

  if (Number.isNaN(parsed.getTime())) {
    return "时间未知";
  }

  return new Intl.DateTimeFormat("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(parsed);
}

function buildActivityDialogDescription(
  message: ConversationMessage,
  descriptorDescription?: string | null,
) {
  const timeLabel = formatActivityTimestamp(message.timestamp);

  if (descriptorDescription && message.meta) {
    return `${descriptorDescription} · ${timeLabel} · ${message.meta}`;
  }

  if (descriptorDescription) {
    return `${descriptorDescription} · ${timeLabel}`;
  }

  if (message.meta) {
    return `${timeLabel} · ${message.meta}`;
  }

  return timeLabel;
}

function buildProjectSummaryPreview(value: string) {
  return compactActivityText(value.replace(/\n+/g, " ").trim(), 180);
}

function buildProjectSummaryPanelText(value: string) {
  const lines = value
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .slice(0, 8);

  if (lines.length === 0) {
    return "项目经理还没有给出这轮判断摘要。";
  }

  return lines.join("\n");
}

function resolveActivityAnchorTarget(
  message: ConversationMessage,
  latestUserRequest: string | null,
  learningSuggestions: ProjectLearningSuggestionRecord[],
  recoveryActions: ProjectRecoveryActionRecord[],
) {
  const linkedSuggestion =
    learningSuggestions.find(
      (suggestion) =>
        message.content.includes(suggestion.title) ||
        suggestion.evidenceLabels.some((label) => label && message.content.includes(label)),
    ) ?? null;

  if (linkedSuggestion) {
    return {
      kind: "learning" as const,
      label: "定位关联建议",
      suggestionId: linkedSuggestion.id,
    };
  }

  if (
    (latestUserRequest && message.role === "user" && message.content.trim() === latestUserRequest.trim()) ||
    /(确认|补充|等待你|checkpoint|待确认|待补充)/.test(message.content)
  ) {
    return {
      kind: "checkpoint" as const,
      label: "看检查点",
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
      kind: "runtime_health" as const,
      label: "看恢复上下文",
    };
  }

  return null;
}

function resolveActivityDescriptor(
  message: ConversationMessage,
  project: NonNullable<ProjectDetail["project"]>,
  agentsById: Map<string, ProjectAgentRecord>,
) {
  if (message.role === "user") {
    const normalized = message.content.trim();

    if (project.runStatus === "waiting_user" && normalized === (project.latestUserRequest || "").trim()) {
      return {
        label: "用户补充",
        description: "你补充了新的目标、边界或修改意见，项目经理会据此组织下一轮推进。",
        tone: "warning" as const,
      };
    }

    return {
      label: "用户指令",
      description: "这是你在 frontstage 群聊里给团队的新要求或新问题。",
      tone: "default" as const,
    };
  }

  const actor =
    [...agentsById.values()].find((agent) => agent.name === message.actorLabel) ?? null;

  if (actor?.canDelegate) {
    if (/@\S+/.test(message.content)) {
      return {
        label: "PM 派工",
        description: "项目经理正在点名下一棒成员，并把这轮任务继续往下推进。",
        tone: "info" as const,
      };
    }

    if (/(确认|结束|补充|反馈|告诉我|等待你)/.test(message.content)) {
      return {
        label: project.runStatus === "waiting_user" ? "PM 等补充" : "PM 待确认",
        description:
          project.runStatus === "waiting_user"
            ? "项目经理判断现在更需要你的补充，而不是继续派工。"
            : "项目经理判断当前已有可交付结果，正在等你确认或反馈。",
        tone: "warning" as const,
      };
    }

    return {
      label: "PM 收束",
      description: "项目经理正在汇总当前进展、判断依赖，并准备决定下一步。",
      tone: "info" as const,
    };
  }

  if (actor) {
    return {
      label: "成员结果",
      description: `${actor.name} 已交回这一步的真实执行结果，项目经理会基于它继续判断下一步。`,
      tone: "success" as const,
    };
  }

  return {
    label: "团队活动",
    description: "这是当前 Team Runtime 的一条过程消息。",
    tone: "default" as const,
  };
}

function resolveAgentTrajectory(
  agent: ProjectAgentRecord,
  project: NonNullable<ProjectDetail["project"]>,
  agentsById: Map<string, ProjectAgentRecord>,
) {
  if (agent.canDelegate) {
    if (project.runStatus === "waiting_approval") {
      return {
        label: "等待确认",
        description: "项目经理已经完成阶段收束，当前在等你确认结束或提出补充。",
        tone: "warning" as const,
      };
    }

    if (project.runStatus === "waiting_user") {
      return {
        label: "等待补充",
        description: "项目经理判断现在更缺你的补充信息，所以暂时没有继续派工。",
        tone: "warning" as const,
      };
    }

    if (project.activeAgentId === agent.id || project.nextAgentId) {
      return {
        label: "统筹推进",
        description: project.nextAgentId
          ? `项目经理已点名 ${agentsById.get(project.nextAgentId)?.name || "下一位成员"} 接力，并会在结果回来后继续判断下一步。`
          : "项目经理正在观察当前结果，准备决定下一步是继续派工还是收束总结。",
        tone: "info" as const,
      };
    }

    return {
      label: "待命统筹",
      description: "项目经理是这轮协作的 owner，随时会根据群聊内容重新编排成员接力。",
      tone: "default" as const,
    };
  }

  if (agent.status === "working") {
    return {
      label: "已被点名",
      description: "这位成员已经被项目经理点名启动，当前正在处理这一棒任务。",
      tone: "info" as const,
    };
  }

  if (agent.blockedByAgentId) {
    const blocker = agentsById.get(agent.blockedByAgentId);
    return {
      label: "等待上游",
      description: blocker
        ? `这位成员已经在接力链上，但要等 ${blocker.name} 先交回结果后才会真正开工。`
        : "这位成员在接力链上，但仍在等待上游阶段结果。",
      tone: "warning" as const,
    };
  }

  if (agent.lastCompletedAt || agent.status === "reviewing") {
    return {
      label: "已交回 PM",
      description: `这位成员已经完成这一棒，最近一次结果已交回给项目经理${formatAgentCompletionTime(agent.lastCompletedAt)}。`,
      tone: "success" as const,
    };
  }

  return {
    label: "尚未上场",
    description: "这位成员当前还没被安排到这一轮接力链里，项目经理后续会按需要点名。",
    tone: "default" as const,
  };
}

function resolveDisplayedStageLabel(
  project: NonNullable<ProjectDetail["project"]>,
  activeAgent: ProjectAgentRecord | null,
  nextAgent: ProjectAgentRecord | null,
) {
  if (project.currentStageLabel && project.currentStageLabel !== "待启动") {
    return project.currentStageLabel;
  }

  const signal = `${project.summary} ${nextAgent?.lastAssignedTask || ""} ${activeAgent?.lastAssignedTask || ""}`.toLowerCase();

  if (/(开发|工程|实现|official-site|页面第一版|编码)/i.test(signal)) {
    return "开发实现";
  }

  if (/(产品|信息架构|页面内容|交互|需求)/i.test(signal)) {
    return "产品定义";
  }

  if (/(杠精|验收|风险|红线|review)/i.test(signal)) {
    return "验收复核";
  }

  if (/(文案|汇报|对外|总结|writer)/i.test(signal)) {
    return "结果整理";
  }

  if (project.runStatus === "running") {
    return "项目经理统筹";
  }

  if (project.runStatus === "paused") {
    return "暂停中";
  }

  return "待启动";
}

function resolveManagerDecision(
  project: NonNullable<ProjectDetail["project"]>,
  activeAgent: ProjectAgentRecord | null,
  nextAgent: ProjectAgentRecord | null,
) {
  if (project.runStatus === "waiting_approval") {
    return {
      label: "交付待确认",
      description: "项目经理认为当前已有可交付结果，正在等你确认结束或反馈问题。",
      tone: "warning" as const,
    };
  }

  if (project.runStatus === "waiting_user") {
    return {
      label: "等待你补充",
      description: "项目经理判断当前更缺你的补充信息，而不是继续派工。",
      tone: "warning" as const,
    };
  }

  if (project.runStatus === "paused") {
    return {
      label: "已暂停",
      description: "团队当前已经暂停，项目经理会保留现有上下文和接力状态，等你恢复后再继续推进。",
      tone: "warning" as const,
    };
  }

  if (project.runStatus === "completed") {
    return {
      label: "本轮已收束",
      description: "这轮协作已经完成，项目经理已完成总结并停止继续派工。",
      tone: "success" as const,
    };
  }

  if (nextAgent) {
    return {
      label: "继续派工",
      description: `项目经理判断当前还要继续推进，下一棒预计交给 ${nextAgent.name}。`,
      tone: "info" as const,
    };
  }

  if (activeAgent?.canDelegate) {
    return {
      label: "正在收束判断",
      description: "项目经理正在看当前结果，准备决定是继续派工还是进入待确认。",
      tone: "info" as const,
    };
  }

  return {
    label: "等待启动",
    description: "团队还没进入正式推进，项目经理还没有开始本轮编排。",
    tone: "default" as const,
  };
}

function formatAgentCompletionTime(value: string | null | undefined) {
  if (!value) {
    return "";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "";
  }

  return `（${date.toLocaleString("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  })}）`;
}

function isInteractiveInputFocused() {
  if (typeof document === "undefined") {
    return false;
  }

  const activeElement = document.activeElement;

  if (!activeElement) {
    return false;
  }

  if (activeElement instanceof HTMLInputElement || activeElement instanceof HTMLTextAreaElement) {
    return true;
  }

  if (activeElement instanceof HTMLSelectElement) {
    return true;
  }

  return activeElement instanceof HTMLElement && activeElement.isContentEditable;
}

function hasProjectDetailMeaningfulChange(current: ProjectDetail | null, next: ProjectDetail | null) {
  if (!current || !next) {
    return true;
  }

  const currentProject = current.project;
  const nextProject = next.project;

  if (!currentProject || !nextProject) {
    return currentProject !== nextProject;
  }

  if (
    currentProject.updatedAt !== nextProject.updatedAt ||
    currentProject.runStatus !== nextProject.runStatus ||
    currentProject.summary !== nextProject.summary ||
    currentProject.lastActivityLabel !== nextProject.lastActivityLabel ||
    currentProject.currentStageLabel !== nextProject.currentStageLabel ||
    currentProject.activeAgentId !== nextProject.activeAgentId ||
    currentProject.nextAgentId !== nextProject.nextAgentId ||
    currentProject.openGateCount !== nextProject.openGateCount ||
    currentProject.latestGateSummary !== nextProject.latestGateSummary ||
    currentProject.autonomyStatus !== nextProject.autonomyStatus ||
    currentProject.autonomyRoundBudget !== nextProject.autonomyRoundBudget ||
    currentProject.autonomyRoundCount !== nextProject.autonomyRoundCount ||
    currentProject.autonomyPauseReason !== nextProject.autonomyPauseReason
  ) {
    return true;
  }

  if (
    current.agents.length !== next.agents.length ||
    current.tasks.length !== next.tasks.length ||
    current.artifacts.length !== next.artifacts.length ||
    current.mailboxThreads.length !== next.mailboxThreads.length ||
    current.roleMemories.length !== next.roleMemories.length ||
    current.taskReflections.length !== next.taskReflections.length ||
    current.stageReflections.length !== next.stageReflections.length ||
    current.runSummaries.length !== next.runSummaries.length ||
    current.learningSuggestions.length !== next.learningSuggestions.length ||
    current.learningReuseCandidates.length !== next.learningReuseCandidates.length ||
    current.autonomyGates.length !== next.autonomyGates.length ||
    current.heartbeats.length !== next.heartbeats.length ||
    current.stuckSignals.length !== next.stuckSignals.length ||
    current.recoveryActions.length !== next.recoveryActions.length ||
    current.reviews.length !== next.reviews.length ||
    current.runs.length !== next.runs.length
  ) {
    return true;
  }

  if (
    buildTaskChangeSignature(current.tasks) !== buildTaskChangeSignature(next.tasks) ||
    buildArtifactChangeSignature(current.artifacts) !== buildArtifactChangeSignature(next.artifacts) ||
    buildMailboxThreadChangeSignature(current.mailboxThreads) !==
      buildMailboxThreadChangeSignature(next.mailboxThreads) ||
    buildProjectMemoryChangeSignature(current.projectMemory) !==
      buildProjectMemoryChangeSignature(next.projectMemory) ||
    buildTeamMemoryChangeSignature(current.teamMemory) !== buildTeamMemoryChangeSignature(next.teamMemory) ||
    buildRoleMemoryChangeSignature(current.roleMemories) !== buildRoleMemoryChangeSignature(next.roleMemories) ||
    buildTaskReflectionChangeSignature(current.taskReflections) !==
      buildTaskReflectionChangeSignature(next.taskReflections) ||
    buildStageReflectionChangeSignature(current.stageReflections) !==
      buildStageReflectionChangeSignature(next.stageReflections) ||
    buildRunSummaryChangeSignature(current.runSummaries) !== buildRunSummaryChangeSignature(next.runSummaries) ||
    buildLearningSuggestionChangeSignature(current.learningSuggestions) !==
      buildLearningSuggestionChangeSignature(next.learningSuggestions) ||
    buildLearningReuseCandidateChangeSignature(current.learningReuseCandidates) !==
      buildLearningReuseCandidateChangeSignature(next.learningReuseCandidates) ||
    buildAutonomyGateChangeSignature(current.autonomyGates) !==
      buildAutonomyGateChangeSignature(next.autonomyGates) ||
    buildHeartbeatChangeSignature(current.heartbeats) !== buildHeartbeatChangeSignature(next.heartbeats) ||
    buildStuckSignalChangeSignature(current.stuckSignals) !== buildStuckSignalChangeSignature(next.stuckSignals) ||
    buildRecoveryActionChangeSignature(current.recoveryActions) !==
      buildRecoveryActionChangeSignature(next.recoveryActions) ||
    buildReviewChangeSignature(current.reviews) !== buildReviewChangeSignature(next.reviews) ||
    buildRunChangeSignature(current.runs) !== buildRunChangeSignature(next.runs)
  ) {
    return true;
  }

  return next.agents.some((agent, index) => {
    const previous = current.agents[index];

    return (
      !previous ||
      previous.id !== agent.id ||
      previous.status !== agent.status ||
      previous.blockedByAgentId !== agent.blockedByAgentId ||
      previous.lastAssignedTask !== agent.lastAssignedTask ||
      previous.lastResultSummary !== agent.lastResultSummary ||
      previous.lastCompletedAt !== agent.lastCompletedAt ||
      previous.progressLabel !== agent.progressLabel ||
      previous.progressDetails !== agent.progressDetails ||
      previous.lastHeartbeatAt !== agent.lastHeartbeatAt ||
      JSON.stringify(previous.progressTrail ?? []) !== JSON.stringify(agent.progressTrail ?? [])
    );
  });
}

function buildTaskChangeSignature(tasks: ProjectTaskRecord[]) {
  return JSON.stringify(
    tasks.map((task) => ({
      id: task.id,
      status: task.status,
      ownerAgentId: task.ownerAgentId,
      blockedByTaskId: task.blockedByTaskId,
      blockedReason: task.blockedReason,
      resultSummary: task.resultSummary,
      artifactIds: task.artifactIds,
      inputArtifactIds: task.inputArtifactIds,
      updatedAt: task.updatedAt,
    })),
  );
}

function buildArtifactChangeSignature(artifacts: ProjectArtifactRecord[]) {
  return JSON.stringify(
    artifacts.map((artifact) => ({
      id: artifact.id,
      status: artifact.status,
      sourceTaskId: artifact.sourceTaskId,
      reviewStatus: artifact.reviewStatus,
      dependsOnArtifactIds: artifact.dependsOnArtifactIds,
      consumedByTaskIds: artifact.consumedByTaskIds,
      updatedAt: artifact.updatedAt,
    })),
  );
}

function buildMailboxThreadChangeSignature(threads: ProjectMailboxThreadRecord[]) {
  return JSON.stringify(
    threads.map((thread) => ({
      id: thread.id,
      kind: thread.kind,
      status: thread.status,
      relatedTaskId: thread.relatedTaskId,
      relatedReviewId: thread.relatedReviewId,
      relatedSuggestionId: thread.relatedSuggestionId,
      relatedArtifactIds: thread.relatedArtifactIds,
      updatedAt: thread.updatedAt,
    })),
  );
}

function buildProjectMemoryChangeSignature(memory: ProjectMemoryRecord | null) {
  if (!memory) {
    return "null";
  }

  return JSON.stringify({
    decisions: memory.decisions,
    preferences: memory.preferences,
    risks: memory.risks,
    pitfalls: memory.pitfalls,
    updatedAt: memory.updatedAt,
  });
}

function buildTeamMemoryChangeSignature(memory: ProjectTeamMemoryRecord | null) {
  if (!memory) {
    return "null";
  }

  return JSON.stringify({
    handoffPatterns: memory.handoffPatterns,
    blockerPatterns: memory.blockerPatterns,
    reviewPatterns: memory.reviewPatterns,
    updatedAt: memory.updatedAt,
  });
}

function buildRoleMemoryChangeSignature(memories: ProjectRoleMemoryRecord[]) {
  return JSON.stringify(
    memories.map((memory) => ({
      agentId: memory.agentId,
      strengths: memory.strengths,
      commonIssues: memory.commonIssues,
      preferredInputFormat: memory.preferredInputFormat,
      updatedAt: memory.updatedAt,
    })),
  );
}

function buildTaskReflectionChangeSignature(reflections: ProjectTaskReflectionRecord[]) {
  return JSON.stringify(
    reflections.map((reflection) => ({
      id: reflection.id,
      outcome: reflection.outcome,
      summary: reflection.summary,
      wins: reflection.wins,
      issues: reflection.issues,
      advice: reflection.advice,
      updatedAt: reflection.updatedAt,
    })),
  );
}

function buildStageReflectionChangeSignature(reflections: ProjectStageReflectionRecord[]) {
  return JSON.stringify(
    reflections.map((reflection) => ({
      id: reflection.id,
      summary: reflection.summary,
      highlights: reflection.highlights,
      frictions: reflection.frictions,
      recommendations: reflection.recommendations,
      updatedAt: reflection.updatedAt,
    })),
  );
}

function buildRunSummaryChangeSignature(summaries: ProjectRunSummaryRecord[]) {
  return JSON.stringify(
    summaries.map((summary) => ({
      id: summary.id,
      outcome: summary.outcome,
      summary: summary.summary,
      wins: summary.wins,
      risks: summary.risks,
      recommendations: summary.recommendations,
      updatedAt: summary.updatedAt,
    })),
  );
}

function buildLearningSuggestionChangeSignature(suggestions: ProjectLearningSuggestionRecord[]) {
  return JSON.stringify(
    suggestions.map((suggestion) => ({
      id: suggestion.id,
      kind: suggestion.kind,
      status: suggestion.status,
      summary: suggestion.summary,
      evidenceLabels: suggestion.evidenceLabels,
      evidenceSources: suggestion.evidenceSources,
      targetLabel: suggestion.targetLabel,
      actionItems: suggestion.actionItems,
      writebackSummary: suggestion.writebackSummary,
      writebackTargets: suggestion.writebackTargets,
      requiresHumanReview: suggestion.requiresHumanReview,
      reviewThreadId: suggestion.reviewThreadId,
      reviewNote: suggestion.reviewNote,
      reviewedAt: suggestion.reviewedAt,
      updatedAt: suggestion.updatedAt,
    })),
  );
}

function buildLearningReuseCandidateChangeSignature(candidates: ProjectLearningReuseCandidateRecord[]) {
  return JSON.stringify(
    candidates.map((candidate) => ({
      id: candidate.id,
      sourceProjectId: candidate.sourceProjectId,
      sourceSuggestionId: candidate.sourceSuggestionId,
      kind: candidate.kind,
      status: candidate.status,
      summary: candidate.summary,
      evidenceLabels: candidate.evidenceLabels,
      evidenceSources: candidate.evidenceSources,
      acceptedAt: candidate.acceptedAt,
      reviewNote: candidate.reviewNote,
      reviewedAt: candidate.reviewedAt,
      updatedAt: candidate.updatedAt,
    })),
  );
}

function buildAutonomyGateChangeSignature(gates: ProjectAutonomyGateRecord[]) {
  return JSON.stringify(
    gates.map((gate) => ({
      id: gate.id,
      kind: gate.kind,
      status: gate.status,
      title: gate.title,
      summary: gate.summary,
      updatedAt: gate.updatedAt,
      resolvedAt: gate.resolvedAt,
    })),
  );
}

function buildReviewChangeSignature(reviews: ProjectReviewRecord[]) {
  return JSON.stringify(
    reviews.map((review) => ({
      id: review.id,
      taskId: review.taskId,
      status: review.status,
      followUpTaskId: review.followUpTaskId,
      updatedAt: review.updatedAt,
    })),
  );
}

function buildHeartbeatChangeSignature(heartbeats: ProjectHeartbeatRecord[]) {
  return JSON.stringify(
    heartbeats.map((heartbeat) => ({
      id: heartbeat.id,
      agentId: heartbeat.agentId,
      status: heartbeat.status,
      taskId: heartbeat.taskId,
      recordedAt: heartbeat.recordedAt,
      leaseExpiresAt: heartbeat.leaseExpiresAt,
    })),
  );
}

function buildStuckSignalChangeSignature(signals: ProjectStuckSignalRecord[]) {
  return JSON.stringify(
    signals.map((signal) => ({
      id: signal.id,
      kind: signal.kind,
      status: signal.status,
      agentId: signal.agentId,
      taskId: signal.taskId,
      updatedAt: signal.updatedAt,
    })),
  );
}

function buildRecoveryActionChangeSignature(actions: ProjectRecoveryActionRecord[]) {
  return JSON.stringify(
    actions.map((action) => ({
      id: action.id,
      kind: action.kind,
      taskId: action.taskId,
      fromAgentId: action.fromAgentId,
      toAgentId: action.toAgentId,
      createdAt: action.createdAt,
    })),
  );
}

function buildRunChangeSignature(runs: ProjectDetail["runs"]) {
  return JSON.stringify(
    runs.map((run) => ({
      id: run.id,
      status: run.status,
      currentStepLabel: run.currentStepLabel,
      summary: run.summary,
      startedAt: run.startedAt,
      finishedAt: run.finishedAt,
    })),
  );
}

function formatRuntimeCardStatus(
  agent: ProjectAgentRecord,
  agentsById: Map<string, ProjectAgentRecord>,
) {
  if (agent.status === "working") {
    return "当前正在执行";
  }

  if (agent.blockedByAgentId) {
    const blocker = agentsById.get(agent.blockedByAgentId);
    return blocker ? `等待 ${blocker.name} 完成上一棒` : "等待上游结果";
  }

  if (agent.status === "reviewing") {
    return "已经交回阶段结果";
  }

  if (agent.canDelegate) {
    return "正在观察群聊并安排下一步";
  }

  return "待命，等待项目经理安排";
}

function formatAgentDependency(
  agent: ProjectAgentRecord,
  agentsById: Map<string, ProjectAgentRecord>,
) {
  if (!agent.blockedByAgentId) {
    return agent.canDelegate ? "负责判断依赖、决定下一棒。" : "当前没有明确阻塞，拿到 baton 就能继续。";
  }

  const blocker = agentsById.get(agent.blockedByAgentId);
  return blocker ? `当前依赖 ${blocker.name} 的阶段结果。` : "当前依赖上游阶段结果。";
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

function formatTaskStatus(status: ProjectTaskRecord["status"]) {
  switch (status) {
    case "claimed":
      return "已接手";
    case "ready":
      return "待执行";
    case "in_progress":
      return "执行中";
    case "in_review":
      return "待复核";
    case "waiting_input":
      return "待补充";
    case "blocked":
      return "等待依赖";
    case "completed":
      return "已完成";
    case "reopened":
      return "待重开";
    case "cancelled":
      return "已取消";
    default:
      return "草稿";
  }
}

function formatArtifactStatus(status: ProjectArtifactRecord["status"]) {
  switch (status) {
    case "ready":
      return "已可用";
    case "planned":
      return "已规划";
    default:
      return "草稿";
  }
}

function formatMailboxThreadKind(kind: ProjectMailboxThreadRecord["kind"]) {
  switch (kind) {
    case "direct_message":
      return "直接协作";
    case "broadcast":
      return "团队广播";
    case "handoff":
      return "任务接力";
    case "review_request":
      return "请求复核";
    case "human_review":
      return "人审建议";
    case "request_input":
      return "请求补充";
    case "escalation":
      return "升级处理";
    case "self_claim":
      return "自领任务";
    default:
      return "建议下一棒";
  }
}

function formatMailboxThreadStatus(status: ProjectMailboxThreadRecord["status"]) {
  switch (status) {
    case "resolved":
      return "已收束";
    case "cancelled":
      return "已取消";
    default:
      return "处理中";
  }
}

function formatHeartbeatStatus(status: ProjectHeartbeatRecord["status"]) {
  switch (status) {
    case "healthy":
      return "健康";
    case "warning":
      return "关注中";
    case "stalled":
      return "已卡住";
    default:
      return "待命";
  }
}

function getHeartbeatTone(status: ProjectHeartbeatRecord["status"]) {
  switch (status) {
    case "healthy":
      return "border-[#d7e9d9] bg-[#eef8f0] text-[#25623e]";
    case "warning":
      return "border-[#f3dfbc] bg-[#fff6e8] text-[#9b6210]";
    case "stalled":
      return "border-[#efd8d6] bg-[#fff2f0] text-[#a54639]";
    default:
      return "border-line bg-surface-muted text-muted-strong";
  }
}

function formatStuckSignalKind(kind: ProjectStuckSignalRecord["kind"]) {
  switch (kind) {
    case "lease_expired":
      return "租约过期";
    case "reply_timeout":
      return "回传超时";
    default:
      return "缺少 runtime 会话";
  }
}

function formatStuckSignalStatus(status: ProjectStuckSignalRecord["status"]) {
  return status === "resolved" ? "已收束" : "处理中";
}

function getStuckSignalTone(status: ProjectStuckSignalRecord["status"]) {
  return status === "resolved"
    ? "border-[#d7e9d9] bg-[#eef8f0] text-[#25623e]"
    : "border-[#efd8d6] bg-[#fff2f0] text-[#a54639]";
}

function formatRecoveryActionKind(kind: ProjectRecoveryActionRecord["kind"]) {
  switch (kind) {
    case "retry_same_owner":
      return "原 owner 重试";
    case "reassign_to_peer":
      return "替补成员继续";
    case "rollback_to_checkpoint":
      return "从 checkpoint 重跑";
    default:
      return "PM 接管";
  }
}

function getRecoveryActionTone(kind: ProjectRecoveryActionRecord["kind"]) {
  switch (kind) {
    case "retry_same_owner":
      return "border-[#d7e4ff] bg-[#eef4ff] text-[#2959b8]";
    case "reassign_to_peer":
      return "border-[#d7e9d9] bg-[#eef8f0] text-[#25623e]";
    case "rollback_to_checkpoint":
      return "border-[#e7ddf7] bg-[#f6f0ff] text-[#6f42c1]";
    default:
      return "border-[#f3dfbc] bg-[#fff6e8] text-[#9b6210]";
  }
}

function formatTaskReflectionOutcome(outcome: ProjectTaskReflectionRecord["outcome"]) {
  switch (outcome) {
    case "needs_follow_up":
      return "待补充";
    case "recovered":
      return "恢复后完成";
    case "blocked":
      return "阻塞 / 取消";
    default:
      return "顺滑完成";
  }
}

function getTaskReflectionTone(outcome: ProjectTaskReflectionRecord["outcome"]) {
  switch (outcome) {
    case "needs_follow_up":
      return "border-[#f3dfbc] bg-[#fff6e8] text-[#9b6210]";
    case "recovered":
      return "border-[#d7e9d9] bg-[#eef8f0] text-[#25623e]";
    case "blocked":
      return "border-[#efd8d6] bg-[#fff2f0] text-[#a54639]";
    default:
      return "border-[#d7e4ff] bg-[#eef4ff] text-[#2959b8]";
  }
}

function formatLearningSuggestionKind(kind: ProjectLearningSuggestionRecord["kind"]) {
  switch (kind) {
    case "failure_pattern":
      return "失败模式";
    case "task_template":
      return "任务模板";
    case "role_tuning":
      return "角色调优";
    case "quality_gate":
      return "质量闸门";
    case "skill_upgrade":
      return "技能升级";
    default:
      return "Profile 更新";
  }
}

function getLearningSuggestionTone(kind: ProjectLearningSuggestionRecord["kind"]) {
  switch (kind) {
    case "failure_pattern":
      return "border-[#efd8d6] bg-[#fff2f0] text-[#a54639]";
    case "task_template":
      return "border-[#d7e4ff] bg-[#eef4ff] text-[#2959b8]";
    case "role_tuning":
      return "border-[#d7e9d9] bg-[#eef8f0] text-[#25623e]";
    case "quality_gate":
      return "border-[#f3dfbc] bg-[#fff6e8] text-[#9b6210]";
    case "skill_upgrade":
      return "border-[#e7ddf7] bg-[#f6f0ff] text-[#6f42c1]";
    default:
      return "border-[#d9e5ec] bg-[#eef7fb] text-[#245d77]";
  }
}

function formatLearningSuggestionStatus(suggestion: ProjectLearningSuggestionRecord) {
  if (suggestion.requiresHumanReview && suggestion.status === "open") {
    return "待人审";
  }

  switch (suggestion.status) {
    case "accepted":
      return "已采纳";
    case "dismissed":
      return "已忽略";
    default:
      return "开放中";
  }
}

function formatLearningEvidenceSourceKind(kind: ProjectLearningSuggestionRecord["evidenceSources"][number]["kind"]) {
  switch (kind) {
    case "task_reflection":
      return "任务复盘";
    case "stage_reflection":
      return "阶段复盘";
    case "run_summary":
      return "Run Summary";
    case "review":
      return "Review";
    case "recovery":
      return "恢复动作";
    case "project_memory":
      return "项目记忆";
    case "team_memory":
      return "团队记忆";
    default:
      return "角色记忆";
  }
}

function summarizeLearningReuseCandidateState(candidates: ProjectLearningReuseCandidateRecord[]) {
  const pendingCount = candidates.filter((candidate) => candidate.status === "pending_review").length;
  const confirmedCount = candidates.filter((candidate) => candidate.status === "confirmed").length;

  if (confirmedCount > 0 && pendingCount > 0) {
    return `已进入 ${confirmedCount} 条跨项目候选库记录，另外还有 ${pendingCount} 条待确认。`;
  }

  if (confirmedCount > 0) {
    return `已进入 ${confirmedCount} 条跨项目候选库记录。`;
  }

  if (pendingCount > 0) {
    return `已生成 ${pendingCount} 条待确认的跨项目复用候选。`;
  }

  return "当前还没有进入跨项目候选库。";
}

function formatLearningReuseCandidateKind(kind: ProjectLearningReuseCandidateRecord["kind"]) {
  switch (kind) {
    case "task_template_candidate":
      return "任务模板候选";
    case "quality_gate_candidate":
      return "质量闸门候选";
    default:
      return "交接 / 复核清单候选";
  }
}

function formatLearningReuseCandidateStatus(status: ProjectLearningReuseCandidateRecord["status"]) {
  switch (status) {
    case "confirmed":
      return "已确认";
    case "dismissed":
      return "已搁置";
    default:
      return "待确认";
  }
}

function getLearningReuseCandidateTone(
  kind: ProjectLearningReuseCandidateRecord["kind"],
  status: ProjectLearningReuseCandidateRecord["status"],
) {
  if (status === "confirmed") {
    return "border-[#d7e9d9] bg-[#eef8f0] text-[#25623e]";
  }

  if (status === "dismissed") {
    return "border-[#e2e2e2] bg-[#f5f5f5] text-[#666666]";
  }

  switch (kind) {
    case "task_template_candidate":
      return "border-[#d7e4ff] bg-[#eef4ff] text-[#2959b8]";
    case "quality_gate_candidate":
      return "border-[#f3dfbc] bg-[#fff6e8] text-[#9b6210]";
    default:
      return "border-[#e7ddf7] bg-[#f6f0ff] text-[#6f42c1]";
  }
}

function formatAutonomyGateKind(kind: ProjectAutonomyGateRecord["kind"]) {
  switch (kind) {
    case "autonomy_budget":
      return "自治预算";
    default:
      return "风险边界";
  }
}

function getAutonomyGateTone(
  kind: ProjectAutonomyGateRecord["kind"],
  status: ProjectAutonomyGateRecord["status"],
) {
  if (status === "resolved") {
    return "border-[#d7e9d9] bg-[#eef8f0] text-[#25623e]";
  }

  return kind === "autonomy_budget"
    ? "border-[#d7e4ff] bg-[#eef4ff] text-[#2959b8]"
    : "border-[#f3dfbc] bg-[#fff6e8] text-[#9b6210]";
}

function getMailboxThreadTone(
  kind: ProjectMailboxThreadRecord["kind"],
  status: ProjectMailboxThreadRecord["status"],
) {
  if (status === "resolved") {
    return "border-[#d7e9d9] bg-[#eef8f0] text-[#25623e]";
  }

  if (status === "cancelled") {
    return "border-line bg-surface-muted text-muted-strong";
  }

  switch (kind) {
    case "escalation":
      return "border-[#f3dfbc] bg-[#fff6e8] text-[#9b6210]";
    case "human_review":
      return "border-[#e7ddf7] bg-[#f6f0ff] text-[#6f42c1]";
    case "review_request":
    case "request_input":
      return "border-[#e7dcc7] bg-[#fff8ec] text-[#9a6513]";
    case "handoff":
    case "self_claim":
      return "border-[#d7e9d9] bg-[#eef8f0] text-[#25623e]";
    case "broadcast":
      return "border-[#dfe7f4] bg-[#f4f7fb] text-[#4c607d]";
    default:
      return "border-[#d7e4ff] bg-[#eef4ff] text-[#2959b8]";
  }
}

function getArtifactTone(status: ProjectArtifactRecord["status"]) {
  switch (status) {
    case "ready":
      return "border-[#d7e9d9] bg-[#eef8f0] text-[#25623e]";
    case "planned":
      return "border-[#dfe7f4] bg-[#f4f7fb] text-[#4c607d]";
    default:
      return "border-[#f3dfbc] bg-[#fff6e8] text-[#9b6210]";
  }
}

function getTaskTone(status: ProjectTaskRecord["status"]) {
  switch (status) {
    case "claimed":
      return "border-[#dfe7f4] bg-[#f4f7fb] text-[#4c607d]";
    case "in_progress":
      return "border-[#d7e4ff] bg-[#eef4ff] text-[#2959b8]";
    case "ready":
    case "reopened":
      return "border-[#e6e1d5] bg-[#f9f7f2] text-[#7a6751]";
    case "in_review":
      return "border-[#e7dcc7] bg-[#fff8ec] text-[#9a6513]";
    case "waiting_input":
    case "blocked":
      return "border-[#f3dfbc] bg-[#fff6e8] text-[#9b6210]";
    case "completed":
      return "border-[#d7e9d9] bg-[#eef8f0] text-[#25623e]";
    case "cancelled":
      return "border-line bg-surface-muted text-muted-strong";
    default:
      return "border-line bg-surface-muted text-muted-strong";
  }
}

function formatReviewStatus(status: ProjectReviewRecord["status"]) {
  switch (status) {
    case "approved":
      return "已通过";
    case "changes_requested":
      return "需修改";
    case "cancelled":
      return "已取消";
    default:
      return "待复核";
  }
}

function getReviewTone(status: ProjectReviewRecord["status"]) {
  switch (status) {
    case "approved":
      return "border-[#d7e9d9] bg-[#eef8f0] text-[#25623e]";
    case "changes_requested":
      return "border-[#f3dfbc] bg-[#fff6e8] text-[#9b6210]";
    case "cancelled":
      return "border-line bg-surface-muted text-muted-strong";
    default:
      return "border-[#e7dcc7] bg-[#fff8ec] text-[#9a6513]";
  }
}

function renderTaskLeaseStatus(task: ProjectTaskRecord) {
  const lines: string[] = [];

  if (task.leaseExpiresAt) {
    const expired = Date.parse(task.leaseExpiresAt) <= Date.now();
    lines.push(expired ? "租约：已过期" : `租约：有效至 ${formatActivityTimestamp(task.leaseExpiresAt)}`);
  }

  if (task.recoveryAttemptCount > 0) {
    lines.push(`恢复：已尝试 ${task.recoveryAttemptCount} 次`);
  }

  if (task.ownerReplacementCount > 0) {
    lines.push(`接管：已改派 ${task.ownerReplacementCount} 次`);
  }

  if (lines.length === 0) {
    return null;
  }

  return (
    <div className="mt-2 space-y-1">
      {lines.map((line) => (
        <p key={line} className="text-[12px] leading-6 text-muted-strong">
          {line}
        </p>
      ))}
    </div>
  );
}

function formatTaskLockScope(paths: string[]) {
  const compact = paths
    .slice(0, 2)
    .map((item) => item.replace(/^.*\/(?=(?:app|components|lib|src|pages|styles|docs|public|tests|skills|scripts)\b)/, ""));

  const suffix = paths.length > 2 ? ` 等 ${paths.length} 项` : "";
  return `${compact.join("、")}${suffix}`;
}

function buildDependencyRailTasks(
  tasks: ProjectTaskRecord[],
  tasksById: Map<string, ProjectTaskRecord>,
) {
  const nonTerminalTasks = tasks.filter((task) => task.status !== "completed" && task.status !== "cancelled");

  if (nonTerminalTasks.length === 0) {
    return [];
  }

  const activeTask =
    nonTerminalTasks.find((task) => task.status === "in_progress") ||
    nonTerminalTasks.find((task) => task.status === "claimed") ||
    nonTerminalTasks.find((task) => task.status === "ready") ||
    nonTerminalTasks[0] ||
    null;

  if (!activeTask) {
    return [];
  }

  const chain: ProjectTaskRecord[] = [];
  const seen = new Set<string>();
  let cursor: ProjectTaskRecord | null = activeTask;

  while (cursor && !seen.has(cursor.id)) {
    seen.add(cursor.id);
    chain.unshift(cursor);
    cursor = cursor.blockedByTaskId ? tasksById.get(cursor.blockedByTaskId) ?? null : null;
  }

  let downstream =
    tasks.find((task) => task.blockedByTaskId === activeTask.id && task.status !== "cancelled") ?? null;

  while (downstream && !seen.has(downstream.id)) {
    seen.add(downstream.id);
    chain.push(downstream);
    downstream =
      tasks.find((task) => task.blockedByTaskId === downstream?.id && task.status !== "cancelled") ?? null;
  }

  return chain;
}

function compactTaskRailLabel(value: string) {
  const normalized = value.replace(/\s+/g, " ").trim();
  return normalized.length > 18 ? `${normalized.slice(0, 18)}...` : normalized;
}

function buildTaskDependencyEdges(
  tasks: ProjectTaskRecord[],
  tasksById: Map<string, ProjectTaskRecord>,
) {
  return tasks.flatMap((task) =>
    task.dependsOnTaskIds.map((dependencyTaskId) => {
      const dependencyTask = tasksById.get(dependencyTaskId) ?? null;
      return {
        id: `${dependencyTaskId}-${task.id}`,
        from: dependencyTask ? compactTaskRailLabel(dependencyTask.title) : "未知上游",
        to: compactTaskRailLabel(task.title),
        reason: task.blockedReason,
      };
    }),
  );
}

function formatArtifactReferenceSummary(
  artifactIds: string[],
  artifactsById: Map<string, ProjectArtifactRecord>,
) {
  const labels = artifactIds
    .map((artifactId) => artifactsById.get(artifactId)?.title ?? null)
    .filter(Boolean)
    .slice(0, 3) as string[];

  if (labels.length === 0) {
    return null;
  }

  return labels.map((label) => compactArtifactLabel(label)).join("、");
}

function formatTaskReferenceSummary(
  taskIds: string[],
  tasksById: Map<string, ProjectTaskRecord>,
) {
  const labels = taskIds
    .map((taskId) => tasksById.get(taskId)?.title ?? null)
    .filter(Boolean)
    .slice(0, 3) as string[];

  if (labels.length === 0) {
    return null;
  }

  return labels.map((label) => compactTaskRailLabel(label)).join("、");
}

function MetaPill({ children }: { children: ReactNode }) {
  return <UnifiedMetaPill>{children}</UnifiedMetaPill>;
}

function StatusPill({
  status,
  children,
}: {
  status: ProjectRunStatus;
  children: ReactNode;
}) {
  return <UnifiedStatusPill tone={getProjectStatusTone(status)}>{children}</UnifiedStatusPill>;
}

function getProjectStatusTone(status: ProjectRunStatus) {
  switch (status) {
    case "running":
      return "info";
    case "paused":
      return "neutral";
    case "waiting_approval":
      return "warning";
    case "waiting_user":
      return "accent";
    case "completed":
      return "success";
    default:
      return "neutral";
  }
}

function getRuntimeCardTone(tone: "default" | "info" | "warning" | "success") {
  switch (tone) {
    case "info":
      return "border-[#d7e4ff] bg-[#f4f8ff]";
    case "warning":
      return "border-[#f3dfbc] bg-[#fff8ec]";
    case "success":
      return "border-[#d7e9d9] bg-[#f3fbf4]";
    default:
      return "border-line bg-background";
  }
}

function getDecisionPanelTone(tone: "default" | "info" | "warning" | "success") {
  switch (tone) {
    case "info":
      return "border-[#d7e4ff] bg-[linear-gradient(135deg,#eff5ff_0%,#ffffff_100%)]";
    case "warning":
      return "border-[#f3dfbc] bg-[linear-gradient(135deg,#fff8eb_0%,#ffffff_100%)]";
    case "success":
      return "border-[#d7e9d9] bg-[linear-gradient(135deg,#f2fbf3_0%,#ffffff_100%)]";
    default:
      return "border-line bg-background";
  }
}

function getTrajectoryTone(tone: "default" | "info" | "warning" | "success") {
  switch (tone) {
    case "info":
      return "border-[#d7e4ff] bg-[linear-gradient(135deg,#eff5ff_0%,#ffffff_100%)]";
    case "warning":
      return "border-[#f3dfbc] bg-[linear-gradient(135deg,#fff7ea_0%,#ffffff_100%)]";
    case "success":
      return "border-[#d7e9d9] bg-[linear-gradient(135deg,#f0fbf2_0%,#ffffff_100%)]";
    default:
      return "border-line bg-surface-muted";
  }
}

function getActivityTone(tone: "default" | "info" | "warning" | "success") {
  switch (tone) {
    case "info":
      return "border-[#d7e4ff] bg-[#eef4ff] text-[#2959b8]";
    case "warning":
      return "border-[#f3dfbc] bg-[#fff6e8] text-[#9b6210]";
    case "success":
      return "border-[#d7e9d9] bg-[#eef8f0] text-[#25623e]";
    default:
      return "border-line bg-surface-muted text-muted-strong";
  }
}

function getActivityPanelTone(tone: "default" | "info" | "warning" | "success") {
  switch (tone) {
    case "info":
      return "border-[#d7e4ff] bg-[linear-gradient(135deg,#eff5ff_0%,#ffffff_100%)]";
    case "warning":
      return "border-[#f3dfbc] bg-[linear-gradient(135deg,#fff7ea_0%,#ffffff_100%)]";
    case "success":
      return "border-[#d7e9d9] bg-[linear-gradient(135deg,#f0fbf2_0%,#ffffff_100%)]";
    default:
      return "border-line bg-surface-muted";
  }
}
