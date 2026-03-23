import {
  runProject,
  updateProjectCheckpoint,
} from "@/lib/projects/project-store";

export type ProjectRunner = typeof runProject;
export type ProjectCheckpointUpdater = typeof updateProjectCheckpoint;

type ProjectRuntimeServiceDependencies = {
  run?: ProjectRunner;
  updateCheckpoint?: ProjectCheckpointUpdater;
};

export function createProjectRuntimeService(
  dependencies: ProjectRuntimeServiceDependencies = {},
) {
  const run = dependencies.run ?? runProject;
  const updateCheckpoint =
    dependencies.updateCheckpoint ?? updateProjectCheckpoint;

  return {
    run,
    updateCheckpoint,
  };
}

export const projectRuntimeService = createProjectRuntimeService();
