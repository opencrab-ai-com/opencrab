import { workflowService } from "@/lib/modules/workflows/workflow-service";
import { buildWorkflowDetailShellViewModel } from "@/lib/workflows/workflow-view-model";
import { workflowDraftBuilder } from "@/lib/workflows/workflow-draft-builder";
import type { CodexReasoningEffort, WorkflowDetailResponse } from "@/lib/resources/opencrab-api-types";
import {
  errorResponse,
  noStoreJson,
  readJsonBody,
} from "@/lib/server/api-route";

type WorkflowDraftCreateBody = {
  mode?: "blank" | "ai";
  name?: string;
  description?: string | null;
  ownerType?: "person" | "team";
  ownerId?: string;
  goalPrompt?: string;
  model?: string;
  reasoningEffort?: CodexReasoningEffort;
};

export async function POST(request: Request) {
  try {
    const body = await readJsonBody<WorkflowDraftCreateBody>(request, {});
    const name = typeof body.name === "string" ? body.name.trim() : "";

    if (!name) {
      throw new Error("请输入工作流名称。");
    }

    const ownerId = typeof body.ownerId === "string" ? body.ownerId.trim() : "";
    const mode = body.mode === "ai" ? "ai" : "blank";
    const graph =
      mode === "ai"
        ? await workflowDraftBuilder.build({
            mode: "ai",
            workflowName: name,
            workflowDescription: body.description,
            goalPrompt: body.goalPrompt,
            model: body.model,
            reasoningEffort: body.reasoningEffort,
          })
        : null;
    const created = workflowService.create({
      name,
      description: body.description,
      ownerType: body.ownerType === "team" ? "team" : "person",
      ownerId: ownerId || "person-self",
      ...(graph ? { graph } : {}),
    });

    return noStoreJson({
      workflow: toApiDetail(created),
    } satisfies WorkflowDetailResponse);
  } catch (error) {
    return errorResponse(error, "创建工作流草稿失败。", 400, {
      request,
      operation: "create_workflow_draft",
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
