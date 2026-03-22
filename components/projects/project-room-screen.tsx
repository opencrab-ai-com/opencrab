"use client";

import type { ReactNode } from "react";
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
  runProject,
  updateProjectCheckpoint,
} from "@/lib/resources/opencrab-api";
import type {
  ProjectAgentStatus,
  ProjectAgentRecord,
  ProjectDetail,
  ProjectRunStatus,
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
  const [selectedAgentId, setSelectedAgentId] = useState<string | null>(null);
  const [selectedActivityMessageId, setSelectedActivityMessageId] = useState<string | null>(null);
  const checkpointSectionRef = useRef<HTMLElement | null>(null);

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

  async function handleCheckpointAction(action: "approve" | "request_changes" | "resume") {
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
      setActionMessage(getCheckpointFeedbackMessage(action, next.project?.runStatus ?? "ready"));

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

  function scrollToCheckpoint() {
    checkpointSectionRef.current?.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });
  }

  const showTopRunButton = currentProject.runStatus !== "waiting_approval";
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
                    {project.runStatus === "waiting_approval" ? "待你确认" : "待你补充"}
                  </span>
                  <span className="text-[12px] text-muted-strong">
                    {project.runStatus === "waiting_approval"
                      ? "团队已经交付了阶段结果"
                      : "团队已经停在你的补充检查点"}
                  </span>
                </div>
                <h2 className="mt-3 text-[20px] font-semibold tracking-[-0.03em] text-text">
                  {project.runStatus === "waiting_approval"
                    ? "这轮已经可以确认完成，或者继续提修改意见"
                    : "先补充方向，再继续推进下一轮"}
                </h2>
                <p className="mt-2 max-w-[74ch] text-[14px] leading-7 text-muted-strong">
                  {project.runStatus === "waiting_approval"
                    ? "我已经把团队的阶段总结收口好了。你现在可以直接去确认，也可以带着补充意见继续推进。"
                    : "当前团队不会继续盲跑。你补充这轮新方向后，再从检查点继续。"}
                </p>
              </div>
              <div className="flex shrink-0 flex-wrap gap-2">
                <button
                  type="button"
                  onClick={scrollToCheckpoint}
                  className={buttonClassName({ variant: "primary" })}
                >
                  {project.runStatus === "waiting_approval" ? "去确认这轮输出" : "去补充后继续"}
                </button>
                {project.runStatus === "waiting_approval" ? (
                  <button
                    type="button"
                    onClick={() => void handleCheckpointAction("approve")}
                    className={buttonClassName({ variant: "secondary" })}
                    disabled={isCheckpointSubmitting || isRefreshing || isRunning || isPausing}
                  >
                    {isCheckpointSubmitting ? "提交中..." : "直接确认完成"}
                  </button>
                ) : null}
              </div>
            </div>
          </section>
        ) : null}

        <div className="space-y-6">
          <div className="space-y-6">
            <section className="rounded-[28px] border border-line bg-surface p-6 shadow-soft">
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
                      {project.runStatus === "waiting_approval" ? "确认这轮输出" : "补充后继续推进"}
                    </h2>
                    <p className="mt-2 max-w-[68ch] text-[14px] leading-7 text-muted-strong">
                      {project.runStatus === "waiting_approval"
                        ? "团队已经交回阶段结果。你可以直接确认完成，或者告诉项目经理还需要补充什么。"
                        : "团队已经停在你的补充检查点。更新一下方向后，再让它继续推进下一轮。"}
                    </p>
                  </div>
                  <span className="rounded-full border border-line bg-surface-muted px-3 py-1.5 text-[12px] text-muted-strong">
                    {project.runStatus === "waiting_approval" ? "需要你决定下一步" : "等待你的补充"}
                  </span>
                </div>

                <div className="mt-5 rounded-[22px] border border-line bg-[linear-gradient(135deg,#fffaf5_0%,#ffffff_55%,#f6f8fe_100%)] p-5">
                  <div className="text-[11px] uppercase tracking-[0.14em] text-muted">当前聚焦点</div>
                  <p className="mt-2 whitespace-pre-wrap text-[14px] leading-7 text-text">
                    {project.latestUserRequest || project.goal}
                  </p>

                  <label className="mt-5 block">
                    <span className="text-[12px] font-medium text-muted-strong">
                      {project.runStatus === "waiting_approval" ? "如果需要补充，请告诉团队" : "更新这次补充方向"}
                    </span>
                    <textarea
                      value={checkpointNote}
                      onChange={(event) => setCheckpointNote(event.target.value)}
                      rows={4}
                      placeholder={
                        project.runStatus === "waiting_approval"
                          ? "例如：请补上风险判断，并把最终输出改成更适合产品评审会的结构。"
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
                          {isCheckpointSubmitting ? "提交中..." : "确认并完成"}
                        </button>
                        <button
                          type="button"
                          onClick={() => void handleCheckpointAction("request_changes")}
                          className={buttonClassName({ variant: "secondary" })}
                          disabled={isCheckpointSubmitting || isRefreshing || isRunning}
                        >
                          要求补充或改方向
                        </button>
                      </>
                    ) : (
                      <button
                        type="button"
                        onClick={() => void handleCheckpointAction("resume")}
                        className={buttonClassName({ variant: "primary" })}
                        disabled={isCheckpointSubmitting || isRefreshing || isRunning}
                      >
                        {isCheckpointSubmitting ? "提交中..." : "带着补充继续推进"}
                      </button>
                    )}
                  </div>
                </div>
              </section>
            ) : null}

          </div>

          <section className="rounded-[28px] border border-line bg-surface p-6 shadow-soft">
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
              <span className="rounded-full border border-line bg-surface-muted px-3 py-1.5 text-[12px] text-muted-strong">
                最近 {runtimeMessages.length} 条
              </span>
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
  action: "approve" | "request_changes" | "resume",
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

  return nextStatus === "running"
    ? "团队已带着新的补充方向重新开始协作。"
    : "团队状态已更新。";
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
    currentProject.nextAgentId !== nextProject.nextAgentId
  ) {
    return true;
  }

  if (
    current.agents.length !== next.agents.length ||
    current.artifacts.length !== next.artifacts.length ||
    current.runs.length !== next.runs.length
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
