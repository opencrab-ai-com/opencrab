import { workflowService } from "@/lib/modules/workflows/workflow-service";
import type {
  WorkflowReviewItemRecord,
  WorkflowReviewItemsResponse,
} from "@/lib/resources/opencrab-api-types";
import { noStoreJson } from "@/lib/server/api-route";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const view = searchParams.get("view") === "pending_publish" ? "pending_publish" : "all";
  const items = workflowService.listReviewItems(view);

  return noStoreJson({
    view,
    items: items.map(toApiReviewItem),
  } satisfies WorkflowReviewItemsResponse);
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
