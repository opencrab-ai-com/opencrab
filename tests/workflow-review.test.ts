import { mkdtempSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { WorkflowGraph } from "@/lib/workflows/types";

type WorkflowStoreModule = Awaited<typeof import("@/lib/workflows/workflow-store")>;

async function loadWorkflowStore(): Promise<WorkflowStoreModule> {
  vi.resetModules();
  return import("@/lib/workflows/workflow-store");
}

function createReviewGraph(): WorkflowGraph {
  return {
    nodes: [
      {
        id: "node-start",
        type: "start",
        name: "开始",
        config: {
          trigger: "manual",
        },
        uiPosition: { x: 40, y: 140 },
      },
      {
        id: "node-script",
        type: "script",
        name: "脚本",
        config: {
          scriptId: "script-review",
        },
        uiPosition: { x: 260, y: 140 },
      },
      {
        id: "node-end",
        type: "end",
        name: "结束",
        config: {
          deliveryTarget: "none",
        },
        uiPosition: { x: 480, y: 140 },
      },
    ],
    edges: [
      {
        id: "edge-start-script",
        sourceNodeId: "node-start",
        targetNodeId: "node-script",
        condition: null,
        label: null,
      },
      {
        id: "edge-script-end",
        sourceNodeId: "node-script",
        targetNodeId: "node-end",
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
}

describe("workflow review", () => {
  const originalOpencrabHome = process.env.OPENCRAB_HOME;
  const tempHomes: string[] = [];

  beforeEach(() => {
    tempHomes.length = 0;
  });

  afterEach(() => {
    if (originalOpencrabHome === undefined) {
      delete process.env.OPENCRAB_HOME;
    } else {
      process.env.OPENCRAB_HOME = originalOpencrabHome;
    }

    tempHomes.forEach((tempHome) => {
      rmSync(tempHome, { recursive: true, force: true });
    });
  });

  it("creates a review item for failed workflow nodes", async () => {
    const tempHome = mkdtempSync(path.join(os.tmpdir(), "opencrab-workflow-review-"));
    tempHomes.push(tempHome);
    process.env.OPENCRAB_HOME = tempHome;

    const workflowStore = await loadWorkflowStore();
    const created = workflowStore.createWorkflow({
      name: "Review item workflow",
      ownerType: "person",
      ownerId: "person-review-item",
    });
    const published = workflowStore.publishWorkflow(created.workflow.id, {
      graph: createReviewGraph(),
    });
    const publishedVersion = published?.versions.find((version) => version.status === "published");

    if (!publishedVersion) {
      throw new Error("Expected published workflow version.");
    }

    const run = workflowStore.recordWorkflowRun({
      workflowId: created.workflow.id,
      workflowVersionId: publishedVersion.id,
      workflowVersionNumber: publishedVersion.versionNumber,
      trigger: "manual",
      triggerStartNodeIds: ["node-start"],
      initiatedBy: "tester",
      startedAt: "2026-04-08T08:00:00.000Z",
    });

    const item = workflowStore.createReviewItemForFailedNode({
      workflowId: created.workflow.id,
      runId: run.id,
      nodeId: "node-script",
      reason: "脚本执行失败",
      surface: "general",
    });

    expect(item.status).toBe("open");
    expect(item.surface).toBe("general");
    expect(item.sourceNodeId).toBe("node-script");
    expect(workflowStore.listWorkflowReviewItems({ view: "all" })).toEqual([
      expect.objectContaining({
        id: item.id,
        surface: "general",
        sourceNodeId: "node-script",
      }),
    ]);
  });

  it("marks downstream node runs stale and resets the current node when retrying it", async () => {
    const tempHome = mkdtempSync(path.join(os.tmpdir(), "opencrab-workflow-review-"));
    tempHomes.push(tempHome);
    process.env.OPENCRAB_HOME = tempHome;

    const workflowStore = await loadWorkflowStore();
    const created = workflowStore.createWorkflow({
      name: "Retry review workflow",
      ownerType: "person",
      ownerId: "person-review",
    });
    const published = workflowStore.publishWorkflow(created.workflow.id, {
      graph: createReviewGraph(),
    });
    const publishedVersion = published?.versions.find((version) => version.status === "published");

    if (!publishedVersion) {
      throw new Error("Expected published workflow version.");
    }

    const run = workflowStore.recordWorkflowRun({
      workflowId: created.workflow.id,
      workflowVersionId: publishedVersion.id,
      workflowVersionNumber: publishedVersion.versionNumber,
      trigger: "manual",
      triggerStartNodeIds: ["node-start"],
      initiatedBy: "tester",
      startedAt: "2026-04-08T09:00:00.000Z",
    });

    workflowStore.recordWorkflowNodeRun({
      runId: run.id,
      workflowId: created.workflow.id,
      workflowVersionId: publishedVersion.id,
      nodeId: "node-script",
      status: "error",
      attemptCount: 1,
      inputSnapshot: { topic: "ai" },
      outputSnapshot: null,
      startedAt: "2026-04-08T09:00:01.000Z",
      completedAt: "2026-04-08T09:00:02.000Z",
      errorMessage: "脚本执行失败",
    });
    workflowStore.recordWorkflowNodeRun({
      runId: run.id,
      workflowId: created.workflow.id,
      workflowVersionId: publishedVersion.id,
      nodeId: "node-end",
      status: "success",
      attemptCount: 1,
      inputSnapshot: { topic: "ai" },
      outputSnapshot: { delivered: true },
      startedAt: "2026-04-08T09:00:03.000Z",
      completedAt: "2026-04-08T09:00:04.000Z",
    });

    const reviewItem = workflowStore.createReviewItemForFailedNode({
      workflowId: created.workflow.id,
      runId: run.id,
      nodeId: "node-script",
      reason: "脚本执行失败",
      surface: "general",
    });

    const result = workflowStore.reviewWorkflowItem(reviewItem.id, {
      action: "retry_current_node",
      inputPatch: { retriedBy: "reviewer" },
    });
    const nodeRuns = workflowStore.listWorkflowNodeRuns(run.id);
    const retriedNodeRun = nodeRuns.find((nodeRun) => nodeRun.nodeId === "node-script");
    const staleNodeRun = nodeRuns.find((nodeRun) => nodeRun.nodeId === "node-end");
    const refreshedReviewItem = workflowStore.listWorkflowReviewItems({ view: "all" });

    if (!result || !("staleNodeRunIds" in result)) {
      throw new Error("Expected retry review action to return stale node ids.");
    }

    expect(result.staleNodeRunIds).toContain("node-end");
    expect(retriedNodeRun?.status).toBe("pending");
    expect(retriedNodeRun?.inputSnapshot).toMatchObject({
      topic: "ai",
      retriedBy: "reviewer",
    });
    expect(retriedNodeRun?.errorMessage).toBeNull();
    expect(staleNodeRun?.status).toBe("stale");
    expect(refreshedReviewItem).toHaveLength(0);
  });

  it("creates a follow-up draft when saving a review fix back to workflow definition", async () => {
    const tempHome = mkdtempSync(path.join(os.tmpdir(), "opencrab-workflow-review-"));
    tempHomes.push(tempHome);
    process.env.OPENCRAB_HOME = tempHome;

    const workflowStore = await loadWorkflowStore();
    const created = workflowStore.createWorkflow({
      name: "Save to draft workflow",
      ownerType: "person",
      ownerId: "person-save-draft",
    });
    const published = workflowStore.publishWorkflow(created.workflow.id, {
      graph: createReviewGraph(),
    });
    const publishedVersion = published?.versions.find((version) => version.status === "published");

    if (!publishedVersion) {
      throw new Error("Expected published workflow version.");
    }

    const run = workflowStore.recordWorkflowRun({
      workflowId: created.workflow.id,
      workflowVersionId: publishedVersion.id,
      workflowVersionNumber: publishedVersion.versionNumber,
      trigger: "manual",
      triggerStartNodeIds: ["node-start"],
      initiatedBy: "tester",
      startedAt: "2026-04-08T10:00:00.000Z",
    });
    const reviewItem = workflowStore.createReviewItemForFailedNode({
      workflowId: created.workflow.id,
      runId: run.id,
      nodeId: "node-script",
      reason: "请更新脚本配置",
      surface: "general",
    });

    const updatedDetail = workflowStore.reviewWorkflowItem(reviewItem.id, {
      action: "save_to_draft",
      definitionPatch: {
        scriptId: "script-review-v2",
      },
    });
    const refreshed = workflowStore.getWorkflow(created.workflow.id);
    const activeDraft = refreshed?.versions.find((version) => version.id === refreshed.workflow.activeVersionId);
    const updatedScriptNode = activeDraft?.graph.nodes.find((node) => node.id === "node-script");

    if (!updatedDetail || !("workflow" in updatedDetail)) {
      throw new Error("Expected save_to_draft to return workflow detail.");
    }

    expect(updatedDetail.workflow.id).toBe(created.workflow.id);
    expect(updatedScriptNode?.config).toMatchObject({
      scriptId: "script-review-v2",
    });
  });

  it("separates pending publish items from the general review queue", async () => {
    const tempHome = mkdtempSync(path.join(os.tmpdir(), "opencrab-workflow-review-"));
    tempHomes.push(tempHome);
    process.env.OPENCRAB_HOME = tempHome;

    const workflowStore = await loadWorkflowStore();
    const created = workflowStore.createWorkflow({
      name: "Pending publish workflow",
      ownerType: "person",
      ownerId: "person-pending-publish",
    });
    const published = workflowStore.publishWorkflow(created.workflow.id, {
      graph: createReviewGraph(),
    });
    const publishedVersion = published?.versions.find((version) => version.status === "published");

    if (!publishedVersion) {
      throw new Error("Expected published workflow version.");
    }

    const generalRun = workflowStore.recordWorkflowRun({
      workflowId: created.workflow.id,
      workflowVersionId: publishedVersion.id,
      workflowVersionNumber: publishedVersion.versionNumber,
      trigger: "manual",
      triggerStartNodeIds: ["node-start"],
      initiatedBy: "tester",
      startedAt: "2026-04-08T11:00:00.000Z",
    });
    const pendingPublishRun = workflowStore.recordWorkflowRun({
      workflowId: created.workflow.id,
      workflowVersionId: publishedVersion.id,
      workflowVersionNumber: publishedVersion.versionNumber,
      trigger: "manual",
      triggerStartNodeIds: ["node-start"],
      initiatedBy: "tester",
      startedAt: "2026-04-08T11:05:00.000Z",
    });

    workflowStore.createReviewItemForFailedNode({
      workflowId: created.workflow.id,
      runId: generalRun.id,
      nodeId: "node-general",
      reason: "人工复核",
      surface: "general",
    });
    const pendingPublishItem = workflowStore.createReviewItemForFailedNode({
      workflowId: created.workflow.id,
      runId: pendingPublishRun.id,
      nodeId: "node-end",
      reason: "待发布内容已生成",
      surface: "pending_publish",
    });

    const pendingPublish = workflowStore.listWorkflowReviewItems({ view: "pending_publish" });
    const allReviewItems = workflowStore.listWorkflowReviewItems({ view: "all" });

    expect(pendingPublish).toEqual([
      expect.objectContaining({
        id: pendingPublishItem.id,
        surface: "pending_publish",
      }),
    ]);
    expect(allReviewItems).toHaveLength(2);
  });
});
