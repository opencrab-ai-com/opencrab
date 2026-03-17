import { NextResponse } from "next/server";
import { deleteTask, getTask, updateTask } from "@/lib/tasks/task-store";
import type { TaskUpdateInput } from "@/lib/tasks/types";

export async function GET(
  _request: Request,
  context: { params: Promise<{ taskId: string }> },
) {
  const { taskId } = await context.params;
  const task = getTask(taskId);

  if (!task) {
    return NextResponse.json({ error: "任务不存在。" }, { status: 404 });
  }

  return NextResponse.json({ task });
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ taskId: string }> },
) {
  const { taskId } = await context.params;

  try {
    const body = (await request.json()) as TaskUpdateInput;
    const task = updateTask(taskId, body);

    if (!task) {
      return NextResponse.json({ error: "任务不存在。" }, { status: 404 });
    }

    return NextResponse.json({ task: getTask(taskId) });
  } catch (error) {
    const message = error instanceof Error ? error.message : "更新任务失败。";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ taskId: string }> },
) {
  const { taskId } = await context.params;

  if (!getTask(taskId)) {
    return NextResponse.json({ error: "任务不存在。" }, { status: 404 });
  }

  deleteTask(taskId);

  return NextResponse.json({ ok: true });
}
