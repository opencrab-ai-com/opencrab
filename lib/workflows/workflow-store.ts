import { createSyncJsonFileStore } from "@/lib/infrastructure/json-store/sync-json-file-store";
import { OPENCRAB_WORKFLOWS_STORE_PATH } from "@/lib/resources/runtime-paths";
import { OpenCrabError } from "@/lib/shared/errors/opencrab-error";
import type {
  WorkflowCreateInput,
  WorkflowDeliveryDestination,
  WorkflowDetail,
  WorkflowGraph,
  WorkflowNodeRunStatus,
  WorkflowNodeRunRecord,
  WorkflowNodeRecord,
  WorkflowRecord,
  WorkflowReviewItemDetail,
  WorkflowReviewItemRecord,
  WorkflowReviewStatus,
  WorkflowReviewSurface,
  WorkflowReviewView,
  WorkflowRunRecord,
  WorkflowRunStatus,
  WorkflowSchedule,
  WorkflowStatus,
  WorkflowStoreState,
  WorkflowVersionRecord,
} from "@/lib/workflows/types";
import { markStaleDescendants, validateWorkflowForPublish } from "@/lib/workflows/workflow-graph";

const STORE_PATH = OPENCRAB_WORKFLOWS_STORE_PATH;
const MAX_RUNS = 120;
const MAX_NODE_RUNS = 600;
const store = createSyncJsonFileStore<WorkflowStoreState>({
  filePath: STORE_PATH,
  seed: createSeedState,
  normalize: normalizeState,
});

export function listWorkflows(): WorkflowRecord[] {
  return readState()
    .workflows
    .slice()
    .sort((left, right) => Date.parse(right.updatedAt) - Date.parse(left.updatedAt))
    .map((workflow) => structuredClone(workflow));
}

export function getWorkflow(workflowId: string): WorkflowDetail | null {
  const state = readState();
  const workflow = state.workflows.find((item) => item.id === workflowId) ?? null;

  if (!workflow) {
    return null;
  }

  const versions = state.versions
    .filter((item) => item.workflowId === workflowId)
    .sort((left, right) => right.versionNumber - left.versionNumber)
    .map((version) => structuredClone(version));

  return {
    workflow: structuredClone(workflow),
    versions,
  };
}

export function createWorkflow(input: WorkflowCreateInput): WorkflowDetail {
  const now = new Date().toISOString();
  const workflowId = `workflow-${crypto.randomUUID()}`;
  const draftVersionId = `workflow-version-${crypto.randomUUID()}`;
  const initialGraph = normalizeGraph(
    (input as WorkflowCreateInput & { graph?: WorkflowGraph | null }).graph ?? undefined,
  );
  const workflow: WorkflowRecord = {
    id: workflowId,
    name: input.name.trim(),
    description: input.description?.trim() || null,
    ownerType: input.ownerType,
    ownerId: input.ownerId.trim(),
    status: "draft",
    activeVersionId: draftVersionId,
    createdAt: now,
    updatedAt: now,
  };
  const version: WorkflowVersionRecord = {
    id: draftVersionId,
    workflowId,
    versionNumber: 1,
    status: "draft",
    graph: initialGraph,
    createdAt: now,
    updatedAt: now,
    publishedAt: null,
  };

  mutateState((state) => {
    state.workflows = [workflow, ...state.workflows];
    state.versions = [version, ...state.versions];
  });

  const created = getWorkflow(workflowId);

  if (!created) {
    throw new Error(`Failed to load created workflow detail for ${workflowId}.`);
  }

  return created;
}

export function publishWorkflow(
  workflowId: string,
  input: { graph?: WorkflowGraph | null } = {},
): WorkflowDetail | null {
  const result = mutateState((state) => {
    const workflow = state.workflows.find((item) => item.id === workflowId);

    if (!workflow) {
      return null;
    }

    const activeDraft =
      state.versions.find(
        (version) =>
          version.id === workflow.activeVersionId &&
          version.workflowId === workflowId &&
          version.status === "draft",
      ) ??
      state.versions
        .filter((version) => version.workflowId === workflowId && version.status === "draft")
        .sort((left, right) => right.versionNumber - left.versionNumber)[0];

    if (!activeDraft) {
      return null;
    }

    const now = new Date().toISOString();
    const graphToPublish = input.graph ? normalizeGraph(input.graph) : structuredClone(activeDraft.graph);

    if (input.graph) {
      const validation = validateWorkflowForPublish(graphToPublish);

      if (!validation.isValid) {
        throw new OpenCrabError("工作流图校验失败，无法发布。", {
          statusCode: 400,
          code: "bad_request",
          details: {
            errors: validation.errors,
          },
        });
      }
    }

    const publishedVersion: WorkflowVersionRecord = {
      ...activeDraft,
      status: "published",
      graph: structuredClone(graphToPublish),
      updatedAt: now,
      publishedAt: now,
    };
    const nextVersionNumber =
      state.versions
        .filter((version) => version.workflowId === workflowId)
        .reduce((max, version) => Math.max(max, version.versionNumber), 0) + 1;
    const nextDraftId = `workflow-version-${crypto.randomUUID()}`;
    const nextDraft: WorkflowVersionRecord = {
      id: nextDraftId,
      workflowId,
      versionNumber: nextVersionNumber,
      status: "draft",
      graph: structuredClone(graphToPublish),
      createdAt: now,
      updatedAt: now,
      publishedAt: null,
    };

    state.versions = [
      nextDraft,
      publishedVersion,
      ...state.versions.filter((version) => version.id !== activeDraft.id),
    ];
    state.workflows = state.workflows.map((item) =>
      item.id === workflowId
        ? {
            ...item,
            status: "active",
            activeVersionId: nextDraftId,
            updatedAt: now,
          }
        : item,
    );

    return workflowId;
  });

  if (!result) {
    return null;
  }

  return getWorkflow(result);
}

export function listWorkflowRuns(workflowId: string): WorkflowRunRecord[] {
  return readState()
    .runs
    .filter((run) => run.workflowId === workflowId)
    .sort((left, right) => Date.parse(right.startedAt) - Date.parse(left.startedAt))
    .map((run) => structuredClone(run));
}

export function listWorkflowNodeRuns(runId: string): WorkflowNodeRunRecord[] {
  return readState()
    .nodeRuns
    .filter((run) => run.runId === runId)
    .sort((left, right) => Date.parse(left.startedAt) - Date.parse(right.startedAt))
    .map((run) => structuredClone(run));
}

export function listWorkflowReviewItems(input: { view: WorkflowReviewView }): WorkflowReviewItemDetail[] {
  return resolveWorkflowReviewItems(readState())
    .filter((item) => {
      if (item.status !== "open") {
        return false;
      }

      if (input.view === "pending_publish") {
        return item.surface === "pending_publish";
      }

      return true;
    })
    .map((item) => structuredClone(item));
}

export function getWorkflowReviewItem(reviewItemId: string): WorkflowReviewItemDetail | null {
  const item = resolveWorkflowReviewItems(readState()).find((candidate) => candidate.id === reviewItemId) ?? null;
  return item ? structuredClone(item) : null;
}

export function createReviewItemForFailedNode(input: {
  workflowId: string;
  runId: string;
  nodeId: string;
  reason: string;
  surface: WorkflowReviewSurface;
}) {
  const state = readState();
  const run = state.runs.find((candidate) => candidate.id === input.runId) ?? null;
  const workflow =
    state.workflows.find((candidate) => candidate.id === input.workflowId) ?? null;
  const workflowVersionId =
    run?.workflowVersionId ??
    workflow?.activeVersionId ??
    "workflow-version-unknown";
  const version =
    state.versions.find((candidate) => candidate.id === workflowVersionId) ?? null;
  const nodeRun =
    state.nodeRuns
      .filter((candidate) => candidate.runId === input.runId && candidate.nodeId === input.nodeId)
      .sort((left, right) => Date.parse(right.startedAt) - Date.parse(left.startedAt))[0] ?? null;
  const node = version?.graph.nodes.find((candidate) => candidate.id === input.nodeId) ?? null;

  return createWorkflowReviewItem({
    workflowId: input.workflowId,
    workflowVersionId,
    runId: input.runId,
    nodeRunId: nodeRun?.id ?? null,
    sourceNodeId: input.nodeId,
    sourceNodeType: node?.type ?? "script",
    surface: input.surface,
    summary: input.reason,
    threadPreview: input.reason,
  });
}

export function createWorkflowReviewItem(input: {
  workflowId: string;
  workflowVersionId: string;
  runId: string;
  nodeRunId: string | null;
  sourceNodeId: string;
  sourceNodeType: WorkflowNodeRecord["type"];
  surface: WorkflowReviewSurface;
  summary: string;
  threadPreview?: string | null;
}) {
  const now = new Date().toISOString();
  const nextItem: WorkflowReviewItemRecord = {
    id: buildWorkflowReviewItemId(input.runId, input.sourceNodeId, input.surface),
    workflowId: input.workflowId,
    workflowVersionId: input.workflowVersionId,
    runId: input.runId,
    nodeRunId: input.nodeRunId,
    sourceNodeId: input.sourceNodeId,
    sourceNodeType: input.sourceNodeType,
    surface: input.surface,
    status: "open",
    summary: input.summary.trim() || "需要人工复核。",
    threadPreview: normalizeNullableString(input.threadPreview) ?? input.summary.trim() ?? "需要人工复核。",
    createdAt: now,
    updatedAt: now,
  };

  mutateState((state) => {
    const current = state.reviewItems.find((item) => item.id === nextItem.id) ?? null;
    const mergedItem: WorkflowReviewItemRecord = current
      ? {
          ...current,
          ...nextItem,
          createdAt: current.createdAt,
          updatedAt: now,
        }
      : nextItem;

    state.reviewItems = [mergedItem, ...state.reviewItems.filter((item) => item.id !== mergedItem.id)];
  });

  const created = getWorkflowReviewItem(nextItem.id);

  if (!created) {
    throw new Error(`Failed to load created workflow review item ${nextItem.id}.`);
  }

  return created;
}

export function resolveWorkflowReviewItem(reviewItemId: string) {
  const resolved = mutateState((state) => {
    const current = resolveWorkflowReviewItems(state).find((item) => item.id === reviewItemId) ?? null;

    if (!current) {
      return null;
    }

    const now = new Date().toISOString();
    const nextItem: WorkflowReviewItemRecord = {
      id: current.id,
      workflowId: current.workflowId,
      workflowVersionId: current.workflowVersionId,
      runId: current.runId,
      nodeRunId: current.nodeRunId,
      sourceNodeId: current.sourceNodeId,
      sourceNodeType: current.sourceNodeType,
      surface: current.surface,
      status: "resolved",
      summary: current.summary,
      threadPreview: current.threadPreview,
      createdAt: current.createdAt,
      updatedAt: now,
    };

    state.reviewItems = [nextItem, ...state.reviewItems.filter((item) => item.id !== nextItem.id)];
    return nextItem.id;
  });

  if (!resolved) {
    return null;
  }

  return getWorkflowReviewItem(resolved);
}

export function reviewWorkflowItem(
  reviewItemId: string,
  input:
    | {
        action: "retry_current_node";
        inputPatch?: Record<string, unknown>;
      }
    | {
        action: "save_to_draft";
        definitionPatch: Record<string, unknown>;
      },
) {
  const item = getWorkflowReviewItem(reviewItemId);

  if (!item) {
    return null;
  }

  const state = readState();
  const run = state.runs.find((candidate) => candidate.id === item.runId) ?? null;
  const version =
    state.versions.find((candidate) => candidate.id === item.workflowVersionId) ??
    state.versions.find((candidate) => candidate.workflowId === item.workflowId && candidate.status === "published") ??
    null;

  if (!run || !version) {
    return null;
  }

  if (input.action === "retry_current_node") {
    const staleNodeIds = markStaleDescendants(version.graph, [item.sourceNodeId]);

    mutateState((mutableState) => {
      mutableState.nodeRuns = mutableState.nodeRuns.map((nodeRun) => {
        if (nodeRun.runId !== item.runId) {
          return nodeRun;
        }

        if (nodeRun.nodeId === item.sourceNodeId) {
          return {
            ...nodeRun,
            status: "pending",
            inputSnapshot: {
              ...(nodeRun.inputSnapshot ?? {}),
              ...(input.inputPatch ?? {}),
            },
            outputSnapshot: null,
            completedAt: null,
            errorMessage: null,
          };
        }

        if (staleNodeIds.includes(nodeRun.nodeId)) {
          return {
            ...nodeRun,
            status: "stale",
          };
        }

        return nodeRun;
      });
    });
    resolveWorkflowReviewItem(reviewItemId);

    return {
      reviewItemId,
      runId: item.runId,
      nodeId: item.sourceNodeId,
      staleNodeRunIds: staleNodeIds,
    };
  }

  const nextVersionNumber =
    state.versions
      .filter((candidate) => candidate.workflowId === item.workflowId)
      .reduce((max, candidate) => Math.max(max, candidate.versionNumber), 0) + 1;
  const nextVersionId = `workflow-version-${crypto.randomUUID()}`;
  const now = new Date().toISOString();
  const nextDraft: WorkflowVersionRecord = {
    ...structuredClone(version),
    id: nextVersionId,
      workflowId: item.workflowId,
      versionNumber: nextVersionNumber,
      status: "draft",
      graph: normalizeGraph({
        ...structuredClone(version.graph),
        nodes: version.graph.nodes.map((node) =>
          node.id === item.sourceNodeId
            ? mergeNodeDefinitionPatch(node, input.definitionPatch)
            : structuredClone(node),
        ),
      }),
    createdAt: now,
    updatedAt: now,
    publishedAt: null,
  };

  mutateState((mutableState) => {
    mutableState.versions = [nextDraft, ...mutableState.versions];
    mutableState.workflows = mutableState.workflows.map((workflow) =>
      workflow.id === item.workflowId
        ? {
            ...workflow,
            activeVersionId: nextVersionId,
            updatedAt: now,
          }
        : workflow,
    );
  });
  resolveWorkflowReviewItem(reviewItemId);

  return getWorkflow(item.workflowId);
}

export function markDownstreamNodeRunsStale(input: {
  runId: string;
  retriedNodeId: string;
  graph: WorkflowGraph;
}) {
  const staleNodeIds = new Set(markStaleDescendants(input.graph, [input.retriedNodeId]));
  mutateState((state) => {
    state.nodeRuns = state.nodeRuns.map((nodeRun) => {
      if (nodeRun.runId !== input.runId || !staleNodeIds.has(nodeRun.nodeId)) {
        return nodeRun;
      }

      return {
        ...nodeRun,
        status: "stale",
        completedAt: nodeRun.completedAt ?? new Date().toISOString(),
      };
    });
  });

  return Array.from(staleNodeIds).sort((left, right) => left.localeCompare(right));
}

export function updateWorkflowDraftNode(input: {
  workflowId: string;
  sourceNodeId: string;
  definitionPatch: Record<string, unknown>;
}) {
  const result = mutateState((state) => {
    const workflow = state.workflows.find((item) => item.id === input.workflowId) ?? null;

    if (!workflow) {
      return null;
    }

    const activeDraft =
      state.versions.find(
        (version) =>
          version.workflowId === input.workflowId &&
          version.id === workflow.activeVersionId &&
          version.status === "draft",
      ) ??
      state.versions
        .filter((version) => version.workflowId === input.workflowId && version.status === "draft")
        .sort((left, right) => right.versionNumber - left.versionNumber)[0] ??
      null;

    if (!activeDraft) {
      return null;
    }

    const now = new Date().toISOString();
    const nextGraph: WorkflowGraph = {
      ...structuredClone(activeDraft.graph),
      nodes: activeDraft.graph.nodes.map((node) =>
        node.id === input.sourceNodeId
          ? mergeNodeDefinitionPatch(node, input.definitionPatch)
          : structuredClone(node),
      ),
    };

    state.versions = state.versions.map((version) =>
      version.id === activeDraft.id
        ? {
            ...version,
            graph: normalizeGraph(nextGraph),
            updatedAt: now,
          }
        : version,
    );
    state.workflows = state.workflows.map((item) =>
      item.id === input.workflowId
        ? {
            ...item,
            updatedAt: now,
          }
        : item,
    );

    return activeDraft.id;
  });

  if (!result) {
    return null;
  }

  return getWorkflow(input.workflowId);
}

export function saveWorkflowDraft(input: {
  workflowId: string;
  versionId: string;
  graph: WorkflowGraph;
}) {
  const result = mutateState((state) => {
    const workflow = state.workflows.find((item) => item.id === input.workflowId) ?? null;

    if (!workflow) {
      return null;
    }

    const activeDraft =
      state.versions.find(
        (version) =>
          version.workflowId === input.workflowId &&
          version.id === input.versionId &&
          version.status === "draft",
      ) ?? null;

    if (!activeDraft) {
      throw new OpenCrabError("当前草稿版本已经变化，请刷新后重试。", {
        statusCode: 409,
        code: "conflict",
      });
    }

    const now = new Date().toISOString();
    const nextGraph = normalizeGraph(input.graph);

    state.versions = state.versions.map((version) =>
      version.id === activeDraft.id
        ? {
            ...version,
            graph: nextGraph,
            updatedAt: now,
          }
        : version,
    );
    state.workflows = state.workflows.map((item) =>
      item.id === input.workflowId
        ? {
            ...item,
            updatedAt: now,
          }
        : item,
    );

    return activeDraft.id;
  });

  if (!result) {
    return null;
  }

  return getWorkflow(input.workflowId);
}

export function recordWorkflowRun(input: {
  workflowId: string;
  workflowVersionId: string;
  workflowVersionNumber: number;
  trigger: WorkflowRunRecord["trigger"];
  triggerStartNodeIds: string[];
  initiatedBy: string;
  startedAt: string;
}) {
  return mutateState((state) => {
    const runRecord: WorkflowRunRecord = {
      id: `workflow-run-${crypto.randomUUID()}`,
      workflowId: input.workflowId,
      workflowVersionId: input.workflowVersionId,
      workflowVersionNumber: input.workflowVersionNumber,
      trigger: input.trigger,
      triggerStartNodeIds: input.triggerStartNodeIds.slice().sort((left, right) => left.localeCompare(right)),
      status: "running",
      initiatedBy: input.initiatedBy,
      startedAt: input.startedAt,
      completedAt: null,
      summary: null,
      errorMessage: null,
    };

    state.runs = trimRuns([runRecord, ...state.runs]);

    return structuredClone(runRecord);
  });
}

export function updateWorkflowRun(
  runId: string,
  patch: Partial<WorkflowRunRecord> & { status?: WorkflowRunStatus },
) {
  return mutateState((state) => {
    const current = state.runs.find((run) => run.id === runId);

    if (!current) {
      return null;
    }

    const nextRun: WorkflowRunRecord = {
      ...current,
      ...patch,
      triggerStartNodeIds:
        patch.triggerStartNodeIds === undefined
          ? current.triggerStartNodeIds
          : patch.triggerStartNodeIds.slice().sort((left, right) => left.localeCompare(right)),
    };

    state.runs = state.runs.map((run) => (run.id === runId ? nextRun : run));
    return structuredClone(nextRun);
  });
}

export function recordWorkflowNodeRun(input: {
  runId: string;
  workflowId: string;
  workflowVersionId: string;
  nodeId: string;
  status: WorkflowNodeRunRecord["status"];
  attemptCount: number;
  inputSnapshot?: Record<string, unknown> | null;
  outputSnapshot?: Record<string, unknown> | null;
  startedAt: string;
  completedAt?: string | null;
  errorMessage?: string | null;
}) {
  return mutateState((state) => {
    const runRecord: WorkflowNodeRunRecord = {
      id: `workflow-node-run-${crypto.randomUUID()}`,
      runId: input.runId,
      workflowId: input.workflowId,
      workflowVersionId: input.workflowVersionId,
      nodeId: input.nodeId,
      status: input.status,
      attemptCount: Math.max(1, Math.floor(input.attemptCount || 1)),
      inputSnapshot: normalizeSnapshot(input.inputSnapshot),
      outputSnapshot: normalizeSnapshot(input.outputSnapshot),
      startedAt: input.startedAt,
      completedAt: input.completedAt ?? null,
      errorMessage: input.errorMessage ?? null,
    };

    state.nodeRuns = trimNodeRuns([runRecord, ...state.nodeRuns]);

    return structuredClone(runRecord);
  });
}

function createBlankWorkflowGraph(): WorkflowGraph {
  const startNode: WorkflowNodeRecord = {
    id: `node-start-${crypto.randomUUID()}`,
    type: "start",
    name: "Start",
    config: {
      trigger: "manual",
    },
    uiPosition: {
      x: 120,
      y: 240,
    },
  };
  const endNode: WorkflowNodeRecord = {
    id: `node-end-${crypto.randomUUID()}`,
    type: "end",
    name: "End",
    config: {
      deliveryTarget: "none",
    },
    uiPosition: {
      x: 480,
      y: 240,
    },
  };

  return {
    nodes: [startNode, endNode],
    edges: [],
    layout: {
      viewport: {
        x: 0,
        y: 0,
        zoom: 1,
      },
    },
    defaults: {
      timezone: null,
    },
  };
}

function readState(): WorkflowStoreState {
  return store.read();
}

function mutateState<T>(mutator: (state: WorkflowStoreState) => T) {
  return store.mutate(mutator);
}

function createSeedState(): WorkflowStoreState {
  return {
    workflows: [],
    versions: [],
    runs: [],
    nodeRuns: [],
    reviewItems: [],
  };
}

function normalizeState(state: Partial<WorkflowStoreState>): WorkflowStoreState {
  const workflows = structuredClone(state.workflows || []).map((workflow) => {
    const now = new Date().toISOString();

    return {
      ...workflow,
      name: typeof workflow.name === "string" && workflow.name.trim() ? workflow.name : "Untitled workflow",
      description: workflow.description || null,
      ownerType: workflow.ownerType === "team" ? "team" : "person",
      ownerId: workflow.ownerId || "person-unknown",
      status: normalizeWorkflowStatus(workflow.status),
      activeVersionId: workflow.activeVersionId || "",
      createdAt: workflow.createdAt || now,
      updatedAt: workflow.updatedAt || now,
    } satisfies WorkflowRecord;
  });
  const versions = structuredClone(state.versions || []).map((version) => {
    const now = new Date().toISOString();
    const status = version.status === "published" ? "published" : "draft";

    return {
      ...version,
      workflowId: version.workflowId || "",
      versionNumber:
        typeof version.versionNumber === "number" && Number.isFinite(version.versionNumber)
          ? Math.max(1, Math.floor(version.versionNumber))
          : 1,
      status,
      graph: normalizeGraph(version.graph),
      createdAt: version.createdAt || now,
      updatedAt: version.updatedAt || now,
      publishedAt: status === "published" ? version.publishedAt || version.updatedAt || now : null,
    } satisfies WorkflowVersionRecord;
  });
  const validVersions = versions.filter((version) => Boolean(version.id && version.workflowId));
  const versionIdsByWorkflow = new Map<string, Set<string>>();

  validVersions.forEach((version) => {
    const idSet = versionIdsByWorkflow.get(version.workflowId) ?? new Set<string>();
    idSet.add(version.id);
    versionIdsByWorkflow.set(version.workflowId, idSet);
  });

  return {
    workflows: workflows
      .filter((workflow) => Boolean(workflow.id))
      .map((workflow) => ({
        ...workflow,
        activeVersionId:
          workflow.activeVersionId &&
          (versionIdsByWorkflow.get(workflow.id)?.has(workflow.activeVersionId) ?? false)
            ? workflow.activeVersionId
            : resolveFallbackActiveVersionId(workflow.id, validVersions),
      })),
    versions: validVersions,
    runs: structuredClone(state.runs || [])
      .map((run) => normalizeWorkflowRun(run))
      .filter((run): run is WorkflowRunRecord => run !== null),
    nodeRuns: structuredClone(state.nodeRuns || [])
      .map((run) => normalizeWorkflowNodeRun(run))
      .filter((run): run is WorkflowNodeRunRecord => run !== null),
    reviewItems: structuredClone(state.reviewItems || [])
      .map((item) => normalizeWorkflowReviewItem(item))
      .filter((item): item is WorkflowReviewItemRecord => item !== null),
  };
}

function resolveFallbackActiveVersionId(
  workflowId: string,
  versions: WorkflowVersionRecord[],
) {
  const candidates = versions
    .filter((version) => version.workflowId === workflowId)
    .sort((left, right) => right.versionNumber - left.versionNumber);
  const draft = candidates.find((version) => version.status === "draft");

  if (draft) {
    return draft.id;
  }

  return candidates[0]?.id || "";
}

function normalizeWorkflowStatus(status: WorkflowRecord["status"] | undefined): WorkflowStatus {
  if (status === "active" || status === "paused" || status === "archived") {
    return status;
  }

  return "draft";
}

function normalizeGraph(graph: WorkflowVersionRecord["graph"] | undefined): WorkflowGraph {
  const blank = createBlankWorkflowGraph();
  const rawNodes = Array.isArray(graph?.nodes) ? graph.nodes : [];
  const nodeIds = new Set<string>();
  const nodes: WorkflowNodeRecord[] = [];

  rawNodes.forEach((node, index) => {
    const normalized = normalizeNode(node, index);

    if (!normalized) {
      return;
    }

    nodes.push(normalized);
    nodeIds.add(normalized.id);
  });

  const normalizedNodes = nodes.length ? nodes : structuredClone(blank.nodes);
  const normalizedNodeIds = nodes.length ? nodeIds : new Set(normalizedNodes.map((node) => node.id));
  const rawEdges = Array.isArray(graph?.edges) ? graph.edges : [];
  const seenEdgeIds = new Set<string>();
  const edges = rawEdges
    .map((edge) => normalizeEdge(edge, normalizedNodeIds))
    .filter((edge): edge is WorkflowGraph["edges"][number] => {
      if (!edge) {
        return false;
      }

      if (seenEdgeIds.has(edge.id)) {
        return false;
      }

      seenEdgeIds.add(edge.id);
      return true;
    });
  const viewport = graph?.layout?.viewport;

  return {
    nodes: normalizedNodes,
    edges,
    layout: {
      viewport: {
        x: typeof viewport?.x === "number" && Number.isFinite(viewport.x) ? viewport.x : 0,
        y: typeof viewport?.y === "number" && Number.isFinite(viewport.y) ? viewport.y : 0,
        zoom: typeof viewport?.zoom === "number" && Number.isFinite(viewport.zoom) ? viewport.zoom : 1,
      },
    },
    defaults: {
      timezone: typeof graph?.defaults?.timezone === "string" ? graph.defaults.timezone : null,
    },
  };
}

function normalizeNode(rawNode: unknown, index: number): WorkflowNodeRecord | null {
  if (!rawNode || typeof rawNode !== "object") {
    return null;
  }

  const node = rawNode as Record<string, unknown>;
  const type = node.type;
  const uiPosition = normalizeUiPosition(node.uiPosition);
  const id = normalizeNodeId(node.id, typeof type === "string" ? type : "node", index);

  if (type === "start") {
    const config = node.config && typeof node.config === "object" ? node.config as Record<string, unknown> : null;
    const trigger =
      config &&
      config.trigger === "schedule"
        ? "schedule"
        : "manual";

    return {
      id,
      type: "start",
      name: normalizeName(node.name, "Start"),
      config: {
        trigger,
        schedule: trigger === "schedule" ? normalizeSchedule(config?.schedule) : null,
      },
      uiPosition,
    };
  }

  if (type === "script") {
    const config = node.config && typeof node.config === "object" ? node.config as Record<string, unknown> : null;
    const scriptId = normalizeNullableString(
      config?.scriptId,
    );
    const source = normalizeNullableString(config?.source);

    return {
      id,
      type: "script",
      name: normalizeName(node.name, "Script"),
      config: { scriptId, source },
      uiPosition,
    };
  }

  if (type === "agent") {
    const config = node.config && typeof node.config === "object" ? node.config as Record<string, unknown> : null;

    return {
      id,
      type: "agent",
      name: normalizeName(node.name, "Agent"),
      config: {
        agentId: normalizeNullableString(config?.agentId),
        prompt: normalizeNullableString(config?.prompt),
      },
      uiPosition,
    };
  }

  if (type === "end") {
    const config = node.config && typeof node.config === "object" ? node.config as Record<string, unknown> : null;
    const deliveryTarget = normalizeDeliveryTarget(
      config?.deliveryTarget,
    );

    return {
      id,
      type: "end",
      name: normalizeName(node.name, "End"),
      config: {
        deliveryTarget,
        primaryDestination: normalizePrimaryDeliveryDestination(config, deliveryTarget),
        mirroredDestinations: normalizeMirroredDeliveryDestinations(config?.mirroredDestinations),
      },
      uiPosition,
    };
  }

  return null;
}

function mergeNodeDefinitionPatch(
  node: WorkflowNodeRecord,
  definitionPatch: Record<string, unknown>,
): WorkflowNodeRecord {
  switch (node.type) {
    case "start":
      return {
        ...structuredClone(node),
        config: {
          ...structuredClone(node.config),
          ...structuredClone(definitionPatch),
        },
      };
    case "script":
      return {
        ...structuredClone(node),
        config: {
          ...structuredClone(node.config),
          ...structuredClone(definitionPatch),
        },
      };
    case "agent":
      return {
        ...structuredClone(node),
        config: {
          ...structuredClone(node.config),
          ...structuredClone(definitionPatch),
        },
      };
    case "end":
      return {
        ...structuredClone(node),
        config: {
          ...structuredClone(node.config),
          ...structuredClone(definitionPatch),
        },
      };
    default:
      return structuredClone(node);
  }
}

function normalizeEdge(
  rawEdge: unknown,
  validNodeIds: Set<string>,
): WorkflowGraph["edges"][number] | null {
  if (!rawEdge || typeof rawEdge !== "object") {
    return null;
  }

  const edge = rawEdge as Record<string, unknown>;
  const id = normalizeNonEmptyString(edge.id);
  const sourceNodeId = normalizeNonEmptyString(edge.sourceNodeId);
  const targetNodeId = normalizeNonEmptyString(edge.targetNodeId);

  if (!id || !sourceNodeId || !targetNodeId) {
    return null;
  }

  if (!validNodeIds.has(sourceNodeId) || !validNodeIds.has(targetNodeId)) {
    return null;
  }

  return {
    id,
    sourceNodeId,
    targetNodeId,
    condition: normalizeNullableString(edge.condition),
    label: normalizeNullableString(edge.label),
  };
}

function normalizeUiPosition(value: unknown) {
  const position = value && typeof value === "object" ? (value as Record<string, unknown>) : null;

  return {
    x: typeof position?.x === "number" && Number.isFinite(position.x) ? position.x : 0,
    y: typeof position?.y === "number" && Number.isFinite(position.y) ? position.y : 0,
  };
}

function normalizeNodeId(value: unknown, type: string, index: number) {
  const normalized = normalizeNonEmptyString(value);

  if (normalized) {
    return normalized;
  }

  return `node-${type}-${index}-${crypto.randomUUID()}`;
}

function normalizeName(value: unknown, fallback: string) {
  const normalized = normalizeNonEmptyString(value);
  return normalized || fallback;
}

function normalizeDeliveryTarget(value: unknown) {
  if (value === "conversation" || value === "channel" || value === "pending_publish") {
    return value;
  }

  return "none";
}

function normalizePrimaryDeliveryDestination(
  config: Record<string, unknown> | null,
  deliveryTarget: "conversation" | "channel" | "pending_publish" | "none",
): WorkflowDeliveryDestination {
  const normalized = normalizeDeliveryDestinationRecord(config?.primaryDestination);

  if (normalized) {
    return normalized;
  }

  if (deliveryTarget === "conversation") {
    return {
      kind: "conversation",
      conversationId: null,
    };
  }

  if (deliveryTarget === "channel") {
    return {
      kind: "channel",
      channelId: null,
    };
  }

  if (deliveryTarget === "pending_publish") {
    return { kind: "pending_publish" };
  }

  return { kind: "none" };
}

function normalizeMirroredDeliveryDestinations(value: unknown) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((item) => normalizeDeliveryDestinationRecord(item))
    .filter((item): item is WorkflowDeliveryDestination => item !== null);
}

function normalizeDeliveryDestinationRecord(value: unknown): WorkflowDeliveryDestination | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  const destination = value as Record<string, unknown>;

  if (destination.kind === "review_center") {
    return { kind: "review_center" };
  }

  if (destination.kind === "pending_publish") {
    return { kind: "pending_publish" };
  }

  if (destination.kind === "conversation") {
    return {
      kind: "conversation",
      conversationId: normalizeNullableString(destination.conversationId),
    };
  }

  if (destination.kind === "channel") {
    return {
      kind: "channel",
      channelId: normalizeNullableString(destination.channelId),
    };
  }

  if (destination.kind === "none") {
    return { kind: "none" };
  }

  return null;
}

function normalizeSchedule(value: unknown): WorkflowSchedule | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  const schedule = value as Record<string, unknown>;

  if (schedule.preset === "interval") {
    const intervalMinutes = getIntervalMinutes(schedule);

    return {
      preset: "interval",
      intervalMinutes: Math.max(1, Math.min(1440, Math.round(intervalMinutes || 5))),
    };
  }

  if (schedule.preset !== "daily" && schedule.preset !== "weekdays" && schedule.preset !== "weekly") {
    return null;
  }

  if (schedule.preset === "weekly") {
    return {
      preset: "weekly",
      time: normalizeTime(schedule.time),
      weekday: clampWeekday(schedule.weekday),
    };
  }

  return {
    preset: schedule.preset,
    time: normalizeTime(schedule.time),
  };
}

function normalizeWorkflowRun(value: unknown): WorkflowRunRecord | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  const run = value as Record<string, unknown>;
  const id = normalizeNonEmptyString(run.id);
  const workflowId = normalizeNonEmptyString(run.workflowId);
  const workflowVersionId = normalizeNonEmptyString(run.workflowVersionId);

  if (!id || !workflowId || !workflowVersionId) {
    return null;
  }

  const now = new Date().toISOString();

  return {
    id,
    workflowId,
    workflowVersionId,
    workflowVersionNumber:
      typeof run.workflowVersionNumber === "number" && Number.isFinite(run.workflowVersionNumber)
        ? Math.max(1, Math.floor(run.workflowVersionNumber))
        : 1,
    trigger: run.trigger === "schedule" ? "schedule" : "manual",
    triggerStartNodeIds: normalizeStringList(run.triggerStartNodeIds),
    status: normalizeWorkflowRunStatus(run.status),
    initiatedBy: normalizeNonEmptyString(run.initiatedBy) || "system",
    startedAt: normalizeNonEmptyString(run.startedAt) || now,
    completedAt: normalizeNullableString(run.completedAt),
    summary: normalizeNullableString(run.summary),
    errorMessage: normalizeNullableString(run.errorMessage),
  };
}

function normalizeWorkflowNodeRun(value: unknown): WorkflowNodeRunRecord | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  const run = value as Record<string, unknown>;
  const id = normalizeNonEmptyString(run.id);
  const runId = normalizeNonEmptyString(run.runId);
  const workflowId = normalizeNonEmptyString(run.workflowId);
  const workflowVersionId = normalizeNonEmptyString(run.workflowVersionId);
  const nodeId = normalizeNonEmptyString(run.nodeId);

  if (!id || !runId || !workflowId || !workflowVersionId || !nodeId) {
    return null;
  }

  const now = new Date().toISOString();

  return {
    id,
    runId,
    workflowId,
    workflowVersionId,
    nodeId,
    status: normalizeWorkflowNodeRunStatus(run.status),
    attemptCount:
      typeof run.attemptCount === "number" && Number.isFinite(run.attemptCount)
        ? Math.max(1, Math.floor(run.attemptCount))
        : 1,
    inputSnapshot: normalizeSnapshot(run.inputSnapshot),
    outputSnapshot: normalizeSnapshot(run.outputSnapshot),
    startedAt: normalizeNonEmptyString(run.startedAt) || now,
    completedAt: normalizeNullableString(run.completedAt),
    errorMessage: normalizeNullableString(run.errorMessage),
  };
}

function normalizeWorkflowReviewItem(value: unknown): WorkflowReviewItemRecord | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  const item = value as Record<string, unknown>;
  const id = normalizeNonEmptyString(item.id);
  const workflowId = normalizeNonEmptyString(item.workflowId);
  const workflowVersionId = normalizeNonEmptyString(item.workflowVersionId);
  const runId = normalizeNonEmptyString(item.runId);
  const sourceNodeId = normalizeNonEmptyString(item.sourceNodeId);

  if (!id || !workflowId || !workflowVersionId || !runId || !sourceNodeId) {
    return null;
  }

  const now = new Date().toISOString();
  const sourceNodeType =
    item.sourceNodeType === "start" ||
    item.sourceNodeType === "script" ||
    item.sourceNodeType === "agent" ||
    item.sourceNodeType === "end"
      ? item.sourceNodeType
      : "script";

  return {
    id,
    workflowId,
    workflowVersionId,
    runId,
    nodeRunId: normalizeNullableString(item.nodeRunId),
    sourceNodeId,
    sourceNodeType,
    surface: item.surface === "pending_publish" ? "pending_publish" : "general",
    status: normalizeWorkflowReviewStatus(item.status),
    summary: normalizeNonEmptyString(item.summary) || "需要人工复核。",
    threadPreview: normalizeNullableString(item.threadPreview),
    createdAt: normalizeNonEmptyString(item.createdAt) || now,
    updatedAt: normalizeNonEmptyString(item.updatedAt) || now,
  };
}

function normalizeSnapshot(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  return structuredClone(value as Record<string, unknown>);
}

function normalizeWorkflowRunStatus(value: unknown): WorkflowRunStatus {
  if (value === "success" || value === "error" || value === "waiting_for_human") {
    return value;
  }

  return "running";
}

function normalizeWorkflowNodeRunStatus(value: unknown): WorkflowNodeRunStatus {
  if (
    value === "pending" ||
    value === "success" ||
    value === "error" ||
    value === "waiting_for_human" ||
    value === "stale"
  ) {
    return value;
  }

  return "running";
}

function normalizeWorkflowReviewStatus(value: unknown): WorkflowReviewStatus {
  return value === "resolved" ? "resolved" : "open";
}

function resolveWorkflowReviewItems(state: WorkflowStoreState): WorkflowReviewItemDetail[] {
  const explicitItems = state.reviewItems.slice().sort(compareReviewItems);
  const explicitById = new Map(explicitItems.map((item) => [item.id, item]));
  const merged = new Map<string, WorkflowReviewItemRecord>();

  explicitItems.forEach((item) => {
    merged.set(item.id, item);
  });

  buildSyntheticWorkflowReviewItems(state).forEach((item) => {
    const explicit = explicitById.get(item.id);

    if (explicit?.status === "resolved") {
      return;
    }

    merged.set(
      item.id,
      explicit
        ? {
            ...item,
            ...explicit,
            summary: explicit.summary || item.summary,
            threadPreview: explicit.threadPreview ?? item.threadPreview,
          }
        : item,
    );
  });

  return Array.from(merged.values())
    .map((item) => hydrateWorkflowReviewItem(state, item))
    .filter((item): item is WorkflowReviewItemDetail => item !== null)
    .sort(compareReviewItems);
}

function buildSyntheticWorkflowReviewItems(state: WorkflowStoreState): WorkflowReviewItemRecord[] {
  const latestNodeRuns = getLatestWorkflowNodeRuns(state);
  const items: WorkflowReviewItemRecord[] = [];

  latestNodeRuns.forEach((nodeRun) => {
    const version = state.versions.find((candidate) => candidate.id === nodeRun.workflowVersionId) ?? null;
    const workflow = state.workflows.find((candidate) => candidate.id === nodeRun.workflowId) ?? null;

    if (!version || !workflow) {
      return;
    }

    const node = version.graph.nodes.find((candidate) => candidate.id === nodeRun.nodeId) ?? null;

    if (!node) {
      return;
    }

    if (nodeRun.status === "error" || nodeRun.status === "waiting_for_human") {
      items.push({
        id: buildWorkflowReviewItemId(nodeRun.runId, nodeRun.nodeId, "general"),
        workflowId: workflow.id,
        workflowVersionId: version.id,
        runId: nodeRun.runId,
        nodeRunId: nodeRun.id,
        sourceNodeId: nodeRun.nodeId,
        sourceNodeType: node.type,
        surface: "general",
        status: "open",
        summary:
          nodeRun.errorMessage ||
          (nodeRun.status === "waiting_for_human" ? "节点等待人工处理。" : "节点执行失败。"),
        threadPreview: nodeRun.errorMessage || null,
        createdAt: nodeRun.completedAt || nodeRun.startedAt,
        updatedAt: nodeRun.completedAt || nodeRun.startedAt,
      });
      return;
    }

    if (node.type !== "end" || nodeRun.status !== "success") {
      return;
    }

    const destinations = resolveDeliveryDestinations(node);

    if (!destinations.some((destination) => destination.kind === "pending_publish")) {
      return;
    }

    items.push({
      id: buildWorkflowReviewItemId(nodeRun.runId, nodeRun.nodeId, "pending_publish"),
      workflowId: workflow.id,
      workflowVersionId: version.id,
      runId: nodeRun.runId,
      nodeRunId: nodeRun.id,
      sourceNodeId: nodeRun.nodeId,
      sourceNodeType: node.type,
      surface: "pending_publish",
      status: "open",
      summary: "待发布内容已生成",
      threadPreview: "该结果已进入 Pending Publish 队列，等待发布前确认。",
      createdAt: nodeRun.completedAt || nodeRun.startedAt,
      updatedAt: nodeRun.completedAt || nodeRun.startedAt,
    });
  });

  return items;
}

function hydrateWorkflowReviewItem(
  state: WorkflowStoreState,
  item: WorkflowReviewItemRecord,
): WorkflowReviewItemDetail {
  const workflow = state.workflows.find((candidate) => candidate.id === item.workflowId) ?? null;
  const version =
    state.versions.find((candidate) => candidate.id === item.workflowVersionId) ??
    state.versions.find((candidate) => candidate.workflowId === item.workflowId) ??
    null;
  const node = version?.graph.nodes.find((candidate) => candidate.id === item.sourceNodeId) ?? null;
  const run = state.runs.find((candidate) => candidate.id === item.runId) ?? null;

  return {
    ...item,
    workflowName: workflow?.name ?? item.workflowId,
    workflowStatus: workflow?.status ?? "draft",
    runStatus: run?.status ?? null,
    runStartedAt: run?.startedAt ?? null,
    sourceNodeName: node?.name ?? item.sourceNodeId,
  };
}

function buildWorkflowReviewItemId(
  runId: string,
  sourceNodeId: string,
  surface: WorkflowReviewSurface,
) {
  return `workflow-review-${runId}-${sourceNodeId}-${surface}`;
}

function getLatestWorkflowNodeRuns(state: WorkflowStoreState) {
  const byKey = new Map<string, WorkflowNodeRunRecord>();

  state.nodeRuns.forEach((nodeRun) => {
    const key = `${nodeRun.runId}:${nodeRun.nodeId}`;
    const current = byKey.get(key);

    if (!current || compareNodeRunRecency(nodeRun, current) < 0) {
      byKey.set(key, nodeRun);
    }
  });

  return Array.from(byKey.values());
}

function compareNodeRunRecency(left: WorkflowNodeRunRecord, right: WorkflowNodeRunRecord) {
  if (left.attemptCount !== right.attemptCount) {
    return right.attemptCount - left.attemptCount;
  }

  return Date.parse(right.startedAt) - Date.parse(left.startedAt);
}

function compareReviewItems(left: WorkflowReviewItemRecord, right: WorkflowReviewItemRecord) {
  const updatedDelta = Date.parse(right.updatedAt) - Date.parse(left.updatedAt);

  if (updatedDelta !== 0) {
    return updatedDelta;
  }

  return left.id.localeCompare(right.id);
}

function resolveDeliveryDestinations(node: Extract<WorkflowNodeRecord, { type: "end" }>) {
  const primary = node.config.primaryDestination ?? convertLegacyDeliveryTargetToDestination(node.config.deliveryTarget);
  const mirrored = Array.isArray(node.config.mirroredDestinations) ? node.config.mirroredDestinations : [];

  return [primary, ...mirrored];
}

function convertLegacyDeliveryTargetToDestination(
  deliveryTarget: Extract<WorkflowNodeRecord, { type: "end" }>["config"]["deliveryTarget"],
): WorkflowDeliveryDestination {
  if (deliveryTarget === "conversation") {
    return {
      kind: "conversation",
      conversationId: null,
    };
  }

  if (deliveryTarget === "channel") {
    return {
      kind: "channel",
      channelId: null,
    };
  }

  if (deliveryTarget === "pending_publish") {
    return { kind: "pending_publish" };
  }

  return { kind: "none" };
}

function normalizeNonEmptyString(value: unknown) {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();
  return trimmed.length ? trimmed : null;
}

function normalizeNullableString(value: unknown) {
  const normalized = normalizeNonEmptyString(value);
  return normalized ?? null;
}

function normalizeStringList(value: unknown) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((item) => normalizeNonEmptyString(item))
    .filter((item): item is string => Boolean(item))
    .sort((left, right) => left.localeCompare(right));
}

function normalizeTime(value: unknown) {
  const raw = typeof value === "string" ? value.trim() : "";
  const match = raw.match(/^(\d{1,2}):(\d{2})$/);

  if (!match) {
    return "09:00";
  }

  const hour = Math.max(0, Math.min(23, Number(match[1])));
  const minute = Math.max(0, Math.min(59, Number(match[2])));

  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}

function clampWeekday(value: unknown) {
  const weekday = typeof value === "number" && Number.isFinite(value) ? value : 1;
  return Math.max(0, Math.min(6, Math.round(weekday)));
}

function getIntervalMinutes(value: Record<string, unknown>) {
  if (typeof value.intervalMinutes === "number" && Number.isFinite(value.intervalMinutes)) {
    return value.intervalMinutes;
  }

  if (typeof value.intervalHours === "number" && Number.isFinite(value.intervalHours)) {
    return value.intervalHours * 60;
  }

  return null;
}

function trimRuns(runs: WorkflowRunRecord[]) {
  return runs.slice(0, MAX_RUNS);
}

function trimNodeRuns(runs: WorkflowNodeRunRecord[]) {
  return runs.slice(0, MAX_NODE_RUNS);
}
