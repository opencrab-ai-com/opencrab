import {
  createProject,
  deleteProject,
  updateProjectFeishuChatSessionId,
  updateProjectSandboxMode,
  updateProjectWorkspaceDir,
} from "@/lib/projects/project-store";

export type ProjectCreator = typeof createProject;
export type ProjectRemover = typeof deleteProject;
export type ProjectWorkspaceUpdater = typeof updateProjectWorkspaceDir;
export type ProjectSandboxUpdater = typeof updateProjectSandboxMode;
export type ProjectFeishuChatSessionUpdater = typeof updateProjectFeishuChatSessionId;

type ProjectManagementServiceDependencies = {
  create?: ProjectCreator;
  remove?: ProjectRemover;
  updateWorkspaceDir?: ProjectWorkspaceUpdater;
  updateSandboxMode?: ProjectSandboxUpdater;
  updateFeishuChatSessionId?: ProjectFeishuChatSessionUpdater;
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
  const updateFeishuChatSessionId =
    dependencies.updateFeishuChatSessionId ?? updateProjectFeishuChatSessionId;

  return {
    create,
    remove,
    updateWorkspaceDir,
    updateSandboxMode,
    updateFeishuChatSessionId,
  };
}

export const projectManagementService = createProjectManagementService();
