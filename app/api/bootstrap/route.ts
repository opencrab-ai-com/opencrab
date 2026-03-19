import {
  ensureChannelStartupSync,
  ensureChannelWatchdog,
} from "@/lib/channels/channel-startup";
import { ensureBrowserSessionWarmup } from "@/lib/codex/browser-session";
import { syncBoundConversationMetadata } from "@/lib/channels/conversation-sync";
import { getSnapshot } from "@/lib/resources/local-store";
import { json } from "@/lib/server/api-route";
import { ensureBundledSkillsReady } from "@/lib/skills/skill-store";
import { ensureTaskRunner } from "@/lib/tasks/task-runner";

export async function GET() {
  ensureChannelWatchdog();
  ensureBundledSkillsReady();
  const snapshot = getSnapshot();

  // Keep first paint fast: startup repair work runs in the background.
  void ensureChannelStartupSync({ force: true });
  void ensureBrowserSessionWarmup({ force: true });
  void ensureTaskRunner();
  void Promise.resolve().then(() => {
    syncBoundConversationMetadata();
  });

  return json(snapshot);
}
