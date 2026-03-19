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
import {
  json,
  notFoundJson,
  readJsonBody,
  type RouteContext,
} from "@/lib/server/api-route";

export async function GET(
  _request: Request,
  context: RouteContext<{ channelId: string }>,
) {
  const channelId = await resolveChannelId(context.params);

  if (!channelId) {
    return notFoundJson("不支持的 channel。");
  }

  syncAllChannelConfigsFromSecrets();
  ensureChannelWatchdog();
  void ensureChannelStartupSync();

  return json({
    detail: getChannelDetail(channelId),
  });
}

export async function PATCH(
  request: Request,
  context: RouteContext<{ channelId: string }>,
) {
  ensureChannelWatchdog();
  const channelId = await resolveChannelId(context.params);

  if (!channelId) {
    return notFoundJson("不支持的 channel。");
  }

  const body = await readJsonBody<ChannelPatchPayload>(request, {});
  const result = await saveChannelConfiguration(channelId, body);

  return json({
    detail: result.detail,
    verification: result.verification,
  });
}
