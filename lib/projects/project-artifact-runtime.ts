import type { ProjectArtifactRecord } from "@/lib/projects/types";

function compactArtifactExcerpt(value: string, maxLength = 120) {
  const normalized = value.replace(/\s+/g, " ").trim();

  if (normalized.length <= maxLength) {
    return normalized;
  }

  return `${normalized.slice(0, maxLength - 3)}...`;
}

function formatArtifactStatusLabel(status: ProjectArtifactRecord["status"]) {
  switch (status) {
    case "ready":
      return "已可用";
    case "planned":
      return "已规划";
    default:
      return "草稿";
  }
}

export function buildManagerArtifactCatalogLines(
  artifacts: ProjectArtifactRecord[],
  options: {
    limit?: number;
    maxLength?: number;
  } = {},
) {
  const limit = options.limit ?? 6;
  const maxLength = options.maxLength ?? 120;

  return [...artifacts]
    .sort((left, right) => {
      if (left.status !== right.status) {
        if (left.status === "ready") {
          return -1;
        }

        if (right.status === "ready") {
          return 1;
        }
      }

      return Date.parse(right.updatedAt) - Date.parse(left.updatedAt);
    })
    .slice(0, limit)
    .map(
      (artifact) =>
        `- ${artifact.title} (${artifact.typeLabel} / ${formatArtifactStatusLabel(artifact.status)}): ${compactArtifactExcerpt(
          artifact.summary,
          maxLength,
        )}`,
    )
    .join("\n");
}

export function normalizeDelegationArtifactTitles(value: unknown) {
  if (!Array.isArray(value)) {
    return [];
  }

  return Array.from(
    new Set(
      value
        .map((item) => (typeof item === "string" ? item.trim() : ""))
        .filter(Boolean),
    ),
  );
}

export function resolveArtifactIdsByTitles(
  artifacts: ProjectArtifactRecord[],
  requestedTitles: string[],
) {
  const artifactByTitle = new Map(artifacts.map((artifact) => [artifact.title, artifact.id] as const));

  return Array.from(
    new Set(
      requestedTitles
        .map((title) => artifactByTitle.get(title) ?? null)
        .filter(Boolean),
    ),
  ) as string[];
}

export function buildWorkerArtifactInputLines(
  artifactIds: string[],
  artifactsById: Map<string, ProjectArtifactRecord>,
  options: {
    limit?: number;
    maxLength?: number;
  } = {},
) {
  const limit = options.limit ?? 4;
  const maxLength = options.maxLength ?? 120;

  const lines = artifactIds
    .map((artifactId) => artifactsById.get(artifactId) ?? null)
    .filter(Boolean)
    .slice(0, limit)
    .map((artifact) => {
      const safeArtifact = artifact as ProjectArtifactRecord;
      return `- ${safeArtifact.title} (${safeArtifact.typeLabel} / ${formatArtifactStatusLabel(safeArtifact.status)}): ${compactArtifactExcerpt(
        safeArtifact.summary,
        maxLength,
      )}`;
    });

  return lines.join("\n");
}
