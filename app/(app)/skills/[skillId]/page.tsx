import { SkillDetailScreen } from "@/components/skills/skill-detail-screen";

export default async function SkillDetailPage({
  params,
}: {
  params: Promise<{ skillId: string }>;
}) {
  const { skillId } = await params;

  return <SkillDetailScreen skillId={skillId} />;
}
