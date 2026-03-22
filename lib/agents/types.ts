import type {
  CodexReasoningEffort,
  CodexSandboxMode,
} from "@/lib/resources/opencrab-api-types";

export type AgentSource = "system" | "custom";
export type AgentAvailability = "solo" | "team" | "both";
export type AgentTeamRole = "lead" | "research" | "writer" | "specialist";
export type AgentFileKey = "soul" | "responsibility" | "tools" | "user" | "knowledge";

export type AgentFiles = Record<AgentFileKey, string>;

export type AgentProfileRecord = {
  id: string;
  name: string;
  avatarDataUrl: string | null;
  summary: string;
  roleLabel: string;
  description: string;
  source: AgentSource;
  availability: AgentAvailability;
  teamRole: AgentTeamRole;
  defaultModel: string | null;
  defaultReasoningEffort: CodexReasoningEffort | null;
  defaultSandboxMode: CodexSandboxMode | null;
  starterPrompts: string[];
  fileCount: number;
  createdAt: string;
  updatedAt: string;
};

export type AgentProfileDetail = AgentProfileRecord & {
  files: AgentFiles;
};

export type AgentProfileListResponse = {
  agents: AgentProfileRecord[];
};

export type AgentProfileDetailResponse = {
  agent: AgentProfileDetail | null;
};
