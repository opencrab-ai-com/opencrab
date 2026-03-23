import { getProjectDetail } from "@/lib/projects/project-store";
import { getSnapshot } from "@/lib/resources/local-store";
import { OPENCRAB_TASKS_STORE_PATH } from "@/lib/resources/runtime-paths";
import { createSyncJsonFileStore } from "@/lib/infrastructure/json-store/sync-json-file-store";
import type {
  TaskCreateInput,
  TaskDetail,
  TaskOverview,
  TaskRecord,
  TaskRunRecord,
  TaskSchedule,
  TaskStatus,
  TaskStoreState,
  TaskUpdateInput,
} from "@/lib/tasks/types";

const STORE_PATH = OPENCRAB_TASKS_STORE_PATH;
const MAX_RUNS = 120;
const MAX_RUNS_PER_TASK = 20;
const store = createSyncJsonFileStore<TaskStoreState>({
  filePath: STORE_PATH,
  seed: createSeedState,
  normalize: normalizeState,
});

export function listTasks(): TaskOverview[] {
  const state = readState();

  return state.tasks.map((task) => buildTaskOverview(task, state.runs));
}

export function getTask(taskId: string): TaskDetail | null {
  const state = readState();
  const task = state.tasks.find((item) => item.id === taskId);

  if (!task) {
    return null;
  }

  const snapshot = getSnapshot();
  const conversation = task.conversationId
    ? snapshot.conversations.find((item) => item.id === task.conversationId) ?? null
    : null;
  const project = task.projectId ? getProjectDetail(task.projectId)?.project ?? null : null;
  const runs = state.runs
    .filter((run) => run.taskId === taskId)
    .sort((left, right) => Date.parse(right.startedAt) - Date.parse(left.startedAt))
    .slice(0, MAX_RUNS_PER_TASK);

  return {
    ...buildTaskOverview(task, state.runs),
    conversation,
    project,
    runs,
  };
}

export function createTask(input: TaskCreateInput) {
  const now = new Date();
  const normalized = normalizeTaskInput(input);
  const task: TaskRecord = {
    id: `task-${crypto.randomUUID()}`,
    name: normalized.name,
    prompt: normalized.prompt,
    timezone: normalized.timezone,
    schedule: normalized.schedule,
    status: "active",
    isRunning: false,
    conversationId: normalized.conversationId,
    projectId: normalized.projectId,
    nextRunAt: calculateNextRunAt(normalized.schedule, now),
    lastRunAt: null,
    lastRunStatus: null,
    lastRunPreview: null,
    lastError: null,
    createdAt: now.toISOString(),
    updatedAt: now.toISOString(),
  };

  mutateState((state) => {
    state.tasks = [task, ...state.tasks];
  });

  return getTask(task.id);
}

export function updateTask(taskId: string, patch: TaskUpdateInput) {
  return mutateState((state) => {
    const current = state.tasks.find((item) => item.id === taskId);

    if (!current) {
      return null;
    }

    const nextConversationId =
      patch.conversationId !== undefined
        ? patch.conversationId
        : patch.projectId !== undefined && patch.projectId !== null
          ? null
          : current.conversationId;
    const nextProjectId =
      patch.projectId !== undefined
        ? patch.projectId
        : patch.conversationId !== undefined && patch.conversationId !== null
          ? null
          : current.projectId;
    const normalized = normalizeTaskInput({
      name: patch.name ?? current.name,
      prompt: patch.prompt ?? current.prompt,
      timezone: patch.timezone ?? current.timezone,
      schedule: patch.schedule ?? current.schedule,
      conversationId: nextConversationId,
      projectId: nextProjectId,
    });
    const nextStatus = patch.status ?? current.status;
    const shouldRecalculateNextRun =
      patch.status === "active" ||
      Boolean(patch.schedule) ||
      typeof patch.timezone === "string" ||
      typeof patch.name === "string" ||
      typeof patch.prompt === "string";

    const nextTask: TaskRecord = {
      ...current,
      name: normalized.name,
      prompt: normalized.prompt,
      timezone: normalized.timezone,
      schedule: normalized.schedule,
      conversationId: normalized.conversationId,
      projectId: normalized.projectId,
      status: nextStatus,
      nextRunAt:
        nextStatus === "paused"
          ? null
          : shouldRecalculateNextRun
            ? calculateNextRunAt(
                normalized.schedule,
                current.lastRunAt ? new Date(current.lastRunAt) : new Date(),
              )
            : current.nextRunAt,
      updatedAt: new Date().toISOString(),
    };

    state.tasks = [
      nextTask,
      ...state.tasks.filter((item) => item.id !== taskId),
    ];

    return buildTaskOverview(nextTask, state.runs);
  });
}

export function deleteTask(taskId: string) {
  return mutateState((state) => {
    state.tasks = state.tasks.filter((item) => item.id !== taskId);
    state.runs = state.runs.filter((run) => run.taskId !== taskId);
  });
}

export function markTaskRunning(taskId: string) {
  return mutateState((state) => {
    const current = state.tasks.find((item) => item.id === taskId);

    if (!current) {
      return null;
    }

    const nextTask: TaskRecord = {
      ...current,
      isRunning: true,
      lastError: null,
      updatedAt: new Date().toISOString(),
    };

    state.tasks = [
      nextTask,
      ...state.tasks.filter((item) => item.id !== taskId),
    ];

    return nextTask;
  });
}

export function completeTaskRun(input: {
  taskId: string;
  startedAt: string;
  finishedAt: string;
  conversationId: string | null;
  projectId: string | null;
  status: "success" | "error";
  summary: string | null;
  errorMessage?: string | null;
}) {
  return mutateState((state) => {
    const current = state.tasks.find((item) => item.id === input.taskId);

    if (!current) {
      return null;
    }

    const nextTask: TaskRecord = {
      ...current,
      isRunning: false,
      conversationId: input.conversationId ?? current.conversationId,
      projectId: input.projectId ?? current.projectId,
      lastRunAt: input.finishedAt,
      lastRunStatus: input.status,
      lastRunPreview: input.summary,
      lastError: input.errorMessage || null,
      nextRunAt:
        current.status === "paused"
          ? null
          : calculateNextRunAt(current.schedule, new Date(input.finishedAt)),
      updatedAt: input.finishedAt,
    };

    state.tasks = [
      nextTask,
      ...state.tasks.filter((item) => item.id !== input.taskId),
    ];

    return buildTaskOverview(nextTask, state.runs);
  });
}

export function recordRunningTaskRun(taskId: string, startedAt: string) {
  return mutateState((state) => {
    const runRecord: TaskRunRecord = {
      id: `task-run-${crypto.randomUUID()}`,
      taskId,
      status: "running",
      startedAt,
      finishedAt: null,
      summary: null,
      errorMessage: null,
      conversationId: null,
      projectId: null,
    };

    state.runs = trimRuns([runRecord, ...state.runs]);

    return runRecord;
  });
}

export function replaceLatestRunningRun(taskId: string, patch: Partial<TaskRunRecord>) {
  return mutateState((state) => {
    const current = state.runs.find((run) => run.taskId === taskId && run.status === "running");

    if (!current) {
      return null;
    }

    const nextRun = {
      ...current,
      ...patch,
    };

    state.runs = state.runs.map((run) => (run.id === current.id ? nextRun : run));
    return nextRun;
  });
}

export function getDueTasks(reference = new Date()) {
  return listTasks()
    .filter(
      (task) =>
        task.status === "active" &&
        !task.isRunning &&
        Boolean(task.nextRunAt) &&
        Date.parse(task.nextRunAt as string) <= reference.getTime(),
    )
    .sort(
      (left, right) =>
        Date.parse(left.nextRunAt || left.updatedAt) - Date.parse(right.nextRunAt || right.updatedAt),
    );
}

export function getTaskStatusLabel(status: TaskStatus, isRunning: boolean) {
  if (isRunning) {
    return "执行中";
  }

  return status === "active" ? "运行中" : "已暂停";
}

export function formatTaskScheduleLabel(schedule: TaskSchedule) {
  if (schedule.preset === "daily") {
    return `每天 ${schedule.time || "09:00"}`;
  }

  if (schedule.preset === "weekdays") {
    return `工作日 ${schedule.time || "09:00"}`;
  }

  if (schedule.preset === "weekly") {
    return `每周${formatWeekday(schedule.weekday ?? 1)} ${schedule.time || "09:00"}`;
  }

  return `每隔 ${getIntervalMinutes(schedule) || 5} 分钟`;
}

export function formatTaskTimeLabel(value: string | null, fallback = "还没有记录") {
  if (!value) {
    return fallback;
  }

  const date = new Date(value);
  const now = new Date();
  const diff = date.getTime() - now.getTime();
  const absolute = new Intl.DateTimeFormat("zh-CN", {
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);

  if (Math.abs(diff) < 60_000) {
    return "马上";
  }

  if (diff > 0 && diff <= 60 * 60_000) {
    return `${Math.round(diff / 60_000)} 分钟后`;
  }

  if (diff > 0 && diff <= 24 * 60 * 60_000) {
    return `${Math.round(diff / 60 / 60_000)} 小时后`;
  }

  if (diff < 0 && Math.abs(diff) <= 24 * 60 * 60_000) {
    return `今天 ${absolute.split(" ").at(-1) || absolute}`;
  }

  return absolute;
}

function buildTaskOverview(task: TaskRecord, runs: TaskRunRecord[]): TaskOverview {
  return {
    ...task,
    scheduleLabel: formatTaskScheduleLabel(task.schedule),
    nextRunLabel:
      task.status === "paused"
        ? "已暂停"
        : formatTaskTimeLabel(task.nextRunAt, "等待首次执行"),
    lastRunLabel: formatTaskTimeLabel(task.lastRunAt, "还没有执行过"),
    runCount: runs.filter((run) => run.taskId === task.id).length,
  };
}

function normalizeTaskInput(input: TaskCreateInput) {
  const name = input.name.trim();
  const prompt = input.prompt.trim();
  const conversationId = input.conversationId?.trim() || null;
  const projectId = input.projectId?.trim() || null;

  if (!name) {
    throw new Error("请先填写定时任务名称。");
  }

  if (!prompt) {
    throw new Error("请先告诉 OpenCrab 这个定时任务要做什么。");
  }

  if (conversationId && projectId) {
    throw new Error("一条定时任务只能绑定一个结果回流目标。");
  }

  const snapshot = getSnapshot();

  if (
    conversationId &&
    !snapshot.conversations.some((conversation) => conversation.id === conversationId)
  ) {
    throw new Error("这条定时任务绑定的结果对话不存在。");
  }

  if (projectId && !getProjectDetail(projectId)?.project) {
    throw new Error("这条定时任务绑定的团队房间不存在。");
  }

  return {
    name,
    prompt,
    timezone: input.timezone?.trim() || null,
    conversationId,
    projectId,
    schedule: normalizeSchedule(input.schedule),
  };
}

function normalizeSchedule(schedule: TaskSchedule): TaskSchedule {
  if (schedule.preset === "interval") {
    const intervalMinutes = Math.max(1, Math.min(1440, Math.round(getIntervalMinutes(schedule) || 5)));
    return {
      preset: "interval",
      intervalMinutes,
    };
  }

  const time = normalizeTime(schedule.time || "09:00");

  if (schedule.preset === "weekly") {
    return {
      preset: "weekly",
      time,
      weekday: clampWeekday(schedule.weekday ?? 1),
    };
  }

  return {
    preset: schedule.preset,
    time,
  };
}

function normalizeTime(value: string) {
  const match = value.trim().match(/^(\d{1,2}):(\d{2})$/);

  if (!match) {
    return "09:00";
  }

  const hour = Math.max(0, Math.min(23, Number(match[1])));
  const minute = Math.max(0, Math.min(59, Number(match[2])));

  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}

function clampWeekday(value: number) {
  return Math.max(0, Math.min(6, Math.round(value)));
}

function calculateNextRunAt(schedule: TaskSchedule, reference: Date) {
  if (schedule.preset === "interval") {
    return new Date(reference.getTime() + (getIntervalMinutes(schedule) || 5) * 60_000).toISOString();
  }

  const [hour, minute] = (schedule.time || "09:00").split(":").map((part) => Number(part));
  const base = new Date(reference);
  const candidate = new Date(base);
  candidate.setSeconds(0, 0);
  candidate.setHours(hour || 0, minute || 0, 0, 0);

  if (schedule.preset === "daily") {
    if (candidate <= reference) {
      candidate.setDate(candidate.getDate() + 1);
    }
    return candidate.toISOString();
  }

  if (schedule.preset === "weekdays") {
    for (let offset = 0; offset < 14; offset += 1) {
      const next = new Date(candidate);
      next.setDate(candidate.getDate() + offset);

      if (next.getDay() === 0 || next.getDay() === 6) {
        continue;
      }

      if (next > reference) {
        return next.toISOString();
      }
    }
  }

  const targetWeekday = clampWeekday(schedule.weekday ?? 1);

  for (let offset = 0; offset < 14; offset += 1) {
    const next = new Date(candidate);
    next.setDate(candidate.getDate() + offset);

    if (next.getDay() === targetWeekday && next > reference) {
      return next.toISOString();
    }
  }

  candidate.setDate(candidate.getDate() + 7);
  return candidate.toISOString();
}

function formatWeekday(weekday: number) {
  return ["日", "一", "二", "三", "四", "五", "六"][clampWeekday(weekday)] || "一";
}

function getIntervalMinutes(schedule: TaskSchedule) {
  if (typeof schedule.intervalMinutes === "number" && Number.isFinite(schedule.intervalMinutes)) {
    return schedule.intervalMinutes;
  }

  if (typeof schedule.intervalHours === "number" && Number.isFinite(schedule.intervalHours)) {
    return schedule.intervalHours * 60;
  }

  return null;
}

function trimRuns(runs: TaskRunRecord[]) {
  return runs.slice(0, MAX_RUNS);
}

function readState(): TaskStoreState {
  return store.read();
}

function mutateState<T>(mutator: (state: TaskStoreState) => T) {
  return store.mutate(mutator);
}

function createSeedState(): TaskStoreState {
  return {
    tasks: [],
    runs: [],
  };
}

function normalizeState(state: Partial<TaskStoreState>): TaskStoreState {
  return {
    tasks: structuredClone(state.tasks || []).map((task) => ({
      ...task,
      schedule: normalizeSchedule(task.schedule || { preset: "daily", time: "09:00" }),
      status: task.status === "paused" ? "paused" : "active",
      isRunning: Boolean(task.isRunning),
      timezone: task.timezone || null,
      conversationId: task.conversationId || null,
      projectId: task.projectId || null,
      nextRunAt: task.nextRunAt || null,
      lastRunAt: task.lastRunAt || null,
      lastRunStatus: task.lastRunStatus || null,
      lastRunPreview: task.lastRunPreview || null,
      lastError: task.lastError || null,
      createdAt: task.createdAt || new Date().toISOString(),
      updatedAt: task.updatedAt || new Date().toISOString(),
    })),
    runs: structuredClone(state.runs || []).slice(0, MAX_RUNS).map((run) => ({
      ...run,
      conversationId: run.conversationId || null,
      projectId: run.projectId || null,
    })),
  };
}
