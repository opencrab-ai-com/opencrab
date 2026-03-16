import { AppPage } from "@/components/ui/app-page";
import { DetailCard } from "@/components/ui/detail-card";
import { PageHeader } from "@/components/ui/page-header";

export default function TasksPage() {
  return (
    <AppPage>
        <PageHeader
          title="任务"
          description="这里会承载提醒和自动执行任务，左侧用于浏览任务列表，主区用于查看详情和执行记录。"
        />
        <DetailCard
          title="选择左侧的一个任务"
          description="第一版任务页会优先展示任务状态、下次执行时间、执行记录和结果回流目标。"
        />
    </AppPage>
  );
}
