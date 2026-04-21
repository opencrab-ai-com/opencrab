import { workflowService } from "@/lib/modules/workflows/workflow-service";
import { buildWorkflowDetailShellViewModel } from "@/lib/workflows/workflow-view-model";
import {
  errorResponse,
  noStoreJson,
  notFoundJson,
  readJsonBody,
  readRouteParams,
  type RouteContext,
} from "@/lib/server/api-route";
import type { WorkflowDetailResponse } from "@/lib/resources/opencrab-api-types";
import type { WorkflowGraph } from "@/lib/workflows/types";

export async function GET(
  _request: Request,
  context: RouteContext<{ workflowId: string }>,
) {
  const { workflowId } = await readRouteParams(context);
  const detail = workflowService.get(workflowId);

  if (!detail) {
    return notFoundJson("工作流不存在。");
  }

  return noStoreJson({
    workflow: toApiDetail(detail),
  } satisfies WorkflowDetailResponse);
}

export async function PATCH(
  request: Request,
  context: RouteContext<{ workflowId: string }>,
) {
  const { workflowId } = await readRouteParams(context);
  const body = await readJsonBody<{ versionId?: string; graph?: WorkflowGraph | null }>(request, {});

  if (!workflowService.get(workflowId)) {
    return notFoundJson("工作流不存在。");
  }

  if (!body.versionId || !body.graph) {
    return errorResponse(
      new Error("缺少草稿版本或图数据。"),
      "保存工作流草稿失败。",
      400,
      {
        request,
        operation: "save_workflow_draft",
      },
    );
  }

  try {
    const detail = workflowService.saveDraft(workflowId, {
      versionId: body.versionId,
      graph: body.graph,
    });

    if (!detail) {
      return notFoundJson("工作流不存在。");
    }

    return noStoreJson({
      workflow: toApiDetail(detail),
    } satisfies WorkflowDetailResponse);
  } catch (error) {
    return errorResponse(error, "保存工作流草稿失败。", 500, {
      request,
      operation: "save_workflow_draft",
    });
  }
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
