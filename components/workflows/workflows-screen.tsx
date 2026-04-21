"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button, buttonClassName } from "@/components/ui/button";
import { MetaPill, StatusPill } from "@/components/ui/pill";
import { WorkflowCreateDialog } from "@/components/workflows/workflow-create-dialog";
import {
  getWorkflows,
  publishWorkflow,
} from "@/lib/resources/opencrab-api";
import type {
  WorkflowOverviewCard,
  WorkflowReviewCounters,
} from "@/lib/resources/opencrab-api-types";

const EMPTY_REVIEW_COUNTERS: WorkflowReviewCounters = {
  total: 0,
  pendingReview: 0,
  upToDate: 0,
  neverPublished: 0,
};

export function WorkflowsScreen() {
  const router = useRouter();
  const [workflows, setWorkflows] = useState<WorkflowOverviewCard[]>([]);
  const [reviewCounters, setReviewCounters] = useState<WorkflowReviewCounters>(
    EMPTY_REVIEW_COUNTERS,
  );
  const [isLoading, setIsLoading] = useState(true);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [pendingPublishId, setPendingPublishId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [messageTone, setMessageTone] = useState<"default" | "success" | "error">("default");

  const loadWorkflows = useCallback(async () => {
    setIsLoading(true);

    try {
      const response = await getWorkflows();
      setWorkflows(response.workflows);
      setReviewCounters(response.reviewCounters);
    } catch (error) {
      setMessageTone("error");
      setMessage(error instanceof Error ? error.message : "加载工作流失败。");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadWorkflows();
  }, [loadWorkflows]);

  async function handleWorkflowCreated(workflowId: string) {
    setMessageTone("success");
    setMessage("工作流草稿已创建。");
    await loadWorkflows();
    router.push(`/workflows/${workflowId}`);
    router.refresh();
  }

  async function handlePublishWorkflow(workflowId: string) {
    setPendingPublishId(workflowId);
    setMessage(null);

    try {
      const response = await publishWorkflow(workflowId);

      if (!response.workflow) {
        throw new Error("工作流不存在。");
      }

      setMessageTone("success");
      setMessage(`已发布 ${response.workflow.workflow.name} 的当前版本。`);
      await loadWorkflows();
    } catch (error) {
      setMessageTone("error");
      setMessage(error instanceof Error ? error.message : "发布工作流失败。");
    } finally {
      setPendingPublishId(null);
    }
  }

  if (isLoading) {
    return (
      <div className="rounded-[24px] border border-line bg-surface p-6 text-[14px] text-muted-strong shadow-soft">
        正在加载工作流...
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <section className="rounded-[24px] border border-line bg-surface p-5 shadow-soft">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <h2 className="text-[18px] font-semibold tracking-[-0.03em] text-text">
              工作流总览
            </h2>
            <p className="mt-1 text-[13px] leading-6 text-muted-strong">
              先搭一个可运行的壳，再逐步补齐节点编辑和运行细节。
            </p>
          </div>
          <div className="grid gap-2 rounded-[18px] border border-line bg-background px-4 py-3 text-[12px] text-muted-strong sm:grid-cols-2">
            <StatItem label="工作流总数" value={reviewCounters.total} />
            <StatItem label="待复核" value={reviewCounters.pendingReview} />
            <StatItem label="已同步" value={reviewCounters.upToDate} />
            <StatItem label="未发布" value={reviewCounters.neverPublished} />
          </div>
        </div>

        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-[18px] border border-line bg-background p-4">
          <p className="text-[13px] leading-6 text-muted-strong">
            可以先从空白骨架开始，也可以让 AI 先生成一个可编辑初稿。
          </p>
          <Button onClick={() => setIsCreateDialogOpen(true)} variant="primary">
            新建工作流
          </Button>
        </div>
      </section>

      {message ? (
        <div
          className={`rounded-[16px] border px-4 py-3 text-[13px] ${
            messageTone === "error"
              ? "border-[#edd9d5] bg-[#fcf2f1] text-[#7e6f6b]"
              : messageTone === "success"
                ? "border-[#dbe8de] bg-[#eef8f0] text-[#6c776d]"
                : "border-line bg-surface text-muted-strong"
          }`}
        >
          {message}
        </div>
      ) : null}

      <section className="rounded-[24px] border border-line bg-surface p-5 shadow-soft">
        <div className="flex items-center justify-between gap-4">
          <h2 className="text-[18px] font-semibold tracking-[-0.03em] text-text">工作流列表</h2>
          <MetaPill>{workflows.length} 个工作流</MetaPill>
        </div>

        {workflows.length === 0 ? (
          <div className="mt-4 rounded-[18px] border border-dashed border-line bg-surface-muted px-4 py-6 text-[14px] leading-7 text-muted-strong">
            还没有工作流。先创建一个草稿，下一步就可以在详情页继续补齐节点和发布流程。
          </div>
        ) : (
          <div className="mt-4 grid gap-3 lg:grid-cols-2">
            {workflows.map((workflow) => (
              <article
                key={workflow.id}
                className="rounded-[20px] border border-line bg-background p-4 shadow-soft"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h3 className="truncate text-[18px] font-semibold tracking-[-0.03em] text-text">
                      {workflow.name}
                    </h3>
                    <p className="mt-1 line-clamp-2 text-[13px] leading-6 text-muted-strong">
                      {workflow.description || "尚未填写描述。"}
                    </p>
                  </div>
                  <StatusPill tone={resolveWorkflowStatusTone(workflow.status)} size="sm">
                    {formatWorkflowStatus(workflow.status)}
                  </StatusPill>
                </div>

                <div className="mt-3 flex flex-wrap gap-2">
                  <MetaPill size="sm">草稿 v{workflow.draftVersionNumber ?? "-"}</MetaPill>
                  <MetaPill size="sm">已发布 v{workflow.publishedVersionNumber ?? "-"}</MetaPill>
                  <StatusPill
                    tone={workflow.reviewState === "pending_review" ? "warning" : "success"}
                    size="sm"
                  >
                    {workflow.reviewState === "pending_review" ? "待复核" : "已同步"}
                  </StatusPill>
                </div>

                <div className="mt-3 text-[12px] text-muted">
                  Owner · {formatOwnerLabel(workflow.ownerType, workflow.ownerId)}
                </div>
                <div className="mt-1 text-[12px] text-muted">
                  最近更新 · {formatUpdatedAt(workflow.updatedAt)}
                </div>

                <div className="mt-4 flex flex-wrap gap-2">
                  <Link
                    href={`/workflows/${workflow.id}`}
                    className={buttonClassName({ variant: "primary" })}
                  >
                    打开详情
                  </Link>
                  <Button
                    onClick={() => void handlePublishWorkflow(workflow.id)}
                    disabled={pendingPublishId === workflow.id}
                    variant="secondary"
                  >
                    {pendingPublishId === workflow.id ? "发布中..." : "发布当前草稿"}
                  </Button>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

      <WorkflowCreateDialog
        isOpen={isCreateDialogOpen}
        onClose={() => setIsCreateDialogOpen(false)}
        onCreated={(workflowId) => void handleWorkflowCreated(workflowId)}
      />
    </div>
  );
}

function StatItem({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-[12px] border border-line bg-surface px-3 py-2">
      <div className="text-[11px] uppercase tracking-[0.14em] text-muted">{label}</div>
      <div className="mt-1 text-[18px] font-semibold tracking-[-0.03em] text-text">{value}</div>
    </div>
  );
}

function resolveWorkflowStatusTone(status: WorkflowOverviewCard["status"]) {
  switch (status) {
    case "active":
      return "success";
    case "paused":
      return "warning";
    case "archived":
      return "neutral";
    default:
      return "info";
  }
}

function formatWorkflowStatus(status: WorkflowOverviewCard["status"]) {
  switch (status) {
    case "active":
      return "运行中";
    case "paused":
      return "已暂停";
    case "archived":
      return "已归档";
    default:
      return "草稿";
  }
}

function formatOwnerLabel(
  ownerType: WorkflowOverviewCard["ownerType"],
  ownerId: string,
) {
  if (ownerType === "team") {
    return `团队 · ${ownerId}`;
  }

  return `个人 · ${ownerId}`;
}

function formatUpdatedAt(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "未知时间";
  }

  return new Intl.DateTimeFormat("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(date);
}
