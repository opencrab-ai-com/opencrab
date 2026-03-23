import { projectManagementService } from "@/lib/modules/projects/project-management-service";
import { projectQueryService } from "@/lib/modules/projects/project-query-service";
import { projectRuntimeService } from "@/lib/modules/projects/project-runtime-service";
import {
  errorResponse,
  noStoreJson,
  notFoundJson,
  readJsonBody,
  readRouteParams,
  type RouteContext,
} from "@/lib/server/api-route";
import type { ProjectCheckpointAction } from "@/lib/projects/types";

export async function GET(
  _request: Request,
  context: RouteContext<{ projectId: string }>,
) {
  const { projectId } = await readRouteParams(context);
  const detail = projectQueryService.getDetail(projectId);

  if (!detail) {
    return notFoundJson("这个团队模式不存在，可能已经被删除。");
  }

  return noStoreJson(detail);
}

export async function POST(
  _request: Request,
  context: RouteContext<{ projectId: string }>,
) {
  try {
    const { projectId } = await readRouteParams(context);
    const detail = await projectRuntimeService.run(projectId);

    if (!detail) {
      return notFoundJson("这个团队模式不存在，可能已经被删除。");
    }

    return noStoreJson(detail);
  } catch (error) {
    return errorResponse(error, "启动团队运行失败。", 400, {
      request: _request,
      operation: "run_project",
    });
  }
}

export async function PATCH(
  request: Request,
  context: RouteContext<{ projectId: string }>,
) {
  try {
    const { projectId } = await readRouteParams(context);
    const body = await readJsonBody<{
      action: ProjectCheckpointAction;
      note?: string | null;
    }>(request);
    const detail = await projectRuntimeService.updateCheckpoint(projectId, body);

    if (!detail) {
      return notFoundJson("这个团队模式不存在，可能已经被删除。");
    }

    return noStoreJson(detail);
  } catch (error) {
    return errorResponse(error, "更新团队检查点失败。", 400, {
      request,
      operation: "update_project_checkpoint",
    });
  }
}

export async function DELETE(
  _request: Request,
  context: RouteContext<{ projectId: string }>,
) {
  try {
    const { projectId } = await readRouteParams(context);
    const ok = projectManagementService.remove(projectId);

    if (!ok) {
      return notFoundJson("这个团队模式不存在，可能已经被删除。");
    }

    return noStoreJson({ ok: true });
  } catch (error) {
    return errorResponse(error, "删除团队失败。", 400, {
      request: _request,
      operation: "delete_project",
    });
  }
}
