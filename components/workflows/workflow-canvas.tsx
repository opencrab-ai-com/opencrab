"use client";

import "@xyflow/react/dist/style.css";
import {
  Background,
  Controls,
  MarkerType,
  Position,
  ReactFlow,
  type Connection,
  type Edge,
  type Node,
  type Viewport,
} from "@xyflow/react";
import { Button } from "@/components/ui/button";
import type { WorkflowGraph, WorkflowNodeRecord } from "@/lib/resources/opencrab-api-types";
import type { ConditionalEdgeReadinessResult } from "@/lib/workflows/workflow-graph";

export type WorkflowCanvasSelection = {
  nodeId: string | null;
  edgeId: string | null;
};

export type WorkflowCanvasChangeMeta = {
  changedNodeIds?: string[];
};

type WorkflowCanvasProps = {
  graph: WorkflowGraph;
  selection: WorkflowCanvasSelection;
  staleNodeIds: string[];
  conditionalReadiness: ConditionalEdgeReadinessResult;
  onGraphChange: (nextGraph: WorkflowGraph, meta?: WorkflowCanvasChangeMeta) => void;
  onSelectionChange: (selection: WorkflowCanvasSelection) => void;
};

export function WorkflowCanvas({
  graph,
  selection,
  staleNodeIds,
  conditionalReadiness,
  onGraphChange,
  onSelectionChange,
}: WorkflowCanvasProps) {
  const staleSet = new Set(staleNodeIds);
  const nodes: Node[] = graph.nodes.map((node) => {
    const isSelected = node.id === selection.nodeId;
    const isStale = staleSet.has(node.id);

    return {
      id: node.id,
      position: {
        x: node.uiPosition.x,
        y: node.uiPosition.y,
      },
      sourcePosition: Position.Right,
      targetPosition: Position.Left,
      selected: isSelected,
      draggable: true,
      data: {
        label: (
          <div className="min-w-[150px]">
            <div className="text-[11px] uppercase tracking-[0.14em] text-muted">{getNodeTypeLabel(node.type)}</div>
            <div className="mt-1 text-[13px] font-medium text-text">{node.name}</div>
            {isStale ? (
              <div className="mt-1 text-[11px] text-[#a16207]">需要重新校验下游</div>
            ) : null}
          </div>
        ),
      },
      style: {
        borderRadius: 14,
        border: isSelected
          ? "1px solid #1f2937"
          : isStale
            ? "1px solid #f4c78b"
            : "1px solid #d6dde6",
        background: node.type === "start"
          ? "#f2f8ff"
          : node.type === "end"
            ? "#f8f6ff"
            : "#ffffff",
        boxShadow: isSelected
          ? "0 0 0 3px rgba(15, 23, 42, 0.12)"
          : isStale
            ? "0 0 0 3px rgba(244, 199, 139, 0.35)"
            : "0 1px 2px rgba(15, 23, 42, 0.06)",
        padding: "10px 12px",
      },
    } satisfies Node;
  });
  const edges: Edge[] = graph.edges.map((edge) => {
    const readiness = conditionalReadiness.byEdgeId[edge.id];
    const hasReadinessIssue = readiness ? !readiness.isReady : false;
    const isSelected = edge.id === selection.edgeId;
    const condition = normalizeEdgeCondition(edge.condition);

    return {
      id: edge.id,
      source: edge.sourceNodeId,
      target: edge.targetNodeId,
      selected: isSelected,
      markerEnd: {
        type: MarkerType.ArrowClosed,
        color: hasReadinessIssue ? "#c2410c" : "#64748b",
      },
      animated: isSelected,
      style: {
        strokeWidth: isSelected ? 2 : 1.5,
        stroke: hasReadinessIssue ? "#c2410c" : "#64748b",
      },
      label: condition || edge.label || undefined,
      labelStyle: {
        fontSize: 11,
        fill: hasReadinessIssue ? "#9a3412" : "#334155",
      },
      labelBgStyle: {
        fill: hasReadinessIssue ? "#fff1e8" : "#eef2f6",
        fillOpacity: 1,
      },
      labelBgPadding: [6, 2],
      labelBgBorderRadius: 8,
    } satisfies Edge;
  });

  function appendNode(type: "script" | "agent" | "end") {
    const id = `node-${type}-${safeRandomId()}`;
    const column = graph.nodes.length;
    const nextNode = createNode(id, type, {
      x: 220 + (column % 4) * 180,
      y: 100 + Math.floor(column / 4) * 140,
    });

    onGraphChange(
      {
        ...graph,
        nodes: [...graph.nodes, nextNode],
      },
      { changedNodeIds: [id] },
    );
    onSelectionChange({ nodeId: id, edgeId: null });
  }

  function handleConnect(connection: Connection) {
    const sourceNodeId = connection.source;
    const targetNodeId = connection.target;

    if (!sourceNodeId || !targetNodeId || sourceNodeId === targetNodeId) {
      return;
    }

    const hasDuplicate = graph.edges.some(
      (edge) => edge.sourceNodeId === sourceNodeId && edge.targetNodeId === targetNodeId,
    );

    if (hasDuplicate) {
      return;
    }

    const edgeId = `edge-${safeRandomId()}`;
    const nextEdge = {
      id: edgeId,
      sourceNodeId,
      targetNodeId,
      condition: null,
      label: null,
    };

    onGraphChange(
      {
        ...graph,
        edges: [...graph.edges, nextEdge],
      },
      { changedNodeIds: [sourceNodeId, targetNodeId] },
    );
    onSelectionChange({ nodeId: null, edgeId });
  }

  function handleNodePositionChange(nodeId: string, position: { x: number; y: number }) {
    onGraphChange({
      ...graph,
      nodes: graph.nodes.map((node) =>
        node.id === nodeId
          ? {
              ...node,
              uiPosition: {
                x: Math.round(position.x),
                y: Math.round(position.y),
              },
            }
          : node,
      ),
    });
  }

  function handleViewportChange(viewport: Viewport) {
    onGraphChange({
      ...graph,
      layout: {
        ...graph.layout,
        viewport: {
          x: viewport.x,
          y: viewport.y,
          zoom: viewport.zoom,
        },
      },
    });
  }

  return (
    <section className="rounded-[24px] border border-line bg-surface p-4 shadow-soft">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-[17px] font-semibold tracking-[-0.03em] text-text">工作流画布</h2>
          <p className="mt-1 text-[12px] text-muted">
            拖拽节点调整结构，连线后在右侧检查器填写条件与配置。
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" size="sm" onClick={() => appendNode("script")}>
            添加 Script
          </Button>
          <Button variant="secondary" size="sm" onClick={() => appendNode("agent")}>
            添加 Agent
          </Button>
          <Button variant="ghost" size="sm" onClick={() => appendNode("end")}>
            添加 End
          </Button>
        </div>
      </div>

      <div className="mt-4 h-[540px] overflow-hidden rounded-[18px] border border-line bg-background">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          defaultViewport={graph.layout.viewport}
          onConnect={handleConnect}
          onNodeClick={(_, node) => onSelectionChange({ nodeId: node.id, edgeId: null })}
          onEdgeClick={(_, edge) => onSelectionChange({ nodeId: null, edgeId: edge.id })}
          onNodeDragStop={(_, node) => handleNodePositionChange(node.id, node.position)}
          onPaneClick={() => onSelectionChange({ nodeId: null, edgeId: null })}
          onMoveEnd={(_, viewport) => handleViewportChange(viewport)}
          nodesDraggable
          nodesConnectable
          edgesFocusable
          deleteKeyCode={null}
          fitView={false}
          minZoom={0.35}
          maxZoom={1.8}
        >
          <Controls position="bottom-right" />
          <Background gap={24} size={1} color="#d8dee9" />
        </ReactFlow>
      </div>
    </section>
  );
}

function createNode(
  id: string,
  type: "script" | "agent" | "end",
  uiPosition: { x: number; y: number },
): WorkflowNodeRecord {
  if (type === "script") {
    return {
      id,
      type,
      name: "Script",
      config: {
        scriptId: null,
        source: null,
      },
      uiPosition,
    };
  }

  if (type === "agent") {
    return {
      id,
      type,
      name: "Agent",
      config: {
        agentId: null,
        prompt: null,
      },
      uiPosition,
    };
  }

  return {
    id,
    type: "end",
    name: "End",
    config: {
      deliveryTarget: "none",
    },
    uiPosition,
  };
}

function getNodeTypeLabel(type: WorkflowNodeRecord["type"]) {
  if (type === "start") {
    return "Start";
  }

  if (type === "script") {
    return "Script";
  }

  if (type === "agent") {
    return "Agent";
  }

  return "End";
}

function normalizeEdgeCondition(condition: string | null) {
  return typeof condition === "string" ? condition.trim() : "";
}

function safeRandomId() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }

  return Math.random().toString(36).slice(2, 12);
}
