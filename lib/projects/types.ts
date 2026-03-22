import type {
  CodexReasoningEffort,
  CodexSandboxMode,
} from "@/lib/resources/opencrab-api-types";
import type { ConversationItem, ConversationMessage } from "@/lib/seed-data";

export type ProjectRoomStatus = "active" | "paused";
export type ProjectRunStatus =
  | "ready"
  | "running"
  | "paused"
  | "waiting_user"
  | "waiting_approval"
  | "completed";
export type ProjectAgentVisibility = "frontstage" | "backstage" | "mixed";
export type ProjectAgentStatus = "idle" | "planning" | "working" | "reviewing";
export type ProjectEventVisibility = "frontstage" | "backstage";
export type ProjectArtifactStatus = "draft" | "ready" | "planned";
export type ProjectRunRecordStatus =
  | "running"
  | "paused"
  | "waiting_user"
  | "waiting_approval"
  | "completed";

export type ProjectCheckpointAction = "approve" | "request_changes" | "resume" | "pause";

export type ProjectAgentProgressEntry = {
  id: string;
  label: string;
  detail: string;
  createdAt: string;
};

export type ProjectRoomRecord = {
  id: string;
  title: string;
  teamName: string;
  goal: string;
  workspaceDir: string | null;
  teamConversationId: string | null;
  summary: string;
  status: ProjectRoomStatus;
  runStatus: ProjectRunStatus;
  sourceConversationId: string | null;
  sourceConversationTitle: string | null;
  latestUserRequest: string | null;
  currentStageLabel?: string | null;
  activeAgentId?: string | null;
  nextAgentId?: string | null;
  memberCount: number;
  artifactCount: number;
  lastActivityLabel: string;
  createdAt: string;
  updatedAt: string;
};

export type ProjectAgentRecord = {
  id: string;
  projectId: string;
  agentProfileId?: string | null;
  name: string;
  role: string;
  responsibility: string;
  status: ProjectAgentStatus;
  visibility: ProjectAgentVisibility;
  runtimeConversationId?: string | null;
  lastAssignedTask?: string | null;
  lastResultSummary?: string | null;
  progressLabel?: string | null;
  progressDetails?: string | null;
  lastHeartbeatAt?: string | null;
  progressTrail?: ProjectAgentProgressEntry[];
  blockedByAgentId?: string | null;
  lastCompletedAt?: string | null;
  model: string;
  reasoningEffort: CodexReasoningEffort;
  sandboxMode: CodexSandboxMode;
  canDelegate: boolean;
};

export type ProjectEventRecord = {
  id: string;
  projectId: string;
  title: string;
  description: string;
  visibility: ProjectEventVisibility;
  actorName: string;
  createdAt: string;
};

export type ProjectArtifactRecord = {
  id: string;
  projectId: string;
  title: string;
  typeLabel: string;
  summary: string;
  status: ProjectArtifactStatus;
  updatedAt: string;
};

export type ProjectRunRecord = {
  id: string;
  projectId: string;
  status: ProjectRunRecordStatus;
  triggerLabel: string;
  summary: string;
  currentStepLabel: string;
  startedAt: string;
  finishedAt: string | null;
};

export type ProjectStoreState = {
  rooms: ProjectRoomRecord[];
  agents: ProjectAgentRecord[];
  events: ProjectEventRecord[];
  artifacts: ProjectArtifactRecord[];
  runs: ProjectRunRecord[];
};

export type ProjectDetail = {
  project: ProjectRoomRecord | null;
  agents: ProjectAgentRecord[];
  events: ProjectEventRecord[];
  artifacts: ProjectArtifactRecord[];
  runs: ProjectRunRecord[];
  sourceConversation: ConversationItem | null;
  sourceMessages: ConversationMessage[];
};

export type ProjectListResponse = {
  projects: ProjectRoomRecord[];
};

export type ProjectDetailResponse = {
  project: ProjectDetail["project"];
  agents: ProjectAgentRecord[];
  events: ProjectEventRecord[];
  artifacts: ProjectArtifactRecord[];
  runs: ProjectRunRecord[];
  sourceConversation: ConversationItem | null;
  sourceMessages: ConversationMessage[];
};
