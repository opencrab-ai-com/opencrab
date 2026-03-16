import { AppPage } from "@/components/ui/app-page";
import { DetailCard } from "@/components/ui/detail-card";
import { PageHeader } from "@/components/ui/page-header";

export default function ChannelsPage() {
  return (
    <AppPage>
        <PageHeader
          title="Channels"
          description="把网页中的会话带到外部渠道，并保持完整远程对话和结果回流。"
        />
        <DetailCard
          title="选择左侧的一个 Channel"
          description="这里会显示当前通道的连接状态、最近消息和相关对话。第一版先保持简单，不把它做成复杂的技术配置面板。"
        />
    </AppPage>
  );
}
