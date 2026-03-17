import { AppPage } from "@/components/ui/app-page";
import { TaskDetailScreen } from "@/components/tasks/task-detail-screen";
import { PageHeader } from "@/components/ui/page-header";
import { ensureTaskRunner } from "@/lib/tasks/task-runner";

export default async function TaskDetailPage({
  params,
}: {
  params: Promise<{ taskId: string }>;
}) {
  const { taskId } = await params;
  void ensureTaskRunner();

  return (
    <AppPage width="wide" contentClassName="space-y-8">
      <PageHeader
        title="任务详情"
        description="这里可以修改任务安排、立刻执行一次，并查看最近结果。"
      />
      <TaskDetailScreen taskId={taskId} />
    </AppPage>
  );
}
