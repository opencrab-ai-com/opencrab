"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { TaskForm } from "@/components/tasks/task-form";
import { Button, buttonClassName } from "@/components/ui/button";
import {
  createTask,
  getTasks,
  runTask,
  updateTask,
} from "@/lib/resources/opencrab-api";
import type { TaskRecord } from "@/lib/resources/opencrab-api-types";

type TaskTemplate = {
  id: string;
  name: string;
  summary: string;
  prompt: string;
  schedule: TaskRecord["schedule"];
  accentClassName: string;
};

const TASK_TEMPLATES: TaskTemplate[] = [
  {
    id: "daily-brief",
    name: "每日简报",
    summary: "每天固定整理最新进展，输出一份简洁摘要和待办建议。",
    prompt:
      "每天按时整理最近一天的重要进展，输出一份简洁简报，包含：关键进展、待跟进事项、风险提醒。",
    schedule: {
      preset: "daily",
      time: "09:00",
    },
    accentClassName: "from-[#f3f8ff] to-[#eef5ff]",
  },
  {
    id: "weekday-follow-up",
    name: "工作日跟进",
    summary: "工作日固定检查事项推进情况，提醒需要继续处理的内容。",
    prompt:
      "每个工作日检查当前事项推进状态，列出需要继续跟进、等待回复或已经阻塞的项目，并给出下一步建议。",
    schedule: {
      preset: "weekdays",
      time: "18:00",
    },
    accentClassName: "from-[#f7f8f3] to-[#f2f5ea]",
  },
  {
    id: "weekly-review",
    name: "每周回顾",
    summary: "每周固定回顾本周成果、问题和下周重点。",
    prompt:
      "每周定时回顾本周完成的工作、未完成事项和主要问题，并整理出下周最值得优先推进的重点。",
    schedule: {
      preset: "weekly",
      time: "10:00",
      weekday: 1,
    },
    accentClassName: "from-[#fff8ef] to-[#fff3e2]",
  },
];

export function TasksScreen() {
  const [tasks, setTasks] = useState<TaskRecord[]>([]);
  const [createFormKey, setCreateFormKey] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [pendingTaskAction, setPendingTaskAction] = useState<string | null>(null);
  const [createMessage, setCreateMessage] = useState<string | null>(null);
  const [createMessageTone, setCreateMessageTone] = useState<"default" | "success" | "error">(
    "default",
  );
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(TASK_TEMPLATES[0]?.id || null);
  const [showCreateForm, setShowCreateForm] = useState(false);

  const selectedTemplate =
    TASK_TEMPLATES.find((template) => template.id === selectedTemplateId) || null;

  const loadTasks = useCallback(
    async ({ silent = false }: { silent?: boolean } = {}) => {
      if (silent) {
        setIsRefreshing(true);
      } else {
        setIsLoading(true);
      }
      setErrorMessage(null);

      try {
        const response = await getTasks();
        setTasks(sortTasks(response.tasks));
      } catch (error) {
        setErrorMessage(error instanceof Error ? error.message : "加载定时任务失败。");
      } finally {
        if (silent) {
          setIsRefreshing(false);
          return;
        }

        setIsLoading(false);
      }
    },
    [],
  );

  useEffect(() => {
    void loadTasks();
  }, [loadTasks]);

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      if (document.hidden) {
        return;
      }

      void loadTasks({ silent: true });
    }, 15000);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [loadTasks]);

  async function handleCreateTask(input: {
    name: string;
    prompt: string;
    timezone: string | null;
    schedule: TaskRecord["schedule"];
  }) {
    setIsCreating(true);
    setCreateMessage(null);
    setErrorMessage(null);

    try {
      const response = await createTask(input);

      if (!response.task) {
        throw new Error("创建定时任务失败。");
      }

      const createdTask = response.task;
      setTasks((current) => reconcileTask(current, createdTask));
      setCreateFormKey((current) => current + 1);
      setCreateMessageTone("success");
      setCreateMessage("定时任务已创建。OpenCrab 会按这个时间自动执行。");
      setShowCreateForm(false);
    } catch (error) {
      setCreateMessageTone("error");
      setCreateMessage(error instanceof Error ? error.message : "创建定时任务失败。");
      setShowCreateForm(true);
    } finally {
      setIsCreating(false);
    }
  }

  async function handleToggleTask(taskId: string, nextStatus: "active" | "paused") {
    setPendingTaskAction(`${taskId}:toggle`);
    setErrorMessage(null);

    try {
      const response = await updateTask(taskId, { status: nextStatus });

      if (!response.task) {
        throw new Error("定时任务不存在。");
      }

      const updatedTask = response.task;
      setTasks((current) => reconcileTask(current, updatedTask));
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "更新定时任务失败。");
    } finally {
      setPendingTaskAction(null);
    }
  }

  async function handleRunTask(taskId: string) {
    setPendingTaskAction(`${taskId}:run`);
    setErrorMessage(null);

    try {
      const response = await runTask(taskId);

      if (!response.task) {
        throw new Error("定时任务不存在。");
      }

      const updatedTask = response.task;
      setTasks((current) => reconcileTask(current, updatedTask));
      setCreateMessageTone("success");
      setCreateMessage("定时任务已经开始执行，结果会自动回流到对应对话。");
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "执行定时任务失败。");
    } finally {
      setPendingTaskAction(null);
    }
  }

  function handleUseTemplate(templateId: string) {
    setSelectedTemplateId(templateId);
    setShowCreateForm(true);
    setCreateMessage(null);
  }

  function handleCustomTask() {
    setSelectedTemplateId(null);
    setShowCreateForm(true);
    setCreateMessage(null);
  }

  return (
    <div className="space-y-5">
      <section className="rounded-[24px] border border-line bg-surface p-5 shadow-soft">
        <div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h2 className="text-[18px] font-semibold tracking-[-0.03em] text-text">推荐模板</h2>
            <p className="mt-1 text-[13px] leading-6 text-muted-strong">
              先从常用定时任务开始。选一个模板，稍微改几句就能直接启用。
            </p>
          </div>
          <Button
            onClick={handleCustomTask}
            variant="secondary"
          >
            自定义定时任务
          </Button>
        </div>

        <div className="mt-4 grid gap-3 lg:grid-cols-3">
          {TASK_TEMPLATES.map((template) => {
            const isActive = selectedTemplateId === template.id;

            return (
              <article
                key={template.id}
                className={`rounded-[20px] border p-4 shadow-soft transition ${
                  isActive
                    ? "border-text/20 bg-surface"
                    : "border-line bg-background hover:border-text/20"
                }`}
              >
                <div className={`rounded-[16px] bg-gradient-to-br ${template.accentClassName} px-4 py-3`}>
                  <div className="text-[11px] uppercase tracking-[0.14em] text-muted">模板</div>
                  <h3 className="mt-2 text-[18px] font-semibold tracking-[-0.04em] text-text">
                    {template.name}
                  </h3>
                  <p className="mt-2 line-clamp-2 text-[13px] leading-6 text-muted-strong">
                    {template.summary}
                  </p>
                </div>
                <div className="mt-3 flex items-center justify-between gap-3">
                  <div className="text-[12px] text-muted">默认节奏：{formatTemplateSchedule(template)}</div>
                  <Button
                    onClick={() => handleUseTemplate(template.id)}
                    variant="primary"
                  >
                    使用模板
                  </Button>
                </div>
              </article>
            );
          })}
        </div>

        {showCreateForm ? (
          <div className="mt-5">
            <TaskForm
              key={`${createFormKey}:${selectedTemplateId || "custom"}`}
              title={selectedTemplate ? `新建定时任务 · ${selectedTemplate.name}` : "新建自定义定时任务"}
              description={
                selectedTemplate
                  ? "模板内容已经帮你填好了，你只需要按自己的节奏微调。"
                  : "告诉 OpenCrab 要做什么、什么时候做，就够了。"
              }
              initialValue={
                selectedTemplate
                  ? {
                      name: selectedTemplate.name,
                      prompt: selectedTemplate.prompt,
                      schedule: selectedTemplate.schedule,
                    }
                  : null
              }
              submitLabel="创建定时任务"
              isSubmitting={isCreating}
              message={createMessage}
              messageTone={createMessageTone}
              onSubmit={handleCreateTask}
            />
          </div>
        ) : null}
      </section>

      <section className="rounded-[24px] border border-line bg-surface p-5 shadow-soft">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-[18px] font-semibold tracking-[-0.03em] text-text">已有定时任务</h2>
            <p className="mt-1 text-[13px] leading-6 text-muted-strong">
              这里保留最常用的动作：查看、立即执行、暂停或恢复。
            </p>
          </div>
          <Button
            onClick={() => void loadTasks({ silent: true })}
            variant="secondary"
            disabled={isRefreshing}
          >
            {isRefreshing ? "刷新中..." : "刷新"}
          </Button>
        </div>

        {errorMessage ? (
          <p className="mt-4 rounded-[16px] border border-[#f3d0cb] bg-[#fff3f1] px-4 py-3 text-[13px] text-[#b42318]">
            {errorMessage}
          </p>
        ) : null}

        <div className="mt-5">
          {isLoading ? (
            <EmptyPanel label="正在加载定时任务..." />
          ) : tasks.length === 0 ? (
            <EmptyPanel label="还没有定时任务。先选一个模板试试。" />
          ) : (
            <div className="grid gap-3 lg:grid-cols-3">
              {tasks.map((task) => (
                <article
                  key={task.id}
                  className="flex h-full flex-col rounded-[20px] border border-line bg-background p-4"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <Link
                        href={`/tasks/${task.id}`}
                        className="line-clamp-2 text-[17px] font-semibold tracking-[-0.03em] text-text transition hover:text-[#1a73e8]"
                      >
                        {task.name}
                      </Link>
                    </div>
                    <TaskStatusPill task={task} />
                  </div>

                  <p className="mt-2 line-clamp-2 text-[13px] leading-6 text-muted-strong">
                    {task.prompt}
                  </p>

                  <div className="mt-4 grid gap-2 rounded-[16px] border border-line bg-surface px-3 py-3 text-[12px] text-muted">
                    <div className="flex items-center justify-between gap-3">
                      <span>执行节奏</span>
                      <span className="text-right text-text">{task.scheduleLabel}</span>
                    </div>
                    <div className="flex items-center justify-between gap-3">
                      <span>下次执行</span>
                      <span className="text-right text-text">{task.nextRunLabel}</span>
                    </div>
                    {task.lastRunStatus ? (
                      <div className="flex items-center justify-between gap-3">
                        <span>最近结果</span>
                        <span className="text-right text-text">
                          {task.lastRunStatus === "success"
                            ? "成功"
                            : task.lastRunStatus === "error"
                              ? "失败"
                              : "执行中"}
                        </span>
                      </div>
                    ) : null}
                  </div>

                  {task.lastError ? (
                    <div className="mt-3 rounded-[14px] border border-[#f3d0cb] bg-[#fff3f1] px-3 py-2 text-[12px] text-[#b42318]">
                      最近失败：{task.lastError}
                    </div>
                  ) : null}

                  <div className="mt-4 flex flex-wrap gap-2">
                    <Button
                      onClick={() => void handleRunTask(task.id)}
                      disabled={pendingTaskAction !== null}
                      variant="primary"
                    >
                      {pendingTaskAction === `${task.id}:run` ? "启动中..." : "立即执行"}
                    </Button>
                    <Button
                      onClick={() =>
                        void handleToggleTask(task.id, task.status === "active" ? "paused" : "active")
                      }
                      disabled={pendingTaskAction !== null}
                      variant="secondary"
                    >
                      {pendingTaskAction === `${task.id}:toggle`
                        ? "处理中..."
                        : task.status === "active"
                          ? "暂停"
                          : "恢复"}
                    </Button>
                    <Link
                      href={`/tasks/${task.id}`}
                      className={buttonClassName({ variant: "secondary" })}
                    >
                      查看
                    </Link>
                    {task.conversationId ? (
                      <Link
                        href={`/conversations/${task.conversationId}`}
                        className={buttonClassName({ variant: "secondary" })}
                      >
                        打开结果
                      </Link>
                    ) : null}
                  </div>
                </article>
              ))}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}

function EmptyPanel({ label }: { label: string }) {
  return (
    <div className="rounded-[18px] border border-dashed border-line bg-surface-muted px-5 py-8 text-[14px] text-muted-strong">
      {label}
    </div>
  );
}

function TaskStatusPill({ task }: { task: TaskRecord }) {
  const tone = task.isRunning
    ? "bg-[#eef3ff] text-[#285cc7]"
    : task.status === "active"
      ? "bg-[#eef8f0] text-[#23633a]"
      : "bg-[#f3f4f6] text-[#5f6368]";

  return (
    <span className={`shrink-0 rounded-full px-3 py-1 text-[12px] font-medium ${tone}`}>
      {task.isRunning ? "执行中" : task.status === "active" ? "运行中" : "已暂停"}
    </span>
  );
}

function reconcileTask(current: TaskRecord[], nextTask: TaskRecord) {
  return sortTasks([nextTask, ...current.filter((task) => task.id !== nextTask.id)]);
}

function sortTasks(tasks: TaskRecord[]) {
  return [...tasks].sort((left, right) => {
    const leftWeight = left.isRunning ? 0 : left.status === "active" ? 1 : 2;
    const rightWeight = right.isRunning ? 0 : right.status === "active" ? 1 : 2;

    if (leftWeight !== rightWeight) {
      return leftWeight - rightWeight;
    }

    const leftTime = Date.parse(left.nextRunAt || left.updatedAt);
    const rightTime = Date.parse(right.nextRunAt || right.updatedAt);

    if (Number.isNaN(leftTime) && Number.isNaN(rightTime)) {
      return Date.parse(right.updatedAt) - Date.parse(left.updatedAt);
    }

    if (Number.isNaN(leftTime)) {
      return 1;
    }

    if (Number.isNaN(rightTime)) {
      return -1;
    }

    return leftTime - rightTime;
  });
}

function formatTemplateSchedule(template: TaskTemplate) {
  const schedule = template.schedule;

  if (schedule.preset === "weekly") {
    const weekday = ["周日", "周一", "周二", "周三", "周四", "周五", "周六"][schedule.weekday ?? 1];
    return `${weekday} ${schedule.time || "09:00"}`;
  }

  if (schedule.preset === "weekdays") {
    return `工作日 ${schedule.time || "18:00"}`;
  }

  if (schedule.preset === "interval") {
    return `每隔 ${schedule.intervalHours || 6} 小时`;
  }

  return `每天 ${schedule.time || "09:00"}`;
}
