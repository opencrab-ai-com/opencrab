import { DetailCard } from "@/components/ui/detail-card";
import { PageHeader } from "@/components/ui/page-header";
import { channels } from "@/lib/mock-data";

export default async function ChannelDetailPage({
  params,
}: {
  params: Promise<{ channelId: string }>;
}) {
  const { channelId } = await params;
  const channel = channels.find((item) => item.id === channelId);

  return (
    <div className="min-h-screen px-6 py-8 lg:px-10">
      <div className="mx-auto max-w-[920px] space-y-6">
        <PageHeader
          title={channel?.name ?? "Channel"}
          description="这里会显示连接引导、最近远程消息，以及和当前通道相关的会话入口。"
        />
        <DetailCard
          title="连接状态"
          description="当前页面骨架已经预留好主信息区，后续只需要接入真实 API 和消息回流即可。"
          meta={channel?.status ?? "未找到"}
        />
      </div>
    </div>
  );
}
