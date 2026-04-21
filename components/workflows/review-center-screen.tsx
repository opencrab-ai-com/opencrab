"use client";

import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { MetaPill, StatusPill } from "@/components/ui/pill";
import { PendingPublishScreen } from "@/components/workflows/pending-publish-screen";
import { reviewWorkflowItem } from "@/lib/resources/opencrab-api";
import type {
  WorkflowReviewItemRecord,
  WorkflowReviewView,
} from "@/lib/resources/opencrab-api-types";

export function ReviewCenterScreen({
  initialItems,
  view,
}: {
  initialItems: WorkflowReviewItemRecord[];
  view: WorkflowReviewView;
}) {
  const [items, setItems] = useState(initialItems);
  const [draftPatchTextById, setDraftPatchTextById] = useState<Record<string, string>>({});
  const [pendingItemId, setPendingItemId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [messageTone, setMessageTone] = useState<"default" | "success" | "error">("default");
  const pendingCount = useMemo(
    () => items.filter((item) => item.surface === "pending_publish").length,
    [items],
  );

  async function handleRetry(reviewItemId: string) {
    setPendingItemId(reviewItemId);
    setMessage(null);

    try {
      const response = await reviewWorkflowItem(reviewItemId, {
        action: "retry_current_node",
      });

      setItems((current) => current.filter((item) => item.id !== reviewItemId));
      setMessageTone("success");
      setMessage(
        response.result?.status === "retried"
          ? `已重试当前节点，并标记 ${response.result.staleNodeRunIds.length} 个下游结果为 stale。`
          : "当前节点已加入重试。",
      );
    } catch (error) {
      setMessageTone("error");
      setMessage(error instanceof Error ? error.message : "重试当前节点失败。");
    } finally {
      setPendingItemId(null);
    }
  }

  async function handleSaveToDraft(reviewItemId: string) {
    setPendingItemId(reviewItemId);
    setMessage(null);

    try {
      const rawPatch = draftPatchTextById[reviewItemId]?.trim() || "{}";
      const definitionPatch = JSON.parse(rawPatch) as Record<string, unknown>;
      const response = await reviewWorkflowItem(reviewItemId, {
        action: "save_to_draft",
        definitionPatch,
      });

      setItems((current) => current.filter((item) => item.id !== reviewItemId));
      setDraftPatchTextById((current) => ({
        ...current,
        [reviewItemId]: "",
      }));
      setMessageTone("success");
      setMessage(
        response.workflow
          ? `已把修改保存回 ${response.workflow.workflow.name} 的当前草稿。`
          : "已把修改保存回当前草稿。",
      );
    } catch (error) {
      setMessageTone("error");
      setMessage(error instanceof Error ? error.message : "保存到草稿失败。");
    } finally {
      setPendingItemId(null);
    }
  }

  return (
    <div className="space-y-5">
      <section className="rounded-[24px] border border-line bg-surface p-5 shadow-soft">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-[18px] font-semibold tracking-[-0.03em] text-text">
              {view === "pending_publish" ? "Pending Publish" : "Review Center"}
            </h2>
            <p className="mt-1 text-[13px] leading-6 text-muted-strong">
              {view === "pending_publish"
                ? "集中查看待发布内容，保持内容确认和发布动作解耦。"
                : "这里聚合运行失败、等待人工处理和人工回放后的收口动作。"}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <MetaPill>{items.length} 项待处理</MetaPill>
            <MetaPill>{pendingCount} 项待发布</MetaPill>
          </div>
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

      {view === "pending_publish" ? (
        <PendingPublishScreen
          items={items}
          pendingActionId={pendingItemId}
          onSaveToDraft={(item) => {
            void handleSaveToDraft(item.id);
          }}
        />
      ) : items.length === 0 ? (
        <div className="rounded-[20px] border border-dashed border-line bg-surface-muted px-4 py-6 text-[14px] leading-7 text-muted-strong">
          当前没有待处理的 review item。
        </div>
      ) : (
        <section className="space-y-4">
          {items.map((item) => (
            <article
              key={item.id}
              className="rounded-[24px] border border-line bg-surface p-5 shadow-soft"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="text-[16px] font-semibold tracking-[-0.03em] text-text">
                    {item.summary}
                  </div>
                  <div className="mt-2 text-[13px] leading-6 text-muted-strong">
                    {item.threadPreview || "等待人工确认后继续执行。"}
                  </div>
                </div>
                <StatusPill tone={item.surface === "pending_publish" ? "warning" : "info"} size="sm">
                  {item.surface === "pending_publish" ? "待发布" : "待复核"}
                </StatusPill>
              </div>

              <div className="mt-4 flex flex-wrap gap-2">
                <MetaPill size="sm">{item.workflowName}</MetaPill>
                <MetaPill size="sm">节点 · {item.sourceNodeName}</MetaPill>
                {item.runStatus ? <MetaPill size="sm">运行状态 · {formatRunStatus(item.runStatus)}</MetaPill> : null}
              </div>

              <label className="mt-4 block text-[12px] text-muted">
                保存到草稿时可选填 JSON patch
                <textarea
                  value={draftPatchTextById[item.id] ?? ""}
                  onChange={(event) =>
                    setDraftPatchTextById((current) => ({
                      ...current,
                      [item.id]: event.target.value,
                    }))
                  }
                  placeholder='例如 {"scriptId":"script-review-v2"}'
                  className="mt-2 min-h-[88px] w-full rounded-[16px] border border-line bg-background px-3 py-2 text-[13px] text-text outline-none transition focus:border-text"
                />
              </label>

              <div className="mt-4 flex flex-wrap gap-2">
                <Button
                  onClick={() => void handleRetry(item.id)}
                  disabled={pendingItemId === item.id}
                  variant="primary"
                >
                  {pendingItemId === item.id ? "处理中..." : "重试当前节点"}
                </Button>
                <Button
                  onClick={() => void handleSaveToDraft(item.id)}
                  disabled={pendingItemId === item.id}
                  variant="secondary"
                >
                  {pendingItemId === item.id ? "处理中..." : "保存到草稿"}
                </Button>
              </div>
            </article>
          ))}
        </section>
      )}
    </div>
  );
}

function formatRunStatus(status: NonNullable<WorkflowReviewItemRecord["runStatus"]>) {
  switch (status) {
    case "success":
      return "成功";
    case "error":
      return "失败";
    case "waiting_for_human":
      return "等待人工";
    default:
      return "运行中";
  }
}
