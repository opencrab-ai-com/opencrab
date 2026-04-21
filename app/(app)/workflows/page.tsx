import { WorkflowsScreen } from "@/components/workflows/workflows-screen";
import { AppPage } from "@/components/ui/app-page";
import { PageHeader } from "@/components/ui/page-header";

export default function WorkflowsPage() {
  return (
    <AppPage width="wide" contentClassName="space-y-5">
      <PageHeader
        title="工作流"
        description="管理流程草稿、发布版本和运行入口。当前页面先提供总览与详情壳，下一步再接入画布编辑。"
        className="mb-6"
      />
      <WorkflowsScreen />
    </AppPage>
  );
}
