import { getChannelStatusText } from "@/lib/channels/channel-detail-copy";
import { StatusPill as UnifiedStatusPill } from "@/components/ui/pill";
import type { ChannelDetail } from "@/lib/channels/types";

export function ChannelStatusBadge({ channel }: { channel: ChannelDetail }) {
  return (
    <UnifiedStatusPill tone={mapChannelStatusTone(channel.status)}>
      {getChannelStatusText(channel.status)}
    </UnifiedStatusPill>
  );
}

function mapChannelStatusTone(status: ChannelDetail["status"]) {
  if (status === "connecting") {
    return "info";
  }

  if (status === "ready") {
    return "success";
  }

  if (status === "disconnected") {
    return "warning";
  }

  if (status === "error") {
    return "danger";
  }

  return "neutral";
}
