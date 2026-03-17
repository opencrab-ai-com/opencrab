"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { TaskForm } from "@/components/tasks/task-form";
import {
  createTask,
  deleteTask,
  getTaskDetail,
  runTask,
  updateTask,
} from "@/lib/resources/opencrab-api";
import type { TaskDetail } from "@/lib/resources/opencrab-api-types";

export function TaskDetailScreen({ taskId }: { taskId: string }) {
  const router = useRouter();
  const [task, setTask] = useState<TaskDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [pendingAction, setPendingAction] = useState<
    "run" | "toggle" | "duplicate" | "delete" | null
  >(null);
  const [message, setMessage] = useState<string | null>(null);
  const [messageTone, setMessageTone] = useState<"default" | "success" | "error">("default");

  const loadTask = useCallback(async () => {
    setIsLoading(true);
    setMessage(null);

    try {
      const response = await getTaskDetail(taskId);
      setTask(response.task);
    } catch (error) {
      setMessageTone("error");
      setMessage(error instanceof Error ? error.message : "加载任务失败。");
    } finally {
      setIsLoading(false);
    }
  }, [taskId]);

  useEffect(() => {
    void loadTask();
  }, [loadTask]);

  useEffect(() => {
    if (!task?.isRunning) {
      return;
    }

    const intervalId = window.setInterval(() => {
      void loadTask();
    }, 5000);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [loadTask, task?.isRunning]);

  async function handleSave(input: {
    name: string;
    prompt: string;
    timezone: string | null;
    schedule: TaskDetail["schedule"];
  }) {
    setIsSaving(true);
    setMessage(null);

    try {
      const response = await updateTask(taskId, input);

      if (!response.task) {
        throw new Error("任务不存在。");
      }

      setTask(response.task);
      setMessageTone("success");
      setMessage("任务设置已保存。");
    } catch (error) {
      setMessageTone("error");
      setMessage(error instanceof Error ? error.message : "保存任务失败。");
    } finally {
      setIsSaving(false);
    }
  }

  async function handleRun() {
    setPendingAction("run");
    setMessage(null);

    try {
      const response = await runTask(taskId);

      if (!response.task) {
        throw new Error("任务不存在。");
      }

      setTask(response.task);
      setMessageTone("success");
      setMessage("任务已经开始执行。执行完成后，结果会自动回流到对应对话。");
      router.refresh();
    } catch (error) {
      setMessageTone("error");
      setMessage(error instanceof Error ? error.message : "执行任务失败。");
    } finally {
      setPendingAction(null);
    }
  }

  async function handleToggle() {
    if (!task) {
      return;
    }

    setPendingAction("toggle");
    setMessage(null);

    try {
      const response = await updateTask(taskId, {
        status: task.status === "active" ? "paused" : "active",
      });

      if (!response.task) {
        throw new Error("任务不存在。");
      }

      setTask(response.task);
      setMessageTone("success");
      setMessage(task.status === "active" ? "任务已暂停。" : "任务已恢复自动执行。");
    } catch (error) {
      setMessageTone("error");
      setMessage(error instanceof Error ? error.message : "更新任务失败。");
    } finally {
      setPendingAction(null);
    }
  }

  async function handleDelete() {
    const confirmed = window.confirm("删除后会同时清空这条任务的执行记录。确定要删除吗？");

    if (!confirmed) {
      return;
    }

    setPendingAction("delete");
    setMessage(null);

    try {
      await deleteTask(taskId);
      router.push("/tasks");
      router.refresh();
    } catch (error) {
      setPendingAction(null);
      setMessageTone("error");
      setMessage(error instanceof Error ? error.message : "删除任务失败。");
    }
  }

  async function handleDuplicate() {
    if (!task) {
      return;
    }

    setPendingAction("duplicate");
    setMessage(null);

    try {
      const response = await createTask({
        name: `${task.name} 副本`,
        prompt: task.prompt,
        timezone: task.timezone,
        schedule: task.schedule,
      });

      if (!response.task) {
        throw new Error("复制任务失败。");
      }

      router.push(`/tasks/${response.task.id}`);
      router.refresh();
    } catch (error) {
      setPendingAction(null);
      setMessageTone("error");
      setMessage(error instanceof Error ? error.message : "复制任务失败。");
    }
  }

  if (isLoading) {
    return (
      <div className="rounded-[24px] border border-line bg-surface p-6 shadow-soft text-[14px] text-muted-strong">
        正在加载任务...
      </div>
    );
  }

  if (!task) {
    return (
      <div className="rounded-[24px] border border-line bg-surface p-6 shadow-soft text-[14px] text-muted-strong">
        这个任务不存在，可能已经被删除。
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 rounded-[28px] border border-line bg-surface p-6 shadow-soft lg:flex-row lg:items-start lg:justify-between">
        <div>
          <Link
            href="/tasks"
            className="text-[13px] text-muted transition hover:text-text"
          >
            返回任务列表
          </Link>
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <h1 className="text-[28px] font-semibold tracking-[-0.04em] text-text">{task.name}</h1>
            <span
              className={`rounded-full px-3 py-1 text-[12px] font-medium ${
                task.isRunning
                  ? "bg-[#eef3ff] text-[#285cc7]"
                  : task.status === "active"
                    ? "bg-[#eef8f0] text-[#23633a]"
                    : "bg-[#f3f4f6] text-[#5f6368]"
              }`}
            >
              {task.isRunning ? "执行中" : task.status === "active" ? "运行中" : "已暂停"}
            </span>
          </div>
          <p className="mt-3 max-w-[72ch] text-[14px] leading-7 text-muted-strong">{task.prompt}</p>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => void loadTask()}
            disabled={pendingAction !== null}
            className="rounded-full border border-line bg-background px-4 py-2 text-[13px] text-text transition hover:border-text/20 disabled:cursor-not-allowed disabled:opacity-60"
          >
            刷新状态
          </button>
          <button
            type="button"
            onClick={() => void handleRun()}
            disabled={pendingAction !== null}
            className="rounded-full bg-text px-4 py-2 text-[13px] font-medium text-white transition disabled:cursor-not-allowed disabled:opacity-60"
          >
            {pendingAction === "run" ? "启动中..." : "立即执行"}
          </button>
          <button
            type="button"
            onClick={() => void handleDuplicate()}
            disabled={pendingAction !== null}
            className="rounded-full border border-line bg-background px-4 py-2 text-[13px] text-text transition hover:border-text/20 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {pendingAction === "duplicate" ? "复制中..." : "复制任务"}
          </button>
          <button
            type="button"
            onClick={() => void handleToggle()}
            disabled={pendingAction !== null}
            className="rounded-full border border-line bg-background px-4 py-2 text-[13px] text-text transition hover:border-text/20 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {pendingAction === "toggle" ? "处理中..." : task.status === "active" ? "暂停任务" : "恢复任务"}
          </button>
          <button
            type="button"
            onClick={() => void handleDelete()}
            disabled={pendingAction !== null}
            className="rounded-full border border-[#f3d0cb] bg-[#fff8f7] px-4 py-2 text-[13px] text-[#b42318] transition disabled:cursor-not-allowed disabled:opacity-60"
          >
            {pendingAction === "delete" ? "删除中..." : "删除任务"}
          </button>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[0.92fr_1.08fr]">
        <section className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-2">
            <InfoCard label="执行节奏" value={task.scheduleLabel} />
            <InfoCard label="下次执行" value={task.nextRunLabel} />
            <InfoCard label="最近执行" value={task.lastRunLabel} />
            <InfoCard label="运行记录" value={`${task.runCount} 次`} />
          </div>

          <section className="rounded-[24px] border border-line bg-surface p-6 shadow-soft">
            <h2 className="text-[18px] font-semibold tracking-[-0.03em] text-text">结果回流</h2>
            <p className="mt-2 text-[14px] leading-6 text-muted-strong">
              每个任务都会把执行结果回流到自己的一条专属对话里，方便你继续追问和接着处理。
            </p>
            <div className="mt-4 rounded-[18px] border border-line bg-background px-4 py-4 text-[14px] text-text">
              {task.conversation ? (
                <div className="space-y-2">
                  <div>{task.conversation.title}</div>
                  <Link
                    href={`/conversations/${task.conversation.id}`}
                    className="text-[13px] text-[#1a73e8] transition hover:underline"
                  >
                    打开结果对话
                  </Link>
                </div>
              ) : (
                <div className="text-muted-strong">还没有生成结果对话。先执行一次，这里就会出现。</div>
              )}
            </div>
          </section>

          <section className="rounded-[24px] border border-line bg-surface p-6 shadow-soft">
            <h2 className="text-[18px] font-semibold tracking-[-0.03em] text-text">最近执行记录</h2>
            <div className="mt-4 space-y-3">
              {task.runs.length === 0 ? (
                <div className="rounded-[18px] border border-dashed border-line bg-surface-muted px-4 py-6 text-[14px] text-muted-strong">
                  还没有执行记录。可以先点一次“立即执行”看看效果。
                </div>
              ) : (
                task.runs.map((run) => (
                  <article
                    key={run.id}
                    className="rounded-[18px] border border-line bg-background px-4 py-4"
                  >
                    <div className="flex flex-wrap items-center gap-3">
                      <span
                        className={`rounded-full px-2.5 py-1 text-[11px] ${
                          run.status === "success"
                            ? "bg-[#eef8f0] text-[#23633a]"
                            : run.status === "error"
                              ? "bg-[#fff3f1] text-[#b42318]"
                              : "bg-[#eef3ff] text-[#285cc7]"
                        }`}
                      >
                        {run.status === "success"
                          ? "成功"
                          : run.status === "error"
                            ? "失败"
                            : "进行中"}
                      </span>
                      <span className="text-[13px] text-muted">
                        {new Intl.DateTimeFormat("zh-CN", {
                          month: "numeric",
                          day: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        }).format(new Date(run.startedAt))}
                      </span>
                    </div>
                    <div className="mt-3 text-[14px] leading-6 text-muted-strong">
                      {run.summary || run.errorMessage || "正在执行中..."}
                    </div>
                  </article>
                ))
              )}
            </div>
          </section>
        </section>

        <TaskForm
          key={`${task.id}:${task.updatedAt}`}
          initialTask={task}
          submitLabel="保存设置"
          isSubmitting={isSaving}
          message={message}
          messageTone={messageTone}
          onSubmit={handleSave}
        />
      </div>
    </div>
  );
}

function InfoCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[18px] border border-line bg-surface px-4 py-4 shadow-soft">
      <div className="text-[12px] text-muted">{label}</div>
      <div className="mt-2 text-[15px] leading-6 text-text">{value}</div>
    </div>
  );
}
