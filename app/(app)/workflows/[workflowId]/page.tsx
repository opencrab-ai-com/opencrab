import { WorkflowDetailScreen } from "@/components/workflows/workflow-detail-screen";
import { AppPage } from "@/components/ui/app-page";
import { PageHeader } from "@/components/ui/page-header";

export default async function WorkflowDetailPage({
  params,
}: {
  params: Promise<{ workflowId: string }>;
}) {
  const { workflowId } = await params;

  return (
    <AppPage width="wide" contentClassName="space-y-8">
      <PageHeader
        title="工作流详情"
        description="查看当前版本、快速发布和手动运行入口。画布编辑将在下一任务接入。"
      />
      <WorkflowDetailScreen workflowId={workflowId} />
    </AppPage>
  );
}
