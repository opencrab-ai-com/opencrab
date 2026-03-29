import {
  ensureChannelStartupSync,
  ensureChannelWatchdog,
} from "@/lib/channels/channel-startup";
import { ensureBrowserSessionWarmup } from "@/lib/codex/browser-session";
import { ensureBoundConversationMetadataSync } from "@/lib/channels/conversation-sync";
import { getSnapshot } from "@/lib/resources/local-store";
import { ensureRuntimeLock } from "@/lib/runtime/runtime-lock";
import { errorResponse, noStoreJson } from "@/lib/server/api-route";
import { logServerError } from "@/lib/server/observability";
import { ensureBundledSkillsReady } from "@/lib/skills/skill-store";
import { ensureTaskRunner } from "@/lib/tasks/task-runner";

export async function GET() {
  try {
    ensureRuntimeLock();
    ensureChannelWatchdog();
    ensureBundledSkillsReady();
    const snapshot = getSnapshot();

    // Keep first paint fast: startup repair work runs in the background.
    void ensureChannelStartupSync().catch((error) => {
      logServerError({
        event: "bootstrap_channel_startup_sync_failed",
        message: error instanceof Error ? error.message : "渠道启动同步失败。",
      });
    });
    void ensureBrowserSessionWarmup().catch((error) => {
      logServerError({
        event: "bootstrap_browser_warmup_failed",
        message: error instanceof Error ? error.message : "浏览器预热失败。",
      });
    });
    void ensureTaskRunner().catch((error) => {
      logServerError({
        event: "bootstrap_task_runner_failed",
        message: error instanceof Error ? error.message : "任务执行器启动失败。",
      });
    });
    void ensureBoundConversationMetadataSync().catch((error) => {
      logServerError({
        event: "bootstrap_conversation_metadata_sync_failed",
        message:
          error instanceof Error ? error.message : "渠道会话元数据同步失败。",
      });
    });

    return noStoreJson(snapshot);
  } catch (error) {
    return errorResponse(error, "OpenCrab 启动引导失败。", 500, {
      operation: "bootstrap_failed",
    });
  }
}
