import { ProjectRoomScreen } from "@/components/projects/project-room-screen";
import { AppPage } from "@/components/ui/app-page";
import { getProjectDetail } from "@/lib/projects/project-store";

export const dynamic = "force-dynamic";

export default async function ProjectRoomPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;
  const detail = getProjectDetail(projectId);

  return (
    <AppPage width="wide" contentClassName="space-y-6">
      <ProjectRoomScreen key={projectId} detail={detail} />
    </AppPage>
  );
}
