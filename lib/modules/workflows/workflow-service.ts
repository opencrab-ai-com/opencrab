import {
  createWorkflow,
  getWorkflow,
  listWorkflowReviewItems,
  listWorkflows,
  publishWorkflow,
  reviewWorkflowItem,
  saveWorkflowDraft,
} from "@/lib/workflows/workflow-store";
import { runWorkflowNow } from "@/lib/workflows/workflow-runner";
import type {
  WorkflowCreateInput,
  WorkflowDetail,
  WorkflowGraph,
  WorkflowRecord,
  WorkflowReviewView,
} from "@/lib/workflows/types";

export type WorkflowCreateDraftInput = WorkflowCreateInput & {
  graph?: WorkflowGraph | null;
};

export type WorkflowReviewActionInput =
  | {
      action: "retry_current_node";
      inputPatch?: Record<string, unknown>;
    }
  | {
      action: "save_to_draft";
      definitionPatch: Record<string, unknown>;
    };

export type WorkflowSaveDraftInput = {
  versionId: string;
  graph: WorkflowGraph;
};

export type WorkflowRepository = {
  listWorkflows: () => WorkflowRecord[];
  getWorkflow: (workflowId: string) => WorkflowDetail | null;
  listWorkflowReviewItems: typeof listWorkflowReviewItems;
  createWorkflow: (input: WorkflowCreateDraftInput) => WorkflowDetail;
  publishWorkflow: (
    workflowId: string,
    input?: { graph?: WorkflowGraph | null },
  ) => WorkflowDetail | null;
  saveWorkflowDraft: (
    input: WorkflowSaveDraftInput & { workflowId: string },
  ) => WorkflowDetail | null;
  reviewWorkflowItem: typeof reviewWorkflowItem;
  runWorkflowNow: (
    workflowId: string,
    options?: { waitForCompletion?: boolean; initiatedBy?: string },
  ) => Promise<{
    detail: WorkflowDetail;
    run: {
      id: string;
      workflowId: string;
      status: "accepted";
      startedAt: string;
      message: string;
    };
  }>;
};

type WorkflowServiceDependencies = {
  repository?: WorkflowRepository;
};

export function createWorkflowService(dependencies: WorkflowServiceDependencies = {}) {
  const repository = dependencies.repository ?? localWorkflowRepository;

  return {
    list() {
      return repository.listWorkflows();
    },
    get(workflowId: string) {
      return repository.getWorkflow(workflowId);
    },
    create(input: WorkflowCreateDraftInput) {
      return repository.createWorkflow(input);
    },
    publish(workflowId: string, input?: { graph?: WorkflowGraph | null }) {
      return repository.publishWorkflow(workflowId, input);
    },
    saveDraft(workflowId: string, input: WorkflowSaveDraftInput) {
      return repository.saveWorkflowDraft({
        workflowId,
        versionId: input.versionId,
        graph: input.graph,
      });
    },
    runNow(workflowId: string, options?: { waitForCompletion?: boolean; initiatedBy?: string }) {
      return repository.runWorkflowNow(workflowId, options);
    },
    listReviewItems(view: WorkflowReviewView) {
      return repository.listWorkflowReviewItems({ view });
    },
    reviewItem(reviewItemId: string, input: WorkflowReviewActionInput) {
      return repository.reviewWorkflowItem(reviewItemId, input);
    },
  };
}

const localWorkflowRepository: WorkflowRepository = {
  listWorkflows,
  getWorkflow,
  listWorkflowReviewItems,
  createWorkflow,
  publishWorkflow,
  saveWorkflowDraft,
  reviewWorkflowItem,
  runWorkflowNow,
};

export const workflowService = createWorkflowService();
