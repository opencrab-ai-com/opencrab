import {
  ensureChannelStartupSync,
  ensureChannelWatchdog,
} from "@/lib/channels/channel-startup";
import {
  resolveChannelId,
  runChannelSyncAction,
  type ChannelSyncMode,
} from "@/lib/channels/channel-management";
import {
  json,
  notFoundJson,
  readJsonBody,
  type RouteContext,
} from "@/lib/server/api-route";

export async function POST(
  request: Request,
  context: RouteContext<{ channelId: string }>,
) {
  ensureChannelWatchdog();
  const channelId = await resolveChannelId(context.params);

  if (!channelId) {
    return notFoundJson("不支持的 channel。");
  }

  void ensureChannelStartupSync({ force: true });

  const body = await readJsonBody<{
    mode?: ChannelSyncMode;
  }>(request, {});
  const result = await runChannelSyncAction(channelId, body.mode || "refresh");

  return json(result);
}
