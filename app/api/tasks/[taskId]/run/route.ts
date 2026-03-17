import { NextResponse } from "next/server";
import { runTaskNow } from "@/lib/tasks/task-runner";
import { getTask } from "@/lib/tasks/task-store";

export async function POST(
  _request: Request,
  context: { params: Promise<{ taskId: string }> },
) {
  const { taskId } = await context.params;

  if (!getTask(taskId)) {
    return NextResponse.json({ error: "任务不存在。" }, { status: 404 });
  }

  try {
    const task = runTaskNow(taskId);

    return NextResponse.json({ task });
  } catch (error) {
    const message = error instanceof Error ? error.message : "执行任务失败。";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
