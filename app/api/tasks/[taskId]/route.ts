import { taskService } from "@/lib/modules/tasks/task-service";
import {
  errorResponse,
  noStoreJson,
  notFoundJson,
  readJsonBody,
  readRouteParams,
  type RouteContext,
} from "@/lib/server/api-route";
import type { TaskUpdateInput } from "@/lib/tasks/types";

export async function GET(
  _request: Request,
  context: RouteContext<{ taskId: string }>,
) {
  const { taskId } = await readRouteParams(context);
  const task = taskService.get(taskId);

  if (!task) {
    return notFoundJson("定时任务不存在。");
  }

  return noStoreJson({ task });
}

export async function PATCH(
  request: Request,
  context: RouteContext<{ taskId: string }>,
) {
  const { taskId } = await readRouteParams(context);

  try {
    const body = await readJsonBody<TaskUpdateInput>(request, {});
    const task = taskService.update(taskId, body);

    if (!task) {
      return notFoundJson("定时任务不存在。");
    }

    return noStoreJson({ task: taskService.get(taskId) });
  } catch (error) {
    return errorResponse(error, "更新定时任务失败。", 400, {
      request,
      operation: "update_task",
    });
  }
}

export async function DELETE(
  _request: Request,
  context: RouteContext<{ taskId: string }>,
) {
  const { taskId } = await readRouteParams(context);

  if (!taskService.get(taskId)) {
    return notFoundJson("定时任务不存在。");
  }

  taskService.remove(taskId);

  return noStoreJson({ ok: true });
}
