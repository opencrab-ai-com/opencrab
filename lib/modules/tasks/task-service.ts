import { runTaskNow } from "@/lib/tasks/task-runner";
import {
  createTask,
  deleteTask,
  getTask,
  listTasks,
  updateTask,
} from "@/lib/tasks/task-store";
import type {
  TaskCreateInput,
  TaskDetail,
  TaskOverview,
  TaskUpdateInput,
} from "@/lib/tasks/types";

export type TaskRepository = {
  listTasks: () => TaskOverview[];
  getTask: (taskId: string) => TaskDetail | null;
  createTask: (input: TaskCreateInput) => TaskDetail | null;
  updateTask: (taskId: string, patch: TaskUpdateInput) => TaskOverview | null;
  deleteTask: (taskId: string) => void;
  runTaskNow: (taskId: string) => TaskDetail | null;
};

type TaskServiceDependencies = {
  repository?: TaskRepository;
};

export function createTaskService(dependencies: TaskServiceDependencies = {}) {
  const repository = dependencies.repository ?? localTaskRepository;

  return {
    list() {
      return repository.listTasks();
    },
    get(taskId: string) {
      return repository.getTask(taskId);
    },
    create(input: TaskCreateInput) {
      return repository.createTask(input);
    },
    update(taskId: string, patch: TaskUpdateInput) {
      return repository.updateTask(taskId, patch);
    },
    remove(taskId: string) {
      repository.deleteTask(taskId);
      return { ok: true as const };
    },
    runNow(taskId: string) {
      return repository.runTaskNow(taskId);
    },
  };
}

const localTaskRepository: TaskRepository = {
  listTasks,
  getTask,
  createTask,
  updateTask,
  deleteTask,
  runTaskNow,
};

export const taskService = createTaskService();
