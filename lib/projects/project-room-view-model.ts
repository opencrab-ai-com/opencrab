import type { ProjectArtifactRecord, ProjectTaskRecord } from "@/lib/projects/types";

export type ProjectArtifactGraphEdge = {
  id: string;
  from: string;
  to: string;
  reason: string;
};

export function compactArtifactLabel(value: string) {
  const normalized = value.replace(/\s+/g, " ").trim();
  return normalized.length > 18 ? `${normalized.slice(0, 18)}...` : normalized;
}

function compactTaskRailLabel(value: string) {
  const normalized = value.replace(/\s+/g, " ").trim();
  return normalized.length > 18 ? `${normalized.slice(0, 18)}...` : normalized;
}

export function buildArtifactDependencyEdges(
  artifacts: ProjectArtifactRecord[],
  artifactsById: Map<string, ProjectArtifactRecord>,
  tasksById: Map<string, ProjectTaskRecord>,
) {
  const edges: ProjectArtifactGraphEdge[] = [];

  artifacts.forEach((artifact) => {
    const sourceTask =
      (artifact.sourceTaskId ? tasksById.get(artifact.sourceTaskId) ?? null : null) ??
      (artifact.sourceTaskTitle
        ? ({
            title: artifact.sourceTaskTitle,
          } as Pick<ProjectTaskRecord, "title">)
        : null);

    if (sourceTask) {
      edges.push({
        id: `${artifact.sourceTaskId ?? artifact.sourceTaskTitle ?? "source"}-${artifact.id}`,
        from: compactTaskRailLabel(sourceTask.title),
        to: compactArtifactLabel(artifact.title),
        reason: "产出交付物",
      });
    }

    artifact.dependsOnArtifactIds.forEach((dependencyArtifactId) => {
      const dependencyArtifact = artifactsById.get(dependencyArtifactId) ?? null;

      edges.push({
        id: `${dependencyArtifactId}-${artifact.id}`,
        from: dependencyArtifact ? compactArtifactLabel(dependencyArtifact.title) : "未知交付物",
        to: compactArtifactLabel(artifact.title),
        reason: artifact.sourceTaskTitle
          ? `经由 ${compactTaskRailLabel(artifact.sourceTaskTitle)} 汇入`
          : "作为上游交付物",
      });
    });

    artifact.consumedByTaskIds.forEach((taskId) => {
      const consumerTask = tasksById.get(taskId) ?? null;

      edges.push({
        id: `${artifact.id}-${taskId}`,
        from: compactArtifactLabel(artifact.title),
        to: consumerTask ? compactTaskRailLabel(consumerTask.title) : "未知任务",
        reason: "作为输入交付物",
      });
    });
  });

  return edges;
}
