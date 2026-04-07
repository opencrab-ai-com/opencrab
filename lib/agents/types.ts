import type {
  CodexReasoningEffort,
  CodexSandboxMode,
} from "@/lib/resources/opencrab-api-types";

export type AgentSource = "system" | "custom";
export type AgentAvailability = "solo" | "team" | "both";
export type AgentTeamRole = "lead" | "research" | "writer" | "specialist";
export type AgentFileKey = "identity" | "contract" | "execution" | "quality" | "handoff";

export type AgentFiles = Record<AgentFileKey, string>;

export type AgentDeliverableDefinition = {
  id: string;
  label: string;
  required: boolean;
};

export type AgentCatalogMetadata = {
  familyId: string;
  familyLabel: string;
  familyDescription: string;
  familyOrder: number;
  promoted: boolean;
  ownedOutcomes?: string[];
  outOfScope?: string[];
  deliverables?: AgentDeliverableDefinition[];
  defaultSkillIds?: string[];
  optionalSkillIds?: string[];
  qualityGates?: string[];
  handoffTargets?: string[];
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
