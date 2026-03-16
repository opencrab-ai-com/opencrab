import { AppPage } from "@/components/ui/app-page";
import { DetailCard } from "@/components/ui/detail-card";
import { PageHeader } from "@/components/ui/page-header";
import { tasks } from "@/lib/seed-data";

export default async function TaskDetailPage({
  params,
}: {
  params: Promise<{ taskId: string }>;
}) {
  const { taskId } = await params;
  const task = tasks.find((item) => item.id === taskId);

  return (
    <AppPage contentClassName="space-y-6">
        <PageHeader
          title={task?.name ?? "任务"}
          description="任务详情页会展示调度方式、最近执行记录、结果摘要和回流目标。"
        />
        <DetailCard
          title="下次执行"
          description="后续这里会接入 run history、暂停/恢复和立即执行动作。"
          meta={task?.nextRun ?? "未找到"}
        />
    </AppPage>
  );
}
