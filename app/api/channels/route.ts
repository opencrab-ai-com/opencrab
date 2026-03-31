import { getChannelOverviewList } from "@/lib/channels/channel-store";
import { ensureChannelRuntimeReady } from "@/lib/runtime/runtime-startup";
import { json } from "@/lib/server/api-route";

export async function GET() {
  ensureChannelRuntimeReady();

  return json({
    channels: getChannelOverviewList(),
  });
}
