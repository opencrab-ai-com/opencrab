"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { TaskForm } from "@/components/tasks/task-form";
import {
  createTask,
  getTasks,
  runTask,
  updateTask,
} from "@/lib/resources/opencrab-api";
import type { TaskRecord } from "@/lib/resources/opencrab-api-types";

type FilterKey = "all" | "active" | "paused";

const TASK_TEMPLATES = [
  {
    id: "daily-summary",
    name: "每天整理产品日报",
    summary: "每天固定时间整理前一天的进展、问题和待办。",
    value: {
      name: "每天整理产品日报",
      prompt:
        "整理最近一天的产品进展，输出一份简洁的日报：今天完成了什么、卡在哪里、接下来建议做什么。",
      schedule: {
        preset: "daily" as const,
        time: "09:00",
      },
    },
  },
  {
    id: "weekly-review",
    name: "每周回顾项目进展",
    summary: "每周固定回顾本周成果、风险和下周优先级。",
    value: {
      name: "每周回顾项目进展",
      prompt:
        "回顾最近一周的项目进展，整理本周完成项、风险、未决问题，并给出下周最值得推进的三件事。",
      schedule: {
        preset: "weekly" as const,
        weekday: 1,
        time: "10:00",
      },
    },
  },
  {
    id: "follow-up",
    name: "工作日提醒跟进消息",
    summary: "工作日定时提醒需要跟进的用户或协作事项。",
    value: {
      name: "工作日提醒跟进消息",
      prompt:
        "检查最近待跟进的事项，整理一份简短提醒：有哪些人或事情需要继续推进，建议下一步动作是什么。",
      schedule: {
        preset: "weekdays" as const,
        time: "18:00",
      },
    },
  },
] as const;

export function TasksScreen() {
  const router = useRouter();
  const [tasks, setTasks] = useState<TaskRecord[]>([]);
  const [createFormKey, setCreateFormKey] = useState(0);
  const [createSeed, setCreateSeed] = useState<(typeof TASK_TEMPLATES)[number]["value"] | null>(null);
  const [filter, setFilter] = useState<FilterKey>("all");
  const [isLoading, setIsLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const [pendingTaskAction, setPendingTaskAction] = useState<string | null>(null);
  const [createMessage, setCreateMessage] = useState<string | null>(null);
  const [createMessageTone, setCreateMessageTone] = useState<"default" | "success" | "error">(
    "default",
  );
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const filteredTasks = useMemo(() => {
    if (filter === "all") {
      return tasks;
    }

    return tasks.filter((task) => task.status === filter);
  }, [filter, tasks]);

  const activeCount = tasks.filter((task) => task.status === "active").length;
  const pausedCount = tasks.filter((task) => task.status === "paused").length;
  const runningCount = tasks.filter((task) => task.isRunning).length;

  const loadTasks = useCallback(async (options?: { keepMessage?: boolean }) => {
    setIsLoading(true);
    if (!options?.keepMessage) {
      setErrorMessage(null);
    }

    try {
      const response = await getTasks();
      setTasks(sortTasks(response.tasks));
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "加载任务失败。");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadTasks();
  }, [loadTasks]);

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      void loadTasks({ keepMessage: true });
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
        throw new Error("创建任务失败。");
      }

      const createdTask = response.task;
      setTasks((current) =>
        sortTasks([createdTask, ...current.filter((task) => task.id !== createdTask.id)]),
      );
      setCreateSeed(null);
      setCreateFormKey((current) => current + 1);
      setCreateMessageTone("success");
      setCreateMessage("任务已创建。OpenCrab 会在到点后自动执行，也可以先点“立即执行”试一次。");
    } catch (error) {
      setCreateMessageTone("error");
      setCreateMessage(error instanceof Error ? error.message : "创建任务失败。");
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
        throw new Error("任务不存在。");
      }

      const updatedTask = response.task;
      setTasks((current) => reconcileTask(current, updatedTask));
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "更新任务失败。");
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
        throw new Error("任务不存在。");
      }

      const updatedTask = response.task;
      setTasks((current) => reconcileTask(current, updatedTask));
      setCreateMessageTone("success");
      setCreateMessage("任务已经开始执行。执行完成后，结果会自动回流到对应对话。");
      router.refresh();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "执行任务失败。");
    } finally {
      setPendingTaskAction(null);
    }
  }

  async function handleDuplicateTask(task: TaskRecord) {
    setPendingTaskAction(`${task.id}:duplicate`);
    setErrorMessage(null);

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

      const duplicatedTask = response.task;
      setTasks((current) =>
        sortTasks([duplicatedTask, ...current.filter((item) => item.id !== duplicatedTask.id)]),
      );
      setCreateMessageTone("success");
      setCreateMessage("任务已复制。你可以继续微调它的时间和内容。");
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "复制任务失败。");
    } finally {
      setPendingTaskAction(null);
    }
  }

  return (
    <div className="space-y-8">
      <section className="grid gap-4 md:grid-cols-3">
        <SummaryCard label="运行中" value={`${activeCount}`} helper="会按计划自动执行" />
        <SummaryCard label="执行中" value={`${runningCount}`} helper="当前正在处理任务" />
        <SummaryCard label="已暂停" value={`${pausedCount}`} helper="不会自动触发" />
      </section>

      <section className="rounded-[22px] border border-line bg-surface-muted px-5 py-4 text-[13px] leading-6 text-muted-strong">
        自动任务需要在 OpenCrab 运行时执行。你可以把它理解成“OpenCrab 开着时，到了时间会自己去做事”，执行结果会自动回流到一条专属对话里。
      </section>

      <section className="space-y-3">
        <div>
          <h2 className="text-[18px] font-semibold tracking-[-0.03em] text-text">常用模板</h2>
          <p className="mt-2 text-[14px] leading-6 text-muted-strong">
            如果你还不确定怎么写任务，可以先从一个模板开始，再按自己的场景微调。
          </p>
        </div>
        <div className="grid gap-4 xl:grid-cols-3">
          {TASK_TEMPLATES.map((template) => (
            <button
              key={template.id}
              type="button"
              onClick={() => {
                setCreateSeed(template.value);
                setCreateFormKey((current) => current + 1);
                setCreateMessage(null);
              }}
              className="rounded-[20px] border border-line bg-surface p-5 text-left shadow-soft transition hover:-translate-y-0.5 hover:border-text/20"
            >
              <div className="text-[16px] font-semibold tracking-[-0.02em] text-text">
                {template.name}
              </div>
              <p className="mt-2 text-[14px] leading-6 text-muted-strong">{template.summary}</p>
              <div className="mt-4 text-[13px] text-[#1a73e8]">使用这个模板</div>
            </button>
          ))}
        </div>
      </section>

      <TaskForm
        key={createFormKey}
        initialValue={createSeed}
        submitLabel="创建任务"
        isSubmitting={isCreating}
        message={createMessage}
        messageTone={createMessageTone}
        onSubmit={handleCreateTask}
      />

      <section className="rounded-[24px] border border-line bg-surface p-6 shadow-soft">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h2 className="text-[18px] font-semibold tracking-[-0.03em] text-text">任务列表</h2>
            <p className="mt-2 text-[14px] leading-6 text-muted-strong">
              每个任务都有自己的执行节奏和结果对话。你可以暂停、恢复，或者手动先跑一次确认效果。
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => void loadTasks({ keepMessage: true })}
              className="rounded-full border border-line bg-background px-4 py-2 text-[13px] text-muted-strong transition hover:border-text/20 hover:text-text"
            >
              刷新状态
            </button>
            {[
              ["all", "全部"],
              ["active", "运行中"],
              ["paused", "已暂停"],
            ].map(([key, label]) => (
              <button
                key={key}
                type="button"
                onClick={() => setFilter(key as FilterKey)}
                className={`rounded-full px-4 py-2 text-[13px] transition ${
                  filter === key
                    ? "bg-text text-white"
                    : "border border-line bg-background text-muted-strong hover:border-text/20 hover:text-text"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {errorMessage ? (
          <p className="mt-4 rounded-[16px] border border-[#f3d0cb] bg-[#fff3f1] px-4 py-3 text-[13px] text-[#b42318]">
            {errorMessage}
          </p>
        ) : null}

        <div className="mt-6 space-y-3">
          {isLoading ? (
            <EmptyPanel label="正在加载任务..." />
          ) : filteredTasks.length === 0 ? (
            <EmptyPanel
              label={
                tasks.length === 0
                  ? "还没有任务。先创建一个试试，比如“每天整理产品日报”。"
                  : "当前筛选条件下没有任务。"
              }
            />
          ) : (
            filteredTasks.map((task) => (
              <article
                key={task.id}
                className="rounded-[20px] border border-line bg-background px-5 py-5"
              >
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-3">
                      <Link
                        href={`/tasks/${task.id}`}
                        className="text-[18px] font-semibold tracking-[-0.03em] text-text transition hover:text-[#1a73e8]"
                      >
                        {task.name}
                      </Link>
                      <TaskStatusPill task={task} />
                    </div>
                    <p className="mt-2 max-w-[72ch] text-[14px] leading-6 text-muted-strong">
                      {task.prompt}
                    </p>
                    <div className="mt-4 grid gap-3 text-[13px] text-muted sm:grid-cols-3">
                      <div>执行节奏：{task.scheduleLabel}</div>
                      <div>下次执行：{task.nextRunLabel}</div>
                      <div>最近结果：{task.lastRunPreview || task.lastRunLabel}</div>
                    </div>
                    {task.lastRunStatus ? (
                      <div className="mt-3">
                        <LastRunPill status={task.lastRunStatus} />
                      </div>
                    ) : null}
                    {task.lastError ? (
                      <div className="mt-3 rounded-[14px] border border-[#f3d0cb] bg-[#fff3f1] px-3 py-2 text-[13px] text-[#b42318]">
                        最近失败：{task.lastError}
                      </div>
                    ) : null}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => void handleRunTask(task.id)}
                      disabled={pendingTaskAction !== null}
                      className="rounded-full bg-text px-4 py-2 text-[13px] font-medium text-white transition disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {pendingTaskAction === `${task.id}:run` ? "启动中..." : "立即执行"}
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        void handleToggleTask(task.id, task.status === "active" ? "paused" : "active")
                      }
                      disabled={pendingTaskAction !== null}
                      className="rounded-full border border-line bg-surface px-4 py-2 text-[13px] text-text transition hover:border-text/20 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {pendingTaskAction === `${task.id}:toggle`
                        ? "处理中..."
                        : task.status === "active"
                          ? "暂停"
                          : "恢复"}
                    </button>
                    <button
                      type="button"
                      onClick={() => void handleDuplicateTask(task)}
                      disabled={pendingTaskAction !== null}
                      className="rounded-full border border-line bg-surface px-4 py-2 text-[13px] text-text transition hover:border-text/20 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {pendingTaskAction === `${task.id}:duplicate` ? "复制中..." : "复制"}
                    </button>
                    {task.conversationId ? (
                      <Link
                        href={`/conversations/${task.conversationId}`}
                        className="rounded-full border border-line bg-surface px-4 py-2 text-[13px] text-text transition hover:border-text/20"
                      >
                        打开结果
                      </Link>
                    ) : null}
                  </div>
                </div>
              </article>
            ))
          )}
        </div>
      </section>
    </div>
  );
}

function SummaryCard({
  label,
  value,
  helper,
}: {
  label: string;
  value: string;
  helper: string;
}) {
  return (
    <div className="rounded-[22px] border border-line bg-surface p-5 shadow-soft">
      <div className="text-[12px] text-muted">{label}</div>
      <div className="mt-2 text-[32px] font-semibold tracking-[-0.05em] text-text">{value}</div>
      <div className="mt-2 text-[13px] text-muted-strong">{helper}</div>
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

function LastRunPill({ status }: { status: TaskRecord["lastRunStatus"] }) {
  if (!status) {
    return null;
  }

  const tone =
    status === "success"
      ? "bg-[#eef8f0] text-[#23633a]"
      : status === "error"
        ? "bg-[#fff3f1] text-[#b42318]"
        : "bg-[#eef3ff] text-[#285cc7]";

  return (
    <span className={`rounded-full px-3 py-1 text-[12px] font-medium ${tone}`}>
      {status === "success" ? "上次执行成功" : status === "error" ? "上次执行失败" : "上次执行中"}
    </span>
  );
}

function TaskStatusPill({ task }: { task: TaskRecord }) {
  const tone = task.isRunning
    ? "bg-[#eef3ff] text-[#285cc7]"
    : task.status === "active"
      ? "bg-[#eef8f0] text-[#23633a]"
      : "bg-[#f3f4f6] text-[#5f6368]";

  return (
    <span className={`rounded-full px-3 py-1 text-[12px] font-medium ${tone}`}>
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
