import { taskService } from "@/lib/modules/tasks/task-service";
import {
  errorResponse,
  noStoreJson,
  notFoundJson,
  readRouteParams,
  type RouteContext,
} from "@/lib/server/api-route";

export async function POST(
  _request: Request,
  context: RouteContext<{ taskId: string }>,
) {
  const { taskId } = await readRouteParams(context);

  if (!taskService.get(taskId)) {
    return notFoundJson("定时任务不存在。");
  }

  try {
    const task = taskService.runNow(taskId);

    return noStoreJson({ task });
  } catch (error) {
    return errorResponse(error, "执行定时任务失败。", 500, {
      request: _request,
      operation: "run_task_now",
    });
  }
}
