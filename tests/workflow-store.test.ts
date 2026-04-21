import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

type WorkflowStoreModule = Awaited<typeof import("@/lib/workflows/workflow-store")>;

async function loadWorkflowStore(): Promise<WorkflowStoreModule> {
  vi.resetModules();
  return import("@/lib/workflows/workflow-store");
}

describe("workflow store", () => {
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

    tempHomes.forEach((homePath) => {
      rmSync(homePath, { recursive: true, force: true });
    });
  });

  it("creates a blank workflow draft seeded with start and end nodes", async () => {
    const tempHome = mkdtempSync(path.join(os.tmpdir(), "opencrab-workflow-store-"));
    tempHomes.push(tempHome);
    process.env.OPENCRAB_HOME = tempHome;

    const workflowStore = await loadWorkflowStore();
    const created = workflowStore.createWorkflow({
      name: "Blank workflow",
      description: "For persistence foundation tests",
      ownerType: "person",
      ownerId: "person-1",
    });

    expect(created).not.toBeNull();
    expect(created?.workflow.ownerType).toBe("person");
    expect(created?.versions).toHaveLength(1);

    const [draftVersion] = created?.versions ?? [];
    expect(draftVersion?.status).toBe("draft");
    expect(draftVersion?.graph.nodes).toHaveLength(2);
    expect(draftVersion?.graph.edges).toEqual([]);

    const seededNodeTypes = draftVersion?.graph.nodes.map((node) => node.type).sort();
    expect(seededNodeTypes).toEqual(["end", "start"]);

    const storePath = path.join(tempHome, "state", "workflows.json");
    expect(existsSync(storePath)).toBe(true);
    expect(JSON.parse(readFileSync(storePath, "utf8"))).toMatchObject({
      workflows: [{ id: created?.workflow.id, ownerType: "person", ownerId: "person-1" }],
      versions: [{ workflowId: created?.workflow.id, status: "draft", versionNumber: 1 }],
    });
  });

  it("publishes drafts immutably and creates a new active draft each time", async () => {
    const tempHome = mkdtempSync(path.join(os.tmpdir(), "opencrab-workflow-store-"));
    tempHomes.push(tempHome);
    process.env.OPENCRAB_HOME = tempHome;

    const workflowStore = await loadWorkflowStore();
    const created = workflowStore.createWorkflow({
      name: "Publish history workflow",
      description: null,
      ownerType: "team",
      ownerId: "team-1",
    });

    if (!created) {
      throw new Error("Expected workflow creation to return a detail result.");
    }

    const firstPublish = workflowStore.publishWorkflow(created.workflow.id);
    expect(firstPublish).not.toBeNull();

    const firstPublishedVersion = firstPublish?.versions.find((version) => version.versionNumber === 1);
    const firstPublishedGraph = structuredClone(firstPublishedVersion?.graph);
    const firstPublishedAt = firstPublishedVersion?.publishedAt;

    expect(firstPublishedVersion?.status).toBe("published");
    expect(firstPublishedAt).not.toBeNull();
    expect(firstPublish?.versions.filter((version) => version.status === "draft")).toHaveLength(1);

    const secondPublish = workflowStore.publishWorkflow(created.workflow.id);
    expect(secondPublish).not.toBeNull();
    expect(secondPublish?.versions).toHaveLength(3);

    const immutableFirstPublished = secondPublish?.versions.find(
      (version) => version.id === firstPublishedVersion?.id,
    );
    const activeDraft = secondPublish?.versions.find((version) => version.id === secondPublish?.workflow.activeVersionId);

    expect(immutableFirstPublished?.status).toBe("published");
    expect(immutableFirstPublished?.publishedAt).toBe(firstPublishedAt);
    expect(immutableFirstPublished?.graph).toEqual(firstPublishedGraph);
    expect(secondPublish?.versions.filter((version) => version.status === "published")).toHaveLength(2);
    expect(secondPublish?.versions.filter((version) => version.status === "draft")).toHaveLength(1);
    expect(activeDraft?.status).toBe("draft");
    expect(activeDraft?.versionNumber).toBe(3);
  });

  it("publishes the provided draft graph payload instead of stale persisted graph", async () => {
    const tempHome = mkdtempSync(path.join(os.tmpdir(), "opencrab-workflow-store-"));
    tempHomes.push(tempHome);
    process.env.OPENCRAB_HOME = tempHome;

    const workflowStore = await loadWorkflowStore();
    const created = workflowStore.createWorkflow({
      name: "Publish with graph payload",
      description: null,
      ownerType: "person",
      ownerId: "person-graph",
    });

    if (!created) {
      throw new Error("Expected workflow creation to return a detail result.");
    }

    const activeDraft = created.versions.find(
      (version) => version.id === created.workflow.activeVersionId,
    );

    if (!activeDraft) {
      throw new Error("Expected created workflow to include an active draft.");
    }

    const startNode = activeDraft.graph.nodes.find((node) => node.type === "start");
    const endNode = activeDraft.graph.nodes.find((node) => node.type === "end");

    if (!startNode || !endNode) {
      throw new Error("Expected seeded graph to include start and end nodes.");
    }

    const editedGraph = {
      ...structuredClone(activeDraft.graph),
      nodes: [
        ...structuredClone(activeDraft.graph.nodes),
        {
          id: "node-script-payload",
          type: "script" as const,
          name: "Payload Script",
          config: {
            scriptId: "script-payload-1",
            source: null,
          },
          uiPosition: {
            x: 280,
            y: 240,
          },
        },
      ],
      edges: [
        {
          id: "edge-start-script",
          sourceNodeId: startNode.id,
          targetNodeId: "node-script-payload",
          condition: null,
          label: null,
        },
        {
          id: "edge-script-end",
          sourceNodeId: "node-script-payload",
          targetNodeId: endNode.id,
          condition: null,
          label: null,
        },
      ],
    };

    const published = workflowStore.publishWorkflow(created.workflow.id, {
      graph: editedGraph,
    });

    expect(published).not.toBeNull();

    const publishedVersion = published?.versions.find(
      (version) => version.status === "published" && version.versionNumber === 1,
    );
    const nextDraftVersion = published?.versions.find(
      (version) => version.id === published.workflow.activeVersionId,
    );

    expect(publishedVersion?.graph).toEqual(editedGraph);
    expect(nextDraftVersion?.graph).toEqual(editedGraph);
  });

  it("rejects publish payload graph that fails server-side validation", async () => {
    const tempHome = mkdtempSync(path.join(os.tmpdir(), "opencrab-workflow-store-"));
    tempHomes.push(tempHome);
    process.env.OPENCRAB_HOME = tempHome;

    const workflowStore = await loadWorkflowStore();
    const created = workflowStore.createWorkflow({
      name: "Invalid graph publish",
      description: null,
      ownerType: "person",
      ownerId: "person-invalid",
    });

    if (!created) {
      throw new Error("Expected workflow creation to return a detail result.");
    }

    const activeDraft = created.versions.find(
      (version) => version.id === created.workflow.activeVersionId,
    );

    if (!activeDraft) {
      throw new Error("Expected created workflow to include an active draft.");
    }

    const startNode = activeDraft.graph.nodes.find((node) => node.type === "start");

    if (!startNode) {
      throw new Error("Expected seeded graph to include a start node.");
    }

    const invalidGraph = {
      ...structuredClone(activeDraft.graph),
      nodes: [
        {
          id: startNode.id,
          type: "start" as const,
          name: "Start",
          config: { trigger: "manual" as const },
          uiPosition: { x: 100, y: 200 },
        },
        {
          id: "node-script-only",
          type: "script" as const,
          name: "Script Only",
          config: { scriptId: "script-only" },
          uiPosition: { x: 280, y: 200 },
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

    expect(() =>
      workflowStore.publishWorkflow(created.workflow.id, {
        graph: invalidGraph,
      }),
    ).toThrowError("工作流图校验失败，无法发布。");
  });

  it("reassigns dangling activeVersionId to a valid version owned by the same workflow", async () => {
    const tempHome = mkdtempSync(path.join(os.tmpdir(), "opencrab-workflow-store-"));
    tempHomes.push(tempHome);
    process.env.OPENCRAB_HOME = tempHome;

    const storeDir = path.join(tempHome, "state");
    const storePath = path.join(storeDir, "workflows.json");
    mkdirSync(storeDir, { recursive: true });

    writeFileSync(
      storePath,
      JSON.stringify(
        {
          workflows: [
            {
              id: "workflow-a",
              name: "Workflow A",
              description: null,
              ownerType: "person",
              ownerId: "person-1",
              status: "active",
              activeVersionId: "version-foreign",
              createdAt: "2026-04-08T00:00:00.000Z",
              updatedAt: "2026-04-08T00:00:00.000Z",
            },
            {
              id: "workflow-b",
              name: "Workflow B",
              description: null,
              ownerType: "team",
              ownerId: "team-1",
              status: "draft",
              activeVersionId: "version-foreign",
              createdAt: "2026-04-08T00:00:00.000Z",
              updatedAt: "2026-04-08T00:00:00.000Z",
            },
          ],
          versions: [
            {
              id: "version-foreign",
              workflowId: "workflow-b",
              versionNumber: 1,
              status: "draft",
              graph: {
                nodes: [],
                edges: [],
                layout: { viewport: { x: 0, y: 0, zoom: 1 } },
                defaults: { timezone: null },
              },
              createdAt: "2026-04-08T00:00:00.000Z",
              updatedAt: "2026-04-08T00:00:00.000Z",
              publishedAt: null,
            },
            {
              id: "version-a-published",
              workflowId: "workflow-a",
              versionNumber: 1,
              status: "published",
              graph: {
                nodes: [],
                edges: [],
                layout: { viewport: { x: 0, y: 0, zoom: 1 } },
                defaults: { timezone: null },
              },
              createdAt: "2026-04-08T00:00:00.000Z",
              updatedAt: "2026-04-08T00:00:00.000Z",
              publishedAt: "2026-04-08T00:00:00.000Z",
            },
            {
              id: "version-a-draft",
              workflowId: "workflow-a",
              versionNumber: 2,
              status: "draft",
              graph: {
                nodes: [],
                edges: [],
                layout: { viewport: { x: 0, y: 0, zoom: 1 } },
                defaults: { timezone: null },
              },
              createdAt: "2026-04-08T00:00:00.000Z",
              updatedAt: "2026-04-08T00:00:00.000Z",
              publishedAt: null,
            },
            {
              id: "version-filtered-out",
              workflowId: "",
              versionNumber: 9,
              status: "draft",
              graph: {
                nodes: [],
                edges: [],
                layout: { viewport: { x: 0, y: 0, zoom: 1 } },
                defaults: { timezone: null },
              },
              createdAt: "2026-04-08T00:00:00.000Z",
              updatedAt: "2026-04-08T00:00:00.000Z",
              publishedAt: null,
            },
          ],
        },
        null,
        2,
      ),
      "utf8",
    );

    const workflowStore = await loadWorkflowStore();
    const detail = workflowStore.getWorkflow("workflow-a");

    expect(detail?.workflow.activeVersionId).toBe("version-a-draft");
    expect(detail?.versions.some((version) => version.id === detail.workflow.activeVersionId)).toBe(true);
    expect(detail?.versions.every((version) => version.workflowId === "workflow-a")).toBe(true);
  });

  it("normalizes malformed nodes and filters invalid edges from persisted graphs", async () => {
    const tempHome = mkdtempSync(path.join(os.tmpdir(), "opencrab-workflow-store-"));
    tempHomes.push(tempHome);
    process.env.OPENCRAB_HOME = tempHome;

    const storeDir = path.join(tempHome, "state");
    const storePath = path.join(storeDir, "workflows.json");
    mkdirSync(storeDir, { recursive: true });

    writeFileSync(
      storePath,
      JSON.stringify(
        {
          workflows: [
            {
              id: "workflow-malformed-graph",
              name: "Malformed graph workflow",
              description: null,
              ownerType: "person",
              ownerId: "person-1",
              status: "draft",
              activeVersionId: "version-malformed-graph",
              createdAt: "2026-04-08T00:00:00.000Z",
              updatedAt: "2026-04-08T00:00:00.000Z",
            },
          ],
          versions: [
            {
              id: "version-malformed-graph",
              workflowId: "workflow-malformed-graph",
              versionNumber: 1,
              status: "draft",
              graph: {
                nodes: [
                  {
                    id: "start-1",
                    type: "start",
                    name: "Start",
                    config: {
                      trigger: "manual",
                    },
                    uiPosition: { x: 10, y: 20 },
                  },
                  {
                    type: "agent",
                  },
                  {
                    id: "unknown-1",
                    type: "unknown",
                  },
                  {
                    id: "end-1",
                    type: "end",
                    name: "End",
                    config: {
                      deliveryTarget: "none",
                    },
                    uiPosition: { x: 200, y: 20 },
                  },
                ],
                edges: [
                  {
                    sourceNodeId: "start-1",
                    targetNodeId: "end-1",
                  },
                  {
                    id: "edge-missing-endpoint",
                    sourceNodeId: "ghost",
                    targetNodeId: "end-1",
                  },
                  {
                    id: "edge-valid",
                    sourceNodeId: "start-1",
                    targetNodeId: "end-1",
                    condition: null,
                    label: null,
                  },
                ],
                layout: { viewport: { x: 0, y: 0, zoom: 1 } },
                defaults: { timezone: null },
              },
              createdAt: "2026-04-08T00:00:00.000Z",
              updatedAt: "2026-04-08T00:00:00.000Z",
              publishedAt: null,
            },
          ],
        },
        null,
        2,
      ),
      "utf8",
    );

    const workflowStore = await loadWorkflowStore();
    const detail = workflowStore.getWorkflow("workflow-malformed-graph");
    const graph = detail?.versions[0]?.graph;

    expect(graph).toBeDefined();
    expect(graph?.nodes.every((node) => typeof node.id === "string" && node.id.length > 0)).toBe(true);
    expect(graph?.nodes.every((node) => ["start", "script", "agent", "end"].includes(node.type))).toBe(true);
    expect(graph?.nodes.some((node) => node.type === "agent")).toBe(true);

    const agentNode = graph?.nodes.find((node) => node.type === "agent");
    expect(agentNode?.config).toEqual({
      agentId: null,
      prompt: null,
    });

    expect(graph?.edges).toEqual([
      {
        id: "edge-valid",
        sourceNodeId: "start-1",
        targetNodeId: "end-1",
        condition: null,
        label: null,
      },
    ]);
  });
});
