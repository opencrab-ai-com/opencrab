import {
  createAgentProfile,
  deleteAgentProfile,
  getAgentProfile,
  listAgentProfiles,
  resetSystemAgentProfile,
  updateAgentProfile,
} from "@/lib/agents/agent-store";
import type { AgentFiles, AgentProfileDetail, AgentProfileRecord } from "@/lib/agents/types";
import type {
  CodexReasoningEffort,
  CodexSandboxMode,
} from "@/lib/resources/opencrab-api-types";

export type AgentMutationInput = Partial<{
  name: string;
  summary: string;
  avatarDataUrl: string | null;
  roleLabel: string;
  description: string;
  availability: "solo" | "team" | "both";
  teamRole: "lead" | "research" | "writer" | "specialist";
  defaultModel: string | null;
  defaultReasoningEffort: CodexReasoningEffort | null;
  defaultSandboxMode: CodexSandboxMode | null;
  starterPrompts: string[];
  defaultSkillIds: string[];
  optionalSkillIds: string[];
  files: Partial<AgentFiles>;
}>;

export type AgentCreateInput = AgentMutationInput & {
  name: string;
  summary: string;
};

export type AgentRepository = {
  listAgentProfiles: () => AgentProfileRecord[];
  getAgentProfile: (agentId: string) => AgentProfileDetail | null;
  createAgentProfile: (input: AgentCreateInput) => AgentProfileDetail;
  updateAgentProfile: (
    agentId: string,
    input: AgentMutationInput,
  ) => AgentProfileDetail;
  deleteAgentProfile: (agentId: string) => boolean;
  resetSystemAgentProfile: (agentId: string) => AgentProfileDetail | null;
};

type AgentServiceDependencies = {
  repository?: AgentRepository;
};

export function createAgentService(
  dependencies: AgentServiceDependencies = {},
) {
  const repository = dependencies.repository ?? localAgentRepository;

  return {
    list() {
      return repository.listAgentProfiles();
    },
    get(agentId: string) {
      return repository.getAgentProfile(agentId);
    },
    create(input: AgentCreateInput) {
      return repository.createAgentProfile(input);
    },
    update(agentId: string, patch: AgentMutationInput) {
      return repository.updateAgentProfile(agentId, patch);
    },
    remove(agentId: string) {
      return repository.deleteAgentProfile(agentId);
    },
    reset(agentId: string) {
      return repository.resetSystemAgentProfile(agentId);
    },
  };
}

const localAgentRepository: AgentRepository = {
  listAgentProfiles,
  getAgentProfile,
  createAgentProfile,
  updateAgentProfile,
  deleteAgentProfile,
  resetSystemAgentProfile,
};

export const agentService = createAgentService();
