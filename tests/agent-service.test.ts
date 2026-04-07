import { describe, expect, it, vi } from "vitest";
import {
  createAgentService,
  type AgentCreateInput,
  type AgentMutationInput,
} from "@/lib/modules/agents/agent-service";
import type { AgentProfileDetail, AgentProfileRecord } from "@/lib/agents/types";

function createAgentRecord(overrides: Partial<AgentProfileRecord> = {}): AgentProfileRecord {
  return {
    id: "agent-1",
    name: "Researcher",
    avatarDataUrl: null,
    summary: "Finds facts",
    roleLabel: "Research",
    description: "Finds facts",
    source: "custom",
    availability: "both",
    teamRole: "research",
    defaultModel: null,
    defaultReasoningEffort: "medium",
    defaultSandboxMode: "read-only",
    starterPrompts: [],
    familyId: "custom",
    familyLabel: "我的智能体",
    familyDescription: "你自己创建和维护的长期角色。",
    familyOrder: 1_000,
    promoted: false,
    fileCount: 5,
    createdAt: "2026-03-23T00:00:00.000Z",
    updatedAt: "2026-03-23T00:00:00.000Z",
    ...overrides,
  };
}

function createAgentDetail(overrides: Partial<AgentProfileDetail> = {}): AgentProfileDetail {
  return {
    ...createAgentRecord(),
    files: {
      identity: "",
      contract: "",
      execution: "",
      quality: "",
      handoff: "",
    },
    ...overrides,
  };
}

describe("agentService", () => {
  it("delegates agent reads and mutations", () => {
    const detail = createAgentDetail();
    const record = createAgentRecord();
    const createInput: AgentCreateInput = {
      name: "Researcher",
      summary: "Finds facts",
    };
    const patch: AgentMutationInput = {
      summary: "Finds better facts",
      defaultSkillIds: ["brainstorming"],
      optionalSkillIds: ["pdf"],
    };
    const repository = {
      listAgentProfiles: vi.fn(() => [record]),
      getAgentProfile: vi.fn(() => detail),
      createAgentProfile: vi.fn(() => detail),
      updateAgentProfile: vi.fn(() => detail),
      deleteAgentProfile: vi.fn(() => true),
      resetSystemAgentProfile: vi.fn(() => detail),
    };
    const service = createAgentService({ repository });

    expect(service.list()).toEqual([record]);
    expect(service.get("agent-1")).toEqual(detail);
    expect(service.create(createInput)).toEqual(detail);
    expect(service.update("agent-1", patch)).toEqual(detail);
    expect(service.remove("agent-1")).toBe(true);
    expect(service.reset("agent-1")).toEqual(detail);
    expect(repository.updateAgentProfile).toHaveBeenCalledWith("agent-1", patch);
    expect(repository.resetSystemAgentProfile).toHaveBeenCalledWith("agent-1");
  });
});
