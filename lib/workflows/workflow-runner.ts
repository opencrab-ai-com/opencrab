import { logServerError } from "@/lib/server/observability";
import { OpenCrabError } from "@/lib/shared/errors/opencrab-error";
import type { WorkflowDetail, WorkflowRunRecord, WorkflowSchedule } from "@/lib/workflows/types";
import { createWorkflowExecutor, workflowExecutor } from "@/lib/workflows/workflow-executor";
import {
  getWorkflow,
  listWorkflowNodeRuns,
  listWorkflowRuns,
  listWorkflows,
  recordWorkflowNodeRun,
  recordWorkflowRun,
  updateWorkflowRun,
} from "@/lib/workflows/workflow-store";

const RUNNER_COOLDOWN_MS = 20_000;

declare global {
  var __opencrabWorkflowRunnerPromise: Promise<void> | undefined;
  var __opencrabWorkflowRunnerTimer: ReturnType<typeof setTimeout> | undefined;
  var __opencrabWorkflowRunnerLastRunAt: number | undefined;
  var __opencrabWorkflowExecutionPromises: Map<string, Promise<void>> | undefined;
  var __opencrabWorkflowRunPromises: Map<string, Promise<void>> | undefined;
}

type WorkflowRunnerDependencies = {
  repository?: {
    listWorkflows: typeof listWorkflows;
    getWorkflow: typeof getWorkflow;
    listWorkflowRuns: typeof listWorkflowRuns;
    listWorkflowNodeRuns: typeof listWorkflowNodeRuns;
    recordWorkflowRun: typeof recordWorkflowRun;
    updateWorkflowRun: typeof updateWorkflowRun;
    recordWorkflowNodeRun: typeof recordWorkflowNodeRun;
  };
  executor?: ReturnType<typeof createWorkflowExecutor>;
};

export function createWorkflowRunner(dependencies: WorkflowRunnerDependencies = {}) {
  const repository = dependencies.repository ?? localWorkflowRepository;
  const executor = dependencies.executor ?? workflowExecutor;

  async function runWorkflowNow(
    workflowId: string,
    options: { waitForCompletion?: boolean; initiatedBy?: string } = {},
  ) {
    const detail = repository.getWorkflow(workflowId);

    if (!detail) {
      throw new OpenCrabError("工作流不存在。", {
        statusCode: 404,
        code: "not_found",
      });
    }

    const version = getLatestPublishedVersion(detail);

    if (!version) {
      throw new OpenCrabError("请先发布工作流草稿，再运行当前工作流。", {
        statusCode: 409,
        code: "bad_request",
      });
    }

    const manualStartNodeIds = version.graph.nodes
      .filter((node) => node.type === "start" && node.config.trigger === "manual")
      .map((node) => node.id)
      .sort((left, right) => left.localeCompare(right));

    if (manualStartNodeIds.length === 0) {
      throw new OpenCrabError("当前发布版本没有可手动触发的开始节点。", {
        statusCode: 400,
        code: "bad_request",
      });
    }

    const run = startWorkflowRun(detail, version, {
      trigger: "manual",
      triggerStartNodeIds: manualStartNodeIds,
      initiatedBy: options.initiatedBy ?? "user",
    });

    if (options.waitForCompletion) {
      await waitForRun(run.id);
    }

    return {
      detail,
      run: {
        id: run.id,
        workflowId: run.workflowId,
        status: "accepted" as const,
        startedAt: run.startedAt,
        message: "工作流已开始运行当前发布版本。",
      },
    };
  }

  async function runDueWorkflows(
    reference = new Date(),
    options: { waitForCompletion?: boolean } = {},
  ) {
    const triggeredRunIds: string[] = [];

    for (const workflow of repository.listWorkflows()) {
      const detail = repository.getWorkflow(workflow.id);

      if (!detail || detail.workflow.status !== "active") {
        continue;
      }

      const version = getLatestPublishedVersion(detail);

      if (!version) {
        continue;
      }

      const dueStartNodeIds = resolveDueScheduledStartNodeIds(detail, reference, repository.listWorkflowRuns(workflow.id));

      if (dueStartNodeIds.length === 0) {
        continue;
      }

      let run;

      try {
        run = startWorkflowRun(detail, version, {
          trigger: "schedule",
          triggerStartNodeIds: dueStartNodeIds,
          initiatedBy: "scheduler",
        });
      } catch (error) {
        if (isWorkflowAlreadyRunningError(error)) {
          continue;
        }

        throw error;
      }

      triggeredRunIds.push(run.id);

      if (options.waitForCompletion) {
        await waitForRun(run.id);
      }
    }

    return triggeredRunIds;
  }

  function startWorkflowRun(
    detail: WorkflowDetail,
    version: NonNullable<ReturnType<typeof getLatestPublishedVersion>>,
    input: {
      trigger: WorkflowRunRecord["trigger"];
      triggerStartNodeIds: string[];
      initiatedBy: string;
    },
  ) {
    if (getRunningWorkflowMap().has(detail.workflow.id)) {
      throw new OpenCrabError("当前工作流已有运行中的执行，请等待本轮结束后再重试。", {
        statusCode: 409,
        code: "bad_request",
      });
    }

    const startedAt = new Date().toISOString();
    const run = repository.recordWorkflowRun({
      workflowId: detail.workflow.id,
      workflowVersionId: version.id,
      workflowVersionNumber: version.versionNumber,
      trigger: input.trigger,
      triggerStartNodeIds: input.triggerStartNodeIds,
      initiatedBy: input.initiatedBy,
      startedAt,
    });
    const task = executeWorkflowRun(detail, version, run).finally(() => {
      getRunningWorkflowMap().delete(detail.workflow.id);
      getRunningRunMap().delete(run.id);
    });

    void task.catch((error) => {
      logServerError({
        event: "workflow_run_failed",
        message: error instanceof Error ? error.message : "工作流执行失败。",
      });
    });

    getRunningWorkflowMap().set(detail.workflow.id, task);
    getRunningRunMap().set(run.id, task);

    return run;
  }

  async function executeWorkflowRun(
    detail: WorkflowDetail,
    version: NonNullable<ReturnType<typeof getLatestPublishedVersion>>,
    run: WorkflowRunRecord,
  ) {
    try {
      const result = await executor.executeRun({
        workflow: detail.workflow,
        version,
        run,
        triggerStartNodeIds: run.triggerStartNodeIds,
        initialContext: {
          workflowId: detail.workflow.id,
          workflowVersionId: version.id,
          workflowVersionNumber: version.versionNumber,
          trigger: run.trigger,
        },
        observer: {
          onNodeCompleted: async ({ node, inputSnapshot, outputSnapshot, startedAt, completedAt }) => {
            repository.recordWorkflowNodeRun({
              runId: run.id,
              workflowId: run.workflowId,
              workflowVersionId: run.workflowVersionId,
              nodeId: node.id,
              status: "success",
              attemptCount: 1,
              inputSnapshot,
              outputSnapshot,
              startedAt,
              completedAt,
            });
          },
          onNodeFailed: async ({ node, inputSnapshot, startedAt, completedAt, errorMessage }) => {
            repository.recordWorkflowNodeRun({
              runId: run.id,
              workflowId: run.workflowId,
              workflowVersionId: run.workflowVersionId,
              nodeId: node.id,
              status: "error",
              attemptCount: 1,
              inputSnapshot,
              outputSnapshot: null,
              startedAt,
              completedAt,
              errorMessage,
            });
          },
        },
      });

      repository.updateWorkflowRun(run.id, {
        status: "success",
        completedAt: new Date().toISOString(),
        summary: buildRunSummary(result.reachedEndNodeIds.length, result.completedNodeIds.length),
        errorMessage: null,
      });
    } catch (error) {
      repository.updateWorkflowRun(run.id, {
        status: "error",
        completedAt: new Date().toISOString(),
        errorMessage: error instanceof Error ? error.message : "工作流执行失败。",
        summary: null,
      });
      throw error;
    }
  }

  function waitForRun(runId: string) {
    return getRunningRunMap().get(runId) ?? Promise.resolve();
  }

  return {
    runWorkflowNow,
    runDueWorkflows,
    waitForRun,
  };
}

const localWorkflowRepository = {
  listWorkflows,
  getWorkflow,
  listWorkflowRuns,
  listWorkflowNodeRuns,
  recordWorkflowRun,
  updateWorkflowRun,
  recordWorkflowNodeRun,
};

export const workflowRunner = createWorkflowRunner();

export function ensureWorkflowRunner() {
  scheduleNextWorkflowRunnerCycle();

  if (globalThis.__opencrabWorkflowRunnerPromise) {
    return globalThis.__opencrabWorkflowRunnerPromise;
  }

  const lastRunAt = globalThis.__opencrabWorkflowRunnerLastRunAt ?? 0;

  if (Date.now() - lastRunAt < RUNNER_COOLDOWN_MS) {
    return Promise.resolve();
  }

  return runWorkflowRunnerCycle();
}

export function runWorkflowNow(
  workflowId: string,
  options: { waitForCompletion?: boolean; initiatedBy?: string } = {},
) {
  return workflowRunner.runWorkflowNow(workflowId, options);
}

function resolveDueScheduledStartNodeIds(
  detail: WorkflowDetail,
  reference: Date,
  runs: WorkflowRunRecord[],
) {
  const version = getLatestPublishedVersion(detail);

  if (!version) {
    return [];
  }

  return version.graph.nodes
    .filter(
      (node): node is Extract<typeof version.graph.nodes[number], { type: "start" }> =>
        node.type === "start" &&
        node.config.trigger === "schedule" &&
        Boolean(node.config.schedule),
    )
    .filter((node) => {
      if (runs.some((run) => run.status === "running" && run.triggerStartNodeIds.includes(node.id))) {
        return false;
      }

      const lastRun = runs
        .filter((run) => run.trigger === "schedule" && run.triggerStartNodeIds.includes(node.id))
        .sort((left, right) => Date.parse(right.startedAt) - Date.parse(left.startedAt))[0];
      const baseline = lastRun
        ? new Date(lastRun.startedAt)
        : new Date(version.publishedAt || version.createdAt);
      const nextRunAt = calculateNextScheduledRunAt(
        node.config.schedule as WorkflowSchedule,
        baseline,
        version.graph.defaults.timezone,
      );

      return Date.parse(nextRunAt) <= reference.getTime();
    })
    .map((node) => node.id)
    .sort((left, right) => left.localeCompare(right));
}

function getLatestPublishedVersion(detail: WorkflowDetail) {
  return detail.versions
    .filter((version) => version.status === "published")
    .sort((left, right) => right.versionNumber - left.versionNumber)[0] ?? null;
}

function calculateNextScheduledRunAt(
  schedule: WorkflowSchedule,
  reference: Date,
  timeZone: string | null,
) {
  if (schedule.preset === "interval") {
    return new Date(reference.getTime() + (getIntervalMinutes(schedule) || 5) * 60_000).toISOString();
  }

  const [hour, minute] = (schedule.time || "09:00").split(":").map((part) => Number(part));

  if (schedule.preset === "daily") {
    return findNextScheduledWallClockTime(
      {
        reference,
        timeZone,
        hour: hour || 0,
        minute: minute || 0,
      },
      () => true,
    ).toISOString();
  }

  if (schedule.preset === "weekdays") {
    return findNextScheduledWallClockTime(
      {
        reference,
        timeZone,
        hour: hour || 0,
        minute: minute || 0,
      },
      (weekday) => weekday !== 0 && weekday !== 6,
    ).toISOString();
  }

  const targetWeekday = clampWeekday(schedule.weekday ?? 1);

  return findNextScheduledWallClockTime(
    {
      reference,
      timeZone,
      hour: hour || 0,
      minute: minute || 0,
    },
    (weekday) => weekday === targetWeekday,
  ).toISOString();
}

function getIntervalMinutes(schedule: WorkflowSchedule) {
  if (typeof schedule.intervalMinutes === "number" && Number.isFinite(schedule.intervalMinutes)) {
    return schedule.intervalMinutes;
  }

  if (typeof schedule.intervalHours === "number" && Number.isFinite(schedule.intervalHours)) {
    return schedule.intervalHours * 60;
  }

  return null;
}

function clampWeekday(value: number) {
  return Math.max(0, Math.min(6, Math.round(value)));
}

function buildRunSummary(reachedEndCount: number, completedNodeCount: number) {
  if (reachedEndCount > 0) {
    return `工作流已完成，共执行 ${completedNodeCount} 个节点。`;
  }

  return `工作流已结束，本次共执行 ${completedNodeCount} 个节点。`;
}

function runWorkflowRunnerCycle(reference = new Date()) {
  if (globalThis.__opencrabWorkflowRunnerPromise) {
    return globalThis.__opencrabWorkflowRunnerPromise;
  }

  const task = workflowRunner
    .runDueWorkflows(reference)
    .catch((error) => {
      logServerError({
        event: "workflow_runner_cycle_failed",
        message: error instanceof Error ? error.message : "工作流执行周期失败。",
      });
      return undefined;
    })
    .finally(() => {
      globalThis.__opencrabWorkflowRunnerPromise = undefined;
      globalThis.__opencrabWorkflowRunnerLastRunAt = Date.now();
    });

  globalThis.__opencrabWorkflowRunnerPromise = task.then(() => undefined);
  return globalThis.__opencrabWorkflowRunnerPromise;
}

function scheduleNextWorkflowRunnerCycle() {
  if (globalThis.__opencrabWorkflowRunnerTimer) {
    return;
  }

  const timer = setTimeout(() => {
    globalThis.__opencrabWorkflowRunnerTimer = undefined;

    void runWorkflowRunnerCycle().finally(() => {
      scheduleNextWorkflowRunnerCycle();
    });
  }, RUNNER_COOLDOWN_MS);

  timer.unref?.();
  globalThis.__opencrabWorkflowRunnerTimer = timer;
}

function isWorkflowAlreadyRunningError(error: unknown) {
  return error instanceof OpenCrabError && error.statusCode === 409 && error.code === "bad_request";
}

function findNextScheduledWallClockTime(
  input: {
    reference: Date;
    timeZone: string | null;
    hour: number;
    minute: number;
  },
  matchesWeekday: (weekday: number) => boolean,
) {
  const referenceParts = getTimeZoneDateParts(input.reference, input.timeZone);

  for (let offset = 0; offset < 14; offset += 1) {
    const dateParts = addCalendarDays(referenceParts, offset);
    const candidate = zonedPartsToDate(
      {
        ...dateParts,
        hour: input.hour,
        minute: input.minute,
        second: 0,
      },
      input.timeZone,
    );
    const candidateWeekday = getTimeZoneDateParts(candidate, input.timeZone).weekday;

    if (!matchesWeekday(candidateWeekday)) {
      continue;
    }

    if (candidate > input.reference) {
      return candidate;
    }
  }

  const fallbackDateParts = addCalendarDays(referenceParts, 14);

  return zonedPartsToDate(
    {
      ...fallbackDateParts,
      hour: input.hour,
      minute: input.minute,
      second: 0,
    },
    input.timeZone,
  );
}

function getTimeZoneDateParts(date: Date, timeZone: string | null) {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: timeZone || undefined,
    weekday: "short",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  });
  const parts = Object.fromEntries(
    formatter
      .formatToParts(date)
      .filter((part) => part.type !== "literal")
      .map((part) => [part.type, part.value]),
  ) as Record<string, string>;

  return {
    year: Number(parts.year),
    month: Number(parts.month),
    day: Number(parts.day),
    hour: Number(parts.hour),
    minute: Number(parts.minute),
    second: Number(parts.second),
    weekday: shortWeekdayToNumber(parts.weekday),
  };
}

function addCalendarDays(
  dateParts: {
    year: number;
    month: number;
    day: number;
  },
  offset: number,
) {
  const shifted = new Date(Date.UTC(dateParts.year, dateParts.month - 1, dateParts.day + offset, 12, 0, 0));

  return {
    year: shifted.getUTCFullYear(),
    month: shifted.getUTCMonth() + 1,
    day: shifted.getUTCDate(),
  };
}

function zonedPartsToDate(
  dateParts: {
    year: number;
    month: number;
    day: number;
    hour: number;
    minute: number;
    second: number;
  },
  timeZone: string | null,
) {
  const utcGuess = Date.UTC(
    dateParts.year,
    dateParts.month - 1,
    dateParts.day,
    dateParts.hour,
    dateParts.minute,
    dateParts.second,
  );
  let candidate = new Date(utcGuess);
  let offset = getTimeZoneOffsetMillis(candidate, timeZone);
  candidate = new Date(utcGuess - offset);
  const adjustedOffset = getTimeZoneOffsetMillis(candidate, timeZone);

  if (adjustedOffset !== offset) {
    offset = adjustedOffset;
    candidate = new Date(utcGuess - offset);
  }

  return candidate;
}

function getTimeZoneOffsetMillis(date: Date, timeZone: string | null) {
  if (!timeZone) {
    return -date.getTimezoneOffset() * 60_000;
  }

  const parts = getTimeZoneDateParts(date, timeZone);
  const localizedTimestamp = Date.UTC(
    parts.year,
    parts.month - 1,
    parts.day,
    parts.hour,
    parts.minute,
    parts.second,
  );

  return localizedTimestamp - date.getTime();
}

function shortWeekdayToNumber(value: string) {
  switch (value) {
    case "Sun":
      return 0;
    case "Mon":
      return 1;
    case "Tue":
      return 2;
    case "Wed":
      return 3;
    case "Thu":
      return 4;
    case "Fri":
      return 5;
    default:
      return 6;
  }
}

function getRunningWorkflowMap() {
  if (!globalThis.__opencrabWorkflowExecutionPromises) {
    globalThis.__opencrabWorkflowExecutionPromises = new Map();
  }

  return globalThis.__opencrabWorkflowExecutionPromises;
}

function getRunningRunMap() {
  if (!globalThis.__opencrabWorkflowRunPromises) {
    globalThis.__opencrabWorkflowRunPromises = new Map();
  }

  return globalThis.__opencrabWorkflowRunPromises;
}
