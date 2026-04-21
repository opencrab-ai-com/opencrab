import { beforeEach, describe, expect, it, vi } from "vitest";
import type { WorkflowDetail } from "@/lib/workflows/types";

const workflowGetMock = vi.hoisted(() => vi.fn());
const workflowRunNowMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/modules/workflows/workflow-service", () => ({
  workflowService: {
    get: workflowGetMock,
    runNow: workflowRunNowMock,
  },
}));

function createWorkflowDetail(workflowId: string): WorkflowDetail {
  return {
    workflow: {
      id: workflowId,
      name: "Test workflow",
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
          nodes: [],
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

describe("workflow run route", () => {
  beforeEach(() => {
    workflowGetMock.mockReset();
    workflowRunNowMock.mockReset();
  });

  it("accepts a manual workflow run and returns the current detail payload", async () => {
    const detail = createWorkflowDetail("workflow-1");
    workflowGetMock.mockReturnValue(detail);
    workflowRunNowMock.mockReturnValue({
      detail,
      run: {
        id: "workflow-run-1",
        workflowId: "workflow-1",
        status: "accepted",
        startedAt: "2026-04-08T09:30:00.000Z",
        message: "工作流已开始运行当前发布版本。",
      },
    });

    const { POST } = await import("@/app/api/workflows/[workflowId]/run/route");
    const response = await POST(
      new Request("http://localhost/api/workflows/workflow-1/run", {
        method: "POST",
      }),
      {
        params: Promise.resolve({
          workflowId: "workflow-1",
        }),
      },
    );
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.workflow?.workflow.id).toBe("workflow-1");
    expect(payload.run).toEqual({
      id: "workflow-run-1",
      workflowId: "workflow-1",
      status: "accepted",
      startedAt: "2026-04-08T09:30:00.000Z",
      message: "工作流已开始运行当前发布版本。",
    });
  });

  it("returns not-found when workflow does not exist", async () => {
    workflowGetMock.mockReturnValue(null);

    const { POST } = await import("@/app/api/workflows/[workflowId]/run/route");
    const response = await POST(
      new Request("http://localhost/api/workflows/missing/run", {
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
  });
});
