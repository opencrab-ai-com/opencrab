import { mkdtempSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { WorkflowGraph, WorkflowNodeRecord } from "@/lib/workflows/types";

type WorkflowStoreModule = Awaited<typeof import("@/lib/workflows/workflow-store")>;
type WorkflowRunnerModule = Awaited<typeof import("@/lib/workflows/workflow-runner")>;
type WorkflowExecutorModule = Awaited<typeof import("@/lib/workflows/workflow-executor")>;

function createDeferred<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((innerResolve, innerReject) => {
    resolve = innerResolve;
    reject = innerReject;
  });

  return {
    promise,
    resolve,
    reject,
  };
}

function createNode(
  id: string,
  type: WorkflowNodeRecord["type"],
  config: Record<string, unknown> = {},
): WorkflowNodeRecord {
  if (type === "start") {
    return {
      id,
      type,
      name: id,
      config: {
        trigger: config.trigger === "schedule" ? "schedule" : "manual",
        schedule: (config.schedule as WorkflowNodeRecord["config"] extends { schedule?: infer T } ? T : never) ?? null,
      },
      uiPosition: { x: 0, y: 0 },
    } as WorkflowNodeRecord;
  }

  if (type === "script") {
    return {
      id,
      type,
      name: id,
      config: {
        scriptId: typeof config.scriptId === "string" ? config.scriptId : id,
      },
      uiPosition: { x: 0, y: 0 },
    };
  }

  if (type === "agent") {
    return {
      id,
      type,
      name: id,
      config: {
        agentId: typeof config.agentId === "string" ? config.agentId : id,
        prompt: typeof config.prompt === "string" ? config.prompt : null,
      },
      uiPosition: { x: 0, y: 0 },
    };
  }

  return {
    id,
    type: "end",
    name: id,
    config: {
      deliveryTarget: "none",
    },
    uiPosition: { x: 0, y: 0 },
  };
}

function createGraph(input: {
  nodes: WorkflowNodeRecord[];
  edges: WorkflowGraph["edges"];
  timezone?: string | null;
}): WorkflowGraph {
  return {
    nodes: input.nodes,
    edges: input.edges,
    layout: {
      viewport: { x: 0, y: 0, zoom: 1 },
    },
    defaults: {
      timezone: input.timezone ?? null,
    },
  };
}

async function loadWorkflowModules(): Promise<{
  workflowStore: WorkflowStoreModule;
  workflowRunner: WorkflowRunnerModule;
  workflowExecutor: WorkflowExecutorModule;
}> {
  vi.resetModules();
  const [workflowStore, workflowRunner, workflowExecutor] = await Promise.all([
    import("@/lib/workflows/workflow-store"),
    import("@/lib/workflows/workflow-runner"),
    import("@/lib/workflows/workflow-executor"),
  ]);

  return {
    workflowStore,
    workflowRunner,
    workflowExecutor,
  };
}

async function flushMicrotasks() {
  await Promise.resolve();
  await Promise.resolve();
}

describe("workflow runner", () => {
  const originalOpencrabHome = process.env.OPENCRAB_HOME;
  const tempHomes: string[] = [];

  beforeEach(() => {
    tempHomes.length = 0;
  });

  afterEach(() => {
    if (globalThis.__opencrabWorkflowRunnerTimer) {
      clearTimeout(globalThis.__opencrabWorkflowRunnerTimer);
    }

    globalThis.__opencrabWorkflowRunnerTimer = undefined;
    globalThis.__opencrabWorkflowRunnerPromise = undefined;
    globalThis.__opencrabWorkflowExecutionPromises = undefined;
    globalThis.__opencrabWorkflowRunPromises = undefined;
    globalThis.__opencrabWorkflowRunnerLastRunAt = undefined;
    vi.useRealTimers();

    if (originalOpencrabHome === undefined) {
      delete process.env.OPENCRAB_HOME;
    } else {
      process.env.OPENCRAB_HOME = originalOpencrabHome;
    }

    tempHomes.forEach((tempHome) => {
      rmSync(tempHome, { recursive: true, force: true });
    });
  });

  it("runs scheduled start nodes only during scheduler cycles and manual start nodes only during manual runs", async () => {
    const tempHome = mkdtempSync(path.join(os.tmpdir(), "opencrab-workflow-runner-"));
    tempHomes.push(tempHome);
    process.env.OPENCRAB_HOME = tempHome;

    const { workflowExecutor, workflowRunner, workflowStore } = await loadWorkflowModules();
    const executedNodeIds: string[] = [];
    const runner = workflowRunner.createWorkflowRunner({
      executor: workflowExecutor.createWorkflowExecutor({
        executeNode: async ({ node }) => {
          executedNodeIds.push(node.id);
          return { nodeId: node.id };
        },
      }),
    });

    const graph = createGraph({
      nodes: [
        createNode("node-start-manual", "start", { trigger: "manual" }),
        createNode("node-start-schedule", "start", {
          trigger: "schedule",
          schedule: { preset: "interval", intervalMinutes: 15 },
        }),
        createNode("node-manual-agent", "agent"),
        createNode("node-schedule-agent", "agent"),
        createNode("node-end-manual", "end"),
        createNode("node-end-schedule", "end"),
      ],
      edges: [
        {
          id: "edge-manual-agent",
          sourceNodeId: "node-start-manual",
          targetNodeId: "node-manual-agent",
          condition: null,
          label: null,
        },
        {
          id: "edge-agent-manual-end",
          sourceNodeId: "node-manual-agent",
          targetNodeId: "node-end-manual",
          condition: null,
          label: null,
        },
        {
          id: "edge-schedule-agent",
          sourceNodeId: "node-start-schedule",
          targetNodeId: "node-schedule-agent",
          condition: null,
          label: null,
        },
        {
          id: "edge-agent-schedule-end",
          sourceNodeId: "node-schedule-agent",
          targetNodeId: "node-end-schedule",
          condition: null,
          label: null,
        },
      ],
    });

    const created = workflowStore.createWorkflow({
      name: "Dual trigger workflow",
      ownerType: "person",
      ownerId: "person-1",
    });
    const published = workflowStore.publishWorkflow(created.workflow.id, { graph });

    if (!published) {
      throw new Error("Expected publish to succeed.");
    }

    const publishedVersion = published.versions.find((version) => version.status === "published");

    if (!publishedVersion?.publishedAt) {
      throw new Error("Expected published workflow version.");
    }

    const manualRun = await runner.runWorkflowNow(created.workflow.id, {
      waitForCompletion: true,
    });

    expect(manualRun.run.status).toBe("accepted");
    expect(executedNodeIds).toContain("node-manual-agent");
    expect(executedNodeIds).not.toContain("node-schedule-agent");

    executedNodeIds.length = 0;

    await runner.runDueWorkflows(new Date(Date.parse(publishedVersion.publishedAt) + 16 * 60_000), {
      waitForCompletion: true,
    });

    expect(executedNodeIds).toContain("node-schedule-agent");
    expect(executedNodeIds).not.toContain("node-manual-agent");
  });

  it("routes execution through the matching conditional branch only", async () => {
    const tempHome = mkdtempSync(path.join(os.tmpdir(), "opencrab-workflow-runner-"));
    tempHomes.push(tempHome);
    process.env.OPENCRAB_HOME = tempHome;

    const { workflowExecutor, workflowRunner, workflowStore } = await loadWorkflowModules();
    const executedNodeIds: string[] = [];
    const runner = workflowRunner.createWorkflowRunner({
      executor: workflowExecutor.createWorkflowExecutor({
        executeNode: async ({ node }) => {
          executedNodeIds.push(node.id);

          if (node.id === "node-router") {
            return { route: "approved" };
          }

          return { handledBy: node.id };
        },
      }),
    });

    const graph = createGraph({
      nodes: [
        createNode("node-start", "start", { trigger: "manual" }),
        createNode("node-router", "script"),
        createNode("node-approved", "agent"),
        createNode("node-rejected", "agent"),
        createNode("node-approved-end", "end"),
        createNode("node-rejected-end", "end"),
      ],
      edges: [
        {
          id: "edge-start-router",
          sourceNodeId: "node-start",
          targetNodeId: "node-router",
          condition: null,
          label: null,
        },
        {
          id: "edge-router-approved",
          sourceNodeId: "node-router",
          targetNodeId: "node-approved",
          condition: "route === 'approved'",
          label: null,
        },
        {
          id: "edge-router-rejected",
          sourceNodeId: "node-router",
          targetNodeId: "node-rejected",
          condition: "route === 'rejected'",
          label: null,
        },
        {
          id: "edge-approved-end",
          sourceNodeId: "node-approved",
          targetNodeId: "node-approved-end",
          condition: null,
          label: null,
        },
        {
          id: "edge-rejected-end",
          sourceNodeId: "node-rejected",
          targetNodeId: "node-rejected-end",
          condition: null,
          label: null,
        },
      ],
    });

    const created = workflowStore.createWorkflow({
      name: "Conditional branch workflow",
      ownerType: "person",
      ownerId: "person-branch",
    });
    workflowStore.publishWorkflow(created.workflow.id, { graph });

    const accepted = await runner.runWorkflowNow(created.workflow.id, {
      waitForCompletion: true,
    });
    const nodeRuns = workflowStore.listWorkflowNodeRuns(accepted.run.id);

    expect(executedNodeIds).toContain("node-router");
    expect(executedNodeIds).toContain("node-approved");
    expect(executedNodeIds).not.toContain("node-rejected");
    expect(nodeRuns.some((run) => run.nodeId === "node-approved")).toBe(true);
    expect(nodeRuns.some((run) => run.nodeId === "node-rejected")).toBe(false);
  });

  it("treats daily schedules as due in the workflow timezone instead of the server timezone", async () => {
    const tempHome = mkdtempSync(path.join(os.tmpdir(), "opencrab-workflow-runner-"));
    tempHomes.push(tempHome);
    process.env.OPENCRAB_HOME = tempHome;
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-04-07T18:00:00.000Z"));

    const { workflowExecutor, workflowRunner, workflowStore } = await loadWorkflowModules();
    const executedNodeIds: string[] = [];
    const runner = workflowRunner.createWorkflowRunner({
      executor: workflowExecutor.createWorkflowExecutor({
        executeNode: async ({ node }) => {
          executedNodeIds.push(node.id);
          return { nodeId: node.id };
        },
      }),
    });

    const graph = createGraph({
      nodes: [
        createNode("node-start-schedule", "start", {
          trigger: "schedule",
          schedule: { preset: "daily", time: "09:00" },
        }),
        createNode("node-schedule-agent", "agent"),
        createNode("node-end", "end"),
      ],
      edges: [
        {
          id: "edge-start-agent",
          sourceNodeId: "node-start-schedule",
          targetNodeId: "node-schedule-agent",
          condition: null,
          label: null,
        },
        {
          id: "edge-agent-end",
          sourceNodeId: "node-schedule-agent",
          targetNodeId: "node-end",
          condition: null,
          label: null,
        },
      ],
      timezone: "Pacific/Kiritimati",
    });

    const created = workflowStore.createWorkflow({
      name: "Timezone workflow",
      ownerType: "person",
      ownerId: "person-timezone",
    });
    workflowStore.publishWorkflow(created.workflow.id, { graph });

    await runner.runDueWorkflows(new Date("2026-04-08T00:30:00.000Z"), {
      waitForCompletion: true,
    });

    expect(executedNodeIds).toContain("node-schedule-agent");
  });

  it("allows a merge node to continue when only one conditional branch becomes active", async () => {
    const tempHome = mkdtempSync(path.join(os.tmpdir(), "opencrab-workflow-runner-"));
    tempHomes.push(tempHome);
    process.env.OPENCRAB_HOME = tempHome;

    const { workflowExecutor, workflowRunner, workflowStore } = await loadWorkflowModules();
    const executedNodeIds: string[] = [];
    const runner = workflowRunner.createWorkflowRunner({
      executor: workflowExecutor.createWorkflowExecutor({
        executeNode: async ({ node }) => {
          executedNodeIds.push(node.id);

          if (node.id === "node-router") {
            return { route: "approved" };
          }

          return { handledBy: node.id };
        },
      }),
    });

    const graph = createGraph({
      nodes: [
        createNode("node-start", "start", { trigger: "manual" }),
        createNode("node-router", "script"),
        createNode("node-approved", "agent"),
        createNode("node-rejected", "agent"),
        createNode("node-merge", "script"),
        createNode("node-end", "end"),
      ],
      edges: [
        {
          id: "edge-start-router",
          sourceNodeId: "node-start",
          targetNodeId: "node-router",
          condition: null,
          label: null,
        },
        {
          id: "edge-router-approved",
          sourceNodeId: "node-router",
          targetNodeId: "node-approved",
          condition: "route === 'approved'",
          label: null,
        },
        {
          id: "edge-router-rejected",
          sourceNodeId: "node-router",
          targetNodeId: "node-rejected",
          condition: "route === 'rejected'",
          label: null,
        },
        {
          id: "edge-approved-merge",
          sourceNodeId: "node-approved",
          targetNodeId: "node-merge",
          condition: null,
          label: null,
        },
        {
          id: "edge-rejected-merge",
          sourceNodeId: "node-rejected",
          targetNodeId: "node-merge",
          condition: null,
          label: null,
        },
        {
          id: "edge-merge-end",
          sourceNodeId: "node-merge",
          targetNodeId: "node-end",
          condition: null,
          label: null,
        },
      ],
    });

    const created = workflowStore.createWorkflow({
      name: "Conditional merge workflow",
      ownerType: "person",
      ownerId: "person-conditional-merge",
    });
    workflowStore.publishWorkflow(created.workflow.id, { graph });

    const accepted = await runner.runWorkflowNow(created.workflow.id, {
      waitForCompletion: true,
    });
    const nodeRuns = workflowStore.listWorkflowNodeRuns(accepted.run.id);

    expect(executedNodeIds).toContain("node-approved");
    expect(executedNodeIds).not.toContain("node-rejected");
    expect(executedNodeIds).toContain("node-merge");
    expect(executedNodeIds).toContain("node-end");
    expect(nodeRuns.some((run) => run.nodeId === "node-merge")).toBe(true);
  });

  it("keeps the workflow runner polling after startup so newly due workflows still run", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-04-08T09:00:00.000Z"));

    const tempHome = mkdtempSync(path.join(os.tmpdir(), "opencrab-workflow-runner-"));
    tempHomes.push(tempHome);
    process.env.OPENCRAB_HOME = tempHome;

    const { workflowRunner, workflowStore } = await loadWorkflowModules();
    const graph = createGraph({
      nodes: [
        createNode("node-start-schedule", "start", {
          trigger: "schedule",
          schedule: { preset: "interval", intervalMinutes: 1 },
        }),
        createNode("node-schedule-agent", "agent"),
        createNode("node-end", "end"),
      ],
      edges: [
        {
          id: "edge-start-agent",
          sourceNodeId: "node-start-schedule",
          targetNodeId: "node-schedule-agent",
          condition: null,
          label: null,
        },
        {
          id: "edge-agent-end",
          sourceNodeId: "node-schedule-agent",
          targetNodeId: "node-end",
          condition: null,
          label: null,
        },
      ],
    });

    const created = workflowStore.createWorkflow({
      name: "Recurring scheduler workflow",
      ownerType: "person",
      ownerId: "person-recurring",
    });
    workflowStore.publishWorkflow(created.workflow.id, { graph });

    await workflowRunner.ensureWorkflowRunner();
    expect(workflowStore.listWorkflowRuns(created.workflow.id)).toHaveLength(0);

    await vi.advanceTimersByTimeAsync(70_000);

    expect(workflowStore.listWorkflowRuns(created.workflow.id)).toHaveLength(1);
  });

  it("waits for every upstream branch to complete before starting a merge node", async () => {
    const tempHome = mkdtempSync(path.join(os.tmpdir(), "opencrab-workflow-runner-"));
    tempHomes.push(tempHome);
    process.env.OPENCRAB_HOME = tempHome;

    const { workflowExecutor, workflowRunner, workflowStore } = await loadWorkflowModules();
    const executedNodeIds: string[] = [];
    const branchA = createDeferred<Record<string, unknown>>();
    const branchB = createDeferred<Record<string, unknown>>();
    const runner = workflowRunner.createWorkflowRunner({
      executor: workflowExecutor.createWorkflowExecutor({
        executeNode: async ({ node }) => {
          executedNodeIds.push(node.id);

          if (node.id === "node-branch-a") {
            return branchA.promise;
          }

          if (node.id === "node-branch-b") {
            return branchB.promise;
          }

          return { nodeId: node.id };
        },
      }),
    });

    const graph = createGraph({
      nodes: [
        createNode("node-start", "start", { trigger: "manual" }),
        createNode("node-branch-a", "script"),
        createNode("node-branch-b", "script"),
        createNode("node-merge", "agent"),
        createNode("node-end", "end"),
      ],
      edges: [
        {
          id: "edge-start-a",
          sourceNodeId: "node-start",
          targetNodeId: "node-branch-a",
          condition: null,
          label: null,
        },
        {
          id: "edge-start-b",
          sourceNodeId: "node-start",
          targetNodeId: "node-branch-b",
          condition: null,
          label: null,
        },
        {
          id: "edge-a-merge",
          sourceNodeId: "node-branch-a",
          targetNodeId: "node-merge",
          condition: null,
          label: null,
        },
        {
          id: "edge-b-merge",
          sourceNodeId: "node-branch-b",
          targetNodeId: "node-merge",
          condition: null,
          label: null,
        },
        {
          id: "edge-merge-end",
          sourceNodeId: "node-merge",
          targetNodeId: "node-end",
          condition: null,
          label: null,
        },
      ],
    });

    const created = workflowStore.createWorkflow({
      name: "Merge wait workflow",
      ownerType: "team",
      ownerId: "team-merge",
    });
    workflowStore.publishWorkflow(created.workflow.id, { graph });

    const accepted = await runner.runWorkflowNow(created.workflow.id);
    await vi.waitFor(() => {
      expect(executedNodeIds).toContain("node-branch-a");
      expect(executedNodeIds).toContain("node-branch-b");
    });
    expect(executedNodeIds).not.toContain("node-merge");

    branchA.resolve({ branch: "a" });
    await flushMicrotasks();

    expect(executedNodeIds).not.toContain("node-merge");

    branchB.resolve({ branch: "b" });
    await runner.waitForRun(accepted.run.id);

    expect(executedNodeIds).toContain("node-merge");
    expect(executedNodeIds.indexOf("node-merge")).toBeGreaterThan(
      executedNodeIds.indexOf("node-branch-b"),
    );
  });

  it("keeps the workflow lock until parallel branches settle after a failure", async () => {
    const tempHome = mkdtempSync(path.join(os.tmpdir(), "opencrab-workflow-runner-"));
    tempHomes.push(tempHome);
    process.env.OPENCRAB_HOME = tempHome;

    const { workflowExecutor, workflowRunner, workflowStore } = await loadWorkflowModules();
    const branchSlow = createDeferred<Record<string, unknown>>();
    const branchFailed = createDeferred<void>();
    const runner = workflowRunner.createWorkflowRunner({
      executor: workflowExecutor.createWorkflowExecutor({
        executeNode: async ({ node }) => {
          if (node.id === "node-fail") {
            branchFailed.resolve();
            throw new Error("branch failed");
          }

          if (node.id === "node-slow") {
            return branchSlow.promise;
          }

          return { nodeId: node.id };
        },
      }),
    });

    const graph = createGraph({
      nodes: [
        createNode("node-start", "start", { trigger: "manual" }),
        createNode("node-fail", "script"),
        createNode("node-slow", "script"),
        createNode("node-end", "end"),
      ],
      edges: [
        {
          id: "edge-start-fail",
          sourceNodeId: "node-start",
          targetNodeId: "node-fail",
          condition: null,
          label: null,
        },
        {
          id: "edge-start-slow",
          sourceNodeId: "node-start",
          targetNodeId: "node-slow",
          condition: null,
          label: null,
        },
        {
          id: "edge-slow-end",
          sourceNodeId: "node-slow",
          targetNodeId: "node-end",
          condition: null,
          label: null,
        },
      ],
    });

    const created = workflowStore.createWorkflow({
      name: "Parallel failure workflow",
      ownerType: "person",
      ownerId: "person-failure",
    });
    workflowStore.publishWorkflow(created.workflow.id, { graph });

    const accepted = await runner.runWorkflowNow(created.workflow.id);
    let waitForRunSettled = false;
    const waitForRunPromise = runner.waitForRun(accepted.run.id);
    void waitForRunPromise.then(
      () => {
        waitForRunSettled = true;
      },
      () => {
        waitForRunSettled = true;
      },
    );
    await branchFailed.promise;
    await flushMicrotasks();
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(waitForRunSettled).toBe(false);

    branchSlow.resolve({ branch: "slow" });
    await expect(waitForRunPromise).rejects.toThrow("branch failed");
    expect(waitForRunSettled).toBe(true);
  });

  it("continues checking later workflows when one due workflow is already running", async () => {
    const tempHome = mkdtempSync(path.join(os.tmpdir(), "opencrab-workflow-runner-"));
    tempHomes.push(tempHome);
    process.env.OPENCRAB_HOME = tempHome;

    const { workflowExecutor, workflowRunner, workflowStore } = await loadWorkflowModules();
    const executedNodeIds: string[] = [];
    const blockingBranch = createDeferred<Record<string, unknown>>();
    const runner = workflowRunner.createWorkflowRunner({
      executor: workflowExecutor.createWorkflowExecutor({
        executeNode: async ({ node }) => {
          executedNodeIds.push(node.id);

          if (node.id === "node-blocking-manual") {
            return blockingBranch.promise;
          }

          return { nodeId: node.id };
        },
      }),
    });

    const busyGraph = createGraph({
      nodes: [
        createNode("node-start-manual", "start", { trigger: "manual" }),
        createNode("node-start-schedule", "start", {
          trigger: "schedule",
          schedule: { preset: "interval", intervalMinutes: 15 },
        }),
        createNode("node-blocking-manual", "script"),
        createNode("node-scheduled-busy", "script"),
        createNode("node-end-manual", "end"),
        createNode("node-end-scheduled", "end"),
      ],
      edges: [
        {
          id: "edge-manual-blocking",
          sourceNodeId: "node-start-manual",
          targetNodeId: "node-blocking-manual",
          condition: null,
          label: null,
        },
        {
          id: "edge-blocking-end",
          sourceNodeId: "node-blocking-manual",
          targetNodeId: "node-end-manual",
          condition: null,
          label: null,
        },
        {
          id: "edge-schedule-busy",
          sourceNodeId: "node-start-schedule",
          targetNodeId: "node-scheduled-busy",
          condition: null,
          label: null,
        },
        {
          id: "edge-scheduled-end",
          sourceNodeId: "node-scheduled-busy",
          targetNodeId: "node-end-scheduled",
          condition: null,
          label: null,
        },
      ],
    });
    const readyGraph = createGraph({
      nodes: [
        createNode("node-start-schedule-ready", "start", {
          trigger: "schedule",
          schedule: { preset: "interval", intervalMinutes: 15 },
        }),
        createNode("node-ready-agent", "agent"),
        createNode("node-ready-end", "end"),
      ],
      edges: [
        {
          id: "edge-ready-agent",
          sourceNodeId: "node-start-schedule-ready",
          targetNodeId: "node-ready-agent",
          condition: null,
          label: null,
        },
        {
          id: "edge-ready-end",
          sourceNodeId: "node-ready-agent",
          targetNodeId: "node-ready-end",
          condition: null,
          label: null,
        },
      ],
    });

    const busyWorkflow = workflowStore.createWorkflow({
      name: "Busy workflow",
      ownerType: "team",
      ownerId: "team-busy",
    });
    const busyPublished = workflowStore.publishWorkflow(busyWorkflow.workflow.id, { graph: busyGraph });
    const readyWorkflow = workflowStore.createWorkflow({
      name: "Ready workflow",
      ownerType: "team",
      ownerId: "team-ready",
    });
    workflowStore.publishWorkflow(readyWorkflow.workflow.id, { graph: readyGraph });

    if (!busyPublished) {
      throw new Error("Expected busy workflow publish to succeed.");
    }

    const busyScheduledVersion = busyPublished.versions.find((version) => version.status === "published");

    if (!busyScheduledVersion?.publishedAt) {
      throw new Error("Expected busy workflow published version.");
    }

    const manualRun = await runner.runWorkflowNow(busyWorkflow.workflow.id);
    await vi.waitFor(() => {
      expect(executedNodeIds).toContain("node-blocking-manual");
    });

    const triggeredRuns = await runner.runDueWorkflows(
      new Date(Date.parse(busyScheduledVersion.publishedAt) + 16 * 60_000),
      { waitForCompletion: true },
    );

    expect(triggeredRuns).toHaveLength(1);
    expect(executedNodeIds).toContain("node-ready-agent");

    blockingBranch.resolve({ finished: true });
    await runner.waitForRun(manualRun.run.id);
  });

  it("records node-run startedAt using the individual node start time", async () => {
    const tempHome = mkdtempSync(path.join(os.tmpdir(), "opencrab-workflow-runner-"));
    tempHomes.push(tempHome);
    process.env.OPENCRAB_HOME = tempHome;

    const { workflowExecutor, workflowRunner, workflowStore } = await loadWorkflowModules();
    const runner = workflowRunner.createWorkflowRunner({
      executor: workflowExecutor.createWorkflowExecutor({
        executeNode: async ({ node }) => {
          if (node.id === "node-delay") {
            await new Promise((resolve) => setTimeout(resolve, 20));
          }

          return { nodeId: node.id };
        },
      }),
    });

    const graph = createGraph({
      nodes: [
        createNode("node-start", "start", { trigger: "manual" }),
        createNode("node-delay", "script"),
        createNode("node-end", "end"),
      ],
      edges: [
        {
          id: "edge-start-delay",
          sourceNodeId: "node-start",
          targetNodeId: "node-delay",
          condition: null,
          label: null,
        },
        {
          id: "edge-delay-end",
          sourceNodeId: "node-delay",
          targetNodeId: "node-end",
          condition: null,
          label: null,
        },
      ],
    });

    const created = workflowStore.createWorkflow({
      name: "Node started-at workflow",
      ownerType: "person",
      ownerId: "person-node-started-at",
    });
    workflowStore.publishWorkflow(created.workflow.id, { graph });

    const accepted = await runner.runWorkflowNow(created.workflow.id, {
      waitForCompletion: true,
    });
    const nodeRuns = workflowStore.listWorkflowNodeRuns(accepted.run.id);
    const delayedNodeRun = nodeRuns.find((run) => run.nodeId === "node-delay");
    const endNodeRun = nodeRuns.find((run) => run.nodeId === "node-end");

    expect(delayedNodeRun).toBeTruthy();
    expect(endNodeRun).toBeTruthy();
    expect(Date.parse(endNodeRun!.startedAt)).toBeGreaterThan(Date.parse(delayedNodeRun!.startedAt));
  });

  it("pins an execution to the published workflow version selected at start time", async () => {
    const tempHome = mkdtempSync(path.join(os.tmpdir(), "opencrab-workflow-runner-"));
    tempHomes.push(tempHome);
    process.env.OPENCRAB_HOME = tempHome;

    const { workflowExecutor, workflowRunner, workflowStore } = await loadWorkflowModules();
    const versionOneGate = createDeferred<Record<string, unknown>>();
    const executedNodeIds: string[] = [];
    const runner = workflowRunner.createWorkflowRunner({
      executor: workflowExecutor.createWorkflowExecutor({
        executeNode: async ({ node }) => {
          executedNodeIds.push(node.id);

          if (node.id === "node-version-1") {
            return versionOneGate.promise;
          }

          return { handledBy: node.id };
        },
      }),
    });

    const workflow = workflowStore.createWorkflow({
      name: "Version pin workflow",
      ownerType: "person",
      ownerId: "person-version",
    });

    const versionOneGraph = createGraph({
      nodes: [
        createNode("node-start-v1", "start", { trigger: "manual" }),
        createNode("node-version-1", "agent"),
        createNode("node-end-v1", "end"),
      ],
      edges: [
        {
          id: "edge-start-v1",
          sourceNodeId: "node-start-v1",
          targetNodeId: "node-version-1",
          condition: null,
          label: null,
        },
        {
          id: "edge-end-v1",
          sourceNodeId: "node-version-1",
          targetNodeId: "node-end-v1",
          condition: null,
          label: null,
        },
      ],
    });

    const firstPublish = workflowStore.publishWorkflow(workflow.workflow.id, {
      graph: versionOneGraph,
    });

    if (!firstPublish) {
      throw new Error("Expected first publish.");
    }

    const versionOne = firstPublish.versions.find((version) => version.status === "published");

    if (!versionOne) {
      throw new Error("Expected first published version.");
    }

    const accepted = await runner.runWorkflowNow(workflow.workflow.id);
    await flushMicrotasks();

    const versionTwoGraph = createGraph({
      nodes: [
        createNode("node-start-v2", "start", { trigger: "manual" }),
        createNode("node-version-2", "agent"),
        createNode("node-end-v2", "end"),
      ],
      edges: [
        {
          id: "edge-start-v2",
          sourceNodeId: "node-start-v2",
          targetNodeId: "node-version-2",
          condition: null,
          label: null,
        },
        {
          id: "edge-end-v2",
          sourceNodeId: "node-version-2",
          targetNodeId: "node-end-v2",
          condition: null,
          label: null,
        },
      ],
    });

    const secondPublish = workflowStore.publishWorkflow(workflow.workflow.id, {
      graph: versionTwoGraph,
    });

    if (!secondPublish) {
      throw new Error("Expected second publish.");
    }

    versionOneGate.resolve({ finished: true });
    await runner.waitForRun(accepted.run.id);

    const storedRuns = workflowStore.listWorkflowRuns(workflow.workflow.id);
    const pinnedRun = storedRuns.find((run) => run.id === accepted.run.id);
    const pinnedNodeRuns = workflowStore.listWorkflowNodeRuns(accepted.run.id);

    expect(pinnedRun?.workflowVersionId).toBe(versionOne.id);
    expect(pinnedNodeRuns.some((run) => run.nodeId === "node-version-1")).toBe(true);
    expect(pinnedNodeRuns.some((run) => run.nodeId === "node-version-2")).toBe(false);

    executedNodeIds.length = 0;

    const latestRun = await runner.runWorkflowNow(workflow.workflow.id, {
      waitForCompletion: true,
    });
    const latestStoredRun = workflowStore
      .listWorkflowRuns(workflow.workflow.id)
      .find((run) => run.id === latestRun.run.id);
    const versionTwo = secondPublish.versions.find(
      (version) => version.status === "published" && version.versionNumber === 2,
    );

    expect(latestStoredRun?.workflowVersionId).toBe(versionTwo?.id);
    expect(executedNodeIds).toContain("node-version-2");
    expect(executedNodeIds).not.toContain("node-version-1");
  });
});
