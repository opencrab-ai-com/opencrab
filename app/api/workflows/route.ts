import { workflowService } from "@/lib/modules/workflows/workflow-service";
import {
  buildWorkflowDetailShellViewModel,
  buildWorkflowOverviewViewModel,
} from "@/lib/workflows/workflow-view-model";
import {
  errorResponse,
  noStoreJson,
  readJsonBody,
} from "@/lib/server/api-route";
import type { WorkflowDetailResponse } from "@/lib/resources/opencrab-api-types";
import type { WorkflowCreateInput } from "@/lib/workflows/types";

export async function GET() {
  const workflowDetails = workflowService
    .list()
    .map((workflow) => workflowService.get(workflow.id))
    .filter((detail): detail is NonNullable<typeof detail> => Boolean(detail));
  const overview = buildWorkflowOverviewViewModel(workflowDetails);

  return noStoreJson({
    workflows: overview.cards,
    reviewCounters: overview.reviewCounters,
  });
}

export async function POST(request: Request) {
  try {
    const body = await readJsonBody<WorkflowCreateInput>(request);
    const created = workflowService.create(body);

    return noStoreJson({
      workflow: toApiDetail(created),
    } satisfies WorkflowDetailResponse);
  } catch (error) {
    return errorResponse(error, "创建工作流失败。", 400, {
      request,
      operation: "create_workflow",
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
