import { NextResponse } from "next/server";
import { ensureChannelStartupSync } from "@/lib/channels/channel-startup";
import {
  resolveChannelId,
  runChannelSyncAction,
  type ChannelSyncMode,
} from "@/lib/channels/channel-management";

export async function POST(
  request: Request,
  context: { params: Promise<{ channelId: string }> },
) {
  const channelId = await resolveChannelId(context.params);

  if (!channelId) {
    return NextResponse.json({ error: "不支持的 channel。" }, { status: 404 });
  }

  void ensureChannelStartupSync();

  const body = (await request.json().catch(() => ({}))) as {
    mode?: ChannelSyncMode;
  };
  const result = await runChannelSyncAction(channelId, body.mode || "refresh");

  return NextResponse.json(result);
}
