import { runTaskNow } from "@/lib/tasks/task-runner";
import { getTask } from "@/lib/tasks/task-store";
import {
  errorResponse,
  json,
  notFoundJson,
  readRouteParams,
  type RouteContext,
} from "@/lib/server/api-route";

export async function POST(
  _request: Request,
  context: RouteContext<{ taskId: string }>,
) {
  const { taskId } = await readRouteParams(context);

  if (!getTask(taskId)) {
    return notFoundJson("定时任务不存在。");
  }

  try {
    const task = runTaskNow(taskId);

    return json({ task });
  } catch (error) {
    return errorResponse(error, "执行定时任务失败。");
  }
}
