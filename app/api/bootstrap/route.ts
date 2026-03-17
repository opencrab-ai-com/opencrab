import { NextResponse } from "next/server";
import {
  ensureChannelStartupSync,
  ensureChannelWatchdog,
} from "@/lib/channels/channel-startup";
import { ensureBrowserSessionWarmup } from "@/lib/codex/browser-session";
import { syncBoundConversationMetadata } from "@/lib/channels/conversation-sync";
import { getSnapshot } from "@/lib/resources/local-store";
import { ensureTaskRunner } from "@/lib/tasks/task-runner";

export async function GET() {
  ensureChannelWatchdog();
  await ensureChannelStartupSync({ force: true });
  void ensureBrowserSessionWarmup({ force: true });
  void ensureTaskRunner();
  syncBoundConversationMetadata();
  return NextResponse.json(getSnapshot());
}
