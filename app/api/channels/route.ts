import {
  ensureChannelStartupSync,
  ensureChannelWatchdog,
} from "@/lib/channels/channel-startup";
import { getChannelOverviewList } from "@/lib/channels/channel-store";
import { syncAllChannelConfigsFromSecrets } from "@/lib/channels/secret-store";
import { json } from "@/lib/server/api-route";

export async function GET() {
  syncAllChannelConfigsFromSecrets();
  ensureChannelWatchdog();
  void ensureChannelStartupSync();

  return json({
    channels: getChannelOverviewList(),
  });
}
