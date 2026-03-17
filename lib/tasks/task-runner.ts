import {
  createConversation,
  ensureFolder,
  updateConversation,
} from "@/lib/resources/local-store";
import { getSnapshot } from "@/lib/resources/local-store";
import { runConversationTurn } from "@/lib/conversations/run-conversation-turn";
import {
  completeTaskRun,
  getDueTasks,
  getTask,
  markTaskRunning,
  recordRunningTaskRun,
  replaceLatestRunningRun,
} from "@/lib/tasks/task-store";

const RUNNER_COOLDOWN_MS = 20_000;
const TASK_FOLDER_NAME = "定时任务";

declare global {
  var __opencrabTaskRunnerPromise: Promise<void> | undefined;
  var __opencrabTaskRunnerLastRunAt: number | undefined;
  var __opencrabTaskExecutionPromises: Map<string, Promise<void>> | undefined;
}

export function ensureTaskRunner() {
  const lastRunAt = globalThis.__opencrabTaskRunnerLastRunAt ?? 0;

  if (globalThis.__opencrabTaskRunnerPromise) {
    return globalThis.__opencrabTaskRunnerPromise;
  }

  if (Date.now() - lastRunAt < RUNNER_COOLDOWN_MS) {
    return Promise.resolve();
  }

  const task = runDueTasks()
    .catch(() => undefined)
    .finally(() => {
      globalThis.__opencrabTaskRunnerPromise = undefined;
      globalThis.__opencrabTaskRunnerLastRunAt = Date.now();
    });

  globalThis.__opencrabTaskRunnerPromise = task;
  return task;
}

export function runTaskNow(taskId: string) {
  void enqueueTaskExecution(taskId, { force: true });
  return getTask(taskId);
}

async function runDueTasks() {
  const dueTasks = getDueTasks(new Date());

  for (const task of dueTasks) {
    await enqueueTaskExecution(task.id);
  }
}

function enqueueTaskExecution(taskId: string, options: { force?: boolean } = {}) {
  const runningTasks = getRunningTaskMap();
  const existing = runningTasks.get(taskId);

  if (existing) {
    return existing;
  }

  const task = executeTask(taskId, options).finally(() => {
    getRunningTaskMap().delete(taskId);
  });

  runningTasks.set(taskId, task);
  return task;
}

async function executeTask(taskId: string, options: { force?: boolean } = {}) {
  const task = getTask(taskId);

  if (!task || task.isRunning || (!options.force && task.status !== "active")) {
    return;
  }

  const startedAt = new Date().toISOString();
  markTaskRunning(taskId);
  recordRunningTaskRun(taskId, startedAt);

  let conversationId = task.conversationId;

  try {
    const snapshot = getSnapshot();
    const taskFolder = ensureFolder(TASK_FOLDER_NAME);
    const targetConversation = conversationId
      ? snapshot.conversations.find((item) => item.id === conversationId) ?? null
      : null;

    if (!targetConversation) {
      const created = createConversation({
        title: task.name,
        folderId: taskFolder?.id ?? null,
        source: "task",
        channelLabel: "定时任务",
        remoteUserLabel: task.name,
      });
      conversationId = created.conversationId;
    } else if (taskFolder && targetConversation.folderId !== taskFolder.id) {
      updateConversation(targetConversation.id, {
        folderId: taskFolder.id,
        source: "task",
        channelLabel: "定时任务",
        remoteUserLabel: task.name,
      });
    }

    if (!conversationId) {
      throw new Error("任务执行失败：没有可用的结果对话。");
    }

    const reply = await runConversationTurn({
      conversationId,
      content: task.prompt,
      model: snapshot.settings.defaultModel,
      reasoningEffort: snapshot.settings.defaultReasoningEffort,
      sandboxMode: snapshot.settings.defaultSandboxMode,
      userMessageSource: "task",
    });

    const finishedAt = new Date().toISOString();
    const summary = summarizeText(reply.assistant.text);

    replaceLatestRunningRun(taskId, {
      status: "success",
      finishedAt,
      summary,
      conversationId,
    });
    completeTaskRun({
      taskId,
      startedAt,
      finishedAt,
      conversationId,
      status: "success",
      summary,
    });
  } catch (error) {
    const finishedAt = new Date().toISOString();
    const message = error instanceof Error ? error.message : "任务执行失败。";

    replaceLatestRunningRun(taskId, {
      status: "error",
      finishedAt,
      errorMessage: message,
      conversationId,
    });
    completeTaskRun({
      taskId,
      startedAt,
      finishedAt,
      conversationId,
      status: "error",
      summary: null,
      errorMessage: message,
    });
  }
}

function getRunningTaskMap() {
  if (!globalThis.__opencrabTaskExecutionPromises) {
    globalThis.__opencrabTaskExecutionPromises = new Map();
  }

  return globalThis.__opencrabTaskExecutionPromises;
}

function summarizeText(text: string) {
  const normalized = text.replace(/\s+/g, " ").trim();

  if (!normalized) {
    return "本次任务没有返回可展示的结果。";
  }

  if (normalized.length <= 120) {
    return normalized;
  }

  return `${normalized.slice(0, 117)}...`;
}
