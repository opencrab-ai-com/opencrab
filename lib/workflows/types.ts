export type WorkflowOwnerType = "person" | "team";

export type WorkflowStatus = "draft" | "active" | "paused" | "archived";

export type WorkflowVersionStatus = "draft" | "published";

export type WorkflowNodeType = "start" | "script" | "agent" | "end";
export type WorkflowTriggerType = "manual" | "schedule";
export type WorkflowSchedulePreset = "daily" | "weekdays" | "weekly" | "interval";
export type WorkflowRunStatus = "running" | "success" | "error" | "waiting_for_human";
export type WorkflowNodeRunStatus =
  | "pending"
  | "running"
  | "success"
  | "error"
  | "waiting_for_human"
  | "stale";
export type WorkflowReviewSurface = "general" | "pending_publish";
export type WorkflowReviewStatus = "open" | "resolved";
export type WorkflowReviewView = "all" | "pending_publish";

export type WorkflowSchedule = {
  preset: WorkflowSchedulePreset;
  time?: string | null;
  weekday?: number | null;
  intervalMinutes?: number | null;
  intervalHours?: number | null;
};

export type WorkflowDeliveryDestination =
  | { kind: "none" }
  | { kind: "review_center" }
  | { kind: "pending_publish" }
  | { kind: "conversation"; conversationId: string | null }
  | { kind: "channel"; channelId: string | null };

export type WorkflowNodePosition = {
  x: number;
  y: number;
};

export type WorkflowStartNode = {
  id: string;
  type: "start";
  name: string;
  config: {
    trigger: WorkflowTriggerType;
    schedule?: WorkflowSchedule | null;
  };
  uiPosition: WorkflowNodePosition;
};

export type WorkflowScriptNode = {
  id: string;
  type: "script";
  name: string;
  config: {
    scriptId: string | null;
    source?: string | null;
  };
  uiPosition: WorkflowNodePosition;
};

export type WorkflowAgentNode = {
  id: string;
  type: "agent";
  name: string;
  config: {
    agentId: string | null;
    prompt: string | null;
  };
  uiPosition: WorkflowNodePosition;
};

export type WorkflowEndNode = {
  id: string;
  type: "end";
  name: string;
  config: {
    deliveryTarget: "conversation" | "channel" | "pending_publish" | "none";
    primaryDestination?: WorkflowDeliveryDestination | null;
    mirroredDestinations?: WorkflowDeliveryDestination[];
  };
  uiPosition: WorkflowNodePosition;
};

export type WorkflowNodeRecord =
  | WorkflowStartNode
  | WorkflowScriptNode
  | WorkflowAgentNode
  | WorkflowEndNode;

export type WorkflowEdgeRecord = {
  id: string;
  sourceNodeId: string;
  targetNodeId: string;
  condition: string | null;
  label: string | null;
};

export type WorkflowGraph = {
  nodes: WorkflowNodeRecord[];
  edges: WorkflowEdgeRecord[];
  layout: {
    viewport: {
      x: number;
      y: number;
      zoom: number;
    };
  };
  defaults: {
    timezone: string | null;
  };
};

export type WorkflowRecord = {
  id: string;
  name: string;
  description: string | null;
  ownerType: WorkflowOwnerType;
  ownerId: string;
  status: WorkflowStatus;
  activeVersionId: string;
  createdAt: string;
  updatedAt: string;
};

export type WorkflowVersionRecord = {
  id: string;
  workflowId: string;
  versionNumber: number;
  status: WorkflowVersionStatus;
  graph: WorkflowGraph;
  createdAt: string;
  updatedAt: string;
  publishedAt: string | null;
};

export type WorkflowStoreState = {
  workflows: WorkflowRecord[];
  versions: WorkflowVersionRecord[];
  runs: WorkflowRunRecord[];
  nodeRuns: WorkflowNodeRunRecord[];
  reviewItems: WorkflowReviewItemRecord[];
};

export type WorkflowDetail = {
  workflow: WorkflowRecord;
  versions: WorkflowVersionRecord[];
};

export type WorkflowCreateInput = {
  name: string;
  description?: string | null;
  ownerType: WorkflowOwnerType;
  ownerId: string;
};

export type WorkflowRunRecord = {
  id: string;
  workflowId: string;
  workflowVersionId: string;
  workflowVersionNumber: number;
  trigger: WorkflowTriggerType;
  triggerStartNodeIds: string[];
  status: WorkflowRunStatus;
  initiatedBy: string;
  startedAt: string;
  completedAt: string | null;
  summary: string | null;
  errorMessage: string | null;
};

export type WorkflowNodeRunRecord = {
  id: string;
  runId: string;
  workflowId: string;
  workflowVersionId: string;
  nodeId: string;
  status: WorkflowNodeRunStatus;
  attemptCount: number;
  inputSnapshot: Record<string, unknown> | null;
  outputSnapshot: Record<string, unknown> | null;
  startedAt: string;
  completedAt: string | null;
  errorMessage: string | null;
};

export type WorkflowReviewItemRecord = {
  id: string;
  workflowId: string;
  workflowVersionId: string;
  runId: string;
  nodeRunId: string | null;
  sourceNodeId: string;
  sourceNodeType: WorkflowNodeType;
  surface: WorkflowReviewSurface;
  status: WorkflowReviewStatus;
  summary: string;
  threadPreview: string | null;
  createdAt: string;
  updatedAt: string;
};

export type WorkflowReviewItemDetail = WorkflowReviewItemRecord & {
  workflowName: string;
  workflowStatus: WorkflowStatus;
  runStatus: WorkflowRunStatus | null;
  runStartedAt: string | null;
  sourceNodeName: string;
};
