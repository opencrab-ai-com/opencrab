import { describe, expect, it, vi } from "vitest";
import { createWorkflowDraftBuilder } from "@/lib/workflows/workflow-draft-builder";

describe("workflowDraftBuilder", () => {
  it("returns the seeded start/end blank graph for blank mode", async () => {
    const executePlanner = vi.fn(async () => {
      throw new Error("planner should not run in blank mode");
    });
    const builder = createWorkflowDraftBuilder({
      executePlanner,
      getReadiness: async () => ({ ready: true }),
      getBrowserSession: async () => ({ ok: true, status: "ready" }),
    });

    const graph = await builder.build({
      mode: "blank",
      workflowName: "内容周报流",
    });

    expect(executePlanner).not.toHaveBeenCalled();
    expect(graph.nodes.map((node) => node.type).sort()).toEqual(["end", "start"]);
    expect(graph.edges).toEqual([]);
  });

  it("normalizes ai planner output to the four supported workflow node types", async () => {
    const executePlanner = vi.fn(async () =>
      JSON.stringify({
        planner_summary: "先给你一个可编辑的流程草稿。",
        graph: {
          nodes: [
            {
              id: "node-start-1",
              type: "start",
              name: "触发",
              config: { trigger: "manual" },
              uiPosition: { x: 80, y: 180 },
            },
            {
              id: "node-http-1",
              type: "http_request",
              name: "抓取数据",
              config: { url: "https://example.com/data" },
              uiPosition: { x: 280, y: 180 },
            },
            {
              id: "node-agent-1",
              type: "agent",
              name: "总结输出",
              config: { agentId: 123, prompt: false },
              uiPosition: { x: 500, y: 180 },
            },
            {
              id: "node-end-1",
              type: "end",
              name: "完成",
              config: { deliveryTarget: "channel" },
              uiPosition: { x: 740, y: 180 },
            },
          ],
          edges: [
            {
              id: "edge-start-http",
              sourceNodeId: "node-start-1",
              targetNodeId: "node-http-1",
              condition: null,
              label: null,
            },
            {
              id: "edge-http-agent",
              sourceNodeId: "node-http-1",
              targetNodeId: "node-agent-1",
              condition: null,
              label: null,
            },
            {
              id: "edge-agent-end",
              sourceNodeId: "node-agent-1",
              targetNodeId: "node-end-1",
              condition: null,
              label: null,
            },
          ],
        },
      }),
    );
    const builder = createWorkflowDraftBuilder({
      executePlanner,
      getReadiness: async () => ({ ready: true }),
      getBrowserSession: async () => ({ ok: true, status: "ready" }),
    });

    const graph = await builder.build({
      mode: "ai",
      workflowName: "内容周报流",
      goalPrompt: "每周抓取数据并整理结论。",
    });

    expect(executePlanner).toHaveBeenCalledOnce();
    expect(executePlanner).toHaveBeenCalledWith(
      expect.objectContaining({
        prompt: expect.stringMatching(/只输出一个 JSON 对象/u),
      }),
    );
    expect(executePlanner).toHaveBeenCalledWith(
      expect.objectContaining({
        prompt: expect.stringMatching(/type 只能是 start、script、agent、end/u),
      }),
    );

    const supportedTypes = new Set(["start", "script", "agent", "end"]);
    expect(graph.nodes.every((node) => supportedTypes.has(node.type))).toBe(true);
    expect(graph.nodes.find((node) => node.id === "node-http-1")?.type).toBe("script");
    expect(graph.nodes.find((node) => node.id === "node-http-1")).toMatchObject({
      config: { scriptId: null },
    });
    expect(graph.nodes.find((node) => node.id === "node-agent-1")).toMatchObject({
      config: {
        agentId: null,
        prompt: null,
      },
    });
    expect(graph.edges).toHaveLength(3);
  });

  it("falls back to seeded blank graph when readiness probe rejects", async () => {
    const executePlanner = vi.fn(async () =>
      JSON.stringify({
        graph: {
          nodes: [],
          edges: [],
        },
      }),
    );
    const builder = createWorkflowDraftBuilder({
      executePlanner,
      getReadiness: async () => {
        throw new Error("readiness probe failed");
      },
      getBrowserSession: async () => ({ ok: true, status: "ready" }),
    });

    const graph = await builder.build({
      mode: "ai",
      workflowName: "探针回退测试",
      goalPrompt: "生成一个草稿。",
    });

    expect(executePlanner).not.toHaveBeenCalled();
    expect(graph.nodes.map((node) => node.type).sort()).toEqual(["end", "start"]);
    expect(graph.edges).toEqual([]);
  });

  it("falls back to seeded blank graph when ai output misses boundary nodes", async () => {
    const executePlanner = vi.fn(async () =>
      JSON.stringify({
        planner_summary: "输出了一个不完整流程。",
        graph: {
          nodes: [
            {
              id: "node-script-1",
              type: "script",
              name: "抓取",
              config: { scriptId: "script-1" },
              uiPosition: { x: 260, y: 180 },
            },
            {
              id: "node-end-1",
              type: "end",
              name: "结束",
              config: { deliveryTarget: "none" },
              uiPosition: { x: 520, y: 180 },
            },
          ],
          edges: [
            {
              id: "edge-script-end",
              sourceNodeId: "node-script-1",
              targetNodeId: "node-end-1",
              condition: null,
              label: null,
            },
          ],
        },
      }),
    );
    const builder = createWorkflowDraftBuilder({
      executePlanner,
      getReadiness: async () => ({ ready: true }),
      getBrowserSession: async () => ({ ok: true, status: "ready" }),
    });

    const graph = await builder.build({
      mode: "ai",
      workflowName: "边界节点回退测试",
      goalPrompt: "先抓取再结束。",
    });

    expect(executePlanner).toHaveBeenCalledOnce();
    expect(graph.nodes.map((node) => node.type).sort()).toEqual(["end", "start"]);
    expect(graph.edges).toEqual([]);
  });

  it("falls back to seeded blank graph when ai output normalizes into disconnected graph", async () => {
    const executePlanner = vi.fn(async () =>
      JSON.stringify({
        graph: {
          nodes: [
            {
              id: "node-start-1",
              type: "start",
              name: "开始",
              config: { trigger: "manual" },
              uiPosition: { x: 80, y: 180 },
            },
            {
              id: "node-end-1",
              type: "end",
              name: "结束",
              config: { deliveryTarget: "none" },
              uiPosition: { x: 600, y: 180 },
            },
          ],
          edges: [],
        },
      }),
    );
    const builder = createWorkflowDraftBuilder({
      executePlanner,
      getReadiness: async () => ({ ready: true }),
      getBrowserSession: async () => ({ ok: true, status: "ready" }),
    });

    const graph = await builder.build({
      mode: "ai",
      workflowName: "断链回退测试",
      goalPrompt: "请生成一个流程。",
    });

    expect(graph.nodes.map((node) => node.name).sort()).toEqual(["End", "Start"]);
    expect(graph.nodes.map((node) => node.type).sort()).toEqual(["end", "start"]);
    expect(graph.edges).toEqual([]);
  });
});
