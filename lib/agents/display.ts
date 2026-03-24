import type { AgentProfileRecord } from "@/lib/agents/types";

export function isSystemAgentForDisplay(agent: Pick<AgentProfileRecord, "id" | "source">) {
  return agent.source === "system";
}

export function isCustomAgentForDisplay(agent: Pick<AgentProfileRecord, "id" | "source">) {
  return agent.source === "custom";
}

export function isSelectableTeamAgent(
  agent: Pick<AgentProfileRecord, "id" | "availability">,
) {
  if (agent.id === "project-manager") {
    return false;
  }

  return agent.availability === "team" || agent.availability === "both";
}
