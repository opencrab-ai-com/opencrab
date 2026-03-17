import {
  buildChannelStatusTone,
  getChannelStatusText,
} from "@/lib/channels/channel-detail-copy";
import type { ChannelDetail } from "@/lib/channels/types";

export function ChannelStatusBadge({ channel }: { channel: ChannelDetail }) {
  return (
    <span
      className={`rounded-full border px-3 py-1.5 text-[12px] font-medium ${buildChannelStatusTone(channel.status)}`}
    >
      {getChannelStatusText(channel.status)}
    </span>
  );
}
