import { deleteTask, getTask, updateTask } from "@/lib/tasks/task-store";
import {
  errorResponse,
  json,
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
  const task = getTask(taskId);

  if (!task) {
    return notFoundJson("定时任务不存在。");
  }

  return json({ task });
}

export async function PATCH(
  request: Request,
  context: RouteContext<{ taskId: string }>,
) {
  const { taskId } = await readRouteParams(context);

  try {
    const body = await readJsonBody<TaskUpdateInput>(request, {});
    const task = updateTask(taskId, body);

    if (!task) {
      return notFoundJson("定时任务不存在。");
    }

    return json({ task: getTask(taskId) });
  } catch (error) {
    return errorResponse(error, "更新定时任务失败。", 400);
  }
}

export async function DELETE(
  _request: Request,
  context: RouteContext<{ taskId: string }>,
) {
  const { taskId } = await readRouteParams(context);

  if (!getTask(taskId)) {
    return notFoundJson("定时任务不存在。");
  }

  deleteTask(taskId);

  return json({ ok: true });
}
