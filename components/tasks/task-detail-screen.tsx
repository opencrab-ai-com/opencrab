"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { TaskForm } from "@/components/tasks/task-form";
import { Button, buttonClassName } from "@/components/ui/button";
import { StatusPill as UnifiedStatusPill } from "@/components/ui/pill";
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
      setMessage(error instanceof Error ? error.message : "加载定时任务失败。");
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
        throw new Error("定时任务不存在。");
      }

      setTask(response.task);
      setMessageTone("success");
      setMessage("定时任务设置已保存。");
    } catch (error) {
      setMessageTone("error");
      setMessage(error instanceof Error ? error.message : "保存定时任务失败。");
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
        throw new Error("定时任务不存在。");
      }

      setTask(response.task);
      setMessageTone("success");
      setMessage(getRunStartedMessage(response.task));
      router.refresh();
    } catch (error) {
      setMessageTone("error");
      setMessage(error instanceof Error ? error.message : "执行定时任务失败。");
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
        throw new Error("定时任务不存在。");
      }

      setTask(response.task);
      setMessageTone("success");
      setMessage(task.status === "active" ? "定时任务已暂停。" : "定时任务已恢复自动执行。");
    } catch (error) {
      setMessageTone("error");
      setMessage(error instanceof Error ? error.message : "更新定时任务失败。");
    } finally {
      setPendingAction(null);
    }
  }

  async function handleDelete() {
    const confirmed = window.confirm("删除后会同时清空这条定时任务的执行记录。确定要删除吗？");

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
      setMessage(error instanceof Error ? error.message : "删除定时任务失败。");
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
        conversationId: task.conversationId,
        projectId: task.projectId,
      });

      if (!response.task) {
        throw new Error("复制定时任务失败。");
      }

      router.push(`/tasks/${response.task.id}`);
      router.refresh();
    } catch (error) {
      setPendingAction(null);
      setMessageTone("error");
      setMessage(error instanceof Error ? error.message : "复制定时任务失败。");
    }
  }

  if (isLoading) {
    return (
        <div className="rounded-[24px] border border-line bg-surface p-6 shadow-soft text-[14px] text-muted-strong">
        正在加载定时任务...
      </div>
    );
  }

  if (!task) {
    return (
        <div className="rounded-[24px] border border-line bg-surface p-6 shadow-soft text-[14px] text-muted-strong">
        这个定时任务不存在，可能已经被删除。
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
            返回定时任务列表
          </Link>
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <h1 className="text-[28px] font-semibold tracking-[-0.04em] text-text">{task.name}</h1>
            <UnifiedStatusPill
              tone={task.isRunning ? "info" : task.status === "active" ? "success" : "neutral"}
            >
              {task.isRunning ? "执行中" : task.status === "active" ? "运行中" : "已暂停"}
            </UnifiedStatusPill>
          </div>
          <p className="mt-3 max-w-[72ch] text-[14px] leading-7 text-muted-strong">{task.prompt}</p>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button
            onClick={() => void loadTask()}
            disabled={pendingAction !== null}
            variant="secondary"
          >
            刷新状态
          </Button>
          <Button
            onClick={() => void handleRun()}
            disabled={pendingAction !== null}
            variant="primary"
          >
            {pendingAction === "run" ? "启动中..." : "立即执行"}
          </Button>
          <Button
            onClick={() => void handleDuplicate()}
            disabled={pendingAction !== null}
            variant="secondary"
          >
            {pendingAction === "duplicate" ? "复制中..." : "复制定时任务"}
          </Button>
          <Button
            onClick={() => void handleToggle()}
            disabled={pendingAction !== null}
            variant="secondary"
          >
            {pendingAction === "toggle" ? "处理中..." : task.status === "active" ? "暂停定时任务" : "恢复定时任务"}
          </Button>
          <Button
            onClick={() => void handleDelete()}
            disabled={pendingAction !== null}
            variant="danger"
          >
            {pendingAction === "delete" ? "删除中..." : "删除定时任务"}
          </Button>
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
              每个定时任务都会把执行结果回流到绑定的工作空间里。你可以继续追问、接着处理，或者检查团队推进状态。
            </p>
            <div className="mt-4 rounded-[18px] border border-line bg-background px-4 py-4 text-[14px] text-text">
              {task.project ? (
                <div className="space-y-2">
                  <div>{task.project.title}</div>
                  <p className="text-[13px] leading-6 text-muted-strong">
                    执行结果会更新到 Team Room 的运行记录、事件流和结果面板里。
                  </p>
                  <Link
                    href={`/projects/${task.project.id}`}
                    className={buttonClassName({ variant: "ghost", size: "sm", className: "px-0 text-[#1a73e8] hover:bg-transparent hover:underline" })}
                  >
                    打开团队房间
                  </Link>
                </div>
              ) : task.conversation ? (
                <div className="space-y-2">
                  <div>{task.conversation.title}</div>
                  <Link
                    href={`/conversations/${task.conversation.id}`}
                    className={buttonClassName({ variant: "ghost", size: "sm", className: "px-0 text-[#1a73e8] hover:bg-transparent hover:underline" })}
                  >
                    打开结果对话
                  </Link>
                </div>
              ) : (
                <div className="text-muted-strong">还没有生成结果空间。先执行一次，这里就会出现。</div>
              )}
            </div>
          </section>

          <section className="rounded-[24px] border border-line bg-surface p-6 shadow-soft">
            <h2 className="text-[18px] font-semibold tracking-[-0.03em] text-text">最近执行记录</h2>
            <div className="mt-4 space-y-3">
              {task.runs.length === 0 ? (
                <div className="rounded-[18px] border border-dashed border-line bg-surface-muted px-4 py-6 text-[14px] text-muted-strong">
                  还没有执行记录。可以先点一次“立即执行”看看这个定时任务的效果。
                </div>
              ) : (
                task.runs.map((run) => (
                  <article
                    key={run.id}
                    className="rounded-[18px] border border-line bg-background px-4 py-4"
                  >
                    <div className="flex flex-wrap items-center gap-3">
                      <UnifiedStatusPill
                        tone={
                          run.status === "success"
                            ? "success"
                            : run.status === "error"
                              ? "danger"
                              : "info"
                        }
                        size="sm"
                      >
                        {run.status === "success"
                          ? "成功"
                          : run.status === "error"
                            ? "失败"
                            : "进行中"}
                      </UnifiedStatusPill>
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

function getRunStartedMessage(task: TaskDetail) {
  if (task.projectId) {
    return "定时任务已经开始执行。执行完成后，结果会更新到对应团队房间。";
  }

  return "定时任务已经开始执行。执行完成后，结果会自动回流到对应对话。";
}

function InfoCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[18px] border border-line bg-surface px-4 py-4 shadow-soft">
      <div className="text-[12px] text-muted">{label}</div>
      <div className="mt-2 text-[15px] leading-6 text-text">{value}</div>
    </div>
  );
}
