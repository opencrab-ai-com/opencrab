import type {
  CodexReasoningEffort,
  CodexSandboxMode,
} from "@/lib/resources/opencrab-api-types";

export type AgentSource = "system" | "custom";
export type AgentAvailability = "solo" | "team" | "both";
export type AgentTeamRole = "lead" | "research" | "writer" | "specialist";
export type AgentFileKey = "soul" | "responsibility" | "tools" | "user" | "knowledge";

export type AgentFiles = Record<AgentFileKey, string>;

export type AgentCatalogMetadata = {
  groupId: string;
  groupLabel: string;
  groupDescription: string;
  groupOrder: number;
  collectionId: string;
  collectionLabel: string;
  collectionDescription: string;
  collectionOrder: number;
  promoted: boolean;
  upstreamAgentName: string | null;
  upstreamSourceUrl: string | null;
  upstreamLicense: string | null;
};

export type AgentProfileRecord = AgentCatalogMetadata & {
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
