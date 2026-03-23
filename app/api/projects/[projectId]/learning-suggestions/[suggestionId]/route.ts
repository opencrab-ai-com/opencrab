import { projectRuntimeService } from "@/lib/modules/projects/project-runtime-service";
import {
  errorResponse,
  noStoreJson,
  notFoundJson,
  readJsonBody,
  readRouteParams,
  type RouteContext,
} from "@/lib/server/api-route";

export async function PATCH(
  request: Request,
  context: RouteContext<{ projectId: string; suggestionId: string }>,
) {
  try {
    const { projectId, suggestionId } = await readRouteParams(context);
    const body = await readJsonBody<{
      action: "accept" | "dismiss";
      note?: string | null;
    }>(request);
    const detail = projectRuntimeService.reviewLearningSuggestion(projectId, {
      suggestionId,
      action: body.action,
      note: body.note,
    });

    if (!detail) {
      return notFoundJson("这个团队模式不存在，可能已经被删除。");
    }

    return noStoreJson(detail);
  } catch (error) {
    return errorResponse(error, "处理 learning suggestion 失败。", 400, {
      request,
      operation: "review_project_learning_suggestion",
    });
  }
}
