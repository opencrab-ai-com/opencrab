import { beforeEach, describe, expect, it, vi } from "vitest";
import type { WorkflowDetail } from "@/lib/workflows/types";

const workflowGetMock = vi.hoisted(() => vi.fn());
const workflowPublishMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/modules/workflows/workflow-service", () => ({
  workflowService: {
    get: workflowGetMock,
    publish: workflowPublishMock,
  },
}));

function createWorkflowDetail(workflowId: string): WorkflowDetail {
  return {
    workflow: {
      id: workflowId,
      name: "Workflow publish test",
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
              id: "node-end-1",
              type: "end",
              name: "End",
              config: { deliveryTarget: "none" },
              uiPosition: { x: 420, y: 200 },
            },
          ],
          edges: [],
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

describe("workflow publish route", () => {
  beforeEach(() => {
    workflowGetMock.mockReset();
    workflowPublishMock.mockReset();
  });

  it("forwards graph payload to publish service", async () => {
    const editedGraph = {
      nodes: [
        {
          id: "node-start-1",
          type: "start" as const,
          name: "Start",
          config: { trigger: "manual" as const },
          uiPosition: { x: 100, y: 220 },
        },
        {
          id: "node-script-1",
          type: "script" as const,
          name: "Script",
          config: { scriptId: "script-1" },
          uiPosition: { x: 260, y: 220 },
        },
        {
          id: "node-end-1",
          type: "end" as const,
          name: "End",
          config: { deliveryTarget: "none" as const },
          uiPosition: { x: 420, y: 220 },
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
      defaults: {
        timezone: null,
      },
    };
    const detail = createWorkflowDetail("workflow-1");

    workflowGetMock.mockReturnValue(detail);
    workflowPublishMock.mockReturnValue(detail);

    const { POST } = await import("@/app/api/workflows/[workflowId]/publish/route");
    const response = await POST(
      new Request("http://localhost/api/workflows/workflow-1/publish", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
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
    expect(workflowPublishMock).toHaveBeenCalledWith("workflow-1", {
      graph: editedGraph,
    });
    expect(payload.workflow).not.toBeNull();
  });

  it("returns not-found when workflow does not exist", async () => {
    workflowGetMock.mockReturnValue(null);

    const { POST } = await import("@/app/api/workflows/[workflowId]/publish/route");
    const response = await POST(
      new Request("http://localhost/api/workflows/missing/publish", {
        method: "POST",
      }),
      {
        params: Promise.resolve({
          workflowId: "missing",
        }),
      },
    );
    const payload = await response.json();

    expect(response.status).toBe(404);
    expect(payload.error).toBe("工作流不存在。");
    expect(payload.code).toBe("not_found");
    expect(workflowPublishMock).not.toHaveBeenCalled();
  });
});
