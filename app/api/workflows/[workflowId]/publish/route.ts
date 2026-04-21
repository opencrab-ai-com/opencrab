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

export async function POST(
  request: Request,
  context: RouteContext<{ workflowId: string }>,
) {
  const { workflowId } = await readRouteParams(context);
  const body = await readJsonBody<{ graph?: WorkflowGraph | null }>(request, {});

  if (!workflowService.get(workflowId)) {
    return notFoundJson("工作流不存在。");
  }

  try {
    const detail = workflowService.publish(
      workflowId,
      body.graph ? { graph: body.graph } : undefined,
    );

    if (!detail) {
      return notFoundJson("工作流不存在。");
    }

    return noStoreJson({
      workflow: toApiDetail(detail),
    } satisfies WorkflowDetailResponse);
  } catch (error) {
    return errorResponse(error, "发布工作流失败。", 500, {
      request,
      operation: "publish_workflow",
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
