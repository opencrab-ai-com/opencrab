import type { AgentTeamRole } from "@/lib/agents/types";
import { listBuiltInSystemAgents } from "@/lib/agents/system-agent-catalog";
import type { CodexSandboxMode } from "@/lib/resources/opencrab-api-types";

type BuiltInSystemAgentDefaults = {
  teamRole: AgentTeamRole;
  defaultSandboxMode: CodexSandboxMode;
};

export function isBuiltInSystemAgentId(agentId: string) {
  return listBuiltInSystemAgents().some((agent) => agent.id === agentId);
}

export function getBuiltInSystemAgentDefaults(agentId: string) {
  const agent = listBuiltInSystemAgents().find((item) => item.id === agentId);

  if (!agent) {
    return null;
  }

  return {
    teamRole: agent.teamRole,
    defaultSandboxMode: agent.defaultSandboxMode ?? "workspace-write",
  } satisfies BuiltInSystemAgentDefaults;
}

export function getPromotedSystemAgentIds() {
  return new Set(listBuiltInSystemAgents().filter((agent) => agent.promoted).map((agent) => agent.id));
}
