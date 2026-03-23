import { describe, expect, it, vi } from "vitest";
import { createTaskService } from "@/lib/modules/tasks/task-service";
import type {
  TaskCreateInput,
  TaskDetail,
  TaskOverview,
  TaskUpdateInput,
} from "@/lib/tasks/types";

function createTaskOverview(overrides: Partial<TaskOverview> = {}): TaskOverview {
  return {
    id: "task-1",
    name: "Daily sync",
    prompt: "Write a summary",
    schedule: { preset: "daily", time: "09:00" },
    status: "active",
    isRunning: false,
    timezone: "Asia/Shanghai",
    conversationId: null,
    projectId: null,
    nextRunAt: "2026-03-23T01:00:00.000Z",
    lastRunAt: null,
    lastRunStatus: null,
    lastRunPreview: null,
    lastError: null,
    createdAt: "2026-03-23T00:00:00.000Z",
    updatedAt: "2026-03-23T00:00:00.000Z",
    scheduleLabel: "每天 09:00",
    nextRunLabel: "1 小时后",
    lastRunLabel: "还没有执行过",
    runCount: 0,
    ...overrides,
  };
}

function createTaskDetail(overrides: Partial<TaskDetail> = {}): TaskDetail {
  return {
    ...createTaskOverview(),
    conversation: null,
    project: null,
    runs: [],
    ...overrides,
  };
}

describe("taskService", () => {
  it("delegates task list, create, read, update, delete, and run actions", () => {
    const taskDetail = createTaskDetail();
    const taskOverview = createTaskOverview();
    const createInput: TaskCreateInput = {
      name: "Daily sync",
      prompt: "Write a summary",
      schedule: { preset: "daily", time: "09:00" },
    };
    const updateInput: TaskUpdateInput = {
      status: "paused",
    };
    const repository = {
      listTasks: vi.fn(() => [taskOverview]),
      getTask: vi.fn(() => taskDetail),
      createTask: vi.fn(() => taskDetail),
      updateTask: vi.fn(() => taskOverview),
      deleteTask: vi.fn(),
      runTaskNow: vi.fn(() => taskDetail),
    };
    const service = createTaskService({ repository });

    expect(service.list()).toEqual([taskOverview]);
    expect(service.get("task-1")).toEqual(taskDetail);
    expect(service.create(createInput)).toEqual(taskDetail);
    expect(service.update("task-1", updateInput)).toEqual(taskOverview);
    expect(service.remove("task-1")).toEqual({ ok: true });
    expect(service.runNow("task-1")).toEqual(taskDetail);
    expect(repository.deleteTask).toHaveBeenCalledWith("task-1");
  });
});
