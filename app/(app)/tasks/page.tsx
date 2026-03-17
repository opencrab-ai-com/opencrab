import { AppPage } from "@/components/ui/app-page";
import { TasksScreen } from "@/components/tasks/tasks-screen";
import { PageHeader } from "@/components/ui/page-header";
import { ensureTaskRunner } from "@/lib/tasks/task-runner";

export default function TasksPage() {
  void ensureTaskRunner();

  return (
    <AppPage width="wide" contentClassName="space-y-8">
      <PageHeader
        title="任务"
        description="让 OpenCrab 按固定时间自己做事。你只需要告诉它做什么、什么时候做。"
      />
      <TasksScreen />
    </AppPage>
  );
}
