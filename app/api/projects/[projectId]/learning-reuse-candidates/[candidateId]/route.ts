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
  context: RouteContext<{ projectId: string; candidateId: string }>,
) {
  try {
    const { projectId, candidateId } = await readRouteParams(context);
    const body = await readJsonBody<{
      action: "confirm" | "dismiss";
      note?: string | null;
    }>(request);
    const detail = projectRuntimeService.reviewLearningReuseCandidate(projectId, {
      candidateId,
      action: body.action,
      note: body.note,
    });

    if (!detail) {
      return notFoundJson("这个团队模式不存在，可能已经被删除。");
    }

    return noStoreJson(detail);
  } catch (error) {
    return errorResponse(error, "处理跨项目复用候选失败。", 400, {
      request,
      operation: "review_project_learning_reuse_candidate",
    });
  }
}
