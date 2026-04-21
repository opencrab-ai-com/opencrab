import Link from "next/link";
import { ReviewCenterScreen } from "@/components/workflows/review-center-screen";
import { AppPage } from "@/components/ui/app-page";
import { PageHeader } from "@/components/ui/page-header";
import { buttonClassName } from "@/components/ui/button";
import { workflowService } from "@/lib/modules/workflows/workflow-service";
import type { WorkflowReviewItemRecord } from "@/lib/resources/opencrab-api-types";

type WorkflowReviewPageProps = {
  searchParams?:
    | Promise<{
        view?: string;
      }>
    | {
        view?: string;
      };
};

export default async function WorkflowReviewPage({ searchParams }: WorkflowReviewPageProps) {
  const resolvedSearchParams = searchParams ? await searchParams : {};
  const view = resolvedSearchParams?.view === "pending_publish" ? "pending_publish" : "all";
  const items = workflowService.listReviewItems(view);

  return (
    <AppPage width="wide" contentClassName="space-y-5">
      <PageHeader
        title="Review Center"
        description="统一承接运行失败、等待人工处理和待发布内容，支持重试当前节点和把修改保存回草稿。"
        className="mb-4"
      />

      <div className="flex flex-wrap gap-2">
        <Link
          href="/workflows/review"
          className={buttonClassName({
            variant: view === "all" ? "primary" : "secondary",
          })}
        >
          全部复核项
        </Link>
        <Link
          href="/workflows/review?view=pending_publish"
          className={buttonClassName({
            variant: view === "pending_publish" ? "primary" : "secondary",
          })}
        >
          Pending Publish
        </Link>
      </div>

      <ReviewCenterScreen
        initialItems={items.map(toApiReviewItem)}
        view={view}
      />
    </AppPage>
  );
}

function toApiReviewItem(
  item: ReturnType<typeof workflowService.listReviewItems>[number],
): WorkflowReviewItemRecord {
  return {
    id: item.id,
    workflowId: item.workflowId,
    workflowName: item.workflowName,
    workflowStatus: item.workflowStatus,
    workflowVersionId: item.workflowVersionId,
    runId: item.runId,
    runStatus: item.runStatus,
    runStartedAt: item.runStartedAt,
    sourceNodeId: item.sourceNodeId,
    sourceNodeName: item.sourceNodeName,
    sourceNodeType: item.sourceNodeType,
    surface: item.surface,
    status: item.status,
    summary: item.summary,
    threadPreview: item.threadPreview,
    createdAt: item.createdAt,
    updatedAt: item.updatedAt,
  };
}
