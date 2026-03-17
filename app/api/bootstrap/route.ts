import { NextResponse } from "next/server";
import { ensureChannelStartupSync } from "@/lib/channels/channel-startup";
import { syncBoundConversationMetadata } from "@/lib/channels/conversation-sync";
import { getSnapshot } from "@/lib/resources/local-store";
import { ensureTaskRunner } from "@/lib/tasks/task-runner";

export async function GET() {
  void ensureChannelStartupSync();
  void ensureTaskRunner();
  syncBoundConversationMetadata();
  return NextResponse.json(getSnapshot());
}
