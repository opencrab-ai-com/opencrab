import { describe, expect, it } from "vitest";
import {
  buildWorkflowDetailShellViewModel,
  buildWorkflowOverviewViewModel,
} from "@/lib/workflows/workflow-view-model";
import type { WorkflowDetail } from "@/lib/workflows/types";

type WorkflowDetailOverrides = {
  workflow?: Partial<WorkflowDetail["workflow"]>;
  versions?: WorkflowDetail["versions"];
};

function createWorkflowDetail(overrides: WorkflowDetailOverrides = {}): WorkflowDetail {
  const { workflow: workflowOverride, versions: versionsOverride, ...restOverrides } = overrides;
  const workflowId = workflowOverride?.id ?? "workflow-1";
  const now = "2026-04-08T08:00:00.000Z";

  return {
    workflow: {
      id: workflowId,
      name: "Weekly report",
      description: "Generate weekly summary draft",
      ownerType: "person",
      ownerId: "person-1",
      status: "draft",
      activeVersionId: `${workflowId}-draft-v2`,
      createdAt: now,
      updatedAt: now,
      ...workflowOverride,
    },
    versions: versionsOverride ?? [
      {
        id: `${workflowId}-draft-v2`,
        workflowId,
        versionNumber: 2,
        status: "draft",
        graph: {
          nodes: [],
          edges: [],
          layout: {
            viewport: { x: 0, y: 0, zoom: 1 },
          },
          defaults: { timezone: null },
        },
        createdAt: "2026-04-08T07:00:00.000Z",
        updatedAt: "2026-04-08T08:00:00.000Z",
        publishedAt: null,
      },
      {
        id: `${workflowId}-published-v1`,
        workflowId,
        versionNumber: 1,
        status: "published",
        graph: {
          nodes: [],
          edges: [],
          layout: {
            viewport: { x: 0, y: 0, zoom: 1 },
          },
          defaults: { timezone: null },
        },
        createdAt: "2026-04-06T07:00:00.000Z",
        updatedAt: "2026-04-06T08:00:00.000Z",
        publishedAt: "2026-04-06T08:00:00.000Z",
      },
    ],
    ...restOverrides,
  };
}

describe("workflow view model", () => {
  it("builds overview cards with version metadata and review states", () => {
    const firstDraft = createWorkflowDetail({
      workflow: {
        id: "workflow-first-draft",
        name: "First draft workflow",
        updatedAt: "2026-04-08T09:00:00.000Z",
      },
      versions: [
        {
          id: "workflow-first-draft-v1",
          workflowId: "workflow-first-draft",
          versionNumber: 1,
          status: "draft",
          graph: {
            nodes: [],
            edges: [],
            layout: {
              viewport: { x: 0, y: 0, zoom: 1 },
            },
            defaults: { timezone: null },
          },
          createdAt: "2026-04-08T08:30:00.000Z",
          updatedAt: "2026-04-08T09:00:00.000Z",
          publishedAt: null,
        },
      ],
    });
    const publishedAndSynced = createWorkflowDetail({
      workflow: {
        id: "workflow-synced",
        name: "Synced workflow",
        updatedAt: "2026-04-08T08:00:00.000Z",
      },
      versions: [
        {
          id: "workflow-synced-v2",
          workflowId: "workflow-synced",
          versionNumber: 2,
          status: "draft",
          graph: {
            nodes: [],
            edges: [],
            layout: {
              viewport: { x: 0, y: 0, zoom: 1 },
            },
            defaults: { timezone: null },
          },
          createdAt: "2026-04-08T07:55:00.000Z",
          updatedAt: "2026-04-08T07:59:00.000Z",
          publishedAt: null,
        },
        {
          id: "workflow-synced-v1",
          workflowId: "workflow-synced",
          versionNumber: 1,
          status: "published",
          graph: {
            nodes: [],
            edges: [],
            layout: {
              viewport: { x: 0, y: 0, zoom: 1 },
            },
            defaults: { timezone: null },
          },
          createdAt: "2026-04-08T07:00:00.000Z",
          updatedAt: "2026-04-08T08:00:00.000Z",
          publishedAt: "2026-04-08T08:00:00.000Z",
        },
      ],
    });
    const pendingUpdate = createWorkflowDetail({
      workflow: {
        id: "workflow-pending-update",
        name: "Pending update workflow",
        updatedAt: "2026-04-08T10:00:00.000Z",
      },
    });

    const viewModel = buildWorkflowOverviewViewModel([
      firstDraft,
      publishedAndSynced,
      pendingUpdate,
    ]);

    expect(viewModel.cards).toEqual([
      {
        id: "workflow-pending-update",
        name: "Pending update workflow",
        description: "Generate weekly summary draft",
        status: "draft",
        ownerType: "person",
        ownerId: "person-1",
        updatedAt: "2026-04-08T10:00:00.000Z",
        draftVersionNumber: 2,
        publishedVersionNumber: 1,
        reviewState: "pending_review",
      },
      {
        id: "workflow-first-draft",
        name: "First draft workflow",
        description: "Generate weekly summary draft",
        status: "draft",
        ownerType: "person",
        ownerId: "person-1",
        updatedAt: "2026-04-08T09:00:00.000Z",
        draftVersionNumber: 1,
        publishedVersionNumber: null,
        reviewState: "pending_review",
      },
      {
        id: "workflow-synced",
        name: "Synced workflow",
        description: "Generate weekly summary draft",
        status: "draft",
        ownerType: "person",
        ownerId: "person-1",
        updatedAt: "2026-04-08T08:00:00.000Z",
        draftVersionNumber: 2,
        publishedVersionNumber: 1,
        reviewState: "up_to_date",
      },
    ]);
  });

  it("builds review counters for pending and up-to-date workflows", () => {
    const viewModel = buildWorkflowOverviewViewModel([
      createWorkflowDetail({
        workflow: { id: "workflow-needs-first-publish" },
        versions: [
          {
            id: "workflow-needs-first-publish-v1",
            workflowId: "workflow-needs-first-publish",
            versionNumber: 1,
            status: "draft",
            graph: {
              nodes: [],
              edges: [],
              layout: {
                viewport: { x: 0, y: 0, zoom: 1 },
              },
              defaults: { timezone: null },
            },
            createdAt: "2026-04-08T06:00:00.000Z",
            updatedAt: "2026-04-08T06:30:00.000Z",
            publishedAt: null,
          },
        ],
      }),
      createWorkflowDetail({
        workflow: { id: "workflow-needs-republish" },
      }),
      createWorkflowDetail({
        workflow: { id: "workflow-up-to-date" },
        versions: [
          {
            id: "workflow-up-to-date-v2",
            workflowId: "workflow-up-to-date",
            versionNumber: 2,
            status: "draft",
            graph: {
              nodes: [],
              edges: [],
              layout: {
                viewport: { x: 0, y: 0, zoom: 1 },
              },
              defaults: { timezone: null },
            },
            createdAt: "2026-04-08T06:00:00.000Z",
            updatedAt: "2026-04-08T07:00:00.000Z",
            publishedAt: null,
          },
          {
            id: "workflow-up-to-date-v1",
            workflowId: "workflow-up-to-date",
            versionNumber: 1,
            status: "published",
            graph: {
              nodes: [],
              edges: [],
              layout: {
                viewport: { x: 0, y: 0, zoom: 1 },
              },
              defaults: { timezone: null },
            },
            createdAt: "2026-04-08T05:00:00.000Z",
            updatedAt: "2026-04-08T07:00:00.000Z",
            publishedAt: "2026-04-08T07:00:00.000Z",
          },
        ],
      }),
    ]);

    expect(viewModel.reviewCounters).toEqual({
      total: 3,
      pendingReview: 2,
      upToDate: 1,
      neverPublished: 1,
    });
  });

  it("uses the active version for node and edge counts while exposing latest draft/published metadata", () => {
    const detail = createWorkflowDetail({
      workflow: {
        id: "workflow-detail-1",
        activeVersionId: "workflow-detail-1-v1-published",
      },
      versions: [
        {
          id: "workflow-detail-1-v3-draft",
          workflowId: "workflow-detail-1",
          versionNumber: 3,
          status: "draft",
          graph: {
            nodes: [
              {
                id: "node-start-v3",
                type: "start",
                name: "Start",
                config: { trigger: "manual" },
                uiPosition: { x: 100, y: 100 },
              },
              {
                id: "node-agent-v3",
                type: "agent",
                name: "Agent",
                config: { agentId: "agent-1", prompt: "analyze" },
                uiPosition: { x: 300, y: 100 },
              },
              {
                id: "node-end-v3",
                type: "end",
                name: "End",
                config: { deliveryTarget: "none" },
                uiPosition: { x: 500, y: 100 },
              },
            ],
            edges: [
              {
                id: "edge-v3-1",
                sourceNodeId: "node-start-v3",
                targetNodeId: "node-agent-v3",
                condition: null,
                label: null,
              },
              {
                id: "edge-v3-2",
                sourceNodeId: "node-agent-v3",
                targetNodeId: "node-end-v3",
                condition: null,
                label: null,
              },
            ],
            layout: {
              viewport: { x: 0, y: 0, zoom: 1 },
            },
            defaults: { timezone: null },
          },
          createdAt: "2026-04-08T10:00:00.000Z",
          updatedAt: "2026-04-08T11:00:00.000Z",
          publishedAt: null,
        },
        {
          id: "workflow-detail-1-v1-published",
          workflowId: "workflow-detail-1",
          versionNumber: 1,
          status: "published",
          graph: {
            nodes: [
              {
                id: "node-start-v1",
                type: "start",
                name: "Start",
                config: { trigger: "manual" },
                uiPosition: { x: 100, y: 100 },
              },
              {
                id: "node-end-v1",
                type: "end",
                name: "End",
                config: { deliveryTarget: "none" },
                uiPosition: { x: 300, y: 100 },
              },
            ],
            edges: [],
            layout: {
              viewport: { x: 0, y: 0, zoom: 1 },
            },
            defaults: { timezone: null },
          },
          createdAt: "2026-04-07T10:00:00.000Z",
          updatedAt: "2026-04-07T11:00:00.000Z",
          publishedAt: "2026-04-07T11:00:00.000Z",
        },
      ],
    });

    const viewModel = buildWorkflowDetailShellViewModel(detail);

    expect(viewModel).not.toBeNull();
    expect(viewModel?.nodeCount).toBe(2);
    expect(viewModel?.edgeCount).toBe(0);
    expect(viewModel?.latestDraft?.versionNumber).toBe(3);
    expect(viewModel?.latestPublished?.versionNumber).toBe(1);
  });
});
