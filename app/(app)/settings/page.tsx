import { DetailCard } from "@/components/ui/detail-card";
import { PageHeader } from "@/components/ui/page-header";

export default function SettingsPage() {
  return (
    <div className="min-h-screen px-6 py-8 lg:px-10">
      <div className="mx-auto max-w-[920px] space-y-6">
        <PageHeader
          title="设置"
          description="设置页只保留低频系统配置，例如权限模式、默认模型、默认推理强度和连接状态。"
        />
        <DetailCard
          title="权限模式"
          description="这一版先把设置页作为低频页面接入壳层，后续再补真正的设置表单和保存逻辑。"
          meta="低频配置"
        />
      </div>
    </div>
  );
}
