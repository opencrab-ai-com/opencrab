import {
  reviewProjectLearningReuseCandidate,
  reviewProjectLearningSuggestion,
  runProject,
  updateProjectCheckpoint,
} from "@/lib/projects/project-store";

export type ProjectRunner = typeof runProject;
export type ProjectCheckpointUpdater = typeof updateProjectCheckpoint;
export type ProjectLearningSuggestionReviewer = typeof reviewProjectLearningSuggestion;
export type ProjectLearningReuseCandidateReviewer = typeof reviewProjectLearningReuseCandidate;

type ProjectRuntimeServiceDependencies = {
  run?: ProjectRunner;
  updateCheckpoint?: ProjectCheckpointUpdater;
  reviewLearningSuggestion?: ProjectLearningSuggestionReviewer;
  reviewLearningReuseCandidate?: ProjectLearningReuseCandidateReviewer;
};

export function createProjectRuntimeService(
  dependencies: ProjectRuntimeServiceDependencies = {},
) {
  const run = dependencies.run ?? runProject;
  const updateCheckpoint =
    dependencies.updateCheckpoint ?? updateProjectCheckpoint;
  const reviewLearningSuggestion =
    dependencies.reviewLearningSuggestion ?? reviewProjectLearningSuggestion;
  const reviewLearningReuseCandidate =
    dependencies.reviewLearningReuseCandidate ?? reviewProjectLearningReuseCandidate;

  return {
    run,
    updateCheckpoint,
    reviewLearningSuggestion,
    reviewLearningReuseCandidate,
  };
}

export const projectRuntimeService = createProjectRuntimeService();
