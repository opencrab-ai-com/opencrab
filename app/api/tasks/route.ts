import { ensureTaskRunner } from "@/lib/tasks/task-runner";
import { createTask, listTasks } from "@/lib/tasks/task-store";
import { errorResponse, json, readJsonBody } from "@/lib/server/api-route";
import type { TaskCreateInput } from "@/lib/tasks/types";

export async function GET() {
  void ensureTaskRunner();

  return json({
    tasks: listTasks(),
  });
}

export async function POST(request: Request) {
  try {
    const body = await readJsonBody<TaskCreateInput>(request);
    const task = createTask(body);

    return json({
      task,
    });
  } catch (error) {
    return errorResponse(error, "创建定时任务失败。", 400);
  }
}
