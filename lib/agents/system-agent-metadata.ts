import type { AgentTeamRole } from "@/lib/agents/types";
import { listBuiltInSystemAgents } from "@/lib/agents/system-agent-catalog";
import type { CodexSandboxMode } from "@/lib/resources/opencrab-api-types";

type BuiltInSystemAgentDefaults = {
  teamRole: AgentTeamRole;
  defaultSandboxMode: CodexSandboxMode;
};

const BUILT_IN_SYSTEM_AGENT_DEFAULTS = Object.fromEntries(
  listBuiltInSystemAgents().map((agent) => [
    agent.id,
    {
      teamRole: agent.teamRole,
      defaultSandboxMode: agent.defaultSandboxMode ?? "workspace-write",
    },
  ]),
) as Record<string, BuiltInSystemAgentDefaults>;

export const PROMOTED_SYSTEM_AGENT_IDS = new Set(
  listBuiltInSystemAgents()
    .filter((agent) => agent.promoted)
    .map((agent) => agent.id),
);

export function isBuiltInSystemAgentId(agentId: string) {
  return agentId in BUILT_IN_SYSTEM_AGENT_DEFAULTS;
}

export function getBuiltInSystemAgentDefaults(agentId: string) {
  return BUILT_IN_SYSTEM_AGENT_DEFAULTS[agentId] ?? null;
}
