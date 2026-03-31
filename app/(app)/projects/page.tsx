import { ProjectsOverviewScreen } from "@/components/projects/projects-overview-screen";
import { AppPage } from "@/components/ui/app-page";
import { listProjects } from "@/lib/projects/project-store";

export default function ProjectsPage() {
  const projects = listProjects();

  return (
    <AppPage width="wide" contentClassName="space-y-6">
      <ProjectsOverviewScreen projects={projects} />
    </AppPage>
  );
}
