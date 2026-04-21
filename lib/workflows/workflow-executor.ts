import { getAgentProfile } from "@/lib/agents/agent-store";
import { generateCodexReply } from "@/lib/codex/sdk";
import type {
  WorkflowGraph,
  WorkflowNodeRecord,
  WorkflowRecord,
  WorkflowRunRecord,
  WorkflowVersionRecord,
} from "@/lib/workflows/types";

export type WorkflowExecutionContext = Record<string, unknown>;

export type WorkflowNodeExecutionResult = Record<string, unknown> | null | void;

export type WorkflowNodeExecutionInput = {
  workflow: WorkflowRecord;
  version: WorkflowVersionRecord;
  run: WorkflowRunRecord;
  node: WorkflowNodeRecord;
  context: WorkflowExecutionContext;
};

export type WorkflowExecutionObserver = {
  onNodeStarted?: (input: {
    node: WorkflowNodeRecord;
    inputSnapshot: WorkflowExecutionContext;
    startedAt: string;
  }) => void | Promise<void>;
  onNodeCompleted?: (input: {
    node: WorkflowNodeRecord;
    inputSnapshot: WorkflowExecutionContext;
    outputSnapshot: WorkflowExecutionContext | null;
    startedAt: string;
    completedAt: string;
  }) => void | Promise<void>;
  onNodeFailed?: (input: {
    node: WorkflowNodeRecord;
    inputSnapshot: WorkflowExecutionContext;
    startedAt: string;
    completedAt: string;
    errorMessage: string;
  }) => void | Promise<void>;
};

type WorkflowExecutorDependencies = {
  executeNode?: (input: WorkflowNodeExecutionInput) => Promise<WorkflowNodeExecutionResult>;
};

export type WorkflowExecutionResult = {
  completedNodeIds: string[];
  reachedEndNodeIds: string[];
  context: WorkflowExecutionContext;
};

export function createWorkflowExecutor(dependencies: WorkflowExecutorDependencies = {}) {
  const executeNode = dependencies.executeNode ?? defaultExecuteNode;

  return {
    async executeRun(input: {
      workflow: WorkflowRecord;
      version: WorkflowVersionRecord;
      run: WorkflowRunRecord;
      triggerStartNodeIds: string[];
      initialContext?: WorkflowExecutionContext;
      observer?: WorkflowExecutionObserver;
    }): Promise<WorkflowExecutionResult> {
      const graph = structuredClone(input.version.graph);
      const nodeById = new Map(graph.nodes.map((node) => [node.id, node]));
      const outgoingBySource = buildOutgoingBySource(graph);
      const incomingByTarget = buildIncomingByTarget(graph);
      const triggerStartNodeIds = new Set(
        input.triggerStartNodeIds.filter((nodeId) => nodeById.get(nodeId)?.type === "start"),
      );
      const sharedContext: WorkflowExecutionContext = {
        ...structuredClone(input.initialContext || {}),
      };
      const completedNodeIds = new Set<string>();
      const reachedEndNodeIds = new Set<string>();
      const skippedNodeIds = new Set<string>();
      const readyNodeIds = new Set<string>();
      const scheduledNodeIds = new Set<string>();
      const resolvedIncomingEdgeIdsByTarget = new Map<string, Set<string>>();
      const satisfiedIncomingEdgeIdsByTarget = new Map<string, Set<string>>();
      const activeExecutions = new Map<string, Promise<void>>();
      let abortError: unknown = null;

      const recordIncomingResolution = (input: {
        targetNodeId: string;
        edgeId: string;
        isSatisfied: boolean;
      }) => {
        const resolvedEdgeIds = resolvedIncomingEdgeIdsByTarget.get(input.targetNodeId) ?? new Set<string>();

        if (resolvedEdgeIds.has(input.edgeId)) {
          return;
        }

        resolvedEdgeIds.add(input.edgeId);
        resolvedIncomingEdgeIdsByTarget.set(input.targetNodeId, resolvedEdgeIds);

        if (input.isSatisfied) {
          const satisfiedEdgeIds = satisfiedIncomingEdgeIdsByTarget.get(input.targetNodeId) ?? new Set<string>();
          satisfiedEdgeIds.add(input.edgeId);
          satisfiedIncomingEdgeIdsByTarget.set(input.targetNodeId, satisfiedEdgeIds);
        }

        if (abortError) {
          return;
        }

        maybeResolveNode(input.targetNodeId);
      };

      const markNodeSkipped = (nodeId: string) => {
        const node = nodeById.get(nodeId);

        if (
          abortError ||
          !node ||
          scheduledNodeIds.has(nodeId) ||
          completedNodeIds.has(nodeId) ||
          skippedNodeIds.has(nodeId) ||
          activeExecutions.has(nodeId)
        ) {
          return;
        }

        skippedNodeIds.add(nodeId);
        scheduledNodeIds.add(nodeId);

        (outgoingBySource.get(nodeId) ?? []).forEach((edge) => {
          recordIncomingResolution({
            targetNodeId: edge.targetNodeId,
            edgeId: edge.id,
            isSatisfied: false,
          });
        });
      };

      const maybeResolveNode = (nodeId: string) => {
        const node = nodeById.get(nodeId);

        if (
          abortError ||
          !node ||
          scheduledNodeIds.has(nodeId) ||
          completedNodeIds.has(nodeId) ||
          skippedNodeIds.has(nodeId) ||
          activeExecutions.has(nodeId)
        ) {
          return;
        }

        const incomingEdges = incomingByTarget.get(nodeId) ?? [];

        if (incomingEdges.length === 0) {
          return;
        }

        const resolvedEdgeIds = resolvedIncomingEdgeIdsByTarget.get(nodeId) ?? new Set<string>();

        if (incomingEdges.some((edge) => !resolvedEdgeIds.has(edge.id))) {
          return;
        }

        const satisfiedEdgeIds = satisfiedIncomingEdgeIdsByTarget.get(nodeId) ?? new Set<string>();

        if (satisfiedEdgeIds.size === 0) {
          markNodeSkipped(nodeId);
          return;
        }

        readyNodeIds.add(nodeId);
        scheduledNodeIds.add(nodeId);
      };

      triggerStartNodeIds.forEach((nodeId) => {
        readyNodeIds.add(nodeId);
        scheduledNodeIds.add(nodeId);
      });

      graph.nodes.forEach((node) => {
        if (node.type === "start" && !triggerStartNodeIds.has(node.id)) {
          markNodeSkipped(node.id);
        }
      });

      const executeNodeById = async (nodeId: string) => {
        const node = nodeById.get(nodeId);

        if (!node) {
          return;
        }

        const inputSnapshot = cloneContext(sharedContext);
        const startedAt = new Date().toISOString();
        await input.observer?.onNodeStarted?.({
          node,
          inputSnapshot,
          startedAt,
        });

        try {
          const rawOutput =
            node.type === "start"
              ? inputSnapshot
              : await executeNode({
                  workflow: input.workflow,
                  version: input.version,
                  run: input.run,
                  node,
                  context: inputSnapshot,
                });
          const outputSnapshot = normalizeExecutionOutput(rawOutput);

          if (outputSnapshot) {
            Object.assign(sharedContext, outputSnapshot);
          }

          const completedAt = new Date().toISOString();
          completedNodeIds.add(node.id);

          if (node.type === "end") {
            reachedEndNodeIds.add(node.id);
          }

          await input.observer?.onNodeCompleted?.({
            node,
            inputSnapshot,
            outputSnapshot,
            startedAt,
            completedAt,
          });

          (outgoingBySource.get(node.id) ?? []).forEach((edge) => {
            recordIncomingResolution({
              targetNodeId: edge.targetNodeId,
              edgeId: edge.id,
              isSatisfied: evaluateEdgeCondition(edge.condition, sharedContext),
            });
          });
        } catch (error) {
          const completedAt = new Date().toISOString();
          const errorMessage = error instanceof Error ? error.message : "工作流节点执行失败。";

          await input.observer?.onNodeFailed?.({
            node,
            inputSnapshot,
            startedAt,
            completedAt,
            errorMessage,
          });
          throw error;
        }
      };

      while (readyNodeIds.size > 0 || activeExecutions.size > 0) {
        if (!abortError) {
          Array.from(readyNodeIds).forEach((nodeId) => {
            readyNodeIds.delete(nodeId);

            const task = executeNodeById(nodeId)
              .catch((error) => {
                if (!abortError) {
                  abortError = error;
                }

                readyNodeIds.clear();
              })
              .finally(() => {
                activeExecutions.delete(nodeId);
              });

            activeExecutions.set(nodeId, task);
          });
        } else {
          readyNodeIds.clear();
        }

        if (activeExecutions.size === 0) {
          break;
        }

        await Promise.race(activeExecutions.values());
      }

      if (abortError) {
        throw abortError;
      }

      return {
        completedNodeIds: Array.from(completedNodeIds).sort((left, right) => left.localeCompare(right)),
        reachedEndNodeIds: Array.from(reachedEndNodeIds).sort((left, right) => left.localeCompare(right)),
        context: cloneContext(sharedContext),
      };
    },
  };
}

export async function executeWorkflowNode(
  input: WorkflowNodeExecutionInput,
  dependencies: WorkflowExecutorDependencies = {},
) {
  const executeNode = dependencies.executeNode ?? defaultExecuteNode;
  return executeNode(input);
}

function buildOutgoingBySource(graph: WorkflowGraph) {
  const map = new Map<string, WorkflowGraph["edges"]>();

  graph.edges.forEach((edge) => {
    const outgoing = map.get(edge.sourceNodeId) ?? [];
    outgoing.push(edge);
    map.set(edge.sourceNodeId, outgoing);
  });

  map.forEach((edges, nodeId) => {
    map.set(
      nodeId,
      edges.slice().sort((left, right) => left.id.localeCompare(right.id)),
    );
  });

  return map;
}

function buildIncomingByTarget(graph: WorkflowGraph) {
  const map = new Map<string, WorkflowGraph["edges"]>();

  graph.edges.forEach((edge) => {
    const incoming = map.get(edge.targetNodeId) ?? [];
    incoming.push(edge);

    map.set(edge.targetNodeId, incoming);
  });

  map.forEach((edges, nodeId) => {
    map.set(
      nodeId,
      edges.slice().sort((left, right) => left.id.localeCompare(right.id)),
    );
  });

  return map;
}

function evaluateEdgeCondition(
  condition: string | null,
  context: WorkflowExecutionContext,
) {
  const normalized = condition?.trim();

  if (!normalized) {
    return true;
  }

  try {
    const evaluate = new Function(
      "context",
      `with (context) { return Boolean(${normalized}); }`,
    ) as (context: WorkflowExecutionContext) => boolean;

    return Boolean(evaluate(context));
  } catch {
    return false;
  }
}

async function defaultExecuteNode(
  input: WorkflowNodeExecutionInput,
): Promise<WorkflowNodeExecutionResult> {
  if (input.node.type === "script") {
    return executeScriptNode({
      ...input,
      node: input.node,
    });
  }

  if (input.node.type === "agent") {
    return executeAgentNode({
      ...input,
      node: input.node,
    });
  }

  if (input.node.type === "end") {
    return {
      nodeId: input.node.id,
      deliveryTarget: input.node.config.deliveryTarget,
    };
  }

  return {
    nodeId: input.node.id,
  };
}

async function executeScriptNode(
  input: WorkflowNodeExecutionInput & {
    node: Extract<WorkflowNodeRecord, { type: "script" }>;
  },
) {
  const source = input.node.config.source?.trim();

  if (!source) {
    return {
      nodeId: input.node.id,
      scriptId: input.node.config.scriptId,
    };
  }

  const execute = new Function(
    "context",
    "workflow",
    "run",
    `"use strict"; return (async function (context, workflow, run) { ${source}\n})(context, workflow, run);`,
  ) as (
    context: WorkflowExecutionContext,
    workflow: WorkflowRecord,
    run: WorkflowRunRecord,
  ) => Promise<unknown>;

  return normalizeNodeResult(
    await execute(
      cloneContext(input.context),
      structuredClone(input.workflow),
      structuredClone(input.run),
    ),
  );
}

async function executeAgentNode(
  input: WorkflowNodeExecutionInput & {
    node: Extract<WorkflowNodeRecord, { type: "agent" }>;
  },
) {
  const agentId = input.node.config.agentId?.trim();

  if (!agentId) {
    return {
      nodeId: input.node.id,
      agentId: null,
      prompt: input.node.config.prompt,
    };
  }

  const agentProfile = getAgentProfile(agentId);

  if (!agentProfile) {
    throw new Error(`Agent ${agentId} does not exist.`);
  }

  const reply = await generateCodexReply({
    conversationTitle: `${input.workflow.name} · ${input.node.name}`,
    content: buildAgentNodePrompt(input),
    agentProfile,
    model: agentProfile.defaultModel ?? undefined,
    reasoningEffort: agentProfile.defaultReasoningEffort ?? undefined,
    sandboxMode: agentProfile.defaultSandboxMode ?? undefined,
  });

  return {
    agentId: agentProfile.id,
    agentName: agentProfile.name,
    text: reply.text,
    threadId: reply.threadId,
    model: reply.model,
  };
}

function normalizeExecutionOutput(
  value: WorkflowNodeExecutionResult,
): WorkflowExecutionContext | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  return cloneContext(value as WorkflowExecutionContext);
}

function cloneContext(context: WorkflowExecutionContext) {
  return structuredClone(context);
}

function normalizeNodeResult(value: unknown): WorkflowNodeExecutionResult {
  if (value == null) {
    return null;
  }

  if (typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }

  return {
    result: value,
  };
}

function buildAgentNodePrompt(
  input: WorkflowNodeExecutionInput & {
    node: Extract<WorkflowNodeRecord, { type: "agent" }>;
  },
) {
  const prompt = input.node.config.prompt?.trim();

  return [
    `你正在执行 OpenCrab 工作流节点 "${input.node.name}"。`,
    prompt ? `节点目标：\n${prompt}` : "节点目标：基于当前工作流上下文完成本节点任务。",
    "当前工作流上下文(JSON)：",
    JSON.stringify(input.context, null, 2),
    "请直接给出本节点产出。若需要结构化结果，请返回清晰的 JSON。",
  ].join("\n\n");
}

export const workflowExecutor = createWorkflowExecutor();
