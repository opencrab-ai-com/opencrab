import { mkdtempSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

describe("workflow publish route server validation", () => {
  const originalOpencrabHome = process.env.OPENCRAB_HOME;
  const tempHomes: string[] = [];

  beforeEach(() => {
    tempHomes.length = 0;
    vi.resetModules();
  });

  afterEach(() => {
    if (originalOpencrabHome === undefined) {
      delete process.env.OPENCRAB_HOME;
    } else {
      process.env.OPENCRAB_HOME = originalOpencrabHome;
    }

    tempHomes.forEach((homePath) => {
      rmSync(homePath, { recursive: true, force: true });
    });
  });

  it("rejects invalid graph payload on publish before persisting versions", async () => {
    const tempHome = mkdtempSync(path.join(os.tmpdir(), "opencrab-workflow-publish-route-"));
    tempHomes.push(tempHome);
    process.env.OPENCRAB_HOME = tempHome;

    const workflowStore = await import("@/lib/workflows/workflow-store");
    const created = workflowStore.createWorkflow({
      name: "Route validation workflow",
      description: null,
      ownerType: "person",
      ownerId: "person-route-validation",
    });
    const activeDraft = created.versions.find(
      (version) => version.id === created.workflow.activeVersionId,
    );
    const startNode = activeDraft?.graph.nodes.find((node) => node.type === "start");

    if (!activeDraft || !startNode) {
      throw new Error("Expected seeded workflow draft with start node.");
    }

    const invalidGraph = {
      ...structuredClone(activeDraft.graph),
      nodes: [
        {
          id: startNode.id,
          type: "start" as const,
          name: "Start",
          config: { trigger: "manual" as const },
          uiPosition: { x: 120, y: 240 },
        },
        {
          id: "node-script-only",
          type: "script" as const,
          name: "Script Only",
          config: { scriptId: "script-only" },
          uiPosition: { x: 300, y: 240 },
        },
      ],
      edges: [
        {
          id: "edge-start-script-only",
          sourceNodeId: startNode.id,
          targetNodeId: "node-script-only",
          condition: null,
          label: null,
        },
      ],
    };

    const { POST } = await import("@/app/api/workflows/[workflowId]/publish/route");
    const response = await POST(
      new Request(`http://localhost/api/workflows/${created.workflow.id}/publish`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          graph: invalidGraph,
        }),
      }),
      {
        params: Promise.resolve({
          workflowId: created.workflow.id,
        }),
      },
    );
    const payload = await response.json();
    const after = workflowStore.getWorkflow(created.workflow.id);

    expect(response.status).toBe(400);
    expect(payload.error).toBe("工作流图校验失败，无法发布。");
    expect(payload.code).toBe("bad_request");
    expect(after?.versions.filter((version) => version.status === "published")).toHaveLength(0);
    expect(after?.versions.filter((version) => version.status === "draft")).toHaveLength(1);
  });
});
