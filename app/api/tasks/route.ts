import { ensureTaskRunner } from "@/lib/tasks/task-runner";
import { taskService } from "@/lib/modules/tasks/task-service";
import {
  errorResponse,
  noStoreJson,
  readJsonBody,
} from "@/lib/server/api-route";
import type { TaskCreateInput } from "@/lib/tasks/types";

export async function GET() {
  void ensureTaskRunner();

  return noStoreJson({
    tasks: taskService.list(),
  });
}

export async function POST(request: Request) {
  try {
    const body = await readJsonBody<TaskCreateInput>(request);
    const task = taskService.create(body);

    return noStoreJson({
      task,
    });
  } catch (error) {
    return errorResponse(error, "创建定时任务失败。", 400, {
      request,
      operation: "create_task",
    });
  }
}
