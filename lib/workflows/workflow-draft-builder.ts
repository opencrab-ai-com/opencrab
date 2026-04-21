import { getAgentProfile } from "@/lib/agents/agent-store";
import { getBrowserSessionStatus } from "@/lib/codex/browser-session";
import { generateCodexReply } from "@/lib/codex/sdk";
import { getRuntimeReadiness } from "@/lib/runtime/first-run-readiness";
import type { CodexReasoningEffort } from "@/lib/resources/opencrab-api-types";
import type { WorkflowGraph, WorkflowNodeRecord } from "@/lib/workflows/types";
import { validateWorkflowForPublish } from "@/lib/workflows/workflow-graph";

const PLANNER_AGENT_ID = "project-manager";

export type WorkflowDraftMode = "blank" | "ai";

type WorkflowDraftBuilderInput = {
  mode?: WorkflowDraftMode;
  workflowName?: string;
  workflowDescription?: string | null;
  goalPrompt?: string;
  model?: string;
  reasoningEffort?: CodexReasoningEffort;
};

type PlannerExecutor = (input: {
  prompt: string;
  model?: string;
  reasoningEffort?: CodexReasoningEffort;
}) => Promise<string>;

type WorkflowDraftBuilderDependencies = {
  executePlanner?: PlannerExecutor;
  getReadiness?: () => Promise<{ ready: boolean }>;
  getBrowserSession?: () => Promise<{
    ok: boolean;
    status: "ready" | "launching" | "missing_browser" | "unreachable";
  }>;
};

export function createWorkflowDraftBuilder(
  dependencies: WorkflowDraftBuilderDependencies = {},
) {
  const executePlanner = dependencies.executePlanner ?? defaultPlannerExecutor;
  const getReadiness = dependencies.getReadiness ?? getRuntimeReadiness;
  const getBrowserSession = dependencies.getBrowserSession ?? getBrowserSessionStatus;

  return {
    async build(input: WorkflowDraftBuilderInput): Promise<WorkflowGraph> {
      const mode = input.mode === "ai" ? "ai" : "blank";

      if (mode === "blank") {
        return createSeedDraftGraph();
      }

      const goalPrompt = input.goalPrompt?.trim() ?? "";

      if (!goalPrompt) {
        return createSeedDraftGraph();
      }

      let readiness: Awaited<ReturnType<typeof getReadiness>>;
      let browserSession: Awaited<ReturnType<typeof getBrowserSession>>;

      try {
        [readiness, browserSession] = await Promise.all([
          getReadiness(),
          getBrowserSession(),
        ]);
      } catch {
        return createSeedDraftGraph();
      }

      if (!readiness.ready || !browserSession.ok) {
        return createSeedDraftGraph();
      }

      let replyText = "";

      try {
        replyText = await executePlanner({
          prompt: buildPlannerPrompt({
            workflowName: input.workflowName?.trim() || "Untitled workflow",
            workflowDescription: input.workflowDescription || "",
            goalPrompt,
          }),
          model: input.model,
          reasoningEffort: input.reasoningEffort,
        });
      } catch {
        return createSeedDraftGraph();
      }

      const graph = normalizePlannerReply(replyText);

      return graph ?? createSeedDraftGraph();
    },
  };
}

export const workflowDraftBuilder = createWorkflowDraftBuilder();

async function defaultPlannerExecutor(input: {
  prompt: string;
  model?: string;
  reasoningEffort?: CodexReasoningEffort;
}) {
  const plannerAgent = getAgentProfile(PLANNER_AGENT_ID);
  const result = await generateCodexReply({
    conversationTitle: "Workflow 草稿生成",
    content: input.prompt,
    agentProfile: plannerAgent,
    model: input.model,
    reasoningEffort: input.reasoningEffort,
    sandboxMode: "read-only",
  });

  return result.text;
}

function buildPlannerPrompt(input: {
  workflowName: string;
  workflowDescription: string;
  goalPrompt: string;
}) {
  return `你正在为 OpenCrab 生成一个“工作流初稿”。目标是产出一个可以继续手工编辑的流程图草稿，不要输出任何运行时细节。

工作流名称：
${input.workflowName}

工作流描述：
${input.workflowDescription || "暂无描述"}

用户期望：
${input.goalPrompt}

请只输出一个 JSON 对象，不要加代码块，不要加解释。格式如下：
{
  "graph": {
    "nodes": [
      {
        "id": "node-start-1",
        "type": "start",
        "name": "开始",
        "config": {},
        "uiPosition": { "x": 120, "y": 240 }
      }
    ],
    "edges": [
      {
        "id": "edge-1",
        "sourceNodeId": "node-start-1",
        "targetNodeId": "node-end-1",
        "condition": null,
        "label": null
      }
    ],
    "layout": {
      "viewport": { "x": 0, "y": 0, "zoom": 1 }
    },
    "defaults": {
      "timezone": null
    }
  }
}

输出规则：
1. 只输出 JSON，不要输出 Markdown。
2. 每个节点 type 只能是 start、script、agent、end。
3. graph.nodes 至少 2 个节点，必须包含至少一个 start 和一个 end。
4. edge 的 sourceNodeId / targetNodeId 必须指向 graph.nodes 里的 id。
5. 文案保持中文、简洁、可编辑。`;
}

export function createSeedDraftGraph(): WorkflowGraph {
  const startNode: WorkflowNodeRecord = {
    id: `node-start-${crypto.randomUUID()}`,
    type: "start",
    name: "Start",
    config: {
      trigger: "manual",
    },
    uiPosition: {
      x: 120,
      y: 240,
    },
  };
  const endNode: WorkflowNodeRecord = {
    id: `node-end-${crypto.randomUUID()}`,
    type: "end",
    name: "End",
    config: {
      deliveryTarget: "none",
    },
    uiPosition: {
      x: 480,
      y: 240,
    },
  };

  return {
    nodes: [startNode, endNode],
    edges: [],
    layout: {
      viewport: {
        x: 0,
        y: 0,
        zoom: 1,
      },
    },
    defaults: {
      timezone: null,
    },
  };
}

function normalizePlannerReply(replyText: string): WorkflowGraph | null {
  const payload = extractJsonObject(replyText);

  if (!payload) {
    return null;
  }

  const rawGraph = toRecord(payload.graph) ?? payload;
  const rawNodes = Array.isArray(rawGraph.nodes) ? rawGraph.nodes : [];
  const nodeIds = new Set<string>();
  const nodes: WorkflowNodeRecord[] = [];

  rawNodes.forEach((rawNode, index) => {
    const normalized = normalizeNode(rawNode, index);

    if (!normalized) {
      return;
    }

    if (nodeIds.has(normalized.id)) {
      return;
    }

    nodeIds.add(normalized.id);
    nodes.push(normalized);
  });

  if (nodes.length === 0) {
    return null;
  }

  const hasStart = nodes.some((node) => node.type === "start");
  const hasEnd = nodes.some((node) => node.type === "end");

  if (!hasStart || !hasEnd) {
    return null;
  }

  const validNodeIds = new Set(nodes.map((node) => node.id));
  const rawEdges = Array.isArray(rawGraph.edges) ? rawGraph.edges : [];
  const edgeIds = new Set<string>();
  const edges: WorkflowGraph["edges"] = [];

  rawEdges.forEach((rawEdge, index) => {
    const normalized = normalizeEdge(rawEdge, index, validNodeIds);

    if (!normalized) {
      return;
    }

    if (edgeIds.has(normalized.id)) {
      return;
    }

    edgeIds.add(normalized.id);
    edges.push(normalized);
  });

  const viewport = toRecord(toRecord(rawGraph.layout)?.viewport);
  const defaults = toRecord(rawGraph.defaults);
  const graph: WorkflowGraph = {
    nodes,
    edges,
    layout: {
      viewport: {
        x: normalizeNumber(viewport?.x, 0),
        y: normalizeNumber(viewport?.y, 0),
        zoom: normalizeNumber(viewport?.zoom, 1),
      },
    },
    defaults: {
      timezone: normalizeNullableString(defaults?.timezone),
    },
  };
  const validation = validateWorkflowForPublish(graph);
  const structuralErrors = validation.errors.filter((error) =>
    error.code === "missing_start_node" ||
    error.code === "missing_end_node" ||
    error.code === "invalid_edge_reference" ||
    error.code === "unreachable_node",
  );

  if (structuralErrors.length > 0) {
    return null;
  }

  return graph;
}

function normalizeNode(rawNode: unknown, index: number): WorkflowNodeRecord | null {
  const node = toRecord(rawNode);

  if (!node) {
    return null;
  }

  const normalizedType = normalizeNodeType(node.type);

  if (!normalizedType) {
    return null;
  }

  const uiPosition = normalizeUiPosition(node.uiPosition);
  const id = normalizeNodeId(node.id, normalizedType, index);

  if (normalizedType === "start") {
    return {
      id,
      type: "start",
      name: normalizeName(node.name, "Start"),
      config: {
        trigger: toRecord(node.config)?.trigger === "schedule" ? "schedule" : "manual",
      },
      uiPosition,
    };
  }

  if (normalizedType === "script") {
    const config = toRecord(node.config);

    return {
      id,
      type: "script",
      name: normalizeName(node.name, "Script"),
      config: {
        scriptId: normalizeNullableString(config?.scriptId),
        source: normalizeNullableString(config?.source),
      },
      uiPosition,
    };
  }

  if (normalizedType === "agent") {
    const config = toRecord(node.config);

    return {
      id,
      type: "agent",
      name: normalizeName(node.name, "Agent"),
      config: {
        agentId: normalizeNullableString(config?.agentId),
        prompt: normalizeNullableString(config?.prompt),
      },
      uiPosition,
    };
  }

  return {
    id,
    type: "end",
    name: normalizeName(node.name, "End"),
    config: {
      deliveryTarget: normalizeDeliveryTarget(toRecord(node.config)?.deliveryTarget),
    },
    uiPosition,
  };
}

function normalizeEdge(
  rawEdge: unknown,
  index: number,
  validNodeIds: Set<string>,
): WorkflowGraph["edges"][number] | null {
  const edge = toRecord(rawEdge);

  if (!edge) {
    return null;
  }

  const sourceNodeId = normalizeNullableString(edge.sourceNodeId);
  const targetNodeId = normalizeNullableString(edge.targetNodeId);

  if (!sourceNodeId || !targetNodeId) {
    return null;
  }

  if (!validNodeIds.has(sourceNodeId) || !validNodeIds.has(targetNodeId)) {
    return null;
  }

  return {
    id: normalizeNullableString(edge.id) || `edge-${index}-${crypto.randomUUID()}`,
    sourceNodeId,
    targetNodeId,
    condition: normalizeNullableString(edge.condition),
    label: normalizeNullableString(edge.label),
  };
}

function normalizeNodeType(value: unknown): WorkflowNodeRecord["type"] | null {
  if (value === "start" || value === "script" || value === "agent" || value === "end") {
    return value;
  }

  if (typeof value === "string") {
    return "script";
  }

  return null;
}

function normalizeUiPosition(value: unknown) {
  const position = toRecord(value);

  return {
    x: normalizeNumber(position?.x, 0),
    y: normalizeNumber(position?.y, 0),
  };
}

function normalizeNumber(value: unknown, fallback: number) {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function normalizeNodeId(value: unknown, type: string, index: number) {
  return normalizeNullableString(value) || `node-${type}-${index}-${crypto.randomUUID()}`;
}

function normalizeName(value: unknown, fallback: string) {
  return normalizeNullableString(value) || fallback;
}

function normalizeDeliveryTarget(value: unknown) {
  if (value === "conversation" || value === "channel") {
    return value;
  }

  return "none";
}

function normalizeNullableString(value: unknown) {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();
  return trimmed.length ? trimmed : null;
}

function toRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : null;
}

function extractJsonObject(value: string) {
  const trimmed = value.trim();

  if (!trimmed) {
    return null;
  }

  try {
    const direct = JSON.parse(trimmed);
    return toRecord(direct);
  } catch {
    const startIndex = trimmed.indexOf("{");
    const endIndex = trimmed.lastIndexOf("}");

    if (startIndex < 0 || endIndex <= startIndex) {
      return null;
    }

    try {
      const sliced = JSON.parse(trimmed.slice(startIndex, endIndex + 1));
      return toRecord(sliced);
    } catch {
      return null;
    }
  }
}
