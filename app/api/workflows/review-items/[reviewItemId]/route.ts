import { workflowService } from "@/lib/modules/workflows/workflow-service";
import type {
  WorkflowDetailResponse,
  WorkflowReviewActionResponse,
  WorkflowReviewItemRecord,
} from "@/lib/resources/opencrab-api-types";
import {
  errorResponse,
  noStoreJson,
  notFoundJson,
  readJsonBody,
  readRouteParams,
  type RouteContext,
} from "@/lib/server/api-route";
import { buildWorkflowDetailShellViewModel } from "@/lib/workflows/workflow-view-model";

export async function PATCH(
  request: Request,
  context: RouteContext<{ reviewItemId: string }>,
) {
  const { reviewItemId } = await readRouteParams(context);
  const body = await readJsonBody<
    | {
        action: "retry_current_node";
        inputPatch?: Record<string, unknown>;
      }
    | {
        action: "save_to_draft";
        definitionPatch: Record<string, unknown>;
      }
  >(request);

  const existing = workflowService.listReviewItems("all").find((item) => item.id === reviewItemId) ?? null;

  if (!existing) {
    return notFoundJson("复核项不存在。");
  }

  try {
    const result = await workflowService.reviewItem(reviewItemId, body);

    if (!result) {
      return notFoundJson("复核项不存在。");
    }

    const nextItem = workflowService.listReviewItems("all").find((item) => item.id === reviewItemId) ?? null;
    const workflow = isWorkflowDetailResult(result) ? toApiDetail(result) : null;

    return noStoreJson({
      item: nextItem ? toApiReviewItem(nextItem) : null,
      workflow,
      result:
        isRetryReviewResult(result)
          ? {
              status: "retried" as const,
              reviewItemId: result.reviewItemId,
              runId: result.runId,
              nodeId: result.nodeId,
              staleNodeRunIds: result.staleNodeRunIds,
            }
          : {
              status: "saved_to_draft" as const,
              reviewItemId,
            },
    } satisfies WorkflowReviewActionResponse);
  } catch (error) {
    return errorResponse(error, "处理复核项失败。", 400, {
      request,
      operation: "review_workflow_item",
    });
  }
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

function toApiDetail(
  detail: NonNullable<ReturnType<typeof workflowService.get>>,
): NonNullable<WorkflowDetailResponse["workflow"]> {
  const shell = buildWorkflowDetailShellViewModel(detail);

  if (!shell) {
    throw new Error("Workflow detail view model could not be built.");
  }

  return {
    workflow: detail.workflow,
    versions: detail.versions,
    reviewState: shell.reviewState,
    nodeCount: shell.nodeCount,
    edgeCount: shell.edgeCount,
    latestDraftVersionNumber: shell.latestDraft?.versionNumber ?? null,
    latestPublishedVersionNumber: shell.latestPublished?.versionNumber ?? null,
  };
}

function isRetryReviewResult(
  value: Awaited<ReturnType<typeof workflowService.reviewItem>>,
): value is {
  reviewItemId: string;
  runId: string;
  nodeId: string;
  staleNodeRunIds: string[];
} {
  return Boolean(
    value &&
      typeof value === "object" &&
      "reviewItemId" in value &&
      "runId" in value &&
      "nodeId" in value &&
      "staleNodeRunIds" in value,
  );
}

function isWorkflowDetailResult(
  value: Awaited<ReturnType<typeof workflowService.reviewItem>>,
): value is NonNullable<ReturnType<typeof workflowService.get>> {
  return Boolean(
    value &&
      typeof value === "object" &&
      "workflow" in value &&
      "versions" in value,
  );
}
