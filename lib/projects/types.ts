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
export type ProjectReviewStatus = "pending" | "approved" | "changes_requested" | "cancelled";
export type ProjectTaskLockStatus = "none" | "held" | "waiting";
export type ProjectMailboxThreadKind =
  | "direct_message"
  | "broadcast"
  | "handoff"
  | "review_request"
  | "human_review"
  | "request_input"
  | "escalation"
  | "self_claim"
  | "next_step_suggestion";
export type ProjectMailboxThreadStatus = "open" | "resolved" | "cancelled";
export type ProjectHeartbeatStatus = "healthy" | "warning" | "stalled" | "idle";
export type ProjectStuckSignalKind = "lease_expired" | "runtime_missing" | "reply_timeout";
export type ProjectStuckSignalStatus = "open" | "resolved";
export type ProjectAutonomyStatus = "guarded" | "gated";
export type ProjectAutonomyGateKind = "autonomy_budget" | "risk_boundary";
export type ProjectAutonomyGateStatus = "open" | "resolved";
export type ProjectRecoveryActionKind =
  | "retry_same_owner"
  | "reassign_to_peer"
  | "rollback_to_checkpoint"
  | "take_over_by_manager";
export type ProjectTaskReflectionOutcome = "smooth" | "needs_follow_up" | "recovered" | "blocked";
export type ProjectRunSummaryOutcome = "running" | "paused" | "waiting_user" | "waiting_approval" | "completed";
export type ProjectLearningSuggestionKind =
  | "failure_pattern"
  | "task_template"
  | "role_tuning"
  | "quality_gate"
  | "skill_upgrade"
  | "agent_profile_update";
export type ProjectLearningSuggestionStatus = "open" | "accepted" | "dismissed";
export type ProjectLearningEvidenceSourceKind =
  | "task_reflection"
  | "stage_reflection"
  | "run_summary"
  | "review"
  | "recovery"
  | "project_memory"
  | "team_memory"
  | "role_memory";
export type ProjectLearningReuseCandidateKind =
  | "task_template_candidate"
  | "quality_gate_candidate"
  | "handoff_review_checklist_candidate";
export type ProjectLearningReuseCandidateStatus = "pending_review" | "confirmed" | "dismissed";
export type ProjectTaskStatus =
  | "draft"
  | "ready"
  | "claimed"
  | "in_progress"
  | "in_review"
  | "waiting_input"
  | "blocked"
  | "completed"
  | "reopened"
  | "cancelled";
export type ProjectRunRecordStatus =
  | "running"
  | "paused"
  | "waiting_user"
  | "waiting_approval"
  | "completed";

export type ProjectCheckpointAction = "approve" | "request_changes" | "resume" | "rollback" | "pause";

export type ProjectAgentProgressEntry = {
  id: string;
  label: string;
  detail: string;
  createdAt: string;
};

export type ProjectMemoryEntry = {
  id: string;
  label: string;
  summary: string;
  sourceKind: "goal" | "checkpoint" | "user_note" | "review" | "recovery" | "task";
  sourceId: string | null;
  updatedAt: string;
};

export type ProjectMemoryRecord = {
  projectId: string;
  decisions: ProjectMemoryEntry[];
  preferences: ProjectMemoryEntry[];
  risks: ProjectMemoryEntry[];
  pitfalls: ProjectMemoryEntry[];
  updatedAt: string;
};

export type ProjectTeamMemoryPattern = {
  id: string;
  label: string;
  summary: string;
  count: number;
  updatedAt: string;
};

export type ProjectTeamMemoryRecord = {
  projectId: string;
  handoffPatterns: ProjectTeamMemoryPattern[];
  blockerPatterns: ProjectTeamMemoryPattern[];
  reviewPatterns: ProjectTeamMemoryPattern[];
  updatedAt: string;
};

export type ProjectRoleMemoryRecord = {
  projectId: string;
  agentId: string;
  agentName: string;
  strengths: string[];
  commonIssues: string[];
  preferredInputFormat: string[];
  updatedAt: string;
};

export type ProjectTaskRecord = {
  id: string;
  projectId: string;
  title: string;
  description: string;
  status: ProjectTaskStatus;
  ownerAgentId: string | null;
  ownerAgentName: string | null;
  stageLabel: string | null;
  acceptanceCriteria: string | null;
  queuedStatus: ProjectTaskStatus | null;
  dependsOnTaskIds: string[];
  inputArtifactIds: string[];
  blockedByTaskId: string | null;
  blockedReason: string | null;
  lockScopePaths: string[];
  lockStatus: ProjectTaskLockStatus;
  lockBlockedByTaskId: string | null;
  resultSummary: string | null;
  artifactIds: string[];
  createdAt: string;
  updatedAt: string;
  claimedAt: string | null;
  recoveryAttemptCount: number;
  ownerReplacementCount: number;
  lastReassignedAt: string | null;
  lastReassignmentReason: string | null;
  leaseAcquiredAt: string | null;
  leaseHeartbeatAt: string | null;
  leaseExpiresAt: string | null;
  startedAt: string | null;
  completedAt: string | null;
};

export type ProjectReviewRecord = {
  id: string;
  projectId: string;
  taskId: string;
  taskTitle: string;
  reviewTargetLabel: string;
  requesterAgentId: string | null;
  requesterAgentName: string | null;
  reviewerAgentId: string | null;
  reviewerAgentName: string | null;
  status: ProjectReviewStatus;
  summary: string;
  blockingComments: string | null;
  followUpTaskId: string | null;
  createdAt: string;
  updatedAt: string;
  completedAt: string | null;
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
  activeTaskTitle?: string | null;
  activeTaskStatus?: ProjectTaskStatus | null;
  openTaskCount?: number;
  pendingReviewCount?: number;
  openStuckSignalCount?: number;
  openGateCount?: number;
  latestGateSummary?: string | null;
  autonomyStatus?: ProjectAutonomyStatus;
  autonomyRoundBudget?: number;
  autonomyRoundCount?: number;
  autonomyApprovedAt?: string | null;
  autonomyPauseReason?: string | null;
  latestRecoverySummary?: string | null;
  latestRecoveryKind?: ProjectRecoveryActionKind | null;
  latestRunStepLabel?: string | null;
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
  currentTaskId?: string | null;
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
  sourceTaskId: string | null;
  sourceTaskTitle: string | null;
  ownerAgentId: string | null;
  ownerAgentName: string | null;
  reviewStatus: ProjectReviewStatus | null;
  reviewerAgentId: string | null;
  reviewerAgentName: string | null;
  dependsOnArtifactIds: string[];
  consumedByTaskIds: string[];
  updatedAt: string;
};

export type ProjectMailboxThreadRecord = {
  id: string;
  projectId: string;
  kind: ProjectMailboxThreadKind;
  status: ProjectMailboxThreadStatus;
  subject: string;
  summary: string;
  fromAgentId: string | null;
  fromAgentName: string | null;
  toAgentIds: string[];
  toAgentNames: string[];
  relatedTaskId: string | null;
  relatedTaskTitle: string | null;
  relatedReviewId: string | null;
  relatedSuggestionId: string | null;
  relatedArtifactIds: string[];
  createdAt: string;
  updatedAt: string;
  resolvedAt: string | null;
};

export type ProjectHeartbeatRecord = {
  id: string;
  projectId: string;
  agentId: string;
  agentName: string;
  status: ProjectHeartbeatStatus;
  taskId: string | null;
  taskTitle: string | null;
  summary: string;
  recordedAt: string;
  leaseExpiresAt: string | null;
};

export type ProjectStuckSignalRecord = {
  id: string;
  projectId: string;
  agentId: string;
  agentName: string;
  taskId: string | null;
  taskTitle: string | null;
  kind: ProjectStuckSignalKind;
  status: ProjectStuckSignalStatus;
  summary: string;
  detectedAt: string;
  updatedAt: string;
  resolvedAt: string | null;
};

export type ProjectRecoveryActionRecord = {
  id: string;
  projectId: string;
  kind: ProjectRecoveryActionKind;
  summary: string;
  taskId: string | null;
  taskTitle: string | null;
  fromAgentId: string | null;
  fromAgentName: string | null;
  toAgentId: string | null;
  toAgentName: string | null;
  createdAt: string;
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

export type ProjectTaskReflectionRecord = {
  id: string;
  projectId: string;
  taskId: string;
  taskTitle: string;
  ownerAgentId: string | null;
  ownerAgentName: string | null;
  outcome: ProjectTaskReflectionOutcome;
  summary: string;
  wins: string[];
  issues: string[];
  advice: string[];
  createdAt: string;
  updatedAt: string;
};

export type ProjectStageReflectionRecord = {
  id: string;
  projectId: string;
  stageLabel: string;
  summary: string;
  highlights: string[];
  frictions: string[];
  recommendations: string[];
  updatedAt: string;
};

export type ProjectRunSummaryRecord = {
  id: string;
  projectId: string;
  runId: string;
  title: string;
  outcome: ProjectRunSummaryOutcome;
  summary: string;
  wins: string[];
  risks: string[];
  recommendations: string[];
  updatedAt: string;
};

export type ProjectLearningEvidenceSource = {
  id: string;
  kind: ProjectLearningEvidenceSourceKind;
  label: string;
  summary: string;
  relatedId: string | null;
  relatedTaskId: string | null;
  updatedAt: string;
};

export type ProjectLearningSuggestionRecord = {
  id: string;
  projectId: string;
  kind: ProjectLearningSuggestionKind;
  status: ProjectLearningSuggestionStatus;
  title: string;
  summary: string;
  evidenceLabels: string[];
  evidenceSources: ProjectLearningEvidenceSource[];
  targetLabel: string | null;
  actionItems: string[];
  writebackSummary: string | null;
  writebackTargets: string[];
  requiresHumanReview: boolean;
  reviewThreadId: string | null;
  reviewNote: string | null;
  reviewedAt: string | null;
  updatedAt: string;
};

export type ProjectLearningReuseCandidateRecord = {
  id: string;
  sourceProjectId: string;
  sourceProjectTitle: string;
  sourceSuggestionId: string;
  sourceSuggestionTitle: string;
  kind: ProjectLearningReuseCandidateKind;
  status: ProjectLearningReuseCandidateStatus;
  title: string;
  summary: string;
  targetLabel: string | null;
  evidenceLabels: string[];
  evidenceSources: ProjectLearningEvidenceSource[];
  acceptedAt: string;
  reviewNote: string | null;
  reviewedAt: string | null;
  updatedAt: string;
};

export type ProjectAutonomyGateRecord = {
  id: string;
  projectId: string;
  kind: ProjectAutonomyGateKind;
  status: ProjectAutonomyGateStatus;
  title: string;
  summary: string;
  openedAt: string;
  updatedAt: string;
  resolvedAt: string | null;
};

export type ProjectStoreState = {
  rooms: ProjectRoomRecord[];
  agents: ProjectAgentRecord[];
  events: ProjectEventRecord[];
  artifacts: ProjectArtifactRecord[];
  mailboxThreads: ProjectMailboxThreadRecord[];
  projectMemories: ProjectMemoryRecord[];
  teamMemories: ProjectTeamMemoryRecord[];
  roleMemories: ProjectRoleMemoryRecord[];
  taskReflections: ProjectTaskReflectionRecord[];
  stageReflections: ProjectStageReflectionRecord[];
  runSummaries: ProjectRunSummaryRecord[];
  learningSuggestions: ProjectLearningSuggestionRecord[];
  learningReuseCandidates: ProjectLearningReuseCandidateRecord[];
  autonomyGates: ProjectAutonomyGateRecord[];
  heartbeats: ProjectHeartbeatRecord[];
  stuckSignals: ProjectStuckSignalRecord[];
  recoveryActions: ProjectRecoveryActionRecord[];
  reviews: ProjectReviewRecord[];
  tasks: ProjectTaskRecord[];
  runs: ProjectRunRecord[];
};

export type ProjectDetail = {
  project: ProjectRoomRecord | null;
  agents: ProjectAgentRecord[];
  events: ProjectEventRecord[];
  artifacts: ProjectArtifactRecord[];
  mailboxThreads: ProjectMailboxThreadRecord[];
  projectMemory: ProjectMemoryRecord | null;
  teamMemory: ProjectTeamMemoryRecord | null;
  roleMemories: ProjectRoleMemoryRecord[];
  taskReflections: ProjectTaskReflectionRecord[];
  stageReflections: ProjectStageReflectionRecord[];
  runSummaries: ProjectRunSummaryRecord[];
  learningSuggestions: ProjectLearningSuggestionRecord[];
  learningReuseCandidates: ProjectLearningReuseCandidateRecord[];
  autonomyGates: ProjectAutonomyGateRecord[];
  heartbeats: ProjectHeartbeatRecord[];
  stuckSignals: ProjectStuckSignalRecord[];
  recoveryActions: ProjectRecoveryActionRecord[];
  reviews: ProjectReviewRecord[];
  tasks: ProjectTaskRecord[];
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
  mailboxThreads: ProjectMailboxThreadRecord[];
  projectMemory: ProjectMemoryRecord | null;
  teamMemory: ProjectTeamMemoryRecord | null;
  roleMemories: ProjectRoleMemoryRecord[];
  taskReflections: ProjectTaskReflectionRecord[];
  stageReflections: ProjectStageReflectionRecord[];
  runSummaries: ProjectRunSummaryRecord[];
  learningSuggestions: ProjectLearningSuggestionRecord[];
  learningReuseCandidates: ProjectLearningReuseCandidateRecord[];
  autonomyGates: ProjectAutonomyGateRecord[];
  heartbeats: ProjectHeartbeatRecord[];
  stuckSignals: ProjectStuckSignalRecord[];
  recoveryActions: ProjectRecoveryActionRecord[];
  reviews: ProjectReviewRecord[];
  tasks: ProjectTaskRecord[];
  runs: ProjectRunRecord[];
  sourceConversation: ConversationItem | null;
  sourceMessages: ConversationMessage[];
};
