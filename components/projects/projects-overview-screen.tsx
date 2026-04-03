"use client";

import Link from "next/link";
import { useState } from "react";
import { ProjectCreateDialog } from "@/components/projects/project-create-dialog";
import { Button, buttonClassName } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import { MetaPill as UnifiedMetaPill, StatusPill as UnifiedStatusPill } from "@/components/ui/pill";
import type { ProjectRoomRecord } from "@/lib/projects/types";

type ProjectsOverviewScreenProps = {
  projects: ProjectRoomRecord[];
};

export function ProjectsOverviewScreen({ projects }: ProjectsOverviewScreenProps) {
  const [isCreateOpen, setIsCreateOpen] = useState(false);

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
                点击右上角“新建团队”，先让规划 Agent 收束任务，再启动一个更像真实协作班子的 Team Room。
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

      <ProjectCreateDialog isOpen={isCreateOpen} onClose={() => setIsCreateOpen(false)} />
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
