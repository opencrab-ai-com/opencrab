import { NextResponse } from "next/server";
import {
  ensureChannelStartupSync,
  ensureChannelWatchdog,
} from "@/lib/channels/channel-startup";
import { getChannelDetail } from "@/lib/channels/channel-store";
import {
  resolveChannelId,
  saveChannelConfiguration,
  type ChannelPatchPayload,
} from "@/lib/channels/channel-management";
import { syncAllChannelConfigsFromSecrets } from "@/lib/channels/secret-store";

export async function GET(
  _request: Request,
  context: { params: Promise<{ channelId: string }> },
) {
  const channelId = await resolveChannelId(context.params);

  if (!channelId) {
    return NextResponse.json({ error: "不支持的 channel。" }, { status: 404 });
  }

  syncAllChannelConfigsFromSecrets();
  ensureChannelWatchdog();
  void ensureChannelStartupSync();

  return NextResponse.json({
    detail: getChannelDetail(channelId),
  });
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ channelId: string }> },
) {
  ensureChannelWatchdog();
  const channelId = await resolveChannelId(context.params);

  if (!channelId) {
    return NextResponse.json({ error: "不支持的 channel。" }, { status: 404 });
  }

  const body = (await request.json()) as ChannelPatchPayload;
  const result = await saveChannelConfiguration(channelId, body);

  return NextResponse.json({
    detail: result.detail,
    verification: result.verification,
  });
}
