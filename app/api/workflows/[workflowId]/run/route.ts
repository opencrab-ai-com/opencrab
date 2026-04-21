import { workflowService } from "@/lib/modules/workflows/workflow-service";
import type { WorkflowRunResponse } from "@/lib/resources/opencrab-api-types";
import {
  errorResponse,
  noStoreJson,
  notFoundJson,
  readRouteParams,
  type RouteContext,
} from "@/lib/server/api-route";
import { buildWorkflowDetailShellViewModel } from "@/lib/workflows/workflow-view-model";

export async function POST(
  request: Request,
  context: RouteContext<{ workflowId: string }>,
) {
  const { workflowId } = await readRouteParams(context);
  const detail = workflowService.get(workflowId);

  if (!detail) {
    return notFoundJson("工作流不存在。");
  }

  try {
    const result = await workflowService.runNow(workflowId);

    return noStoreJson({
      workflow: toApiDetail(result.detail),
      run: result.run,
    } satisfies WorkflowRunResponse);
  } catch (error) {
    return errorResponse(error, "执行工作流失败。", 500, {
      request,
      operation: "run_workflow_now",
    });
  }
}

function toApiDetail(
  detail: NonNullable<ReturnType<typeof workflowService.get>>,
): NonNullable<WorkflowRunResponse["workflow"]> {
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
