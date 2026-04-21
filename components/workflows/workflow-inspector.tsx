"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import type { WorkflowEdgeRecord, WorkflowGraph, WorkflowNodeRecord } from "@/lib/resources/opencrab-api-types";
import type { AgentProfileRecord } from "@/lib/agents/types";
import type { WorkflowPublishValidationResult } from "@/lib/workflows/workflow-graph";
import type { WorkflowCanvasChangeMeta, WorkflowCanvasSelection } from "@/components/workflows/workflow-canvas";

type WorkflowInspectorProps = {
  agents: AgentProfileRecord[];
  graph: WorkflowGraph;
  selection: WorkflowCanvasSelection;
  staleNodeIds: string[];
  validation: WorkflowPublishValidationResult;
  onGraphChange: (nextGraph: WorkflowGraph, meta?: WorkflowCanvasChangeMeta) => void;
  onSelectionChange: (selection: WorkflowCanvasSelection) => void;
};

export function WorkflowInspector({
  agents,
  graph,
  selection,
  staleNodeIds,
  validation,
  onGraphChange,
  onSelectionChange,
}: WorkflowInspectorProps) {
  const selectedNode = graph.nodes.find((node) => node.id === selection.nodeId) ?? null;
  const selectedEdge = graph.edges.find((edge) => edge.id === selection.edgeId) ?? null;
  const selectedMerge = validation.mergeReadiness.find((item) => item.nodeId === selectedNode?.id) ?? null;
  const staleSet = new Set(staleNodeIds);
  const [preferredConnectTargetNodeId, setPreferredConnectTargetNodeId] = useState<string>("");
  const connectableTargetNodes = selectedNode
    ? graph.nodes.filter((node) => {
        if (node.id === selectedNode.id || node.type === "start") {
          return false;
        }

        return !graph.edges.some(
          (edge) => edge.sourceNodeId === selectedNode.id && edge.targetNodeId === node.id,
        );
      })
    : [];
  const outgoingEdges = selectedNode
    ? graph.edges.filter((edge) => edge.sourceNodeId === selectedNode.id)
    : [];
  const connectTargetNodeId = connectableTargetNodes.some(
    (node) => node.id === preferredConnectTargetNodeId,
  )
    ? preferredConnectTargetNodeId
    : (connectableTargetNodes[0]?.id ?? "");

  function updateNode(nextNode: WorkflowNodeRecord) {
    onGraphChange(
      {
        ...graph,
        nodes: graph.nodes.map((node) => (node.id === nextNode.id ? nextNode : node)),
      },
      { changedNodeIds: [nextNode.id] },
    );
  }

  function removeNode(node: WorkflowNodeRecord) {
    if (node.type === "start") {
      return;
    }

    const linkedNodeIds = Array.from(
      new Set(
        graph.edges
          .filter((edge) => edge.sourceNodeId === node.id || edge.targetNodeId === node.id)
          .flatMap((edge) => [edge.sourceNodeId, edge.targetNodeId]),
      ),
    );

    onGraphChange(
      {
        ...graph,
        nodes: graph.nodes.filter((item) => item.id !== node.id),
        edges: graph.edges.filter(
          (edge) => edge.sourceNodeId !== node.id && edge.targetNodeId !== node.id,
        ),
      },
      { changedNodeIds: [node.id, ...linkedNodeIds] },
    );
    onSelectionChange({ nodeId: null, edgeId: null });
  }

  function updateEdge(nextEdge: WorkflowEdgeRecord) {
    onGraphChange(
      {
        ...graph,
        edges: graph.edges.map((edge) => (edge.id === nextEdge.id ? nextEdge : edge)),
      },
      { changedNodeIds: [nextEdge.sourceNodeId, nextEdge.targetNodeId] },
    );
  }

  function removeEdge(edge: WorkflowEdgeRecord) {
    onGraphChange(
      {
        ...graph,
        edges: graph.edges.filter((item) => item.id !== edge.id),
      },
      { changedNodeIds: [edge.sourceNodeId, edge.targetNodeId] },
    );
    onSelectionChange({ nodeId: null, edgeId: null });
  }

  function createEdge(sourceNodeId: string, targetNodeId: string) {
    if (!targetNodeId || sourceNodeId === targetNodeId) {
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

  return (
    <section className="rounded-[24px] border border-line bg-surface p-4 shadow-soft">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-[17px] font-semibold tracking-[-0.03em] text-text">检查器</h2>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => onSelectionChange({ nodeId: null, edgeId: null })}
        >
          取消选择
        </Button>
      </div>

      {selectedNode ? (
        <article className="mt-4 space-y-4">
          <div className="rounded-[14px] border border-line bg-background px-4 py-3">
            <div className="text-[11px] uppercase tracking-[0.14em] text-muted">{selectedNode.type}</div>
            <div className="mt-1 text-[14px] font-medium text-text">{selectedNode.id}</div>
            {staleSet.has(selectedNode.id) ? (
              <div className="mt-2 rounded-[10px] border border-[#f4c78b] bg-[#fff8ef] px-2 py-1 text-[12px] text-[#9a4f08]">
                下游节点待刷新
              </div>
            ) : null}
          </div>

          <label className="block">
            <span className="text-[12px] font-medium text-muted-strong">节点名称</span>
            <input
              value={selectedNode.name}
              onChange={(event) =>
                updateNode({
                  ...selectedNode,
                  name: event.target.value,
                })
              }
              className={INPUT_CLASS_NAME}
            />
          </label>

          {selectedNode.type === "start" ? (
            <label className="block">
              <span className="text-[12px] font-medium text-muted-strong">触发方式</span>
              <select
                value={selectedNode.config.trigger}
                onChange={(event) =>
                  updateNode({
                    ...selectedNode,
                    config: {
                      trigger: event.target.value === "schedule" ? "schedule" : "manual",
                    },
                  })
                }
                className={INPUT_CLASS_NAME}
              >
                <option value="manual">manual</option>
                <option value="schedule">schedule</option>
              </select>
            </label>
          ) : null}

          {selectedNode.type === "script" ? (
            <div className="space-y-3">
              <label className="block">
                <span className="text-[12px] font-medium text-muted-strong">脚本内容</span>
                <textarea
                  value={selectedNode.config.source ?? ""}
                  onChange={(event) =>
                    updateNode({
                      ...selectedNode,
                      config: {
                        ...selectedNode.config,
                        source: event.target.value.trim() ? event.target.value : null,
                      },
                    })
                  }
                  rows={6}
                  className={TEXTAREA_CLASS_NAME}
                  placeholder={"return {\n  approved: true,\n  summary: \"workflow ok\",\n};"}
                />
              </label>

              {selectedNode.config.scriptId ? (
                <div className="rounded-[12px] border border-line bg-background px-3 py-2 text-[12px] text-muted-strong">
                  Legacy Script ID · {selectedNode.config.scriptId}
                </div>
              ) : null}
            </div>
          ) : null}

          {selectedNode.type === "agent" ? (
            <div className="space-y-3">
              <label className="block">
                <span className="text-[12px] font-medium text-muted-strong">Agent</span>
                <select
                  value={selectedNode.config.agentId ?? ""}
                  onChange={(event) =>
                    updateNode({
                      ...selectedNode,
                      config: {
                        ...selectedNode.config,
                        agentId: event.target.value.trim() ? event.target.value : null,
                      },
                    })
                  }
                  className={INPUT_CLASS_NAME}
                >
                  <option value="">选择一个 Agent</option>
                  {agents.map((agent) => (
                    <option key={agent.id} value={agent.id}>
                      {agent.name} · {agent.id}
                    </option>
                  ))}
                </select>
              </label>

              {agents.length === 0 ? (
                <div className="rounded-[12px] border border-[#f2d3bd] bg-[#fff3e7] px-3 py-2 text-[12px] text-[#9a4f08]">
                  还没有可选 Agent。请先到 /agents 创建或确认已有 Agent。
                </div>
              ) : null}

              <label className="block">
                <span className="text-[12px] font-medium text-muted-strong">Prompt</span>
                <textarea
                  value={selectedNode.config.prompt ?? ""}
                  onChange={(event) =>
                    updateNode({
                      ...selectedNode,
                      config: {
                        ...selectedNode.config,
                        prompt: event.target.value.trim() ? event.target.value : null,
                      },
                    })
                  }
                  rows={4}
                  className={TEXTAREA_CLASS_NAME}
                  placeholder="例如：根据当前上下文整理一段可发布摘要，并返回 JSON。"
                />
              </label>
            </div>
          ) : null}

          {selectedNode.type === "end" ? (
            <label className="block">
              <span className="text-[12px] font-medium text-muted-strong">交付目标</span>
              <select
                value={selectedNode.config.deliveryTarget}
                onChange={(event) =>
                  updateNode({
                    ...selectedNode,
                    config: {
                      deliveryTarget: normalizeDeliveryTarget(event.target.value),
                    },
                  })
                }
                className={INPUT_CLASS_NAME}
              >
                <option value="none">none</option>
                <option value="conversation">conversation</option>
                <option value="channel">channel</option>
                <option value="pending_publish">pending_publish</option>
              </select>
            </label>
          ) : null}

          {selectedNode.type !== "end" ? (
            <div className="space-y-3 rounded-[14px] border border-line bg-background px-4 py-3">
              <div className="text-[12px] font-medium text-muted-strong">新增连线</div>
              <select
                value={connectTargetNodeId}
                onChange={(event) => setPreferredConnectTargetNodeId(event.target.value)}
                className={INPUT_CLASS_NAME}
              >
                <option value="">选择目标节点</option>
                {connectableTargetNodes.map((node) => (
                  <option key={node.id} value={node.id}>
                    {node.name} ({node.type})
                  </option>
                ))}
              </select>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => createEdge(selectedNode.id, connectTargetNodeId)}
                disabled={!connectTargetNodeId}
              >
                添加连线
              </Button>

              {outgoingEdges.length > 0 ? (
                <div className="space-y-2">
                  <div className="text-[12px] font-medium text-muted-strong">现有输出连线</div>
                  {outgoingEdges.map((edge) => (
                    <button
                      key={edge.id}
                      type="button"
                      onClick={() => onSelectionChange({ nodeId: null, edgeId: edge.id })}
                      className="flex w-full items-center justify-between rounded-[12px] border border-line px-3 py-2 text-left text-[12px] text-muted-strong transition hover:border-text/20 hover:text-text"
                    >
                      <span>
                        {resolveNodeName(graph.nodes, edge.sourceNodeId)} {"->"} {resolveNodeName(graph.nodes, edge.targetNodeId)}
                      </span>
                      <span>{edge.label || edge.condition || "编辑条件"}</span>
                    </button>
                  ))}
                </div>
              ) : null}
            </div>
          ) : null}

          <div className="rounded-[14px] border border-line bg-background px-4 py-3 text-[12px] text-muted-strong">
            <div>入度 · {graph.edges.filter((edge) => edge.targetNodeId === selectedNode.id).length}</div>
            <div className="mt-1">出度 · {graph.edges.filter((edge) => edge.sourceNodeId === selectedNode.id).length}</div>
            {selectedMerge ? (
              <div className="mt-2 text-[#8a5a08]">
                Merge 状态 · {selectedMerge.isReady ? "已就绪" : `等待 ${selectedMerge.waitingOnNodeIds.join(", ")}`}
              </div>
            ) : null}
          </div>

          {selectedNode.type !== "start" ? (
            <Button variant="danger" size="sm" onClick={() => removeNode(selectedNode)}>
              删除节点
            </Button>
          ) : null}
        </article>
      ) : selectedEdge ? (
        <article className="mt-4 space-y-4">
          <div className="rounded-[14px] border border-line bg-background px-4 py-3">
            <div className="text-[11px] uppercase tracking-[0.14em] text-muted">Edge</div>
            <div className="mt-1 text-[14px] font-medium text-text">{selectedEdge.id}</div>
            <div className="mt-2 text-[12px] text-muted-strong">
              {resolveNodeName(graph.nodes, selectedEdge.sourceNodeId)} →{" "}
              {resolveNodeName(graph.nodes, selectedEdge.targetNodeId)}
            </div>
          </div>

          <label className="block">
            <span className="text-[12px] font-medium text-muted-strong">Condition</span>
            <input
              value={selectedEdge.condition ?? ""}
              onChange={(event) =>
                updateEdge({
                  ...selectedEdge,
                  condition: event.target.value.trim() ? event.target.value : null,
                })
              }
              placeholder="status === 'ok'"
              className={INPUT_CLASS_NAME}
            />
          </label>

          <label className="block">
            <span className="text-[12px] font-medium text-muted-strong">显示标签</span>
            <input
              value={selectedEdge.label ?? ""}
              onChange={(event) =>
                updateEdge({
                  ...selectedEdge,
                  label: event.target.value.trim() ? event.target.value : null,
                })
              }
              placeholder="可选：给业务方看的标签"
              className={INPUT_CLASS_NAME}
            />
          </label>

          {validation.conditionalReadiness.byEdgeId[selectedEdge.id]?.isReady ? (
            <div className="rounded-[12px] border border-[#dbe8de] bg-[#eef8f0] px-3 py-2 text-[12px] text-[#4c6750]">
              分支条件通过检查。
            </div>
          ) : (
            <div className="rounded-[12px] border border-[#f2d3bd] bg-[#fff3e7] px-3 py-2 text-[12px] text-[#9a4f08]">
              这条分支仍有条件问题，发布前需要修复。
            </div>
          )}

          <Button variant="danger" size="sm" onClick={() => removeEdge(selectedEdge)}>
            删除连线
          </Button>
        </article>
      ) : (
        <article className="mt-4 space-y-3 rounded-[14px] border border-line bg-background px-4 py-4 text-[13px] text-muted-strong">
          <div>选择画布上的节点或连线查看详情并编辑。</div>
          <div>节点总数 · {graph.nodes.length}</div>
          <div>连线总数 · {graph.edges.length}</div>
          <div>分支条件状态 · {validation.conditionalReadiness.isReady ? "通过" : "未通过"}</div>
          <div>发布检查 · {validation.isValid ? "通过" : `阻塞 ${validation.errors.length} 项`}</div>
        </article>
      )}
    </section>
  );
}

const INPUT_CLASS_NAME =
  "mt-2 h-11 w-full rounded-[14px] border border-line bg-background px-3 text-[13px] text-text outline-none transition focus:border-text";

const TEXTAREA_CLASS_NAME =
  "mt-2 w-full rounded-[14px] border border-line bg-background px-3 py-2 text-[13px] text-text outline-none transition focus:border-text";

function resolveNodeName(nodes: WorkflowNodeRecord[], nodeId: string) {
  const node = nodes.find((item) => item.id === nodeId);

  return node ? `${node.name} (${node.type})` : nodeId;
}

function normalizeDeliveryTarget(value: string): "conversation" | "channel" | "pending_publish" | "none" {
  if (value === "conversation" || value === "channel" || value === "pending_publish") {
    return value;
  }

  return "none";
}

function safeRandomId() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }

  return Math.random().toString(36).slice(2, 12);
}
