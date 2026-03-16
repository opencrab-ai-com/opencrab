import { NextResponse } from "next/server";
import { ensureChannelStartupSync } from "@/lib/channels/channel-startup";
import { syncBoundConversationMetadata } from "@/lib/channels/conversation-sync";
import { getSnapshot } from "@/lib/resources/local-store";

export async function GET() {
  void ensureChannelStartupSync();
  syncBoundConversationMetadata();
  return NextResponse.json(getSnapshot());
}
