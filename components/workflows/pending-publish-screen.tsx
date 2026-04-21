"use client";

import Link from "next/link";
import { Button, buttonClassName } from "@/components/ui/button";
import { MetaPill, StatusPill } from "@/components/ui/pill";
import type { WorkflowReviewItemRecord } from "@/lib/resources/opencrab-api-types";

type PendingPublishScreenProps = {
  items: WorkflowReviewItemRecord[];
  pendingActionId: string | null;
  onSaveToDraft: (item: WorkflowReviewItemRecord) => void;
};

export function PendingPublishScreen({
  items,
  pendingActionId,
  onSaveToDraft,
}: PendingPublishScreenProps) {
  if (items.length === 0) {
    return (
      <div className="rounded-[24px] border border-dashed border-line bg-surface p-8 text-[14px] leading-7 text-muted-strong shadow-soft">
        当前没有进入 Pending Publish 的内容。等工作流跑到发布前确认节点后，这里会自动出现待检查结果。
      </div>
    );
  }

  return (
    <section className="grid gap-4 xl:grid-cols-2">
      {items.map((item) => (
        <article
          key={item.id}
          className="overflow-hidden rounded-[28px] border border-line bg-surface shadow-soft"
        >
          <div className="bg-[linear-gradient(135deg,#fff4e8_0%,#f8f1ea_58%,#f4f7f2_100%)] px-5 py-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <div className="text-[11px] uppercase tracking-[0.14em] text-[#9a6a28]">
                  Pending Publish
                </div>
                <h3 className="mt-2 text-[20px] font-semibold tracking-[-0.03em] text-text">
                  {item.summary}
                </h3>
              </div>
              <StatusPill tone="warning" size="sm">
                待发布确认
              </StatusPill>
            </div>
          </div>

          <div className="space-y-4 px-5 py-5">
            <div className="flex flex-wrap gap-2">
              <MetaPill size="sm">{item.workflowName}</MetaPill>
              <MetaPill size="sm">{item.sourceNodeName}</MetaPill>
            </div>

            <p className="text-[13px] leading-7 text-muted-strong">
              {item.threadPreview || "系统已生成一份待发布结果，建议先同步回草稿或打开工作流检查配置。"}
            </p>

            <div className="grid gap-3 rounded-[18px] border border-line bg-background p-4 text-[12px] text-muted-strong sm:grid-cols-2">
              <div>
                <div className="uppercase tracking-[0.12em] text-muted">工作流</div>
                <div className="mt-1 text-text">{item.workflowName}</div>
              </div>
              <div>
                <div className="uppercase tracking-[0.12em] text-muted">运行时间</div>
                <div className="mt-1 text-text">{formatReviewTime(item.runStartedAt || item.createdAt)}</div>
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              <Button
                onClick={() => onSaveToDraft(item)}
                disabled={pendingActionId === item.id}
                variant="primary"
              >
                {pendingActionId === item.id ? "同步中..." : "保存到草稿"}
              </Button>
              <Link href={`/workflows/${item.workflowId}`} className={buttonClassName({ variant: "secondary" })}>
                打开工作流
              </Link>
            </div>
          </div>
        </article>
      ))}
    </section>
  );
}

function formatReviewTime(value: string) {
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
