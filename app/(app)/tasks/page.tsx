import { AppPage } from "@/components/ui/app-page";
import { TasksScreen } from "@/components/tasks/tasks-screen";
import { PageHeader } from "@/components/ui/page-header";
import { ensureTaskRuntimeReady } from "@/lib/runtime/runtime-startup";

export default function TasksPage() {
  ensureTaskRuntimeReady();

  return (
    <AppPage width="wide" contentClassName="space-y-5">
      <PageHeader
        title="定时任务"
        description="把重复工作交给 OpenCrab 按计划执行，并持续把结果回到对应对话。"
        className="mb-6"
      />
      <TasksScreen />
    </AppPage>
  );
}
