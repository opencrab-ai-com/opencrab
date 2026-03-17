import { NextResponse } from "next/server";
import {
  ensureChannelStartupSync,
  ensureChannelWatchdog,
} from "@/lib/channels/channel-startup";
import { getChannelOverviewList } from "@/lib/channels/channel-store";
import { syncAllChannelConfigsFromSecrets } from "@/lib/channels/secret-store";

export async function GET() {
  syncAllChannelConfigsFromSecrets();
  ensureChannelWatchdog();
  void ensureChannelStartupSync();

  return NextResponse.json({
    channels: getChannelOverviewList(),
  });
}
