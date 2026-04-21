# Workflow Engine Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the V1 `Workflow` product surface and runtime in OpenCrab, including workflow persistence, canvas authoring, AI-generated draft entry, graph execution, review-thread-based human intervention, and a content-oriented `Pending Publish` view.

**Architecture:** Add a new local-first workflow domain alongside the existing tasks/projects stack: persisted workflow definitions and versions in `lib/workflows`, app-facing mutations/queries in `lib/modules/workflows`, API routes under `app/api/workflows`, and new workflow UI surfaces under `components/workflows` and `app/(app)/workflows`. Use a graph helper layer for validation and runtime decisions, a scheduler-backed runner for published workflows, and a unified review-item model that powers both `Review Center` and `Pending Publish`.

**Tech Stack:** Next.js App Router, React client components, local JSON persistence, Codex SDK, Vitest, `@xyflow/react`

---

## Planned File Structure

- Create: `/Users/sky/SkyProjects/opencrab/lib/workflows/types.ts` - Workflow, version, node, edge, run, node-run, review-item, delivery, and draft-builder types.
- Create: `/Users/sky/SkyProjects/opencrab/lib/workflows/workflow-store.ts` - Local JSON-backed persistence for workflows, versions, runs, node runs, and review items.
- Create: `/Users/sky/SkyProjects/opencrab/lib/workflows/workflow-graph.ts` - Graph validation, branch resolution, merge readiness, and stale-propagation helpers.
- Create: `/Users/sky/SkyProjects/opencrab/lib/workflows/workflow-draft-builder.ts` - Blank-graph seeding and AI-generated workflow draft generation.
- Create: `/Users/sky/SkyProjects/opencrab/lib/workflows/workflow-view-model.ts` - UI-friendly labels, grouping, and review counters for workflow screens.
- Create: `/Users/sky/SkyProjects/opencrab/lib/workflows/workflow-runner.ts` - Scheduler polling and due-workflow execution queue.
- Create: `/Users/sky/SkyProjects/opencrab/lib/workflows/workflow-executor.ts` - Version-pinned run orchestration plus start/script/agent/end node execution.
- Create: `/Users/sky/SkyProjects/opencrab/lib/modules/workflows/workflow-service.ts` - Query/mutation facade used by API routes.
- Modify: `/Users/sky/SkyProjects/opencrab/lib/resources/runtime-paths.ts` - Add workflow store path constant.
- Modify: `/Users/sky/SkyProjects/opencrab/lib/resources/opencrab-api-types.ts` - Add workflow API payload/response types.
- Modify: `/Users/sky/SkyProjects/opencrab/lib/resources/opencrab-api.ts` - Add workflow client functions.
- Modify: `/Users/sky/SkyProjects/opencrab/lib/runtime/runtime-startup.ts` - Start the workflow runner alongside existing runtime bootstrapping.
- Create: `/Users/sky/SkyProjects/opencrab/app/api/workflows/route.ts` - List/create workflows.
- Create: `/Users/sky/SkyProjects/opencrab/app/api/workflows/[workflowId]/route.ts` - Read/update/delete workflow metadata and draft graph state.
- Create: `/Users/sky/SkyProjects/opencrab/app/api/workflows/[workflowId]/publish/route.ts` - Publish the active draft version.
- Create: `/Users/sky/SkyProjects/opencrab/app/api/workflows/[workflowId]/run/route.ts` - Trigger a manual run.
- Create: `/Users/sky/SkyProjects/opencrab/app/api/workflows/draft/route.ts` - Generate an AI-seeded draft graph from natural language.
- Create: `/Users/sky/SkyProjects/opencrab/app/api/workflows/review-items/route.ts` - List review items with `all` and `pending_publish` modes.
- Create: `/Users/sky/SkyProjects/opencrab/app/api/workflows/review-items/[reviewItemId]/route.ts` - Approve, retry, or persist-review changes.
- Create: `/Users/sky/SkyProjects/opencrab/app/(app)/workflows/page.tsx` - Workflow overview page.
- Create: `/Users/sky/SkyProjects/opencrab/app/(app)/workflows/[workflowId]/page.tsx` - Workflow detail page.
- Create: `/Users/sky/SkyProjects/opencrab/app/(app)/workflows/review/page.tsx` - Unified review center page with a `Pending Publish` switch.
- Create: `/Users/sky/SkyProjects/opencrab/components/workflows/workflows-screen.tsx` - Overview/create-entry screen.
- Create: `/Users/sky/SkyProjects/opencrab/components/workflows/workflow-create-dialog.tsx` - Blank-vs-AI draft creation dialog.
- Create: `/Users/sky/SkyProjects/opencrab/components/workflows/workflow-detail-screen.tsx` - Detail shell with tabs for editor, runs, and review.
- Create: `/Users/sky/SkyProjects/opencrab/components/workflows/workflow-canvas.tsx` - Graph canvas surface built on `@xyflow/react`.
- Create: `/Users/sky/SkyProjects/opencrab/components/workflows/workflow-inspector.tsx` - Hybrid node/edge inspector with structured fields plus AI assist panel.
- Create: `/Users/sky/SkyProjects/opencrab/components/workflows/review-center-screen.tsx` - General review-thread screen.
- Create: `/Users/sky/SkyProjects/opencrab/components/workflows/pending-publish-screen.tsx` - Content-oriented review-item presentation.
- Modify: `/Users/sky/SkyProjects/opencrab/components/app-shell/app-shell.tsx` - Add `Workflow` navigation.
- Modify: `/Users/sky/SkyProjects/opencrab/lib/seed-data.ts` - Add `workflows` nav key.
- Create: `/Users/sky/SkyProjects/opencrab/tests/workflow-store.test.ts` - Workflow persistence and publish tests.
- Create: `/Users/sky/SkyProjects/opencrab/tests/workflow-view-model.test.ts` - Overview/review-count UI helper tests.
- Create: `/Users/sky/SkyProjects/opencrab/tests/workflow-graph.test.ts` - Graph validation, branch, merge, and stale logic tests.
- Create: `/Users/sky/SkyProjects/opencrab/tests/workflow-draft-builder.test.ts` - Blank and AI draft generation tests.
- Create: `/Users/sky/SkyProjects/opencrab/tests/workflow-runner.test.ts` - Schedule, version pinning, and node execution tests.
- Create: `/Users/sky/SkyProjects/opencrab/tests/workflow-review.test.ts` - Review item, retry, stale, and pending-publish tests.

### Task 1: Add workflow persistence tests and implement the local workflow store

**Files:**
- Create: `/Users/sky/SkyProjects/opencrab/tests/workflow-store.test.ts`
- Create: `/Users/sky/SkyProjects/opencrab/lib/workflows/types.ts`
- Create: `/Users/sky/SkyProjects/opencrab/lib/workflows/workflow-store.ts`
- Create: `/Users/sky/SkyProjects/opencrab/lib/modules/workflows/workflow-service.ts`
- Modify: `/Users/sky/SkyProjects/opencrab/lib/resources/runtime-paths.ts`

- [ ] **Step 1: Write a failing workflow-creation test that seeds a blank draft graph**

```ts
import { afterEach, describe, expect, it } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";

describe("workflow-store", () => {
  const tempHomes: string[] = [];

  afterEach(() => {
    delete process.env.OPENCRAB_HOME;
    tempHomes.splice(0).forEach((dir) => rmSync(dir, { recursive: true, force: true }));
  });

  it("creates a person-owned workflow with a blank draft version", async () => {
    const tempHome = mkdtempSync(path.join(os.tmpdir(), "opencrab-workflow-store-"));
    tempHomes.push(tempHome);
    process.env.OPENCRAB_HOME = tempHome;

    const { workflowService } = await import("@/lib/modules/workflows/workflow-service");
    const created = workflowService.create({
      name: "AI 热点跟进",
      description: "每天收集热点并生成待发布内容",
      ownerType: "person",
      ownerId: "me",
      creationMode: "blank",
    });

    expect(created.workflow.status).toBe("draft");
    expect(created.activeDraftVersion.status).toBe("draft");
    expect(created.activeDraftVersion.graph.nodes.map((node) => node.type)).toEqual([
      "start",
      "end",
    ]);
  });
});
```

- [ ] **Step 2: Add a failing publish test that preserves published versions instead of mutating them**

```ts
it("publishes the current draft version and keeps published history immutable", async () => {
  const tempHome = mkdtempSync(path.join(os.tmpdir(), "opencrab-workflow-store-"));
  tempHomes.push(tempHome);
  process.env.OPENCRAB_HOME = tempHome;

  const { workflowService } = await import("@/lib/modules/workflows/workflow-service");
  const created = workflowService.create({
    name: "内容发布",
    description: "内容 workflow",
    ownerType: "team",
    ownerId: "team-1",
    creationMode: "blank",
  });

  workflowService.updateDraft(created.workflow.id, {
    versionId: created.activeDraftVersion.id,
    graph: {
      ...created.activeDraftVersion.graph,
      nodes: [
        ...created.activeDraftVersion.graph.nodes,
        {
          id: "node-script",
          type: "script",
          name: "汇总信号",
          position: { x: 320, y: 140 },
          config: {
            mode: "script",
            goal: "汇总热点信号",
            scriptSource: "return { score: 82 };",
          },
        },
      ],
    },
  });

  const published = workflowService.publish(created.workflow.id, created.activeDraftVersion.id);
  expect(published.workflow.activeVersionId).toBe(created.activeDraftVersion.id);

  const refreshed = workflowService.getDetail(created.workflow.id);
  expect(refreshed?.versions.filter((version) => version.status === "published")).toHaveLength(1);
  expect(refreshed?.activeDraftVersion.id).not.toBe(created.activeDraftVersion.id);
});
```

- [ ] **Step 3: Run the targeted tests and verify they fail for missing workflow files**

Run: `npm run test -- tests/workflow-store.test.ts`

Expected: FAIL with `Cannot find module '@/lib/modules/workflows/workflow-service'` or missing workflow exports.

- [ ] **Step 4: Add the workflow runtime path constant**

```ts
export const OPENCRAB_WORKFLOWS_STORE_PATH = path.join(
  OPENCRAB_RUNTIME_HOME,
  "workflows.json",
);
```

- [ ] **Step 5: Define the workflow domain types**

```ts
import type { TaskSchedule } from "@/lib/tasks/types";

export type WorkflowOwnerType = "person" | "team";
export type WorkflowStatus = "draft" | "active" | "paused" | "archived";
export type WorkflowVersionStatus = "draft" | "published";
export type WorkflowNodeType = "start" | "script" | "agent" | "end";
export type WorkflowReviewSurface = "general" | "pending_publish";
export type WorkflowRunStatus = "queued" | "running" | "completed" | "failed" | "paused";
export type WorkflowNodeRunStatus =
  | "pending"
  | "running"
  | "completed"
  | "failed"
  | "waiting_for_human"
  | "stale";

export type WorkflowTrigger =
  | { kind: "manual" }
  | { kind: "schedule"; schedule: TaskSchedule; timezone: string | null };

export type WorkflowConditionRecord = {
  field: string;
  operator: "equals" | "not_equals" | "greater_than" | "less_than" | "contains";
  value: string | number | boolean;
  sourceText: string;
};

export type WorkflowDeliveryDestination =
  | { kind: "review_center" }
  | { kind: "pending_publish" }
  | { kind: "conversation"; conversationId: string }
  | { kind: "channel"; channelId: string };

export type WorkflowNodeRecord = {
  id: string;
  type: WorkflowNodeType;
  name: string;
  position: { x: number; y: number };
  config: Record<string, unknown>;
};

export type WorkflowEdgeRecord = {
  id: string;
  source: string;
  target: string;
  condition: WorkflowConditionRecord | null;
  label: string | null;
};

export type WorkflowGraphRecord = {
  nodes: WorkflowNodeRecord[];
  edges: WorkflowEdgeRecord[];
  viewport: { x: number; y: number; zoom: number };
};

export type WorkflowRecord = {
  id: string;
  name: string;
  description: string;
  ownerType: WorkflowOwnerType;
  ownerId: string;
  status: WorkflowStatus;
  activeVersionId: string | null;
  createdAt: string;
  updatedAt: string;
};

export type WorkflowVersionRecord = {
  id: string;
  workflowId: string;
  versionNumber: number;
  status: WorkflowVersionStatus;
  graph: WorkflowGraphRecord;
  createdAt: string;
  updatedAt: string;
  publishedAt: string | null;
};

export type WorkflowRunRecord = {
  id: string;
  workflowId: string;
  workflowVersionId: string;
  status: WorkflowRunStatus;
  startedAt: string;
  finishedAt: string | null;
  trigger: WorkflowTrigger;
};

export type WorkflowNodeRunRecord = {
  id: string;
  runId: string;
  nodeId: string;
  status: WorkflowNodeRunStatus;
  input: Record<string, unknown>;
  output: Record<string, unknown> | null;
  errorMessage: string | null;
  waitReason: string | null;
  startedAt: string | null;
  finishedAt: string | null;
};

export type WorkflowReviewItemRecord = {
  id: string;
  workflowId: string;
  runId: string;
  sourceNodeId: string;
  surface: WorkflowReviewSurface;
  status: "open" | "resolved";
  summary: string;
  threadPreview: string;
  createdAt: string;
  updatedAt: string;
};

export type WorkflowStoreState = {
  workflows: WorkflowRecord[];
  versions: WorkflowVersionRecord[];
  runs: WorkflowRunRecord[];
  nodeRuns: WorkflowNodeRunRecord[];
  reviewItems: WorkflowReviewItemRecord[];
};

export type WorkflowCreateInput = {
  name: string;
  description: string;
  ownerType: WorkflowOwnerType;
  ownerId: string;
  creationMode: "blank" | "ai_draft";
  draftPrompt?: string;
};

export type WorkflowOverview = WorkflowRecord & {
  ownerLabel: string;
  latestRunStatus: WorkflowRunStatus | null;
  pendingReviewCount: number;
  pendingPublishCount: number;
  reviewBadge?: string | null;
  pendingPublishBadge?: string | null;
};

export type WorkflowDetail = {
  workflow: WorkflowRecord;
  versions: WorkflowVersionRecord[];
  activeDraftVersion: WorkflowVersionRecord;
  publishedVersion: WorkflowVersionRecord | null;
  runs: WorkflowRunRecord[];
  nodeRuns: WorkflowNodeRunRecord[];
  reviewItems: WorkflowReviewItemRecord[];
};

export function createBlankWorkflowGraph(): WorkflowGraphRecord {
  return {
    nodes: [
      {
        id: "node-start",
        type: "start",
        name: "开始",
        position: { x: 80, y: 160 },
        config: { trigger: { kind: "manual" } },
      },
      {
        id: "node-end",
        type: "end",
        name: "结束",
        position: { x: 560, y: 160 },
        config: {
          primaryDestination: { kind: "review_center" },
          mirroredDestinations: [],
        },
      },
    ],
    edges: [
      {
        id: "edge-start-end",
        source: "node-start",
        target: "node-end",
        condition: null,
        label: null,
      },
    ],
    viewport: { x: 0, y: 0, zoom: 1 },
  };
}
```

- [ ] **Step 6: Implement the workflow store and service with blank creation, draft updates, and publish**

```ts
import { createSyncJsonFileStore } from "@/lib/infrastructure/json-store/sync-json-file-store";
import { OPENCRAB_WORKFLOWS_STORE_PATH } from "@/lib/resources/runtime-paths";

const store = createSyncJsonFileStore<WorkflowStoreState>({
  filePath: OPENCRAB_WORKFLOWS_STORE_PATH,
  seed: createSeedState,
  normalize: normalizeState,
});

function readState() {
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
  return {
    workflows: structuredClone(state.workflows || []),
    versions: structuredClone(state.versions || []),
    runs: structuredClone(state.runs || []),
    nodeRuns: structuredClone(state.nodeRuns || []),
    reviewItems: structuredClone(state.reviewItems || []),
  };
}

function getWorkflowDetail(workflowId: string): WorkflowDetail | null {
  const state = readState();
  const workflow = state.workflows.find((item) => item.id === workflowId);

  if (!workflow) {
    return null;
  }

  const versions = state.versions.filter((item) => item.workflowId === workflowId);
  const activeDraftVersion =
    versions.find((item) => item.status === "draft") ??
    versions.sort((left, right) => right.versionNumber - left.versionNumber)[0];

  if (!activeDraftVersion) {
    return null;
  }

  return {
    workflow,
    versions,
    activeDraftVersion,
    publishedVersion: versions.find((item) => item.id === workflow.activeVersionId) ?? null,
    runs: state.runs.filter((item) => item.workflowId === workflowId),
    nodeRuns: state.nodeRuns.filter((item) =>
      state.runs.some((run) => run.workflowId === workflowId && run.id === item.runId),
    ),
    reviewItems: state.reviewItems.filter((item) => item.workflowId === workflowId),
  };
}

export function createWorkflow(input: WorkflowCreateInput) {
  const now = new Date().toISOString();
  const workflowId = `workflow-${crypto.randomUUID()}`;
  const versionId = `workflow-version-${crypto.randomUUID()}`;
  const draftGraph = createBlankWorkflowGraph();

  const workflow: WorkflowRecord = {
    id: workflowId,
    name: input.name.trim(),
    description: input.description.trim(),
    ownerType: input.ownerType,
    ownerId: input.ownerId,
    status: "draft",
    activeVersionId: null,
    createdAt: now,
    updatedAt: now,
  };

  const version: WorkflowVersionRecord = {
    id: versionId,
    workflowId,
    versionNumber: 1,
    status: "draft",
    graph: draftGraph,
    createdAt: now,
    updatedAt: now,
    publishedAt: null,
  };

  mutateState((state) => {
    state.workflows = [workflow, ...state.workflows];
    state.versions = [version, ...state.versions];
  });

  return getWorkflowDetail(workflowId);
}

export function updateWorkflowDraft(
  workflowId: string,
  input: { versionId: string; graph: WorkflowGraphRecord },
) {
  mutateState((state) => {
    state.versions = state.versions.map((version) =>
      version.workflowId === workflowId && version.id === input.versionId
        ? {
            ...version,
            graph: input.graph,
            updatedAt: new Date().toISOString(),
          }
        : version,
    );
  });

  return getWorkflowDetail(workflowId);
}

export function listWorkflows(): WorkflowOverview[] {
  const state = readState();

  return state.workflows.map((workflow) => {
    const reviewItems = state.reviewItems.filter(
      (item) => item.workflowId === workflow.id && item.status === "open",
    );
    const latestRun = state.runs
      .filter((run) => run.workflowId === workflow.id)
      .sort((left, right) => Date.parse(right.startedAt) - Date.parse(left.startedAt))[0];

    return {
      ...workflow,
      ownerLabel: workflow.ownerType === "team" ? "团队" : "个人",
      latestRunStatus: latestRun?.status ?? null,
      pendingReviewCount: reviewItems.filter((item) => item.surface === "general").length,
      pendingPublishCount: reviewItems.filter((item) => item.surface === "pending_publish").length,
      reviewBadge: null,
      pendingPublishBadge: null,
    };
  });
}

export function publishWorkflow(workflowId: string, versionId: string) {
  const current = getWorkflowDetail(workflowId);

  if (!current) {
    return null;
  }

  mutateState((state) => {
    const nextPublishedVersionNumber =
      current.versions.reduce((max, version) => Math.max(max, version.versionNumber), 0) + 1;
    const target = state.versions.find((item) => item.id === versionId && item.workflowId === workflowId);

    if (!target) {
      return null;
    }

    target.status = "published";
    target.versionNumber = nextPublishedVersionNumber;
    target.publishedAt = new Date().toISOString();

    state.workflows = state.workflows.map((workflow) =>
      workflow.id === workflowId
        ? {
            ...workflow,
            status: "active",
            activeVersionId: versionId,
            updatedAt: new Date().toISOString(),
          }
        : workflow,
    );

    state.versions = [
      {
        ...target,
        id: `workflow-version-${crypto.randomUUID()}`,
        status: "draft",
        publishedAt: null,
        versionNumber: target.versionNumber + 1,
        updatedAt: new Date().toISOString(),
      },
      ...state.versions.filter((item) => item.id !== target.id),
      target,
    ];
  });

  return getWorkflowDetail(workflowId);
}

export const workflowService = {
  create: createWorkflow,
  getDetail: getWorkflowDetail,
  list: listWorkflows,
  updateDraft: updateWorkflowDraft,
  publish: publishWorkflow,
  generateDraftGraph: async (_input: { prompt: string }) => createBlankWorkflowGraph(),
  runNow: async (_workflowId: string) => null as WorkflowDetail | null,
};
```

- [ ] **Step 7: Run the targeted tests and verify they pass**

Run: `npm run test -- tests/workflow-store.test.ts`

Expected: PASS

- [ ] **Step 8: Commit**

```bash
git add /Users/sky/SkyProjects/opencrab/lib/resources/runtime-paths.ts /Users/sky/SkyProjects/opencrab/lib/workflows/types.ts /Users/sky/SkyProjects/opencrab/lib/workflows/workflow-store.ts /Users/sky/SkyProjects/opencrab/lib/modules/workflows/workflow-service.ts /Users/sky/SkyProjects/opencrab/tests/workflow-store.test.ts
git commit -m "feat: add workflow persistence foundation"
```

### Task 2: Expose workflows through the API and add the overview/detail shell

**Files:**
- Modify: `/Users/sky/SkyProjects/opencrab/lib/resources/opencrab-api-types.ts`
- Modify: `/Users/sky/SkyProjects/opencrab/lib/resources/opencrab-api.ts`
- Create: `/Users/sky/SkyProjects/opencrab/app/api/workflows/route.ts`
- Create: `/Users/sky/SkyProjects/opencrab/app/api/workflows/[workflowId]/route.ts`
- Create: `/Users/sky/SkyProjects/opencrab/app/api/workflows/[workflowId]/publish/route.ts`
- Create: `/Users/sky/SkyProjects/opencrab/app/api/workflows/[workflowId]/run/route.ts`
- Create: `/Users/sky/SkyProjects/opencrab/lib/workflows/workflow-view-model.ts`
- Create: `/Users/sky/SkyProjects/opencrab/components/workflows/workflows-screen.tsx`
- Create: `/Users/sky/SkyProjects/opencrab/components/workflows/workflow-detail-screen.tsx`
- Create: `/Users/sky/SkyProjects/opencrab/app/(app)/workflows/page.tsx`
- Create: `/Users/sky/SkyProjects/opencrab/app/(app)/workflows/[workflowId]/page.tsx`
- Modify: `/Users/sky/SkyProjects/opencrab/components/app-shell/app-shell.tsx`
- Modify: `/Users/sky/SkyProjects/opencrab/lib/seed-data.ts`
- Create: `/Users/sky/SkyProjects/opencrab/tests/workflow-view-model.test.ts`

- [ ] **Step 1: Write a failing view-model test for overview cards and review counters**

```ts
import { describe, expect, it } from "vitest";
import { buildWorkflowOverviewCard } from "@/lib/workflows/workflow-view-model";

describe("workflow-view-model", () => {
  it("surfaces pending review counts and owner labels on overview cards", () => {
    const card = buildWorkflowOverviewCard({
      workflow: {
        id: "workflow-1",
        name: "AI 热点跟进",
        description: "内容 workflow",
        ownerType: "team",
        ownerId: "team-1",
        status: "active",
        activeVersionId: "version-1",
        createdAt: "2026-04-08T00:00:00.000Z",
        updatedAt: "2026-04-08T00:00:00.000Z",
      },
      pendingReviewCount: 3,
      pendingPublishCount: 2,
      latestRunStatus: "running",
    });

    expect(card.ownerLabel).toBe("团队");
    expect(card.reviewBadge).toBe("3 个待处理");
    expect(card.pendingPublishBadge).toBe("2 个待发布");
  });
});
```

- [ ] **Step 2: Add workflow API response types and client helpers**

```ts
export type WorkflowListResponse = {
  workflows: WorkflowOverview[];
};

export type WorkflowDetailResponse = {
  workflow: WorkflowDetail | null;
};

export type WorkflowDraftGenerationResponse = {
  graph: WorkflowGraphRecord;
};

export async function getWorkflows() {
  return request<WorkflowListResponse>("/api/workflows", { method: "GET" });
}

export async function getWorkflowDetail(workflowId: string) {
  return request<WorkflowDetailResponse>(`/api/workflows/${workflowId}`, {
    method: "GET",
  });
}

export async function createWorkflow(input: WorkflowCreateInput) {
  return request<WorkflowDetail>("/api/workflows", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export async function generateWorkflowDraft(prompt: string) {
  return request<WorkflowDraftGenerationResponse>("/api/workflows/draft", {
    method: "POST",
    body: JSON.stringify({ prompt }),
  });
}
```

- [ ] **Step 3: Implement workflow API routes**

```ts
export async function GET() {
  return noStoreJson({
    workflows: workflowService.list(),
  });
}

export async function POST(request: Request) {
  const body = await readJsonBody<WorkflowCreateInput>(request, {});
  const detail = workflowService.create({
    name: body.name || "",
    description: body.description || "",
    ownerType: body.ownerType === "team" ? "team" : "person",
    ownerId: body.ownerId || "me",
    creationMode: body.creationMode === "ai_draft" ? "ai_draft" : "blank",
    draftPrompt: body.draftPrompt || "",
  });

  return noStoreJson(detail, { status: 201 });
}
```

- [ ] **Step 4: Add the new `Workflow` nav item and page routes**

```ts
export type NavKey =
  | "conversations"
  | "agents"
  | "projects"
  | "channels"
  | "tasks"
  | "workflows"
  | "skills"
  | "about"
  | "settings";
```

```tsx
function WorkflowIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.7" className="h-5 w-5">
      <path d="M4 5.5h4v3H4z" />
      <path d="M12 11.5h4v3h-4z" />
      <path d="M8 7h2.5c1.2 0 2.2 1 2.2 2.2v2.3" />
    </svg>
  );
}

{
  key: "workflows",
  label: "工作流",
  href: "/workflows",
  icon: <WorkflowIcon />,
}
```

- [ ] **Step 5: Build the initial overview/detail shell**

```tsx
export function buildWorkflowOverviewCard(input: {
  workflow: WorkflowRecord;
  pendingReviewCount: number;
  pendingPublishCount: number;
  latestRunStatus: WorkflowRunStatus | null;
}) {
  return {
    ...input.workflow,
    ownerLabel: input.workflow.ownerType === "team" ? "团队" : "个人",
    reviewBadge: input.pendingReviewCount > 0 ? `${input.pendingReviewCount} 个待处理` : null,
    pendingPublishBadge:
      input.pendingPublishCount > 0 ? `${input.pendingPublishCount} 个待发布` : null,
    latestRunStatus: input.latestRunStatus,
  };
}

export function WorkflowsScreen({ initialWorkflows }: { initialWorkflows: WorkflowOverview[] }) {
  const [workflows, setWorkflows] = useState(initialWorkflows);

  return (
    <section className="space-y-6">
      <header className="rounded-[24px] border border-line bg-surface p-6 shadow-soft">
        <h1 className="text-[28px] font-semibold tracking-[-0.03em] text-text">工作流</h1>
        <p className="mt-2 text-[14px] leading-6 text-muted-strong">
          用灵活画布管理可重复执行的工作定义、运行记录和待处理事项。
        </p>
      </header>
      <div className="grid gap-4">
        {workflows.map((workflow) => (
          <Link key={workflow.id} href={`/workflows/${workflow.id}`} className="rounded-[20px] border border-line bg-surface p-5">
            <div className="text-[16px] font-semibold text-text">{workflow.name}</div>
            <div className="mt-2 text-[13px] leading-6 text-muted-strong">{workflow.description}</div>
            <div className="mt-3 flex flex-wrap gap-2 text-[12px] text-muted-strong">
              <span>{workflow.ownerLabel}</span>
              {workflow.pendingReviewCount > 0 ? <span>{workflow.pendingReviewCount} 个待处理</span> : null}
              {workflow.pendingPublishCount > 0 ? <span>{workflow.pendingPublishCount} 个待发布</span> : null}
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}
```

- [ ] **Step 6: Run the targeted tests and typecheck**

Run: `npm run test -- tests/workflow-store.test.ts tests/workflow-view-model.test.ts && npm run typecheck`

Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add /Users/sky/SkyProjects/opencrab/lib/resources/opencrab-api-types.ts /Users/sky/SkyProjects/opencrab/lib/resources/opencrab-api.ts /Users/sky/SkyProjects/opencrab/app/api/workflows/route.ts /Users/sky/SkyProjects/opencrab/app/api/workflows/[workflowId]/route.ts /Users/sky/SkyProjects/opencrab/app/api/workflows/[workflowId]/publish/route.ts /Users/sky/SkyProjects/opencrab/app/api/workflows/[workflowId]/run/route.ts /Users/sky/SkyProjects/opencrab/lib/workflows/workflow-view-model.ts /Users/sky/SkyProjects/opencrab/components/workflows/workflows-screen.tsx /Users/sky/SkyProjects/opencrab/components/workflows/workflow-detail-screen.tsx /Users/sky/SkyProjects/opencrab/app/(app)/workflows/page.tsx /Users/sky/SkyProjects/opencrab/app/(app)/workflows/[workflowId]/page.tsx /Users/sky/SkyProjects/opencrab/components/app-shell/app-shell.tsx /Users/sky/SkyProjects/opencrab/lib/seed-data.ts /Users/sky/SkyProjects/opencrab/tests/workflow-view-model.test.ts
git commit -m "feat: add workflow overview and detail shell"
```

### Task 3: Build the canvas editor, hybrid inspector, and publish validation

**Files:**
- Modify: `/Users/sky/SkyProjects/opencrab/package.json`
- Create: `/Users/sky/SkyProjects/opencrab/lib/workflows/workflow-graph.ts`
- Create: `/Users/sky/SkyProjects/opencrab/components/workflows/workflow-canvas.tsx`
- Create: `/Users/sky/SkyProjects/opencrab/components/workflows/workflow-inspector.tsx`
- Modify: `/Users/sky/SkyProjects/opencrab/components/workflows/workflow-detail-screen.tsx`
- Create: `/Users/sky/SkyProjects/opencrab/tests/workflow-graph.test.ts`

- [ ] **Step 1: Write failing graph tests for conditional edges, merge readiness, and publish validation**

```ts
import { describe, expect, it } from "vitest";
import {
  canPublishWorkflowGraph,
  collectReadyNodeIds,
  markDescendantsStale,
} from "@/lib/workflows/workflow-graph";

function makeMergeGraph() {
  return {
    nodes: [
      { id: "start", type: "start", name: "开始", position: { x: 0, y: 0 }, config: {} },
      { id: "node-a", type: "script", name: "A", position: { x: 200, y: 0 }, config: {} },
      { id: "node-b", type: "script", name: "B", position: { x: 200, y: 180 }, config: {} },
      { id: "node-merge", type: "agent", name: "汇合", position: { x: 420, y: 80 }, config: {} },
      { id: "node-end", type: "end", name: "结束", position: { x: 640, y: 80 }, config: {} },
    ],
    edges: [
      { id: "edge-1", source: "start", target: "node-a", condition: null, label: null },
      { id: "edge-2", source: "start", target: "node-b", condition: null, label: null },
      { id: "edge-3", source: "node-a", target: "node-merge", condition: null, label: null },
      { id: "edge-4", source: "node-b", target: "node-merge", condition: null, label: null },
      { id: "edge-5", source: "node-merge", target: "node-end", condition: null, label: null },
    ],
    viewport: { x: 0, y: 0, zoom: 1 },
  };
}

describe("workflow-graph", () => {
  it("requires exactly one start node and one end node to publish", () => {
    expect(
      canPublishWorkflowGraph({
        nodes: [],
        edges: [],
        viewport: { x: 0, y: 0, zoom: 1 },
      }),
    ).toEqual({
      ok: false,
      reason: "Workflow 至少需要一个开始节点和一个结束节点。",
    });
  });

  it("waits for all upstream nodes before a merge node becomes ready", () => {
    const ready = collectReadyNodeIds({
      graph: makeMergeGraph(),
      completedNodeIds: new Set(["node-a"]),
      failedNodeIds: new Set(),
      waitingNodeIds: new Set(),
    });

    expect(ready).not.toContain("node-merge");
  });

  it("marks downstream node runs stale after retrying the current node only", () => {
    const staleIds = markDescendantsStale(makeMergeGraph(), "node-a");
    expect(staleIds).toContain("node-end");
  });
});
```

- [ ] **Step 2: Install the canvas dependency**

Run: `npm install @xyflow/react`

Expected: `package.json` and `package-lock.json` include `@xyflow/react`.

- [ ] **Step 3: Implement graph helpers**

```ts
export function canPublishWorkflowGraph(graph: WorkflowGraphRecord) {
  const startCount = graph.nodes.filter((node) => node.type === "start").length;
  const endCount = graph.nodes.filter((node) => node.type === "end").length;

  if (startCount !== 1 || endCount !== 1) {
    return {
      ok: false as const,
      reason: "Workflow 至少需要一个开始节点和一个结束节点。",
    };
  }

  if (graph.edges.length === 0) {
    return {
      ok: false as const,
      reason: "Workflow 还没有任何连线，暂时不能发布。",
    };
  }

  return { ok: true as const, reason: null };
}

export function collectReadyNodeIds(input: {
  graph: WorkflowGraphRecord;
  completedNodeIds: Set<string>;
  failedNodeIds: Set<string>;
  waitingNodeIds: Set<string>;
  context?: Record<string, unknown>;
}) {
  return input.graph.nodes
    .filter((node) => {
      if (node.type === "start") {
        return !input.completedNodeIds.has(node.id);
      }

      if (input.failedNodeIds.has(node.id) || input.waitingNodeIds.has(node.id)) {
        return false;
      }

      const incoming = input.graph.edges.filter(
        (edge) =>
          edge.target === node.id &&
          edgeMatchesContext(edge.condition, input.context || {}) &&
          isNodeReachable(input.graph, edge.source, input.context || {}),
      );
      return incoming.length > 0 && incoming.every((edge) => input.completedNodeIds.has(edge.source));
    })
    .map((node) => node.id);
}

export function edgeMatchesContext(
  condition: WorkflowConditionRecord | null,
  context: Record<string, unknown>,
) {
  if (!condition) {
    return true;
  }

  const value = context[condition.field];

  if (condition.operator === "greater_than") {
    return Number(value) > Number(condition.value);
  }

  if (condition.operator === "less_than") {
    return Number(value) < Number(condition.value);
  }

  if (condition.operator === "contains") {
    return String(value || "").includes(String(condition.value));
  }

  if (condition.operator === "not_equals") {
    return value !== condition.value;
  }

  return value === condition.value;
}

export function isNodeReachable(
  graph: WorkflowGraphRecord,
  nodeId: string,
  context: Record<string, unknown>,
): boolean {
  const node = graph.nodes.find((item) => item.id === nodeId);

  if (!node) {
    return false;
  }

  if (node.type === "start") {
    return true;
  }

  const incoming = graph.edges.filter(
    (edge) => edge.target === nodeId && edgeMatchesContext(edge.condition, context),
  );

  return incoming.some((edge) => isNodeReachable(graph, edge.source, context));
}

export function markDescendantsStale(graph: WorkflowGraphRecord, nodeId: string) {
  const staleIds = new Set<string>();
  const queue = graph.edges.filter((edge) => edge.source === nodeId).map((edge) => edge.target);

  while (queue.length > 0) {
    const current = queue.shift();

    if (!current || staleIds.has(current)) {
      continue;
    }

    staleIds.add(current);
    graph.edges
      .filter((edge) => edge.source === current)
      .forEach((edge) => queue.push(edge.target));
  }

  return [...staleIds];
}
```

- [ ] **Step 4: Build the canvas surface on `@xyflow/react`**

```tsx
import {
  Background,
  Controls,
  MiniMap,
  ReactFlow,
  addEdge,
  useEdgesState,
  useNodesState,
  type Connection,
} from "@xyflow/react";

function toFlowNodes(nodes: WorkflowNodeRecord[]) {
  return nodes.map((node) => ({ ...node, data: { label: node.name } }));
}

function toFlowEdges(edges: WorkflowEdgeRecord[]) {
  return edges.map((edge) => ({ ...edge, type: "smoothstep", label: edge.label || undefined }));
}

function fromFlowState(nodes: Array<{ id: string; position: { x: number; y: number }; data?: { label?: string } }>, edges: Array<{ id: string; source: string; target: string; label?: string }>) {
  return {
    nodes: nodes.map((node) => ({
      id: node.id,
      type: (node as { type?: WorkflowNodeType }).type || "script",
      name: node.data?.label || node.id,
      position: node.position,
      config: {},
    })),
    edges: edges.map((edge) => ({
      id: edge.id,
      source: edge.source,
      target: edge.target,
      condition: null,
      label: edge.label || null,
    })),
    viewport: { x: 0, y: 0, zoom: 1 },
  };
}

export function WorkflowCanvas({
  graph,
  onGraphChange,
}: {
  graph: WorkflowGraphRecord;
  onGraphChange: (next: WorkflowGraphRecord) => void;
}) {
  const [nodes, setNodes, onNodesChange] = useNodesState(toFlowNodes(graph.nodes));
  const [edges, setEdges, onEdgesChange] = useEdgesState(toFlowEdges(graph.edges));

  function handleConnect(connection: Connection) {
    setEdges((current) => {
      const next = addEdge({ ...connection, type: "smoothstep" }, current);
      onGraphChange(fromFlowState(nodes, next));
      return next;
    });
  }

  return (
    <div className="h-[640px] overflow-hidden rounded-[24px] border border-line bg-background">
      <ReactFlow nodes={nodes} edges={edges} onNodesChange={onNodesChange} onEdgesChange={onEdgesChange} onConnect={handleConnect} fitView>
        <MiniMap />
        <Controls />
        <Background gap={20} size={1} />
      </ReactFlow>
    </div>
  );
}
```

- [ ] **Step 5: Build the hybrid inspector**

```tsx
function ConditionEdgeEditor({
  edge,
  onPatch,
}: {
  edge: WorkflowEdgeRecord;
  onPatch: (patch: Partial<WorkflowEdgeRecord>) => void;
}) {
  return (
    <aside className="space-y-3 rounded-[24px] border border-line bg-surface p-5">
      <p className="text-[13px] text-muted-strong">通过自然语言描述条件，再同步成结构化规则。</p>
      <textarea
        className="min-h-[120px] w-full rounded-2xl border border-line bg-background p-3 text-[13px] text-text"
        defaultValue={edge.condition?.sourceText || ""}
        onBlur={(event) =>
          onPatch({
            condition: {
              field: "context.score",
              operator: "greater_than",
              value: 80,
              sourceText: event.currentTarget.value,
            },
          })
        }
      />
    </aside>
  );
}

function WorkflowNodeEditor({
  node,
  onPatch,
}: {
  node: WorkflowNodeRecord;
  onPatch: (patch: Partial<WorkflowNodeRecord>) => void;
}) {
  return (
    <aside className="space-y-3 rounded-[24px] border border-line bg-surface p-5">
      <input
        className="w-full rounded-2xl border border-line bg-background px-3 py-2 text-[13px] text-text"
        defaultValue={node.name}
        onBlur={(event) => onPatch({ name: event.currentTarget.value })}
      />
      <textarea
        className="min-h-[160px] w-full rounded-2xl border border-line bg-background p-3 text-[13px] text-text"
        defaultValue={String(node.config.goal || "")}
        onBlur={(event) => onPatch({ config: { ...node.config, goal: event.currentTarget.value } })}
      />
    </aside>
  );
}

export function WorkflowInspector({
  selection,
  onNodePatch,
  onEdgePatch,
}: {
  selection:
    | { kind: "node"; node: WorkflowNodeRecord }
    | { kind: "edge"; edge: WorkflowEdgeRecord }
    | null;
  onNodePatch: (patch: Partial<WorkflowNodeRecord>) => void;
  onEdgePatch: (patch: Partial<WorkflowEdgeRecord>) => void;
}) {
  if (!selection) {
    return (
      <aside className="rounded-[24px] border border-line bg-surface p-5 text-[13px] text-muted-strong">
        选中节点或连线后，在这里修改结构化配置，并用 AI 帮你生成或调整配置内容。
      </aside>
    );
  }

  return selection.kind === "edge" ? (
    <ConditionEdgeEditor edge={selection.edge} onPatch={onEdgePatch} />
  ) : (
    <WorkflowNodeEditor node={selection.node} onPatch={onNodePatch} />
  );
}
```

- [ ] **Step 6: Wire publish validation into the detail screen**

```tsx
import { useMemo } from "react";
import { Button } from "@/components/ui/button";

const publishCheck = useMemo(
  () => canPublishWorkflowGraph(activeVersion.graph),
  [activeVersion.graph],
);

<Button
  variant="primary"
  disabled={!publishCheck.ok || isPublishing}
  onClick={() => void handlePublish()}
>
  {isPublishing ? "发布中..." : "发布工作流"}
</Button>
{publishCheck.ok ? null : (
  <p className="mt-2 text-[12px] text-[#b42318]">{publishCheck.reason}</p>
)}
```

- [ ] **Step 7: Run the targeted tests and typecheck**

Run: `npm run test -- tests/workflow-graph.test.ts tests/workflow-view-model.test.ts && npm run typecheck`

Expected: PASS

- [ ] **Step 8: Commit**

```bash
git add /Users/sky/SkyProjects/opencrab/package.json /Users/sky/SkyProjects/opencrab/package-lock.json /Users/sky/SkyProjects/opencrab/lib/workflows/workflow-graph.ts /Users/sky/SkyProjects/opencrab/components/workflows/workflow-canvas.tsx /Users/sky/SkyProjects/opencrab/components/workflows/workflow-inspector.tsx /Users/sky/SkyProjects/opencrab/components/workflows/workflow-detail-screen.tsx /Users/sky/SkyProjects/opencrab/tests/workflow-graph.test.ts
git commit -m "feat: add workflow canvas editor"
```

### Task 4: Add blank-vs-AI creation flow and workflow draft generation

**Files:**
- Create: `/Users/sky/SkyProjects/opencrab/lib/workflows/workflow-draft-builder.ts`
- Create: `/Users/sky/SkyProjects/opencrab/app/api/workflows/draft/route.ts`
- Create: `/Users/sky/SkyProjects/opencrab/components/workflows/workflow-create-dialog.tsx`
- Modify: `/Users/sky/SkyProjects/opencrab/components/workflows/workflows-screen.tsx`
- Modify: `/Users/sky/SkyProjects/opencrab/lib/modules/workflows/workflow-service.ts`
- Create: `/Users/sky/SkyProjects/opencrab/tests/workflow-draft-builder.test.ts`

- [ ] **Step 1: Write failing draft-builder tests for blank and AI-generated entry**

```ts
import { describe, expect, it, vi } from "vitest";
import { createWorkflowDraftBuilder } from "@/lib/workflows/workflow-draft-builder";

describe("workflow-draft-builder", () => {
  it("returns a blank graph for blank mode", async () => {
    const builder = createWorkflowDraftBuilder({
      executePlanner: vi.fn(),
    });

    const graph = await builder.build({
      mode: "blank",
      prompt: "",
    });

    expect(graph.nodes.map((node) => node.type)).toEqual(["start", "end"]);
  });

  it("normalizes an AI reply into the four allowed node types", async () => {
    const builder = createWorkflowDraftBuilder({
      executePlanner: vi.fn(async () =>
        JSON.stringify({
          nodes: [
            { id: "start", type: "start", name: "开始", position: { x: 80, y: 120 }, config: { trigger: { kind: "manual" } } },
            { id: "script", type: "script", name: "抓取信号", position: { x: 320, y: 120 }, config: { goal: "抓取热点", scriptSource: "return { score: 91 };" } },
            { id: "end", type: "end", name: "待发布", position: { x: 600, y: 120 }, config: { primaryDestination: { kind: "pending_publish" }, mirroredDestinations: [] } },
          ],
          edges: [{ id: "edge-1", source: "start", target: "script", condition: null, label: null }],
        }),
      ),
    });

    const graph = await builder.build({
      mode: "ai_draft",
      prompt: "做一个 AI 热点跟进 workflow",
    });

    expect(graph.nodes.every((node) => ["start", "script", "agent", "end"].includes(node.type))).toBe(true);
  });
});
```

- [ ] **Step 2: Implement the draft builder with a planner-style JSON prompt**

```ts
async function defaultWorkflowPlannerExecutor(input: { prompt: string }) {
  const { reply } = await generateCodexReply({
    prompt: input.prompt,
    cwd: process.cwd(),
  });

  return reply;
}

function buildWorkflowDraftPrompt(prompt: string) {
  return [
    "你是 OpenCrab 的 workflow 规划器。",
    "只允许输出 start/script/agent/end 四种节点。",
    "必须返回 JSON，包含 nodes 和 edges。",
    `用户目标：${prompt.trim()}`,
  ].join("\n");
}

function normalizeGeneratedWorkflowGraph(payload: Record<string, unknown>) {
  const rawNodes = Array.isArray(payload.nodes) ? payload.nodes : [];
  const rawEdges = Array.isArray(payload.edges) ? payload.edges : [];

  return {
    nodes: rawNodes
      .map((node) => {
        const candidate = node as Partial<WorkflowNodeRecord>;
        const type = candidate.type;

        if (!type || !["start", "script", "agent", "end"].includes(type)) {
          return null;
        }

        return {
          id: candidate.id || `node-${crypto.randomUUID()}`,
          type,
          name: candidate.name || "未命名节点",
          position: candidate.position || { x: 0, y: 0 },
          config: candidate.config || {},
        };
      })
      .filter(Boolean),
    edges: rawEdges.map((edge) => ({
      id: (edge as { id?: string }).id || `edge-${crypto.randomUUID()}`,
      source: (edge as { source?: string }).source || "node-start",
      target: (edge as { target?: string }).target || "node-end",
      condition: null,
      label: (edge as { label?: string }).label || null,
    })),
    viewport: { x: 0, y: 0, zoom: 1 },
  };
}

export function createWorkflowDraftBuilder(dependencies: {
  executePlanner?: (input: { prompt: string }) => Promise<string>;
} = {}) {
  const executePlanner = dependencies.executePlanner ?? defaultWorkflowPlannerExecutor;

  return {
    async build(input: { mode: "blank" | "ai_draft"; prompt: string }) {
      if (input.mode === "blank") {
        return createBlankWorkflowGraph();
      }

      const reply = await executePlanner({
        prompt: buildWorkflowDraftPrompt(input.prompt),
      });

      return normalizeGeneratedWorkflowGraph(JSON.parse(reply));
    },
  };
}

const workflowDraftBuilder = createWorkflowDraftBuilder();

export async function generateDraftGraph(input: { prompt: string }) {
  return workflowDraftBuilder.build({
    mode: "ai_draft",
    prompt: input.prompt,
  });
}

workflowService.generateDraftGraph = generateDraftGraph;
```

- [ ] **Step 3: Add the draft-generation API route**

```ts
export async function POST(request: Request) {
  const body = await readJsonBody<{ prompt?: string }>(request, {});
  const graph = await workflowService.generateDraftGraph({
    prompt: body.prompt || "",
  });

  return noStoreJson({
    graph,
  });
}
```

- [ ] **Step 4: Build the create dialog with `空白画布` and `AI 生成初稿` entry points**

```tsx
export function WorkflowCreateDialog({
  open,
  onClose,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  onCreated: (workflowId: string) => void;
}) {
  const [mode, setMode] = useState<"blank" | "ai_draft">("blank");
  const [prompt, setPrompt] = useState("");

  async function handleSubmit() {
    const response = await createWorkflow({
      name: mode === "blank" ? "未命名 Workflow" : prompt.trim().slice(0, 24) || "未命名 Workflow",
      description: mode === "blank" ? "" : prompt,
      ownerType: "person",
      ownerId: "me",
      creationMode: mode,
      draftPrompt: mode === "ai_draft" ? prompt : undefined,
    });

    onCreated(response.workflow.id);
  }

  if (!open) {
    return null;
  }

  return (
    <DialogShell onClose={onClose} panelClassName="max-w-[720px]">
      <div className="space-y-5">
        <div className="space-y-2">
          <h2 className="text-[20px] font-semibold text-text">新建 Workflow</h2>
          <p className="text-[13px] leading-6 text-muted-strong">
            先选创建方式，再决定是从空白画布开始，还是让 AI 生成第一版草稿。
          </p>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <button
            type="button"
            className={`rounded-[20px] border px-4 py-4 text-left ${mode === "blank" ? "border-text bg-background" : "border-line bg-surface"}`}
            onClick={() => setMode("blank")}
          >
            <div className="text-[14px] font-semibold text-text">空白画布</div>
            <div className="mt-1 text-[12px] leading-5 text-muted-strong">自己添加节点、连线和条件。</div>
          </button>
          <button
            type="button"
            className={`rounded-[20px] border px-4 py-4 text-left ${mode === "ai_draft" ? "border-text bg-background" : "border-line bg-surface"}`}
            onClick={() => setMode("ai_draft")}
          >
            <div className="text-[14px] font-semibold text-text">AI 生成初稿</div>
            <div className="mt-1 text-[12px] leading-5 text-muted-strong">先说目标，再回到画布里细改。</div>
          </button>
        </div>
        <textarea
          className="min-h-[160px] w-full rounded-[20px] border border-line bg-background p-4 text-[13px] leading-6 text-text"
          value={prompt}
          onChange={(event) => setPrompt(event.currentTarget.value)}
          placeholder="例如：每天上午 9 点抓取 AI 产品热点，生成 X 和小红书待发布内容。"
          disabled={mode === "blank"}
        />
        <div className="flex justify-end gap-3">
          <button type="button" className="rounded-full border border-line px-4 py-2 text-[13px] text-text" onClick={onClose}>
            取消
          </button>
          <button
            type="button"
            className="rounded-full bg-text px-4 py-2 text-[13px] font-medium text-white disabled:opacity-50"
            onClick={() => void handleSubmit()}
            disabled={mode === "ai_draft" && !prompt.trim()}
          >
            创建 Workflow
          </button>
        </div>
      </div>
    </DialogShell>
  );
}
```

- [ ] **Step 5: Run the targeted tests and typecheck**

Run: `npm run test -- tests/workflow-draft-builder.test.ts tests/workflow-store.test.ts && npm run typecheck`

Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add /Users/sky/SkyProjects/opencrab/lib/workflows/workflow-draft-builder.ts /Users/sky/SkyProjects/opencrab/app/api/workflows/draft/route.ts /Users/sky/SkyProjects/opencrab/components/workflows/workflow-create-dialog.tsx /Users/sky/SkyProjects/opencrab/components/workflows/workflows-screen.tsx /Users/sky/SkyProjects/opencrab/lib/modules/workflows/workflow-service.ts /Users/sky/SkyProjects/opencrab/tests/workflow-draft-builder.test.ts
git commit -m "feat: add workflow draft generation"
```

### Task 5: Implement workflow execution, scheduling, and version-pinned node runs

**Files:**
- Create: `/Users/sky/SkyProjects/opencrab/lib/workflows/workflow-executor.ts`
- Create: `/Users/sky/SkyProjects/opencrab/lib/workflows/workflow-runner.ts`
- Modify: `/Users/sky/SkyProjects/opencrab/lib/runtime/runtime-startup.ts`
- Modify: `/Users/sky/SkyProjects/opencrab/lib/workflows/workflow-store.ts`
- Modify: `/Users/sky/SkyProjects/opencrab/lib/modules/workflows/workflow-service.ts`
- Modify: `/Users/sky/SkyProjects/opencrab/app/api/workflows/[workflowId]/run/route.ts`
- Create: `/Users/sky/SkyProjects/opencrab/tests/workflow-runner.test.ts`

- [ ] **Step 1: Write failing runtime tests for schedule triggers, branch routing, merge waits, and version pinning**

```ts
import { describe, expect, it, vi } from "vitest";
import {
  createWorkflowExecutor,
  shouldRunWorkflowAt,
} from "@/lib/workflows/workflow-executor";

function makePublishedBranchingWorkflow(versionId = "version-1"): WorkflowDetail {
  return {
    workflow: {
      id: "workflow-1",
      name: "AI 热点跟进",
      description: "内容 workflow",
      ownerType: "person",
      ownerId: "me",
      status: "active",
      activeVersionId: versionId,
      createdAt: "2026-04-08T00:00:00.000Z",
      updatedAt: "2026-04-08T00:00:00.000Z",
    },
    versions: [],
    activeDraftVersion: {
      id: "draft-1",
      workflowId: "workflow-1",
      versionNumber: 2,
      status: "draft",
      graph: createBlankWorkflowGraph(),
      createdAt: "2026-04-08T00:00:00.000Z",
      updatedAt: "2026-04-08T00:00:00.000Z",
      publishedAt: null,
    },
    publishedVersion: {
      id: versionId,
      workflowId: "workflow-1",
      versionNumber: 1,
      status: "published",
      graph: {
        nodes: [
          { id: "node-start", type: "start", name: "开始", position: { x: 0, y: 0 }, config: { trigger: { kind: "manual" } } },
          { id: "node-score", type: "script", name: "抓取信号", position: { x: 180, y: 0 }, config: {} },
          { id: "node-x-output", type: "agent", name: "生成 X 草稿", position: { x: 400, y: 0 }, config: {} },
          { id: "node-fallback", type: "agent", name: "生成保守稿", position: { x: 400, y: 180 }, config: {} },
          { id: "node-merge", type: "script", name: "汇总结果", position: { x: 620, y: 90 }, config: {} },
          { id: "node-end", type: "end", name: "结束", position: { x: 820, y: 90 }, config: {} },
        ],
        edges: [
          { id: "edge-1", source: "node-start", target: "node-score", condition: null, label: null },
          {
            id: "edge-2",
            source: "node-score",
            target: "node-x-output",
            condition: { field: "score", operator: "greater_than", value: 80, sourceText: "score > 80" },
            label: "热度高",
          },
          {
            id: "edge-3",
            source: "node-score",
            target: "node-fallback",
            condition: { field: "score", operator: "less_than", value: 81, sourceText: "score <= 80" },
            label: "热度低",
          },
          { id: "edge-4", source: "node-x-output", target: "node-merge", condition: null, label: null },
          { id: "edge-5", source: "node-fallback", target: "node-merge", condition: null, label: null },
          { id: "edge-6", source: "node-merge", target: "node-end", condition: null, label: null },
        ],
        viewport: { x: 0, y: 0, zoom: 1 },
      },
      createdAt: "2026-04-08T00:00:00.000Z",
      updatedAt: "2026-04-08T00:00:00.000Z",
      publishedAt: "2026-04-08T00:00:00.000Z",
    },
    runs: [],
    nodeRuns: [],
    reviewItems: [],
  };
}

function makePublishedVersionedWorkflow(versionId: string) {
  return makePublishedBranchingWorkflow(versionId);
}

describe("workflow-runner", () => {
  it("treats scheduled workflows as due when the start-node schedule matches now", () => {
    expect(
      shouldRunWorkflowAt(
        {
          kind: "schedule",
          schedule: { preset: "daily", time: "09:00" },
          timezone: "Asia/Shanghai",
        },
        new Date("2026-04-08T09:00:00+08:00"),
      ),
    ).toBe(true);
  });

  it("runs only the satisfied conditional branch and waits for all merge inputs", async () => {
    const execute = createWorkflowExecutor({
      runScriptNode: vi.fn(async () => ({ score: 88 })),
      runAgentNode: vi.fn(async ({ nodeId }) => ({ nodeId })),
    });

    const result = await execute.run(makePublishedBranchingWorkflow());
    expect(result.completedNodeIds).toContain("node-x-output");
    expect(result.completedNodeIds).toContain("node-merge");
    expect(result.completedNodeIds).not.toContain("node-fallback");
  });

  it("pins a run to the published version active at start time", async () => {
    const execute = createWorkflowExecutor({
      runScriptNode: vi.fn(async () => ({ ok: true })),
      runAgentNode: vi.fn(async () => ({ ok: true })),
    });

    const result = await execute.run(makePublishedVersionedWorkflow("version-1"));
    expect(result.run.workflowVersionId).toBe("version-1");
  });
});
```

- [ ] **Step 2: Implement the version-pinned executor**

```ts
import {
  collectReadyNodeIds,
  edgeMatchesContext,
} from "@/lib/workflows/workflow-graph";

export function shouldRunWorkflowAt(trigger: WorkflowTrigger, now: Date) {
  if (trigger.kind !== "schedule" || !trigger.schedule.time) {
    return false;
  }

  const [hours, minutes] = trigger.schedule.time.split(":").map((value) => Number(value));
  return now.getHours() === hours && now.getMinutes() === minutes;
}

export function createWorkflowExecutor(dependencies: {
  runScriptNode: (input: {
    nodeId: string;
    config: Record<string, unknown>;
    context: Record<string, unknown>;
  }) => Promise<Record<string, unknown>>;
  runAgentNode: (input: {
    nodeId: string;
    config: Record<string, unknown>;
    context: Record<string, unknown>;
  }) => Promise<Record<string, unknown>>;
}) {
  const runScriptNode = dependencies.runScriptNode;
  const runAgentNode = dependencies.runAgentNode;

  return {
    async run(detail: WorkflowDetail) {
      if (!detail.publishedVersion) {
        throw new Error("Workflow 还没有已发布版本。");
      }

      const run: WorkflowRunRecord = {
        id: `workflow-run-${crypto.randomUUID()}`,
        workflowId: detail.workflow.id,
        workflowVersionId: detail.publishedVersion.id,
        status: "running",
        startedAt: new Date().toISOString(),
        finishedAt: null,
        trigger: { kind: "manual" },
      };
      let context: Record<string, unknown> = {};
      const completedNodeIds = new Set<string>();
      const failedNodeIds = new Set<string>();
      const waitingNodeIds = new Set<string>();
      const pendingNodeIds = new Set(detail.publishedVersion.graph.nodes.map((node) => node.id));

      while (pendingNodeIds.size > 0) {
        const readyNodeIds = collectReadyNodeIds({
          graph: detail.publishedVersion.graph,
          completedNodeIds,
          failedNodeIds,
          waitingNodeIds,
          context,
        }).filter((nodeId) => pendingNodeIds.has(nodeId));

        if (readyNodeIds.length === 0) {
          break;
        }

        for (const nodeId of readyNodeIds) {
          const node = detail.publishedVersion.graph.nodes.find((item) => item.id === nodeId);

          if (!node) {
            continue;
          }

          const incoming = detail.publishedVersion.graph.edges.filter(
            (edge) => edge.target === node.id,
          );
          const hasSatisfiedIncoming =
            node.type === "start" ||
            incoming.some((edge) => edgeMatchesContext(edge.condition, context));

          if (!hasSatisfiedIncoming) {
            pendingNodeIds.delete(node.id);
            continue;
          }

          pendingNodeIds.delete(node.id);

          if (node.type === "script") {
            context = {
              ...context,
              ...(await runScriptNode({ nodeId: node.id, config: node.config, context })),
            };
          } else if (node.type === "agent") {
            context = {
              ...context,
              ...(await runAgentNode({ nodeId: node.id, config: node.config, context })),
            };
          }

          completedNodeIds.add(node.id);
        }
      }

      return { run, completedNodeIds };
    },
  };
}
```

- [ ] **Step 3: Implement the scheduler-backed runner**

```ts
export async function ensureWorkflowRunner() {
  if (globalThis.__opencrabWorkflowRunnerPromise) {
    return globalThis.__opencrabWorkflowRunnerPromise;
  }

  const task = runDueWorkflows()
    .catch((error) => {
      logServerError({
        event: "workflow_runner_cycle_failed",
        message: error instanceof Error ? error.message : "Workflow 执行周期失败。",
      });
    })
    .finally(() => {
      globalThis.__opencrabWorkflowRunnerPromise = undefined;
    });

  globalThis.__opencrabWorkflowRunnerPromise = task;
  return task;
}

async function runDueWorkflows() {
  const workflows = workflowService.list().filter((item) => item.status === "active");

  for (const workflow of workflows) {
    const detail = workflowService.getDetail(workflow.id);

    if (!detail?.publishedVersion) {
      continue;
    }

    const startNode = detail.publishedVersion.graph.nodes.find((node) => node.type === "start");
    const trigger = (startNode?.config.trigger as WorkflowTrigger | undefined) ?? { kind: "manual" };

    if (shouldRunWorkflowAt(trigger, new Date())) {
      await workflowService.runNow(workflow.id);
    }
  }
}
```

- [ ] **Step 4: Start the workflow runner from runtime boot**

```ts
import { ensureWorkflowRunner } from "@/lib/workflows/workflow-runner";

export async function warmRuntimeStartup() {
  await Promise.all([
    ensureTaskRunner(),
    ensureWorkflowRunner(),
  ]);
}
```

- [ ] **Step 5: Wire manual `Run now` through the API and detail screen**

```ts
const workflowExecutor = createWorkflowExecutor({
  runScriptNode: async ({ config }) => ({ ...(config.mockOutput as Record<string, unknown> | undefined) }),
  runAgentNode: async ({ config }) => ({ ...(config.mockOutput as Record<string, unknown> | undefined) }),
});

export async function runWorkflowNow(workflowId: string) {
  const detail = workflowService.getDetail(workflowId);

  if (!detail?.publishedVersion) {
    return null;
  }

  const result = await workflowExecutor.run(detail);

  mutateState((state) => {
    state.runs = [result.run, ...state.runs];
  });

  return workflowService.getDetail(workflowId);
}

workflowService.runNow = runWorkflowNow;

export async function POST(
  _request: Request,
  context: { params: Promise<{ workflowId: string }> },
) {
  const { workflowId } = await context.params;
  const detail = await workflowService.runNow(workflowId);
  return noStoreJson({ workflow: detail });
}
```

- [ ] **Step 6: Run the targeted tests and typecheck**

Run: `npm run test -- tests/workflow-runner.test.ts tests/workflow-graph.test.ts && npm run typecheck`

Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add /Users/sky/SkyProjects/opencrab/lib/workflows/workflow-executor.ts /Users/sky/SkyProjects/opencrab/lib/workflows/workflow-runner.ts /Users/sky/SkyProjects/opencrab/lib/runtime/runtime-startup.ts /Users/sky/SkyProjects/opencrab/lib/workflows/workflow-store.ts /Users/sky/SkyProjects/opencrab/lib/modules/workflows/workflow-service.ts /Users/sky/SkyProjects/opencrab/app/api/workflows/[workflowId]/run/route.ts /Users/sky/SkyProjects/opencrab/tests/workflow-runner.test.ts
git commit -m "feat: add workflow runtime execution"
```

### Task 6: Implement Review Center, retry/stale handling, and Pending Publish delivery

**Files:**
- Create: `/Users/sky/SkyProjects/opencrab/app/api/workflows/review-items/route.ts`
- Create: `/Users/sky/SkyProjects/opencrab/app/api/workflows/review-items/[reviewItemId]/route.ts`
- Create: `/Users/sky/SkyProjects/opencrab/app/(app)/workflows/review/page.tsx`
- Create: `/Users/sky/SkyProjects/opencrab/components/workflows/review-center-screen.tsx`
- Create: `/Users/sky/SkyProjects/opencrab/components/workflows/pending-publish-screen.tsx`
- Modify: `/Users/sky/SkyProjects/opencrab/lib/resources/opencrab-api-types.ts`
- Modify: `/Users/sky/SkyProjects/opencrab/lib/resources/opencrab-api.ts`
- Modify: `/Users/sky/SkyProjects/opencrab/lib/workflows/workflow-store.ts`
- Modify: `/Users/sky/SkyProjects/opencrab/lib/workflows/workflow-executor.ts`
- Modify: `/Users/sky/SkyProjects/opencrab/lib/modules/workflows/workflow-service.ts`
- Modify: `/Users/sky/SkyProjects/opencrab/components/workflows/workflow-detail-screen.tsx`
- Create: `/Users/sky/SkyProjects/opencrab/tests/workflow-review.test.ts`

- [ ] **Step 1: Write failing tests for review-item creation, retry, stale propagation, and pending-publish filtering**

```ts
import { describe, expect, it } from "vitest";
import {
  createReviewItemForFailedNode,
  markDownstreamNodeRunsStale,
  listWorkflowReviewItems,
} from "@/lib/workflows/workflow-store";

function makeReviewGraph() {
  return {
    nodes: [
      { id: "node-start", type: "start", name: "开始", position: { x: 0, y: 0 }, config: {} },
      { id: "node-script", type: "script", name: "脚本", position: { x: 200, y: 0 }, config: {} },
      { id: "node-end", type: "end", name: "结束", position: { x: 420, y: 0 }, config: {} },
    ],
    edges: [
      { id: "edge-1", source: "node-start", target: "node-script", condition: null, label: null },
      { id: "edge-2", source: "node-script", target: "node-end", condition: null, label: null },
    ],
    viewport: { x: 0, y: 0, zoom: 1 },
  };
}

describe("workflow-review", () => {
  it("creates a review item when a node fails", () => {
    const item = createReviewItemForFailedNode({
      workflowId: "workflow-1",
      runId: "run-1",
      nodeId: "node-script",
      reason: "脚本执行失败",
      surface: "general",
    });

    expect(item.status).toBe("open");
    expect(item.sourceNodeId).toBe("node-script");
  });

  it("marks downstream node runs stale when retrying the current node only", () => {
    const staleIds = markDownstreamNodeRunsStale({
      runId: "run-1",
      retriedNodeId: "node-script",
      graph: makeReviewGraph(),
    });

    expect(staleIds).toContain("node-end");
  });

  it("separates pending publish items from the general review queue", () => {
    const pendingPublish = listWorkflowReviewItems({ view: "pending_publish" });
    expect(pendingPublish.every((item) => item.surface === "pending_publish")).toBe(true);
  });
});
```

- [ ] **Step 2: Extend the store with unified review items and stale mutations**

```ts
export function createReviewItemForFailedNode(input: {
  workflowId: string;
  runId: string;
  nodeId: string;
  reason: string;
  surface: WorkflowReviewSurface;
}) {
  const item: WorkflowReviewItemRecord = {
    id: `workflow-review-${crypto.randomUUID()}`,
    workflowId: input.workflowId,
    runId: input.runId,
    sourceNodeId: input.nodeId,
    surface: input.surface,
    status: "open",
    summary: input.reason,
    threadPreview: input.reason,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  mutateState((state) => {
    state.reviewItems = [item, ...state.reviewItems];
  });

  return item;
}

export function markDownstreamNodeRunsStale(input: {
  runId: string;
  retriedNodeId: string;
  graph: WorkflowGraphRecord;
}) {
  const staleNodeIds = markDescendantsStale(input.graph, input.retriedNodeId);

  mutateState((state) => {
    state.nodeRuns = state.nodeRuns.map((nodeRun) =>
      nodeRun.runId === input.runId && staleNodeIds.includes(nodeRun.nodeId)
        ? { ...nodeRun, status: "stale" }
        : nodeRun,
    );
  });

  return staleNodeIds;
}

export function listWorkflowReviewItems(input: { view: "all" | "pending_publish" }) {
  const state = readState();

  return state.reviewItems.filter((item) =>
    input.view === "pending_publish"
      ? item.surface === "pending_publish" && item.status === "open"
      : item.status === "open",
  );
}
```

- [ ] **Step 3: Route failed nodes and `waiting_for_human` nodes into review items**

```ts
if (nodeResult.status === "failed") {
  createReviewItemForFailedNode({
    workflowId: detail.workflow.id,
    runId: run.id,
    nodeId: node.id,
    reason: nodeResult.errorMessage ?? "节点执行失败",
    surface: "general",
  });
}

if (nodeResult.status === "waiting_for_human") {
  createReviewItemForFailedNode({
    workflowId: detail.workflow.id,
    runId: run.id,
    nodeId: node.id,
    reason: nodeResult.waitReason ?? "等待人工处理",
    surface: "general",
  });
}
```

- [ ] **Step 4: Implement review-item actions for `retry current node` and `save to draft`**

```ts
export function reviewWorkflowItem(
  reviewItemId: string,
  input:
    | { action: "retry_current_node"; inputPatch?: Record<string, unknown> }
    | { action: "save_to_draft"; definitionPatch: Record<string, unknown> },
) {
  const item = readState().reviewItems.find((reviewItem) => reviewItem.id === reviewItemId);

  if (!item) {
    return null;
  }

  const run = readState().runs.find((runRecord) => runRecord.id === item.runId);
  const version = run
    ? readState().versions.find((versionRecord) => versionRecord.id === run.workflowVersionId)
    : null;

  if (!run || !version) {
    return null;
  }

  if (input.action === "retry_current_node") {
    const staleNodeRunIds = markDownstreamNodeRunsStale({
      runId: item.runId,
      retriedNodeId: item.sourceNodeId,
      graph: version.graph,
    });

    mutateState((state) => {
      state.nodeRuns = state.nodeRuns.map((nodeRun) =>
        nodeRun.runId === item.runId && nodeRun.nodeId === item.sourceNodeId
          ? {
              ...nodeRun,
              status: "pending",
              input: { ...nodeRun.input, ...(input.inputPatch ?? {}) },
              errorMessage: null,
              waitReason: null,
            }
          : nodeRun,
      );
      state.reviewItems = state.reviewItems.map((reviewItem) =>
        reviewItem.id === reviewItemId
          ? { ...reviewItem, status: "resolved", updatedAt: new Date().toISOString() }
          : reviewItem,
      );
    });

    return {
      reviewItemId,
      runId: item.runId,
      nodeId: item.sourceNodeId,
      staleNodeRunIds,
    };
  }

  if (input.action === "save_to_draft") {
    const draftVersion: WorkflowVersionRecord = {
      ...version,
      id: `workflow-version-${crypto.randomUUID()}`,
      status: "draft",
      publishedAt: null,
      versionNumber: version.versionNumber + 1,
      updatedAt: new Date().toISOString(),
      graph: {
        ...version.graph,
        nodes: version.graph.nodes.map((node) =>
          node.id === item.sourceNodeId
            ? { ...node, config: { ...node.config, ...input.definitionPatch } }
            : node,
        ),
      },
    });

    mutateState((state) => {
      state.versions = [draftVersion, ...state.versions];
    });

    return draftVersion;
  }
}
```

- [ ] **Step 5: Build the Review Center and Pending Publish screens**

```tsx
export function PendingPublishScreen({ items }: { items: WorkflowReviewItemRecord[] }) {
  return (
    <section className="space-y-4">
      {items.map((item) => (
        <article key={item.id} className="rounded-[24px] border border-line bg-surface p-5">
          <div className="text-[15px] font-semibold text-text">{item.summary}</div>
          <div className="mt-2 text-[13px] leading-6 text-muted-strong">进入发布前确认队列。</div>
        </article>
      ))}
    </section>
  );
}

export function ReviewCenterScreen({
  initialItems,
  view,
}: {
  initialItems: WorkflowReviewItemRecord[];
  view: "all" | "pending_publish";
}) {
  return view === "pending_publish" ? (
    <PendingPublishScreen items={initialItems} />
  ) : (
    <section className="space-y-4">
      {initialItems.map((item) => (
        <article key={item.id} className="rounded-[24px] border border-line bg-surface p-5">
          <div className="text-[15px] font-semibold text-text">{item.summary}</div>
          <div className="mt-3 text-[13px] leading-6 text-muted-strong">{item.threadPreview || item.summary}</div>
        </article>
      ))}
    </section>
  );
}
```

- [ ] **Step 6: Implement end-node delivery with primary plus mirrored destinations**

```ts
async function deliverWorkflowResult(input: {
  primary: WorkflowDeliveryDestination;
  mirrored: WorkflowDeliveryDestination[];
  payload: {
    workflowId: string;
    runId: string;
    summary: string;
    context: Record<string, unknown>;
  };
}) {
  const destinations = [input.primary, ...input.mirrored];

  for (const destination of destinations) {
    if (destination.kind === "pending_publish") {
      createReviewItemForFailedNode({
        workflowId: input.payload.workflowId,
        runId: input.payload.runId,
        nodeId: "node-end",
        reason: input.payload.summary,
        surface: "pending_publish",
      });
    }
  }
}

await deliverWorkflowResult({
  primary: endNode.config.primaryDestination as WorkflowDeliveryDestination,
  mirrored: (endNode.config.mirroredDestinations as WorkflowDeliveryDestination[]) ?? [],
  payload: {
    workflowId: run.workflowId,
    runId: run.id,
    summary: "待发布内容已生成",
    context,
  },
});
```

- [ ] **Step 7: Run the targeted tests and typecheck**

Run: `npm run test -- tests/workflow-review.test.ts tests/workflow-runner.test.ts && npm run typecheck`

Expected: PASS

- [ ] **Step 8: Commit**

```bash
git add /Users/sky/SkyProjects/opencrab/app/api/workflows/review-items/route.ts /Users/sky/SkyProjects/opencrab/app/api/workflows/review-items/[reviewItemId]/route.ts /Users/sky/SkyProjects/opencrab/app/(app)/workflows/review/page.tsx /Users/sky/SkyProjects/opencrab/components/workflows/review-center-screen.tsx /Users/sky/SkyProjects/opencrab/components/workflows/pending-publish-screen.tsx /Users/sky/SkyProjects/opencrab/lib/resources/opencrab-api-types.ts /Users/sky/SkyProjects/opencrab/lib/resources/opencrab-api.ts /Users/sky/SkyProjects/opencrab/lib/workflows/workflow-store.ts /Users/sky/SkyProjects/opencrab/lib/workflows/workflow-executor.ts /Users/sky/SkyProjects/opencrab/lib/modules/workflows/workflow-service.ts /Users/sky/SkyProjects/opencrab/components/workflows/workflow-detail-screen.tsx /Users/sky/SkyProjects/opencrab/tests/workflow-review.test.ts
git commit -m "feat: add workflow review center and delivery"
```

## Spec Coverage Check

- Workflow object, ownership, versions, and blank creation are covered by Tasks 1 and 2.
- Canvas authoring, hybrid inspector, blank/AI entry, and publish validation are covered by Tasks 3 and 4.
- Manual and scheduled execution, conditional edges, parallel fan-out, merge-all-upstream semantics, and version-pinned runs are covered by Task 5.
- Human intervention, retry-current-node behavior, stale downstream marking, `Review Center`, `Pending Publish`, and end-node delivery are covered by Task 6.
- V1 exclusions remain intact because no task introduces event triggers, loops, automatic retry, automatic publish, or new node types.
