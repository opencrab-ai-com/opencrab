import { DetailCard } from "@/components/ui/detail-card";
import { PageHeader } from "@/components/ui/page-header";

export default function SkillsPage() {
  return (
    <div className="min-h-screen px-6 py-8 lg:px-10">
      <div className="mx-auto max-w-[920px]">
        <PageHeader
          title="Skills"
          description="Skills 页面用于查看当前可用能力，并进行基础启用管理。第一版先不做市场化结构。"
        />
        <DetailCard
          title="选择左侧的一个 Skill"
          description="这里会展示 Skill 简介、说明、启用状态和基础操作。"
        />
      </div>
    </div>
  );
}
