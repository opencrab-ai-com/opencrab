import type { WorkflowGraph } from "@/lib/workflows/types";

export type ConditionalEdgeIssueCode =
  | "conditional_edge_missing_condition"
  | "conditional_edge_duplicate_condition";

export type ConditionalEdgeIssue = {
  code: ConditionalEdgeIssueCode;
  sourceNodeId: string;
  edgeId: string;
};

export type ConditionalEdgeState = {
  isReady: boolean;
  reasons: ConditionalEdgeIssueCode[];
};

export type ConditionalEdgeReadinessResult = {
  isReady: boolean;
  issues: ConditionalEdgeIssue[];
  byEdgeId: Record<string, ConditionalEdgeState>;
};

export type MergeReadinessItem = {
  nodeId: string;
  incomingNodeIds: string[];
  waitingOnNodeIds: string[];
  isReady: boolean;
};

export type WorkflowPublishValidationErrorCode =
  | "missing_start_node"
  | "missing_end_node"
  | "invalid_edge_reference"
  | "unreachable_node"
  | "script_node_missing_source"
  | "agent_node_missing_agent"
  | ConditionalEdgeIssueCode;

export type WorkflowPublishValidationError = {
  code: WorkflowPublishValidationErrorCode;
  message: string;
  nodeId?: string;
  edgeId?: string;
};

export type WorkflowPublishValidationResult = {
  isValid: boolean;
  errors: WorkflowPublishValidationError[];
  conditionalReadiness: ConditionalEdgeReadinessResult;
  mergeReadiness: MergeReadinessItem[];
};

export function evaluateConditionalEdgeReadiness(
  graph: WorkflowGraph,
): ConditionalEdgeReadinessResult {
  const byEdgeId: Record<string, ConditionalEdgeState> = {};
  const outgoingBySource = new Map<string, WorkflowGraph["edges"]>();

  graph.edges
    .slice()
    .sort((left, right) => left.id.localeCompare(right.id))
    .forEach((edge) => {
      byEdgeId[edge.id] = { isReady: true, reasons: [] };

      const outgoing = outgoingBySource.get(edge.sourceNodeId) ?? [];
      outgoing.push(edge);
      outgoingBySource.set(edge.sourceNodeId, outgoing);
    });

  const issues: ConditionalEdgeIssue[] = [];

  Array.from(outgoingBySource.keys())
    .sort((left, right) => left.localeCompare(right))
    .forEach((sourceNodeId) => {
      const outgoing = (outgoingBySource.get(sourceNodeId) ?? [])
        .slice()
        .sort((left, right) => left.id.localeCompare(right.id));

      if (outgoing.length <= 1) {
        return;
      }

      const hasConditionalOutgoing = outgoing.some((edge) => Boolean(normalizeCondition(edge.condition)));

      if (!hasConditionalOutgoing) {
        return;
      }

      const normalizedBuckets = new Map<string, WorkflowGraph["edges"]>();

      outgoing.forEach((edge) => {
        const condition = normalizeCondition(edge.condition);

        if (!condition) {
          issues.push({
            code: "conditional_edge_missing_condition",
            sourceNodeId,
            edgeId: edge.id,
          });
          return;
        }

        const bucket = normalizedBuckets.get(condition) ?? [];
        bucket.push(edge);
        normalizedBuckets.set(condition, bucket);
      });

      Array.from(normalizedBuckets.values()).forEach((bucket) => {
        if (bucket.length <= 1) {
          return;
        }

        bucket.forEach((edge) => {
          issues.push({
            code: "conditional_edge_duplicate_condition",
            sourceNodeId,
            edgeId: edge.id,
          });
        });
      });
    });

  issues
    .slice()
    .sort(compareConditionalIssues)
    .forEach((issue) => {
      byEdgeId[issue.edgeId].isReady = false;
      byEdgeId[issue.edgeId].reasons = [
        ...new Set([...byEdgeId[issue.edgeId].reasons, issue.code]),
      ];
    });

  return {
    isReady: issues.length === 0,
    issues: issues.slice().sort(compareConditionalIssues),
    byEdgeId,
  };
}

export function evaluateMergeReadiness(
  graph: WorkflowGraph,
  completedNodeIds: Iterable<string>,
): MergeReadinessItem[] {
  const completed = new Set(completedNodeIds);
  const incomingByTarget = buildIncomingByTarget(graph);

  return graph.nodes
    .slice()
    .sort((left, right) => left.id.localeCompare(right.id))
    .map((node) => {
      const incomingNodeIds = Array.from(incomingByTarget.get(node.id) ?? [])
        .slice()
        .sort((left, right) => left.localeCompare(right));

      if (incomingNodeIds.length <= 1) {
        return null;
      }

      const waitingOnNodeIds = incomingNodeIds.filter((nodeId) => !completed.has(nodeId));

      return {
        nodeId: node.id,
        incomingNodeIds,
        waitingOnNodeIds,
        isReady: waitingOnNodeIds.length === 0,
      } satisfies MergeReadinessItem;
    })
    .filter((item): item is MergeReadinessItem => item !== null);
}

export function markStaleDescendants(
  graph: WorkflowGraph,
  changedNodeIds: Iterable<string>,
): string[] {
  const changed = new Set(changedNodeIds);
  const outgoingBySource = buildOutgoingBySource(graph);
  const queue = Array.from(changed);
  const visited = new Set<string>(queue);
  const stale = new Set<string>();

  while (queue.length) {
    const nodeId = queue.shift();

    if (!nodeId) {
      continue;
    }

    const targets = outgoingBySource.get(nodeId) ?? [];

    targets.forEach((targetNodeId) => {
      if (changed.has(targetNodeId)) {
        return;
      }

      stale.add(targetNodeId);

      if (visited.has(targetNodeId)) {
        return;
      }

      visited.add(targetNodeId);
      queue.push(targetNodeId);
    });
  }

  return Array.from(stale).sort((left, right) => left.localeCompare(right));
}

export function validateWorkflowForPublish(
  graph: WorkflowGraph,
): WorkflowPublishValidationResult {
  const errors: WorkflowPublishValidationError[] = [];
  const nodeIds = new Set(graph.nodes.map((node) => node.id));
  const starts = graph.nodes.filter((node) => node.type === "start");
  const ends = graph.nodes.filter((node) => node.type === "end");
  const conditionalReadiness = evaluateConditionalEdgeReadiness(graph);
  const mergeReadiness = evaluateMergeReadiness(graph, []);

  if (starts.length === 0) {
    errors.push({
      code: "missing_start_node",
      message: "Workflow requires at least one start node.",
    });
  }

  if (ends.length === 0) {
    errors.push({
      code: "missing_end_node",
      message: "Workflow requires at least one end node.",
    });
  }

  graph.edges.forEach((edge) => {
    if (!nodeIds.has(edge.sourceNodeId) || !nodeIds.has(edge.targetNodeId)) {
      errors.push({
        code: "invalid_edge_reference",
        message: "Edge references nodes that do not exist.",
        edgeId: edge.id,
      });
    }
  });

  const reachableNodeIds = traverseReachableNodes(graph, starts.map((node) => node.id));

  graph.nodes
    .slice()
    .sort((left, right) => left.id.localeCompare(right.id))
    .forEach((node) => {
      if (
        node.type === "script" &&
        !node.config.source?.trim() &&
        !node.config.scriptId?.trim()
      ) {
        errors.push({
          code: "script_node_missing_source",
          message: "Script node requires script content before publish.",
          nodeId: node.id,
        });
      }

      if (node.type === "agent" && !node.config.agentId?.trim()) {
        errors.push({
          code: "agent_node_missing_agent",
          message: "Agent node requires an agent selection before publish.",
          nodeId: node.id,
        });
      }

      if (!reachableNodeIds.has(node.id)) {
        errors.push({
          code: "unreachable_node",
          message: "Node cannot be reached from a start node.",
          nodeId: node.id,
        });
      }
    });

  conditionalReadiness.issues.forEach((issue) => {
    if (issue.code === "conditional_edge_missing_condition") {
      errors.push({
        code: issue.code,
        message: "Branch edge requires a condition before publish.",
        nodeId: issue.sourceNodeId,
        edgeId: issue.edgeId,
      });
      return;
    }

    errors.push({
      code: issue.code,
      message: "Branch conditions must be unique for each source node.",
      nodeId: issue.sourceNodeId,
      edgeId: issue.edgeId,
    });
  });

  return {
    isValid: errors.length === 0,
    errors: errors.slice().sort(compareValidationErrors),
    conditionalReadiness,
    mergeReadiness,
  };
}

function buildOutgoingBySource(graph: WorkflowGraph) {
  const outgoingBySource = new Map<string, string[]>();

  graph.edges.forEach((edge) => {
    const outgoing = outgoingBySource.get(edge.sourceNodeId) ?? [];
    outgoing.push(edge.targetNodeId);
    outgoingBySource.set(edge.sourceNodeId, outgoing);
  });

  outgoingBySource.forEach((targets, nodeId) => {
    outgoingBySource.set(nodeId, targets.slice().sort((left, right) => left.localeCompare(right)));
  });

  return outgoingBySource;
}

function buildIncomingByTarget(graph: WorkflowGraph) {
  const incomingByTarget = new Map<string, Set<string>>();

  graph.edges.forEach((edge) => {
    const incoming = incomingByTarget.get(edge.targetNodeId) ?? new Set<string>();
    incoming.add(edge.sourceNodeId);
    incomingByTarget.set(edge.targetNodeId, incoming);
  });

  return incomingByTarget;
}

function traverseReachableNodes(
  graph: WorkflowGraph,
  startNodeIds: string[],
) {
  const outgoingBySource = buildOutgoingBySource(graph);
  const queue = [...startNodeIds];
  const visited = new Set<string>();

  while (queue.length) {
    const nodeId = queue.shift();

    if (!nodeId || visited.has(nodeId)) {
      continue;
    }

    visited.add(nodeId);

    const targets = outgoingBySource.get(nodeId) ?? [];

    targets.forEach((targetNodeId) => {
      if (!visited.has(targetNodeId)) {
        queue.push(targetNodeId);
      }
    });
  }

  return visited;
}

function compareConditionalIssues(
  left: ConditionalEdgeIssue,
  right: ConditionalEdgeIssue,
) {
  if (left.sourceNodeId !== right.sourceNodeId) {
    return left.sourceNodeId.localeCompare(right.sourceNodeId);
  }

  if (left.edgeId !== right.edgeId) {
    return left.edgeId.localeCompare(right.edgeId);
  }

  return left.code.localeCompare(right.code);
}

function compareValidationErrors(
  left: WorkflowPublishValidationError,
  right: WorkflowPublishValidationError,
) {
  if ((left.nodeId ?? "") !== (right.nodeId ?? "")) {
    return (left.nodeId ?? "").localeCompare(right.nodeId ?? "");
  }

  if ((left.edgeId ?? "") !== (right.edgeId ?? "")) {
    return (left.edgeId ?? "").localeCompare(right.edgeId ?? "");
  }

  return left.code.localeCompare(right.code);
}

function normalizeCondition(condition: string | null) {
  return typeof condition === "string" ? condition.trim() : "";
}
