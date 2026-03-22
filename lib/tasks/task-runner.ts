import { findBindingByConversationId } from "@/lib/channels/channel-store";
import { recordOutboundDelivery } from "@/lib/channels/dispatcher";
import { sendFeishuReply } from "@/lib/channels/feishu";
import { sendTelegramReply } from "@/lib/channels/telegram";
import {
  createConversation,
  ensureFolder,
  updateConversation,
} from "@/lib/resources/local-store";
import { getSnapshot } from "@/lib/resources/local-store";
import type { UploadedAttachment } from "@/lib/resources/opencrab-api-types";
import { runConversationTurn } from "@/lib/conversations/run-conversation-turn";
import { getProjectDetail, runProject } from "@/lib/projects/project-store";
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
  let projectId = task.projectId;

  try {
    const snapshot = getSnapshot();
    const result = projectId
      ? await runTaskAgainstProject(taskId, {
          taskName: task.name,
          prompt: task.prompt,
          projectId,
        })
      : await runTaskAgainstConversation({
          taskName: task.name,
          prompt: task.prompt,
          conversationId,
          snapshot,
        });

    conversationId = result.conversationId;
    projectId = result.projectId;
    const summary = result.summary;
    const finishedAt = new Date().toISOString();

    replaceLatestRunningRun(taskId, {
      status: "success",
      finishedAt,
      summary,
      conversationId,
      projectId,
    });
    completeTaskRun({
      taskId,
      startedAt,
      finishedAt,
      conversationId,
      projectId,
      status: "success",
      summary,
    });
  } catch (error) {
    const finishedAt = new Date().toISOString();
    const message = error instanceof Error ? error.message : "定时任务执行失败。";

    replaceLatestRunningRun(taskId, {
      status: "error",
      finishedAt,
      errorMessage: message,
      conversationId,
      projectId,
    });
    completeTaskRun({
      taskId,
      startedAt,
      finishedAt,
      conversationId,
      projectId,
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
    return "本次定时任务没有返回可展示的结果。";
  }

  if (normalized.length <= 120) {
    return normalized;
  }

  return `${normalized.slice(0, 117)}...`;
}

async function runTaskAgainstConversation(input: {
  taskName: string;
  prompt: string;
  conversationId: string | null;
  snapshot: ReturnType<typeof getSnapshot>;
}) {
  let conversationId = input.conversationId;
  const taskFolder = ensureFolder(TASK_FOLDER_NAME);
  const targetConversation = conversationId
    ? input.snapshot.conversations.find((item) => item.id === conversationId) ?? null
    : null;

  if (!targetConversation) {
    const created = createConversation({
      title: input.taskName,
      folderId: taskFolder?.id ?? null,
      source: "task",
      channelLabel: "定时任务",
      remoteUserLabel: input.taskName,
    });
    conversationId = created.conversationId;
  } else if (
    taskFolder &&
    targetConversation.source === "task" &&
    targetConversation.folderId !== taskFolder.id
  ) {
    updateConversation(targetConversation.id, {
      folderId: taskFolder.id,
      source: "task",
      channelLabel: "定时任务",
      remoteUserLabel: input.taskName,
    });
  }

  if (!conversationId) {
    throw new Error("定时任务执行失败：没有可用的结果对话。");
  }

  const reply = await runConversationTurn({
    conversationId,
    content: input.prompt,
    model: input.snapshot.settings.defaultModel,
    reasoningEffort: input.snapshot.settings.defaultReasoningEffort,
    sandboxMode: input.snapshot.settings.defaultSandboxMode,
    userMessageSource: "task",
  });

  if (targetConversation?.source === "feishu" || targetConversation?.source === "telegram") {
    await deliverTaskReplyToChannel({
      channelId: targetConversation.source,
      conversationId,
      text: reply.assistant.text,
      attachments: reply.assistant.attachments,
    });
  }

  return {
    conversationId,
    projectId: null,
    summary: summarizeText(reply.assistant.text),
  };
}

async function runTaskAgainstProject(
  taskId: string,
  input: {
    taskName: string;
    prompt: string;
    projectId: string;
  },
) {
  const existing = getProjectDetail(input.projectId);

  if (!existing?.project) {
    throw new Error("定时任务执行失败：绑定的团队房间不存在。");
  }

  if (existing.project.runStatus === "waiting_user") {
    throw new Error("当前团队房间正在等待你补充信息，定时任务不会自动越过这个检查点。");
  }

  const initialDetail = await runProject(input.projectId, {
    triggerLabel: `定时任务 · ${input.taskName}`,
    triggerPrompt: input.prompt,
  });

  if (!initialDetail?.project) {
    throw new Error("定时任务执行失败：团队房间启动后未返回有效状态。");
  }

  const detail = initialDetail;

  replaceLatestRunningRun(taskId, {
    projectId: input.projectId,
    summary: summarizeProjectProgress(detail),
  });

  if (detail.project?.runStatus !== "completed") {
    throw new Error("团队房间本轮运行没有成功完成。");
  }

  const artifactSummary =
    detail.artifacts.find((artifact) => artifact.title === "执行摘要")?.summary ||
    detail.project.summary ||
    "团队房间已完成一次自动推进。";

  return {
    conversationId: null,
    projectId: input.projectId,
    summary: artifactSummary,
  };
}

function summarizeProjectProgress(detail: NonNullable<ReturnType<typeof getProjectDetail>>) {
  const project = detail.project;

  if (!project) {
    return "团队房间正在处理中。";
  }

  switch (project.runStatus) {
    case "running":
      return "团队房间已启动自动推进，当前正在由 Manager 委派并收拢阶段信息。";
    case "waiting_approval":
      return "团队房间已整理出阶段摘要，正在自动推进到最终输出。";
    case "completed":
      return (
        detail.artifacts.find((artifact) => artifact.title === "执行摘要")?.summary ||
        "团队房间已完成本轮自动推进。"
      );
    case "waiting_user":
      return "团队房间正在等待你补充新的信息。";
    default:
      return "团队房间已准备好下一轮自动推进。";
  }
}

async function deliverTaskReplyToChannel(input: {
  channelId: "telegram" | "feishu";
  conversationId: string;
  text: string;
  attachments: UploadedAttachment[];
}) {
  const binding = findBindingByConversationId(input.conversationId);

  if (!binding) {
    throw new Error("定时任务执行成功，但没有找到对应的渠道绑定，无法把结果发回原聊天。");
  }

  const delivery =
    input.channelId === "telegram"
      ? await sendTelegramReply({
          chatId: binding.remoteChatId,
          text: input.text,
          attachments: input.attachments,
        })
      : await sendFeishuReply({
          chatId: binding.remoteChatId,
          text: input.text,
          attachments: input.attachments,
        });

  recordOutboundDelivery({
    channelId: input.channelId,
    binding,
    remoteMessageId: delivery.remoteMessageId,
    text: input.text,
    attachmentCount: input.attachments.length,
  });
}
