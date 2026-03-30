"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useOpenCrabApp } from "@/components/app-shell/opencrab-provider";
import { isSelectableTeamAgent } from "@/lib/agents/display";
import { Button, buttonClassName } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import { MetaPill as UnifiedMetaPill, StatusPill as UnifiedStatusPill } from "@/components/ui/pill";
import {
  createProject as createProjectResource,
  pickLocalDirectory,
} from "@/lib/resources/opencrab-api";
import type { ProjectRoomRecord } from "@/lib/projects/types";

type ProjectsOverviewScreenProps = {
  projects: ProjectRoomRecord[];
};

export function ProjectsOverviewScreen({ projects }: ProjectsOverviewScreenProps) {
  const router = useRouter();
  const {
    agents,
    selectedModel,
    selectedReasoningEffort,
  } = useOpenCrabApp();
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [goal, setGoal] = useState("");
  const [workspaceDir, setWorkspaceDir] = useState("");
  const [selectedAgentIds, setSelectedAgentIds] = useState<string[]>([]);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isPickingWorkspace, setIsPickingWorkspace] = useState(false);

  const teamAgents = useMemo(
    () => agents.filter(isSelectableTeamAgent),
    [agents],
  );
  const validTeamAgentIds = useMemo(() => new Set(teamAgents.map((agent) => agent.id)), [teamAgents]);

  useEffect(() => {
    setSelectedAgentIds((current) => current.filter((agentId) => validTeamAgentIds.has(agentId)));
  }, [validTeamAgentIds]);

  function handleToggleAgent(agentId: string) {
    if (!validTeamAgentIds.has(agentId)) {
      return;
    }

    setSelectedAgentIds((current) =>
      current.includes(agentId) ? current.filter((item) => item !== agentId) : [...current, agentId],
    );
  }

  async function handleCreateProject() {
    const trimmedGoal = goal.trim();
    const normalizedSelectedAgentIds = Array.from(
      new Set(selectedAgentIds.filter((agentId) => validTeamAgentIds.has(agentId))),
    );

    if (!trimmedGoal) {
      setErrorMessage("请先填写这个团队的目标。");
      return;
    }

    if (normalizedSelectedAgentIds.length === 0) {
      setErrorMessage("请至少选择一个要加入团队的智能体。");
      return;
    }

    if (!workspaceDir.trim()) {
      setErrorMessage("请先指定这个团队的工作空间目录。");
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);
    setSelectedAgentIds(normalizedSelectedAgentIds);

    try {
      const response = await createProjectResource({
        goal: trimmedGoal,
        workspaceDir: workspaceDir.trim(),
        agentProfileIds: normalizedSelectedAgentIds,
        model: selectedModel,
        reasoningEffort: selectedReasoningEffort,
      });
      const nextProjectId = response.project?.id;

      if (!nextProjectId) {
        throw new Error("创建团队失败。");
      }

      setIsCreateOpen(false);
      setGoal("");
      setWorkspaceDir("");
      setSelectedAgentIds([]);
      router.push(`/projects/${nextProjectId}`);
      router.refresh();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "创建团队失败。");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handlePickWorkspace() {
    setIsPickingWorkspace(true);
    setErrorMessage(null);

    try {
      const result = await pickLocalDirectory({
        title: "为 Team 选择工作区目录",
        defaultPath: workspaceDir || undefined,
      });

      if (result.path) {
        setWorkspaceDir(result.path);
      }
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "打开目录选择器失败。");
    } finally {
      setIsPickingWorkspace(false);
    }
  }

  return (
    <>
      <div className="space-y-8">
        <PageHeader
          title="团队模式"
          description="不是简单的多 Agent 群聊，而是一个训练有素的数字人团队。"
          className="mb-6"
          actions={
            <Button type="button" variant="primary" onClick={() => setIsCreateOpen(true)}>
              新建团队
            </Button>
          }
        />

        <section className="rounded-[28px] border border-line bg-surface p-6 shadow-soft">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h2 className="text-[24px] font-semibold tracking-[-0.04em] text-text">当前已有团队</h2>
              <p className="mt-2 text-[14px] leading-7 text-muted-strong">
                这里保留已经创建的 Team Room。你可以直接进入继续推进，或者回看已有结果。
              </p>
            </div>
            <UnifiedMetaPill>{projects.length} 个团队</UnifiedMetaPill>
          </div>

          {projects.length === 0 ? (
            <div className="mt-6 rounded-[22px] border border-dashed border-line bg-surface-muted px-5 py-8">
              <h3 className="text-[18px] font-semibold tracking-[-0.03em] text-text">还没有团队</h3>
              <p className="mt-2 text-[14px] leading-7 text-muted-strong">
                点击右上角“新建团队”，填写目标并选择要加入的智能体，就可以直接创建一个 Team Room。
              </p>
            </div>
          ) : (
            <div className="mt-6 grid gap-4 xl:grid-cols-2">
              {projects.map((project) => (
                <article
                  key={project.id}
                  className="flex flex-col rounded-[24px] border border-line bg-background p-5"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <StatusPill status={project.runStatus}>{formatProjectStatus(project.runStatus)}</StatusPill>
                        <MetaPill>{project.memberCount} 位成员</MetaPill>
                        {project.currentStageLabel ? <MetaPill>{project.currentStageLabel}</MetaPill> : null}
                      </div>
                      <h3 className="mt-4 text-[22px] font-semibold tracking-[-0.04em] text-text">
                        {project.title}
                      </h3>
                    </div>
                    <div className="shrink-0 text-right">
                      <div className="text-[11px] uppercase tracking-[0.18em] text-muted">最近活动</div>
                      <div className="mt-2 text-[13px] text-text">{project.lastActivityLabel}</div>
                    </div>
                  </div>

                  <div className="mt-4 rounded-[18px] border border-line bg-surface-muted/70 px-4 py-4">
                    <div className="text-[11px] uppercase tracking-[0.14em] text-muted">团队目标</div>
                    <p className="mt-2 line-clamp-4 text-[14px] leading-7 text-muted-strong">
                      {buildProjectGoalPreview(project.goal)}
                    </p>
                  </div>

                  <div className="mt-4 rounded-[18px] border border-line bg-surface px-4 py-3.5">
                    <div className="flex flex-wrap items-center gap-2">
                      <div className="text-[11px] uppercase tracking-[0.14em] text-muted">运行联动</div>
                      <SignalPill tone="neutral">未完成任务 {project.openTaskCount ?? 0}</SignalPill>
                      {project.pendingReviewCount ? (
                        <SignalPill tone="info">待复核 {project.pendingReviewCount}</SignalPill>
                      ) : null}
                      {project.openGateCount ? (
                        <SignalPill tone="warning">自治 Gate {project.openGateCount}</SignalPill>
                      ) : null}
                      {project.openStuckSignalCount ? (
                        <SignalPill tone="warning">卡住信号 {project.openStuckSignalCount}</SignalPill>
                      ) : null}
                    </div>
                    <div className="mt-3 grid gap-2 text-[13px] leading-6 text-muted-strong sm:grid-cols-2">
                      <p>
                        当前任务 ·{" "}
                        {project.activeTaskTitle
                          ? `${project.activeTaskTitle}${project.activeTaskStatus ? ` · ${formatProjectTaskStatus(project.activeTaskStatus)}` : ""}`
                          : "当前没有未完成任务"}
                      </p>
                      <p>
                        当前 run · {project.latestRunStepLabel || "最近还没有新的运行记录"}
                      </p>
                      <p>
                        自治预算 · {project.autonomyRoundCount ?? 0}/{project.autonomyRoundBudget ?? 20}
                      </p>
                      <p>
                        最近恢复 ·{" "}
                        {project.latestRecoverySummary
                          ? `${formatRecoveryKind(project.latestRecoveryKind)} · ${project.latestRecoverySummary}`
                          : "最近没有新的恢复动作"}
                      </p>
                    </div>
                    {project.latestGateSummary ? (
                      <p className="mt-2 text-[12px] leading-6 text-muted-strong">
                        最近 gate · {project.latestGateSummary}
                      </p>
                    ) : null}
                  </div>

                  <div className="mt-4 flex flex-wrap gap-2">
                    {project.workspaceDir ? <MetaPill>产出目录 · {formatWorkspaceLabel(project.workspaceDir)}</MetaPill> : null}
                    <MetaPill>{project.artifactCount} 个结果</MetaPill>
                    <MetaPill>{formatUpdatedAt(project.updatedAt)}</MetaPill>
                  </div>

                  <div className="pt-4">
                    <Link href={`/projects/${project.id}`} className={buttonClassName({ variant: "primary" })}>
                      打开团队
                    </Link>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>
      </div>

      {isCreateOpen ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-[rgba(17,17,17,0.16)] p-4 backdrop-blur-[2px]"
          onClick={() => (isSubmitting ? null : setIsCreateOpen(false))}
          role="presentation"
        >
          <div
            className="w-full max-w-[860px] rounded-[28px] border border-line bg-surface p-6 shadow-[0_24px_80px_rgba(15,23,42,0.16)]"
            onClick={(event) => event.stopPropagation()}
            role="dialog"
            aria-modal="true"
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="text-[12px] uppercase tracking-[0.16em] text-muted">New Team</div>
                <h2 className="mt-2 text-[28px] font-semibold tracking-[-0.05em] text-text">新建团队</h2>
                <p className="mt-2 max-w-[60ch] text-[14px] leading-7 text-muted-strong">
                  只需要定义两件事：这个团队要完成什么目标，以及哪些智能体要加入这次协作。项目经理会默认自动加入，负责统筹 Team 的推进。
                </p>
              </div>

              <button
                type="button"
                onClick={() => setIsCreateOpen(false)}
                className={buttonClassName({ variant: "ghost", className: "h-10 w-10 rounded-full px-0" })}
                disabled={isSubmitting}
                aria-label="关闭"
              >
                ×
              </button>
            </div>

            <div className="mt-6 grid gap-6 lg:grid-cols-[0.95fr_1.05fr]">
              <section className="rounded-[24px] border border-line bg-background p-5">
                <label className="block">
                  <span className="text-[13px] font-medium text-text">目标是什么？</span>
                  <textarea
                    value={goal}
                    onChange={(event) => setGoal(event.target.value)}
                    rows={8}
                    placeholder="例如：为 Team 模式设计一版智能体驱动的协作体验，并明确 MVP 的页面、数据结构和运行方式。"
                    className="mt-3 w-full rounded-[18px] border border-line bg-surface px-4 py-3 text-[14px] leading-7 text-text outline-none transition focus:border-text"
                  />
                </label>

                <label className="mt-5 block">
                  <span className="text-[13px] font-medium text-text">工作空间目录</span>
                  <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                    <input
                      value={workspaceDir}
                      onChange={(event) => setWorkspaceDir(event.target.value)}
                      placeholder="~/OpenCrab/workspaces/team-alpha"
                      className="min-w-0 flex-1 rounded-[18px] border border-line bg-surface px-4 py-3 text-[14px] text-text outline-none transition focus:border-text"
                    />
                    <button
                      type="button"
                      onClick={() => void handlePickWorkspace()}
                      disabled={isSubmitting || isPickingWorkspace}
                      className={buttonClassName({
                        variant: "secondary",
                        className: "rounded-[18px] bg-surface-muted hover:bg-[#efeff1]",
                      })}
                    >
                      {isPickingWorkspace ? "打开中..." : "选择目录"}
                    </button>
                  </div>
                  <p className="mt-2 text-[12px] leading-6 text-muted-strong">
                    这里是 Team 的默认写入目录。即使目标里提到了别的代码路径，也默认只把它们当参考输入；新 Team 会先使用“可写工作区”，后续你也可以在 Team 群聊输入框右侧继续修改权限模式。
                  </p>
                </label>
              </section>

              <section className="rounded-[24px] border border-line bg-background p-5">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
                  <div>
                    <h3 className="text-[18px] font-semibold tracking-[-0.03em] text-text">需要加入的智能体</h3>
                    <p className="mt-2 text-[14px] leading-7 text-muted-strong">
                      只展示可用于 Team 的智能体。系统项目经理会默认加入并承担团队牵引，下面这些是你额外希望拉进来的成员。
                    </p>
                  </div>
                  <UnifiedMetaPill>已选 {selectedAgentIds.length} 个</UnifiedMetaPill>
                </div>

                {teamAgents.length === 0 ? (
                  <div className="mt-5 rounded-[18px] border border-dashed border-line bg-surface-muted px-4 py-5 text-[13px] leading-6 text-muted-strong">
                    当前还没有可加入团队的智能体。先去智能体页创建，或把已有智能体的可用范围设为“团队”或“单聊 + 团队”。
                  </div>
                ) : (
                  <div className="mt-5 max-h-[420px] space-y-3 overflow-y-auto pr-1">
                    {teamAgents.map((agent) => {
                      const checked = selectedAgentIds.includes(agent.id);

                      return (
                        <label
                          key={agent.id}
                          className={`flex cursor-pointer gap-3 rounded-[20px] border p-4 transition ${
                            checked
                              ? "border-[#c9d8ff] bg-[#f6f9ff]"
                              : "border-line bg-surface hover:border-text/12"
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => handleToggleAgent(agent.id)}
                            className="mt-1 h-4 w-4 rounded border-line"
                          />
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                              <div className="text-[16px] font-semibold text-text">{agent.name}</div>
                              <MetaPill>{agent.roleLabel}</MetaPill>
                              <MetaPill>{formatTeamRole(agent.teamRole)}</MetaPill>
                            </div>
                            <p className="mt-2 text-[13px] leading-6 text-muted-strong">{agent.summary}</p>
                          </div>
                        </label>
                      );
                    })}
                  </div>
                )}
              </section>
            </div>

            {errorMessage ? (
              <div className="mt-5 rounded-[18px] border border-[#f3d0cb] bg-[#fff3f1] px-4 py-3 text-[13px] text-[#b42318]">
                {errorMessage}
              </div>
            ) : null}

            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setIsCreateOpen(false)}
                className={buttonClassName({ variant: "secondary" })}
                disabled={isSubmitting}
              >
                取消
              </button>
              <button
                type="button"
                onClick={() => void handleCreateProject()}
                className={buttonClassName({ variant: "primary" })}
                disabled={isSubmitting || teamAgents.length === 0}
              >
                {isSubmitting ? "创建中..." : "创建团队"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}

function MetaPill({ children }: { children: React.ReactNode }) {
  return <UnifiedMetaPill>{children}</UnifiedMetaPill>;
}

function StatusPill({
  status,
  children,
}: {
  status: ProjectRoomRecord["runStatus"];
  children: React.ReactNode;
}) {
  return <UnifiedStatusPill tone={getStatusTone(status)}>{children}</UnifiedStatusPill>;
}

function SignalPill({
  tone,
  children,
}: {
  tone: "neutral" | "info" | "warning";
  children: React.ReactNode;
}) {
  return (
    <span
      className={`rounded-full border px-2.5 py-1 text-[11px] font-medium ${
        tone === "warning"
          ? "border-[#efd8d6] bg-[#fff2f0] text-[#a54639]"
          : tone === "info"
            ? "border-[#d7e4ff] bg-[#eef4ff] text-[#2d56a3]"
            : "border-line bg-surface-muted text-muted-strong"
      }`}
    >
      {children}
    </span>
  );
}

function formatProjectStatus(status: ProjectRoomRecord["runStatus"]) {
  switch (status) {
    case "running":
      return "运行中";
    case "waiting_approval":
      return "待确认";
    case "waiting_user":
      return "待补充";
    case "completed":
      return "已完成";
    default:
      return "准备中";
  }
}

function formatTeamRole(value: "lead" | "research" | "writer" | "specialist") {
  switch (value) {
    case "lead":
      return "Lead";
    case "research":
      return "Research";
    case "writer":
      return "Writer";
    default:
      return "Specialist";
  }
}

function getStatusTone(status: ProjectRoomRecord["runStatus"]) {
  switch (status) {
    case "running":
      return "info";
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

function formatProjectTaskStatus(status: NonNullable<ProjectRoomRecord["activeTaskStatus"]>) {
  switch (status) {
    case "in_progress":
      return "执行中";
    case "claimed":
      return "已认领";
    case "ready":
      return "待开工";
    case "reopened":
      return "返工中";
    case "in_review":
      return "待复核";
    case "waiting_input":
      return "等输入";
    case "blocked":
      return "被阻塞";
    default:
      return "处理中";
  }
}

function formatRecoveryKind(kind: ProjectRoomRecord["latestRecoveryKind"]) {
  switch (kind) {
    case "retry_same_owner":
      return "原 owner 重试";
    case "reassign_to_peer":
      return "替补接力";
    case "rollback_to_checkpoint":
      return "checkpoint 重跑";
    case "take_over_by_manager":
      return "PM 接管";
    default:
      return "无恢复动作";
  }
}

function buildProjectGoalPreview(goal: string) {
  const normalized = goal.replace(/\s+/g, " ").trim();
  return normalized.length > 260 ? `${normalized.slice(0, 257)}...` : normalized;
}

function formatWorkspaceLabel(workspaceDir: string) {
  const segments = workspaceDir.split("/").filter(Boolean);
  return segments.at(-1) || workspaceDir;
}

function formatUpdatedAt(updatedAt: string) {
  const parsed = new Date(updatedAt);

  if (Number.isNaN(parsed.getTime())) {
    return "最近更新";
  }

  return new Intl.DateTimeFormat("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(parsed);
}
