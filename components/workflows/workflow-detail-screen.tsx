"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  WorkflowCanvas,
  type WorkflowCanvasChangeMeta,
  type WorkflowCanvasSelection,
} from "@/components/workflows/workflow-canvas";
import { WorkflowInspector } from "@/components/workflows/workflow-inspector";
import { Button, buttonClassName } from "@/components/ui/button";
import { MetaPill, StatusPill } from "@/components/ui/pill";
import {
  getAgents,
  getWorkflowDetail,
  publishWorkflow,
  runWorkflow,
  saveWorkflowDraft,
} from "@/lib/resources/opencrab-api";
import type { WorkflowDetailRecord, WorkflowGraph } from "@/lib/resources/opencrab-api-types";
import { markStaleDescendants, validateWorkflowForPublish } from "@/lib/workflows/workflow-graph";
import type { AgentProfileRecord } from "@/lib/agents/types";

export function WorkflowDetailScreen({ workflowId }: { workflowId: string }) {
  const [workflow, setWorkflow] = useState<WorkflowDetailRecord | null>(null);
  const [draftGraph, setDraftGraph] = useState<WorkflowGraph | null>(null);
  const [agents, setAgents] = useState<AgentProfileRecord[]>([]);
  const [selection, setSelection] = useState<WorkflowCanvasSelection>({
    nodeId: null,
    edgeId: null,
  });
  const [staleNodeIds, setStaleNodeIds] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [pendingAction, setPendingAction] = useState<"publish" | "run" | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [messageTone, setMessageTone] = useState<"default" | "success" | "error">("default");
  const [draftSaveState, setDraftSaveState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [draftSaveError, setDraftSaveError] = useState<string | null>(null);
  const lastPersistedGraphKeyRef = useRef<string | null>(null);

  const publishValidation = draftGraph ? validateWorkflowForPublish(draftGraph) : null;
  const isPublishBlocked = publishValidation ? !publishValidation.isValid : true;

  const loadWorkflow = useCallback(async () => {
    setIsLoading(true);
    setMessage(null);

    try {
      const [workflowResponse, agentsResponse] = await Promise.all([
        getWorkflowDetail(workflowId),
        getAgents().catch(() => ({ agents: [] as AgentProfileRecord[] })),
      ]);
      const editableGraph = workflowResponse.workflow ? resolveEditableGraph(workflowResponse.workflow) : null;
      setWorkflow(workflowResponse.workflow);
      setDraftGraph(editableGraph);
      lastPersistedGraphKeyRef.current = editableGraph ? JSON.stringify(editableGraph) : null;
      setAgents(agentsResponse.agents);
      setSelection({ nodeId: null, edgeId: null });
      setStaleNodeIds([]);
      setDraftSaveState("idle");
      setDraftSaveError(null);
    } catch (error) {
      setMessageTone("error");
      setMessage(error instanceof Error ? error.message : "加载工作流失败。");
    } finally {
      setIsLoading(false);
    }
  }, [workflowId]);

  useEffect(() => {
    void loadWorkflow();
  }, [loadWorkflow]);

  useEffect(() => {
    const activeDraftVersionId = workflow ? resolveActiveDraftVersionId(workflow) : null;

    if (!draftGraph || !activeDraftVersionId) {
      return;
    }

    const nextGraphKey = JSON.stringify(draftGraph);

    if (nextGraphKey === lastPersistedGraphKeyRef.current) {
      return;
    }

    setDraftSaveState("saving");
    setDraftSaveError(null);

    const timer = window.setTimeout(() => {
      const graphSnapshot = structuredClone(draftGraph);
      const saveKey = nextGraphKey;

      void saveWorkflowDraft(workflowId, {
        versionId: activeDraftVersionId,
        graph: graphSnapshot,
      })
        .then((response) => {
          if (!response.workflow) {
            throw new Error("工作流不存在。");
          }

          lastPersistedGraphKeyRef.current = saveKey;
          setWorkflow(response.workflow);
          setDraftSaveState("saved");
        })
        .catch((error) => {
          setDraftSaveState("error");
          setDraftSaveError(error instanceof Error ? error.message : "自动保存工作流失败。");
        });
    }, 450);

    return () => {
      window.clearTimeout(timer);
    };
  }, [workflow, workflowId, draftGraph]);

  async function handlePublish() {
    if (!draftGraph) {
      setMessageTone("error");
      setMessage("当前草稿图不可用，请先刷新工作流。");
      return;
    }

    const validation = validateWorkflowForPublish(draftGraph);

    if (!validation.isValid) {
      setMessageTone("error");
      setMessage(summarizePublishValidation(validation.errors));
      return;
    }

    setPendingAction("publish");
    setMessage(null);

    try {
      const response = await publishWorkflow(workflowId, {
        graph: draftGraph,
      });

      if (!response.workflow) {
        throw new Error("工作流不存在。");
      }

      const nextGraph = resolveEditableGraph(response.workflow);
      setWorkflow(response.workflow);
      setDraftGraph(nextGraph);
      lastPersistedGraphKeyRef.current = nextGraph ? JSON.stringify(nextGraph) : null;
      setSelection({ nodeId: null, edgeId: null });
      setStaleNodeIds([]);
      setDraftSaveState("idle");
      setDraftSaveError(null);
      setMessageTone("success");
      setMessage("当前草稿已发布，系统已生成新的草稿版本。");
    } catch (error) {
      setMessageTone("error");
      setMessage(error instanceof Error ? error.message : "发布工作流失败。");
    } finally {
      setPendingAction(null);
    }
  }

  async function handleRun() {
    setPendingAction("run");
    setMessage(null);

    try {
      const response = await runWorkflow(workflowId);

      if (!response.workflow || !response.run) {
        throw new Error("工作流不存在。");
      }

      const nextGraph = resolveEditableGraph(response.workflow);
      setWorkflow(response.workflow);
      setDraftGraph(nextGraph);
      lastPersistedGraphKeyRef.current = nextGraph ? JSON.stringify(nextGraph) : null;
      setMessageTone("success");
      setMessage(response.run.message);
    } catch (error) {
      setMessageTone("error");
      setMessage(error instanceof Error ? error.message : "执行工作流失败。");
    } finally {
      setPendingAction(null);
    }
  }

  function handleGraphChange(nextGraph: WorkflowGraph, meta?: WorkflowCanvasChangeMeta) {
    setDraftGraph(nextGraph);

    const changedNodeIds = meta?.changedNodeIds?.filter(Boolean) ?? [];

    if (changedNodeIds.length === 0) {
      return;
    }

    setStaleNodeIds((current) => {
      const next = new Set(current);

      changedNodeIds.forEach((nodeId) => {
        next.delete(nodeId);
      });

      markStaleDescendants(nextGraph, changedNodeIds).forEach((nodeId) => {
        next.add(nodeId);
      });

      return Array.from(next).sort((left, right) => left.localeCompare(right));
    });
  }

  if (isLoading) {
    return (
      <div className="rounded-[24px] border border-line bg-surface p-6 text-[14px] text-muted-strong shadow-soft">
        正在加载工作流详情...
      </div>
    );
  }

  if (!workflow) {
    return (
      <div className="rounded-[24px] border border-line bg-surface p-6 text-[14px] text-muted-strong shadow-soft">
        这个工作流不存在，可能已经被删除。
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="rounded-[28px] border border-line bg-surface p-6 shadow-soft">
        <Link href="/workflows" className="text-[13px] text-muted transition hover:text-text">
          返回工作流列表
        </Link>

        <div className="mt-3 flex flex-wrap items-center gap-3">
          <h1 className="text-[28px] font-semibold tracking-[-0.04em] text-text">
            {workflow.workflow.name}
          </h1>
          <StatusPill tone={resolveWorkflowStatusTone(workflow.workflow.status)}>
            {formatWorkflowStatus(workflow.workflow.status)}
          </StatusPill>
          <StatusPill tone={workflow.reviewState === "pending_review" ? "warning" : "success"}>
            {workflow.reviewState === "pending_review" ? "待复核" : "已同步"}
          </StatusPill>
        </div>

        <p className="mt-3 max-w-[72ch] text-[14px] leading-7 text-muted-strong">
          {workflow.workflow.description || "尚未填写工作流描述。"}
        </p>

        <div className="mt-4 flex flex-wrap gap-2">
          <Button onClick={() => void loadWorkflow()} disabled={pendingAction !== null} variant="secondary">
            刷新状态
          </Button>
          <Button onClick={() => void handleRun()} disabled={pendingAction !== null} variant="primary">
            {pendingAction === "run" ? "运行中..." : "立即运行"}
          </Button>
          <Button
            onClick={() => void handlePublish()}
            disabled={pendingAction !== null || isPublishBlocked}
            variant="secondary"
            title={isPublishBlocked ? "请先修复发布校验问题" : undefined}
          >
            {pendingAction === "publish" ? "发布中..." : "发布草稿"}
          </Button>
          <Link href="/workflows/review" className={buttonClassName({ variant: "secondary" })}>
            打开 Review Center
          </Link>
          <Link
            href="/workflows/review?view=pending_publish"
            className={buttonClassName({ variant: "secondary" })}
          >
            查看 Pending Publish
          </Link>
          <span className={buttonClassName({ variant: "ghost", className: "cursor-default" })}>
            {draftSaveState === "saving"
              ? "草稿保存中..."
              : draftSaveState === "saved"
                ? "草稿已自动保存"
                : draftSaveState === "error"
                  ? "自动保存失败"
                  : "本地草稿编辑中"}
          </span>
        </div>

        {draftSaveError ? (
          <div className="mt-3 rounded-[14px] border border-[#edd9d5] bg-[#fcf2f1] px-4 py-3 text-[12px] text-[#7e6f6b]">
            {draftSaveError}
          </div>
        ) : null}

        {publishValidation && !publishValidation.isValid ? (
          <div className="mt-4 rounded-[16px] border border-[#f2d3bd] bg-[#fff4e8] px-4 py-3 text-[12px] text-[#8a5a08]">
            发布前需修复 {publishValidation.errors.length} 项校验：
            <ul className="mt-2 list-disc space-y-1 pl-5">
              {publishValidation.errors.slice(0, 3).map((error) => (
                <li key={`${error.code}-${error.nodeId ?? ""}-${error.edgeId ?? ""}`}>
                  {error.message}
                  {error.nodeId ? ` (${error.nodeId})` : ""}
                  {error.edgeId ? ` [${error.edgeId}]` : ""}
                </li>
              ))}
            </ul>
          </div>
        ) : (
          <div className="mt-4 rounded-[16px] border border-[#dbe8de] bg-[#eef8f0] px-4 py-3 text-[12px] text-[#4c6750]">
            发布校验已通过，可直接发布当前草稿版本。
          </div>
        )}
      </div>

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

      {draftGraph && publishValidation ? (
        <section className="grid gap-4 xl:grid-cols-[1.28fr_0.72fr]">
          <WorkflowCanvas
            graph={draftGraph}
            selection={selection}
            staleNodeIds={staleNodeIds}
            conditionalReadiness={publishValidation.conditionalReadiness}
            onGraphChange={handleGraphChange}
            onSelectionChange={setSelection}
          />
          <WorkflowInspector
            agents={agents}
            graph={draftGraph}
            selection={selection}
            staleNodeIds={staleNodeIds}
            validation={publishValidation}
            onGraphChange={handleGraphChange}
            onSelectionChange={setSelection}
          />
        </section>
      ) : null}

      <section className="grid gap-4 rounded-[24px] border border-line bg-surface p-5 shadow-soft sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="草稿版本" value={workflow.latestDraftVersionNumber ?? "-"} />
        <StatCard label="已发布版本" value={workflow.latestPublishedVersionNumber ?? "-"} />
        <StatCard label="节点数" value={draftGraph?.nodes.length ?? workflow.nodeCount} />
        <StatCard label="连线数" value={draftGraph?.edges.length ?? workflow.edgeCount} />
      </section>

      <section className="rounded-[24px] border border-line bg-surface p-5 shadow-soft">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-[18px] font-semibold tracking-[-0.03em] text-text">版本轨迹</h2>
          <MetaPill>{workflow.versions.length} 个版本</MetaPill>
        </div>

        <div className="mt-4 space-y-3">
          {workflow.versions.map((version) => (
            <article
              key={version.id}
              className="rounded-[18px] border border-line bg-background p-4"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex flex-wrap items-center gap-2">
                  <div className="text-[15px] font-medium text-text">版本 v{version.versionNumber}</div>
                  <StatusPill tone={version.status === "published" ? "success" : "info"} size="sm">
                    {version.status === "published" ? "已发布" : "草稿"}
                  </StatusPill>
                  {workflow.workflow.activeVersionId === version.id ? (
                    <MetaPill size="sm">当前激活草稿</MetaPill>
                  ) : null}
                </div>
                <div className="text-[12px] text-muted">更新于 {formatUpdatedAt(version.updatedAt)}</div>
              </div>

              <div className="mt-2 grid gap-2 text-[13px] leading-6 text-muted-strong sm:grid-cols-2">
                <p>节点 · {version.graph.nodes.length}</p>
                <p>连线 · {version.graph.edges.length}</p>
                <p>创建时间 · {formatUpdatedAt(version.createdAt)}</p>
                <p>
                  发布时间 ·{" "}
                  {version.publishedAt ? formatUpdatedAt(version.publishedAt) : "尚未发布"}
                </p>
              </div>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: string | number }) {
  return (
    <article className="rounded-[16px] border border-line bg-background px-4 py-3">
      <div className="text-[11px] uppercase tracking-[0.14em] text-muted">{label}</div>
      <div className="mt-2 text-[22px] font-semibold tracking-[-0.03em] text-text">{value}</div>
    </article>
  );
}

function resolveWorkflowStatusTone(status: WorkflowDetailRecord["workflow"]["status"]) {
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

function formatWorkflowStatus(status: WorkflowDetailRecord["workflow"]["status"]) {
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

function resolveEditableGraph(detail: WorkflowDetailRecord): WorkflowGraph | null {
  const activeVersion =
    detail.versions.find((version) => version.id === detail.workflow.activeVersionId) ??
    detail.versions.find((version) => version.status === "draft") ??
    detail.versions[0];

  return activeVersion ? structuredClone(activeVersion.graph) : null;
}

function resolveActiveDraftVersionId(detail: WorkflowDetailRecord) {
  const activeVersion = detail.versions.find((version) => version.id === detail.workflow.activeVersionId);

  if (activeVersion?.status === "draft") {
    return activeVersion.id;
  }

  return detail.versions.find((version) => version.status === "draft")?.id ?? null;
}

function summarizePublishValidation(
  errors: ReturnType<typeof validateWorkflowForPublish>["errors"],
) {
  const firstError = errors[0];

  if (!firstError) {
    return "发布校验未通过，请检查工作流拓扑。";
  }

  if (errors.length === 1) {
    return firstError.message;
  }

  return `${firstError.message}（另有 ${errors.length - 1} 项问题）`;
}
