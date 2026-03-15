import { DetailCard } from "@/components/ui/detail-card";
import { PageHeader } from "@/components/ui/page-header";
import { skills } from "@/lib/mock-data";

export default async function SkillDetailPage({
  params,
}: {
  params: Promise<{ skillId: string }>;
}) {
  const { skillId } = await params;
  const skill = skills.find((item) => item.id === skillId);

  return (
    <div className="min-h-screen px-6 py-8 lg:px-10">
      <div className="mx-auto max-w-[920px] space-y-6">
        <PageHeader
          title={skill?.name ?? "Skill"}
          description={skill?.description ?? "Skill 详情页骨架。"}
        />
        <DetailCard
          title="当前状态"
          description="后续这里会接入使用说明、作用范围和启停动作。"
          meta={skill?.status ?? "未找到"}
        />
      </div>
    </div>
  );
}
