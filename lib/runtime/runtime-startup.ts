import {
  ensureChannelStartupSync,
  ensureChannelWatchdog,
} from "@/lib/channels/channel-startup";
import { ensureBoundConversationHistorySync } from "@/lib/channels/bound-conversation-sync";
import { ensureBoundConversationMetadataSync } from "@/lib/channels/conversation-sync";
import { syncAllChannelConfigsFromSecrets } from "@/lib/channels/secret-store";
import { ensureBrowserSessionWarmup } from "@/lib/codex/browser-session";
import { logServerError } from "@/lib/server/observability";
import { ensureBundledSkillsReady } from "@/lib/skills/skill-store";
import { ensureTaskRunner } from "@/lib/tasks/task-runner";
import { ensureWorkflowRunner } from "@/lib/workflows/workflow-runner";

type RuntimeStartupTask = {
  event: string;
  message: string;
  run: () => Promise<unknown>;
};

const BOOTSTRAP_TASKS: RuntimeStartupTask[] = [
  {
    event: "bootstrap_channel_startup_sync_failed",
    message: "渠道启动同步失败。",
    run: () => ensureChannelStartupSync(),
  },
  {
    event: "bootstrap_browser_warmup_failed",
    message: "浏览器预热失败。",
    run: () => ensureBrowserSessionWarmup(),
  },
  {
    event: "bootstrap_task_runner_failed",
    message: "任务执行器启动失败。",
    run: () => ensureTaskRunner(),
  },
  {
    event: "bootstrap_workflow_runner_failed",
    message: "工作流执行器启动失败。",
    run: () => ensureWorkflowRunner(),
  },
  {
    event: "bootstrap_conversation_metadata_sync_failed",
    message: "渠道会话元数据同步失败。",
    run: () => ensureBoundConversationMetadataSync(),
  },
  {
    event: "bootstrap_conversation_history_sync_failed",
    message: "绑定会话历史同步失败。",
    run: () => ensureBoundConversationHistorySync(),
  },
];

export function ensureBootstrapRuntimeReady() {
  ensureBundledSkillsReady();
  ensureChannelWatchdog();

  BOOTSTRAP_TASKS.forEach((task) => {
    runRuntimeStartupTask(task);
  });
}

export function ensureChannelRuntimeReady(input: { force?: boolean } = {}) {
  syncAllChannelConfigsFromSecrets();
  ensureChannelWatchdog();

  runRuntimeStartupTask({
    event: "channel_startup_sync_failed",
    message: "渠道启动同步失败。",
    run: () => ensureChannelStartupSync({ force: input.force }),
  });
}

export function ensureChannelRuntimeWatchdog() {
  ensureChannelWatchdog();
}

export function ensureTaskRuntimeReady() {
  runRuntimeStartupTask({
    event: "task_runner_startup_failed",
    message: "任务执行器启动失败。",
    run: () => ensureTaskRunner(),
  });
}

export function ensureAppShellRuntimeReady() {
  runRuntimeStartupTask({
    event: "app_shell_browser_warmup_failed",
    message: "浏览器预热失败。",
    run: () => ensureBrowserSessionWarmup(),
  });
  runRuntimeStartupTask({
    event: "app_shell_bound_conversation_history_sync_failed",
    message: "绑定会话历史同步失败。",
    run: () => ensureBoundConversationHistorySync(),
  });
}

function runRuntimeStartupTask(task: RuntimeStartupTask) {
  void task.run().catch((error) => {
    logServerError({
      event: task.event,
      message: error instanceof Error ? error.message : task.message,
    });
  });
}
