import { NextResponse } from "next/server";
import { ensureTaskRunner } from "@/lib/tasks/task-runner";
import { createTask, listTasks } from "@/lib/tasks/task-store";
import type { TaskCreateInput } from "@/lib/tasks/types";

export async function GET() {
  void ensureTaskRunner();

  return NextResponse.json({
    tasks: listTasks(),
  });
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as TaskCreateInput;
    const task = createTask(body);

    return NextResponse.json({
      task,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "创建任务失败。";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
