import { beforeEach, describe, expect, it, vi } from "vitest";

const generateCodexReplyMock = vi.hoisted(() => vi.fn());
const getAgentProfileMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/codex/sdk", () => ({
  generateCodexReply: generateCodexReplyMock,
}));

vi.mock("@/lib/agents/agent-store", () => ({
  getAgentProfile: getAgentProfileMock,
}));

describe("workflow executor", () => {
  beforeEach(() => {
    generateCodexReplyMock.mockReset();
    getAgentProfileMock.mockReset();
  });

  it("executes script node source and merges the returned object into context", async () => {
    const { createWorkflowExecutor } = await import("@/lib/workflows/workflow-executor");

    const executor = createWorkflowExecutor();
    const result = await executor.executeRun({
      workflow: {
        id: "workflow-1",
        name: "Script workflow",
        description: null,
        ownerType: "person",
        ownerId: "person-1",
        status: "draft",
        activeVersionId: "workflow-version-1",
        createdAt: "2026-04-08T08:00:00.000Z",
        updatedAt: "2026-04-08T08:00:00.000Z",
      },
      version: {
        id: "workflow-version-1",
        workflowId: "workflow-1",
        versionNumber: 1,
        status: "draft",
        graph: {
          nodes: [
            {
              id: "node-start",
              type: "start",
              name: "Start",
              config: { trigger: "manual" },
              uiPosition: { x: 0, y: 0 },
            },
            {
              id: "node-script",
              type: "script",
              name: "Script",
              config: {
                scriptId: null,
                source: "return { route: context.flag === 'go' ? 'approved' : 'rejected', total: 3 };",
              },
              uiPosition: { x: 220, y: 0 },
            },
            {
              id: "node-end",
              type: "end",
              name: "End",
              config: { deliveryTarget: "none" },
              uiPosition: { x: 440, y: 0 },
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
        },
        createdAt: "2026-04-08T08:00:00.000Z",
        updatedAt: "2026-04-08T08:00:00.000Z",
        publishedAt: null,
      },
      run: {
        id: "workflow-run-1",
        workflowId: "workflow-1",
        workflowVersionId: "workflow-version-1",
        workflowVersionNumber: 1,
        trigger: "manual",
        triggerStartNodeIds: ["node-start"],
        status: "running",
        initiatedBy: "tester",
        startedAt: "2026-04-08T09:00:00.000Z",
        completedAt: null,
        summary: null,
        errorMessage: null,
      },
      triggerStartNodeIds: ["node-start"],
      initialContext: {
        flag: "go",
      },
    });

    expect(result.context).toMatchObject({
      flag: "go",
      route: "approved",
      total: 3,
    });
  });

  it("executes an agent node with the selected agent profile and prompt", async () => {
    getAgentProfileMock.mockReturnValue({
      id: "agent-writer",
      name: "Writer",
      summary: "Writes",
      roleLabel: "Writer",
      description: "Writer agent",
      source: "system",
      availability: "both",
      teamRole: "writer",
      familyId: "writers",
      familyLabel: "Writers",
      familyDescription: "Writers",
      familyOrder: 1,
      promoted: true,
      defaultModel: null,
      defaultReasoningEffort: null,
      defaultSandboxMode: null,
      starterPrompts: [],
      fileCount: 0,
      createdAt: "2026-04-08T08:00:00.000Z",
      updatedAt: "2026-04-08T08:00:00.000Z",
      files: {
        identity: "",
        contract: "",
        execution: "",
        quality: "",
        handoff: "",
      },
    });
    generateCodexReplyMock.mockResolvedValue({
      text: "Agent output",
      threadId: "thread-1",
      model: "gpt-5.4",
      usage: null,
    });

    const { createWorkflowExecutor } = await import("@/lib/workflows/workflow-executor");
    const executor = createWorkflowExecutor();
    const result = await executor.executeRun({
      workflow: {
        id: "workflow-1",
        name: "Agent workflow",
        description: null,
        ownerType: "person",
        ownerId: "person-1",
        status: "draft",
        activeVersionId: "workflow-version-1",
        createdAt: "2026-04-08T08:00:00.000Z",
        updatedAt: "2026-04-08T08:00:00.000Z",
      },
      version: {
        id: "workflow-version-1",
        workflowId: "workflow-1",
        versionNumber: 1,
        status: "draft",
        graph: {
          nodes: [
            {
              id: "node-start",
              type: "start",
              name: "Start",
              config: { trigger: "manual" },
              uiPosition: { x: 0, y: 0 },
            },
            {
              id: "node-agent",
              type: "agent",
              name: "Agent",
              config: {
                agentId: "agent-writer",
                prompt: "Summarize the current workflow context.",
              },
              uiPosition: { x: 220, y: 0 },
            },
            {
              id: "node-end",
              type: "end",
              name: "End",
              config: { deliveryTarget: "none" },
              uiPosition: { x: 440, y: 0 },
            },
          ],
          edges: [
            {
              id: "edge-start-agent",
              sourceNodeId: "node-start",
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
          layout: {
            viewport: { x: 0, y: 0, zoom: 1 },
          },
          defaults: {
            timezone: null,
          },
        },
        createdAt: "2026-04-08T08:00:00.000Z",
        updatedAt: "2026-04-08T08:00:00.000Z",
        publishedAt: null,
      },
      run: {
        id: "workflow-run-1",
        workflowId: "workflow-1",
        workflowVersionId: "workflow-version-1",
        workflowVersionNumber: 1,
        trigger: "manual",
        triggerStartNodeIds: ["node-start"],
        status: "running",
        initiatedBy: "tester",
        startedAt: "2026-04-08T09:00:00.000Z",
        completedAt: null,
        summary: null,
        errorMessage: null,
      },
      triggerStartNodeIds: ["node-start"],
      initialContext: {
        topic: "workflow",
      },
    });

    expect(getAgentProfileMock).toHaveBeenCalledWith("agent-writer");
    expect(generateCodexReplyMock).toHaveBeenCalledTimes(1);
    expect(result.context).toMatchObject({
      topic: "workflow",
      agentId: "agent-writer",
      text: "Agent output",
      threadId: "thread-1",
    });
  });
});
