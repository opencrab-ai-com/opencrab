"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useOpenCrabApp } from "@/components/app-shell/opencrab-provider";
import { Button, buttonClassName } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import { MetaPill as UnifiedMetaPill, StatusPill as UnifiedStatusPill } from "@/components/ui/pill";
import { createProject as createProjectResource } from "@/lib/resources/opencrab-api";
import type { ProjectRoomRecord } from "@/lib/projects/types";

type ProjectsOverviewScreenProps = {
  projects: ProjectRoomRecord[];
};

export function ProjectsOverviewScreen({ projects }: ProjectsOverviewScreenProps) {
  const router = useRouter();
  const { agents } = useOpenCrabApp();
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [goal, setGoal] = useState("");
  const [workspaceDir, setWorkspaceDir] = useState("");
  const [selectedAgentIds, setSelectedAgentIds] = useState<string[]>([]);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const teamAgents = useMemo(
    () => agents.filter((agent) => agent.availability === "team" || agent.availability === "both"),
    [agents],
  );

  function handleToggleAgent(agentId: string) {
    setSelectedAgentIds((current) =>
      current.includes(agentId) ? current.filter((item) => item !== agentId) : [...current, agentId],
    );
  }

  async function handleCreateProject() {
    const trimmedGoal = goal.trim();

    if (!trimmedGoal) {
      setErrorMessage("请先填写这个团队的目标。");
      return;
    }

    if (selectedAgentIds.length === 0) {
      setErrorMessage("请至少选择一个要加入团队的智能体。");
      return;
    }

    if (!workspaceDir.trim()) {
      setErrorMessage("请先指定这个团队的工作空间目录。");
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      const response = await createProjectResource({
        goal: trimmedGoal,
        workspaceDir: workspaceDir.trim(),
        agentProfileIds: selectedAgentIds,
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
                  className="flex min-h-[360px] flex-col rounded-[24px] border border-line bg-background p-5"
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
                    <div className="text-[11px] uppercase tracking-[0.14em] text-muted">阶段摘要</div>
                    <p className="mt-2 line-clamp-6 min-h-[9.5rem] text-[14px] leading-7 text-muted-strong">
                      {buildProjectSummaryPreview(project.summary)}
                    </p>
                  </div>

                  <div className="mt-5 flex flex-wrap gap-2">
                    {project.workspaceDir ? <MetaPill>产出目录 · {formatWorkspaceLabel(project.workspaceDir)}</MetaPill> : null}
                    <MetaPill>{project.artifactCount} 个结果</MetaPill>
                    <MetaPill>{formatUpdatedAt(project.updatedAt)}</MetaPill>
                  </div>

                  <div className="mt-auto pt-5">
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
                  <input
                    value={workspaceDir}
                    onChange={(event) => setWorkspaceDir(event.target.value)}
                    placeholder="/Users/sky/SkyProjects/opencrab/workspaces/team-alpha"
                    className="mt-3 w-full rounded-[18px] border border-line bg-surface px-4 py-3 text-[14px] text-text outline-none transition focus:border-text"
                  />
                  <p className="mt-2 text-[12px] leading-6 text-muted-strong">
                    这个团队的默认产出目录会创建在这里。后续实际读写权限仍然遵循系统当前的 sandbox 设置。
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

function buildProjectSummaryPreview(summary: string) {
  const normalized = summary.replace(/\s+/g, " ").trim();
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
