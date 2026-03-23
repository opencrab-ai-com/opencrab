import {
  createProject,
  createProjectFromConversation,
  deleteProject,
} from "@/lib/projects/project-store";

export type ProjectCreator = typeof createProject;
export type ProjectConversationUpgrader = typeof createProjectFromConversation;
export type ProjectRemover = typeof deleteProject;

type ProjectManagementServiceDependencies = {
  create?: ProjectCreator;
  createFromConversation?: ProjectConversationUpgrader;
  remove?: ProjectRemover;
};

export function createProjectManagementService(
  dependencies: ProjectManagementServiceDependencies = {},
) {
  const create = dependencies.create ?? createProject;
  const createFromConversation =
    dependencies.createFromConversation ?? createProjectFromConversation;
  const remove = dependencies.remove ?? deleteProject;

  return {
    create,
    createFromConversation,
    remove,
  };
}

export const projectManagementService = createProjectManagementService();
