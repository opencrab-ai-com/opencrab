import {
  createProject,
  deleteProject,
  updateProjectSandboxMode,
  updateProjectWorkspaceDir,
} from "@/lib/projects/project-store";

export type ProjectCreator = typeof createProject;
export type ProjectRemover = typeof deleteProject;
export type ProjectWorkspaceUpdater = typeof updateProjectWorkspaceDir;
export type ProjectSandboxUpdater = typeof updateProjectSandboxMode;

type ProjectManagementServiceDependencies = {
  create?: ProjectCreator;
  remove?: ProjectRemover;
  updateWorkspaceDir?: ProjectWorkspaceUpdater;
  updateSandboxMode?: ProjectSandboxUpdater;
};

export function createProjectManagementService(
  dependencies: ProjectManagementServiceDependencies = {},
) {
  const create = dependencies.create ?? createProject;
  const remove = dependencies.remove ?? deleteProject;
  const updateWorkspaceDir =
    dependencies.updateWorkspaceDir ?? updateProjectWorkspaceDir;
  const updateSandboxMode =
    dependencies.updateSandboxMode ?? updateProjectSandboxMode;

  return {
    create,
    remove,
    updateWorkspaceDir,
    updateSandboxMode,
  };
}

export const projectManagementService = createProjectManagementService();
