import type {
  WorkflowDetail,
  WorkflowVersionRecord,
} from "@/lib/workflows/types";

export type WorkflowReviewState = "pending_review" | "up_to_date";

export type WorkflowOverviewCard = {
  id: string;
  name: string;
  description: string | null;
  status: WorkflowDetail["workflow"]["status"];
  ownerType: WorkflowDetail["workflow"]["ownerType"];
  ownerId: string;
  updatedAt: string;
  draftVersionNumber: number | null;
  publishedVersionNumber: number | null;
  reviewState: WorkflowReviewState;
};

export type WorkflowOverviewReviewCounters = {
  total: number;
  pendingReview: number;
  upToDate: number;
  neverPublished: number;
};

export type WorkflowOverviewViewModel = {
  cards: WorkflowOverviewCard[];
  reviewCounters: WorkflowOverviewReviewCounters;
};

export type WorkflowDetailShellViewModel = {
  workflow: WorkflowDetail["workflow"];
  latestDraft: WorkflowVersionRecord | null;
  latestPublished: WorkflowVersionRecord | null;
  reviewState: WorkflowReviewState;
  nodeCount: number;
  edgeCount: number;
} | null;

export function buildWorkflowOverviewViewModel(
  workflows: WorkflowDetail[],
): WorkflowOverviewViewModel {
  const cards = workflows
    .map((item) => {
      const latestDraft = getLatestVersion(item.versions, "draft");
      const latestPublished = getLatestVersion(item.versions, "published");
      const reviewState = resolveReviewState(latestDraft, latestPublished);

      return {
        id: item.workflow.id,
        name: item.workflow.name,
        description: item.workflow.description,
        status: item.workflow.status,
        ownerType: item.workflow.ownerType,
        ownerId: item.workflow.ownerId,
        updatedAt: item.workflow.updatedAt,
        draftVersionNumber: latestDraft?.versionNumber ?? null,
        publishedVersionNumber: latestPublished?.versionNumber ?? null,
        reviewState,
      } satisfies WorkflowOverviewCard;
    })
    .sort(
      (left, right) => Date.parse(right.updatedAt) - Date.parse(left.updatedAt),
    );

  const reviewCounters = cards.reduce<WorkflowOverviewReviewCounters>(
    (accumulator, card) => {
      accumulator.total += 1;

      if (card.reviewState === "pending_review") {
        accumulator.pendingReview += 1;
      } else {
        accumulator.upToDate += 1;
      }

      if (card.publishedVersionNumber === null) {
        accumulator.neverPublished += 1;
      }

      return accumulator;
    },
    {
      total: 0,
      pendingReview: 0,
      upToDate: 0,
      neverPublished: 0,
    },
  );

  return {
    cards,
    reviewCounters,
  };
}

export function buildWorkflowDetailShellViewModel(
  detail: WorkflowDetail | null,
): WorkflowDetailShellViewModel {
  if (!detail) {
    return null;
  }

  const latestDraft = getLatestVersion(detail.versions, "draft");
  const latestPublished = getLatestVersion(detail.versions, "published");
  const activeVersion =
    detail.versions.find((version) => version.id === detail.workflow.activeVersionId) ??
    latestDraft ??
    latestPublished;

  return {
    workflow: detail.workflow,
    latestDraft,
    latestPublished,
    reviewState: resolveReviewState(latestDraft, latestPublished),
    nodeCount: activeVersion?.graph.nodes.length ?? 0,
    edgeCount: activeVersion?.graph.edges.length ?? 0,
  };
}

function getLatestVersion(
  versions: WorkflowVersionRecord[],
  status: WorkflowVersionRecord["status"],
) {
  return versions
    .filter((version) => version.status === status)
    .sort((left, right) => right.versionNumber - left.versionNumber)[0] ?? null;
}

function resolveReviewState(
  latestDraft: WorkflowVersionRecord | null,
  latestPublished: WorkflowVersionRecord | null,
): WorkflowReviewState {
  if (!latestDraft) {
    return "up_to_date";
  }

  if (!latestPublished) {
    return "pending_review";
  }

  return Date.parse(latestDraft.updatedAt) > Date.parse(latestPublished.updatedAt)
    ? "pending_review"
    : "up_to_date";
}
