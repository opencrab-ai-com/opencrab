import { describe, expect, it } from "vitest";
import {
  isCustomAgentForDisplay,
  isSelectableTeamAgent,
  isSystemAgentForDisplay,
} from "@/lib/agents/display";
import type { AgentProfileRecord } from "@/lib/agents/types";

function createAgent(overrides: Partial<AgentProfileRecord> = {}): AgentProfileRecord {
  return {
    id: "agent-1",
    name: "Agent",
    avatarDataUrl: null,
    summary: "Summary",
    roleLabel: "Specialist",
    description: "Description",
    source: "custom",
    availability: "both",
    teamRole: "specialist",
    defaultModel: null,
    defaultReasoningEffort: null,
    defaultSandboxMode: null,
    starterPrompts: [],
    familyId: "custom",
    familyLabel: "我的智能体",
    familyDescription: "你自己创建和维护的长期角色。",
    familyOrder: 1_000,
    promoted: false,
    fileCount: 5,
    createdAt: "2026-03-24T00:00:00.000Z",
    updatedAt: "2026-03-24T00:00:00.000Z",
    ...overrides,
  };
}

describe("agent display rules", () => {
  it("keeps PM out of the extra member picker because it is auto-included", () => {
    expect(
      isSelectableTeamAgent(
        createAgent({
          id: "project-manager",
          source: "system",
          availability: "team",
        }),
      ),
    ).toBe(false);
  });

  it("still shows selectable custom and visible system agents", () => {
    expect(
      isSelectableTeamAgent(
        createAgent({
          id: "product-manager",
          source: "system",
          availability: "both",
        }),
      ),
    ).toBe(true);
    expect(
      isSelectableTeamAgent(
        createAgent({
          id: "custom-team-agent",
          source: "custom",
          availability: "both",
        }),
      ),
    ).toBe(true);
  });

  it("uses the same visibility split as the agents screen", () => {
    expect(
      isSystemAgentForDisplay(
        createAgent({
          id: "product-manager",
          source: "system",
        }),
      ),
    ).toBe(true);
    expect(
      isCustomAgentForDisplay(
        createAgent({
          id: "custom-team-agent",
          source: "custom",
        }),
      ),
    ).toBe(true);
  });
});
