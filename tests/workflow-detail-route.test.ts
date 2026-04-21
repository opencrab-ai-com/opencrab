import { beforeEach, describe, expect, it, vi } from "vitest";
import type { WorkflowDetail } from "@/lib/workflows/types";

const workflowGetMock = vi.hoisted(() => vi.fn());
const workflowSaveDraftMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/modules/workflows/workflow-service", () => ({
  workflowService: {
    get: workflowGetMock,
    saveDraft: workflowSaveDraftMock,
  },
}));

function createWorkflowDetail(workflowId: string): WorkflowDetail {
  return {
    workflow: {
      id: workflowId,
      name: "Workflow detail test",
      description: "test",
      ownerType: "person",
      ownerId: "person-1",
      status: "draft",
      activeVersionId: `${workflowId}-v1`,
      createdAt: "2026-04-08T08:00:00.000Z",
      updatedAt: "2026-04-08T09:00:00.000Z",
    },
    versions: [
      {
        id: `${workflowId}-v1`,
        workflowId,
        versionNumber: 1,
        status: "draft",
        graph: {
          nodes: [
            {
              id: "node-start-1",
              type: "start",
              name: "Start",
              config: { trigger: "manual" },
              uiPosition: { x: 100, y: 200 },
            },
            {
              id: "node-script-1",
              type: "script",
              name: "Script",
              config: { scriptId: null, source: "return { ok: true };" },
              uiPosition: { x: 280, y: 200 },
            },
            {
              id: "node-end-1",
              type: "end",
              name: "End",
              config: { deliveryTarget: "none" },
              uiPosition: { x: 460, y: 200 },
            },
          ],
          edges: [
            {
              id: "edge-start-script",
              sourceNodeId: "node-start-1",
              targetNodeId: "node-script-1",
              condition: null,
              label: null,
            },
            {
              id: "edge-script-end",
              sourceNodeId: "node-script-1",
              targetNodeId: "node-end-1",
              condition: null,
              label: null,
            },
          ],
          layout: {
            viewport: { x: 0, y: 0, zoom: 1 },
          },
          defaults: { timezone: null },
        },
        createdAt: "2026-04-08T08:00:00.000Z",
        updatedAt: "2026-04-08T09:00:00.000Z",
        publishedAt: null,
      },
    ],
  };
}

describe("workflow detail route", () => {
  beforeEach(() => {
    workflowGetMock.mockReset();
    workflowSaveDraftMock.mockReset();
  });

  it("saves the edited draft graph through PATCH", async () => {
    const editedDetail = createWorkflowDetail("workflow-1");
    const editedGraph = structuredClone(editedDetail.versions[0].graph);
    editedGraph.nodes = editedGraph.nodes.map((node) => {
      if (node.id !== "node-script-1" || node.type !== "script") {
        return node;
      }

      return {
        ...node,
        config: {
          ...node.config,
          source: "return { answer: 42 };",
        },
      };
    });

    workflowGetMock.mockReturnValue(editedDetail);
    workflowSaveDraftMock.mockReturnValue({
      ...editedDetail,
      versions: [
        {
          ...editedDetail.versions[0],
          graph: editedGraph,
        },
      ],
    });

    const { PATCH } = await import("@/app/api/workflows/[workflowId]/route");
    const response = await PATCH(
      new Request("http://localhost/api/workflows/workflow-1", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          versionId: "workflow-1-v1",
          graph: editedGraph,
        }),
      }),
      {
        params: Promise.resolve({
          workflowId: "workflow-1",
        }),
      },
    );
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(workflowSaveDraftMock).toHaveBeenCalledWith("workflow-1", {
      versionId: "workflow-1-v1",
      graph: editedGraph,
    });
    expect(payload.workflow?.versions[0].graph).toEqual(editedGraph);
  });
});
