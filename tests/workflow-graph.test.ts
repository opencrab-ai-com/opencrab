import { describe, expect, it } from "vitest";
import {
  evaluateConditionalEdgeReadiness,
  evaluateMergeReadiness,
  markStaleDescendants,
  validateWorkflowForPublish,
} from "@/lib/workflows/workflow-graph";
import type { WorkflowGraph, WorkflowNodeRecord } from "@/lib/workflows/types";

function createNode(
  id: string,
  type: WorkflowNodeRecord["type"],
): WorkflowNodeRecord {
  if (type === "start") {
    return {
      id,
      type,
      name: "Start",
      config: { trigger: "manual" },
      uiPosition: { x: 0, y: 0 },
    };
  }

  if (type === "script") {
    return {
      id,
      type,
      name: "Script",
      config: { scriptId: null, source: "return {};" },
      uiPosition: { x: 0, y: 0 },
    };
  }

  if (type === "agent") {
    return {
      id,
      type,
      name: "Agent",
      config: { agentId: "agent-default", prompt: null },
      uiPosition: { x: 0, y: 0 },
    };
  }

  return {
    id,
    type: "end",
    name: "End",
    config: { deliveryTarget: "none" },
    uiPosition: { x: 0, y: 0 },
  };
}

function createGraph(input: {
  nodes: WorkflowNodeRecord[];
  edges: WorkflowGraph["edges"];
}): WorkflowGraph {
  return {
    nodes: input.nodes,
    edges: input.edges,
    layout: {
      viewport: { x: 0, y: 0, zoom: 1 },
    },
    defaults: {
      timezone: null,
    },
  };
}

describe("workflow graph helpers", () => {
  it("allows unconditional parallel fan-out without treating it as conditional branching", () => {
    const graph = createGraph({
      nodes: [
        createNode("node-start", "start"),
        createNode("node-script-1", "script"),
        createNode("node-script-2", "script"),
        createNode("node-end", "end"),
      ],
      edges: [
        {
          id: "edge-start-1",
          sourceNodeId: "node-start",
          targetNodeId: "node-script-1",
          condition: null,
          label: null,
        },
        {
          id: "edge-start-2",
          sourceNodeId: "node-start",
          targetNodeId: "node-script-2",
          condition: null,
          label: null,
        },
        {
          id: "edge-script-1-end",
          sourceNodeId: "node-script-1",
          targetNodeId: "node-end",
          condition: null,
          label: null,
        },
        {
          id: "edge-script-2-end",
          sourceNodeId: "node-script-2",
          targetNodeId: "node-end",
          condition: null,
          label: null,
        },
      ],
    });

    const readiness = evaluateConditionalEdgeReadiness(graph);
    const validation = validateWorkflowForPublish(graph);

    expect(readiness.isReady).toBe(true);
    expect(readiness.issues).toEqual([]);
    expect(validation.isValid).toBe(true);
  });

  it("flags conditional branches when one branch edge is missing a condition", () => {
    const graph = createGraph({
      nodes: [
        createNode("node-start", "start"),
        createNode("node-script-1", "script"),
        createNode("node-script-2", "script"),
        createNode("node-end", "end"),
      ],
      edges: [
        {
          id: "edge-start-1",
          sourceNodeId: "node-start",
          targetNodeId: "node-script-1",
          condition: null,
          label: null,
        },
        {
          id: "edge-start-2",
          sourceNodeId: "node-start",
          targetNodeId: "node-script-2",
          condition: "status === 'ok'",
          label: null,
        },
        {
          id: "edge-script-1-end",
          sourceNodeId: "node-script-1",
          targetNodeId: "node-end",
          condition: null,
          label: null,
        },
        {
          id: "edge-script-2-end",
          sourceNodeId: "node-script-2",
          targetNodeId: "node-end",
          condition: null,
          label: null,
        },
      ],
    });

    const readiness = evaluateConditionalEdgeReadiness(graph);

    expect(readiness.isReady).toBe(false);
    expect(readiness.issues).toContainEqual({
      code: "conditional_edge_missing_condition",
      edgeId: "edge-start-1",
      sourceNodeId: "node-start",
    });
    expect(readiness.byEdgeId["edge-start-1"]).toEqual({
      isReady: false,
      reasons: ["conditional_edge_missing_condition"],
    });
    expect(readiness.byEdgeId["edge-start-2"]).toEqual({
      isReady: true,
      reasons: [],
    });
  });

  it("blocks publish when script content or agent selection is missing", () => {
    const graph = createGraph({
      nodes: [
        createNode("node-start", "start"),
        {
          id: "node-script",
          type: "script",
          name: "Script",
          config: { scriptId: null, source: null },
          uiPosition: { x: 0, y: 0 },
        },
        {
          id: "node-agent",
          type: "agent",
          name: "Agent",
          config: { agentId: null, prompt: null },
          uiPosition: { x: 0, y: 0 },
        },
        createNode("node-end", "end"),
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
          id: "edge-script-agent",
          sourceNodeId: "node-script",
          targetNodeId: "node-agent",
          condition: null,
          label: null,
        },
        {
          id: "edge-agent-end",
          sourceNodeId: "node-agent",
          targetNodeId: "node-end",
          condition: null,
          label: null,
        },
      ],
    });

    const validation = validateWorkflowForPublish(graph);

    expect(validation.isValid).toBe(false);
    expect(validation.errors).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: "script_node_missing_source",
          nodeId: "node-script",
        }),
        expect.objectContaining({
          code: "agent_node_missing_agent",
          nodeId: "node-agent",
        }),
      ]),
    );
  });

  it("evaluates merge node readiness from completed upstream nodes", () => {
    const graph = createGraph({
      nodes: [
        createNode("node-start", "start"),
        createNode("node-script-a", "script"),
        createNode("node-script-b", "script"),
        createNode("node-agent-merge", "agent"),
        createNode("node-end", "end"),
      ],
      edges: [
        {
          id: "edge-start-a",
          sourceNodeId: "node-start",
          targetNodeId: "node-script-a",
          condition: "flag === 'a'",
          label: null,
        },
        {
          id: "edge-start-b",
          sourceNodeId: "node-start",
          targetNodeId: "node-script-b",
          condition: "flag === 'b'",
          label: null,
        },
        {
          id: "edge-a-merge",
          sourceNodeId: "node-script-a",
          targetNodeId: "node-agent-merge",
          condition: null,
          label: null,
        },
        {
          id: "edge-b-merge",
          sourceNodeId: "node-script-b",
          targetNodeId: "node-agent-merge",
          condition: null,
          label: null,
        },
        {
          id: "edge-merge-end",
          sourceNodeId: "node-agent-merge",
          targetNodeId: "node-end",
          condition: null,
          label: null,
        },
      ],
    });

    const notReady = evaluateMergeReadiness(graph, ["node-start", "node-script-a"]);
    const ready = evaluateMergeReadiness(graph, [
      "node-start",
      "node-script-a",
      "node-script-b",
    ]);

    expect(notReady).toContainEqual({
      nodeId: "node-agent-merge",
      incomingNodeIds: ["node-script-a", "node-script-b"],
      waitingOnNodeIds: ["node-script-b"],
      isReady: false,
    });
    expect(ready).toContainEqual({
      nodeId: "node-agent-merge",
      incomingNodeIds: ["node-script-a", "node-script-b"],
      waitingOnNodeIds: [],
      isReady: true,
    });
  });

  it("marks stale descendants of changed nodes without marking the changed node itself", () => {
    const graph = createGraph({
      nodes: [
        createNode("node-start", "start"),
        createNode("node-script-a", "script"),
        createNode("node-script-b", "script"),
        createNode("node-agent-c", "agent"),
        createNode("node-end", "end"),
      ],
      edges: [
        {
          id: "edge-start-a",
          sourceNodeId: "node-start",
          targetNodeId: "node-script-a",
          condition: null,
          label: null,
        },
        {
          id: "edge-a-b",
          sourceNodeId: "node-script-a",
          targetNodeId: "node-script-b",
          condition: null,
          label: null,
        },
        {
          id: "edge-a-c",
          sourceNodeId: "node-script-a",
          targetNodeId: "node-agent-c",
          condition: null,
          label: null,
        },
        {
          id: "edge-b-end",
          sourceNodeId: "node-script-b",
          targetNodeId: "node-end",
          condition: null,
          label: null,
        },
        {
          id: "edge-c-end",
          sourceNodeId: "node-agent-c",
          targetNodeId: "node-end",
          condition: null,
          label: null,
        },
      ],
    });

    const staleNodeIds = markStaleDescendants(graph, ["node-script-a"]);

    expect(staleNodeIds).toEqual(["node-agent-c", "node-end", "node-script-b"]);
  });

  it("validates publish readiness for branching and reachability rules", () => {
    const graph = createGraph({
      nodes: [
        createNode("node-start", "start"),
        createNode("node-script-a", "script"),
        createNode("node-script-b", "script"),
        createNode("node-end", "end"),
        createNode("node-orphan", "agent"),
      ],
      edges: [
        {
          id: "edge-start-a",
          sourceNodeId: "node-start",
          targetNodeId: "node-script-a",
          condition: null,
          label: null,
        },
        {
          id: "edge-start-b",
          sourceNodeId: "node-start",
          targetNodeId: "node-script-b",
          condition: "result === 'ok'",
          label: null,
        },
        {
          id: "edge-a-end",
          sourceNodeId: "node-script-a",
          targetNodeId: "node-end",
          condition: null,
          label: null,
        },
        {
          id: "edge-b-end",
          sourceNodeId: "node-script-b",
          targetNodeId: "node-end",
          condition: null,
          label: null,
        },
      ],
    });

    const validation = validateWorkflowForPublish(graph);

    expect(validation.isValid).toBe(false);
    expect(validation.errors).toContainEqual({
      code: "conditional_edge_missing_condition",
      message: "Branch edge requires a condition before publish.",
      nodeId: "node-start",
      edgeId: "edge-start-a",
    });
    expect(validation.errors).toContainEqual({
      code: "unreachable_node",
      message: "Node cannot be reached from a start node.",
      nodeId: "node-orphan",
    });
  });
});
