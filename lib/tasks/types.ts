import type { ProjectRoomRecord } from "@/lib/projects/types";
import type { ConversationItem } from "@/lib/seed-data";

export type TaskSchedulePreset = "daily" | "weekdays" | "weekly" | "interval";

export type TaskStatus = "active" | "paused";

export type TaskRunStatus = "running" | "success" | "error";

export type TaskSchedule = {
  preset: TaskSchedulePreset;
  time?: string | null;
  weekday?: number | null;
  intervalMinutes?: number | null;
  intervalHours?: number | null;
};

export type TaskRecord = {
  id: string;
  name: string;
  prompt: string;
  schedule: TaskSchedule;
  status: TaskStatus;
  isRunning: boolean;
  timezone: string | null;
  conversationId: string | null;
  projectId: string | null;
  nextRunAt: string | null;
  lastRunAt: string | null;
  lastRunStatus: TaskRunStatus | null;
  lastRunPreview: string | null;
  lastError: string | null;
  createdAt: string;
  updatedAt: string;
};

export type TaskRunRecord = {
  id: string;
  taskId: string;
  status: TaskRunStatus;
  startedAt: string;
  finishedAt: string | null;
  summary: string | null;
  errorMessage: string | null;
  conversationId: string | null;
  projectId: string | null;
};

export type TaskStoreState = {
  tasks: TaskRecord[];
  runs: TaskRunRecord[];
};

export type TaskOverview = TaskRecord & {
  scheduleLabel: string;
  nextRunLabel: string;
  lastRunLabel: string;
  runCount: number;
};

export type TaskDetail = TaskOverview & {
  conversation: ConversationItem | null;
  project: ProjectRoomRecord | null;
  runs: TaskRunRecord[];
};

export type TaskCreateInput = {
  name: string;
  prompt: string;
  timezone?: string | null;
  schedule: TaskSchedule;
  conversationId?: string | null;
  projectId?: string | null;
};

export type TaskUpdateInput = Partial<TaskCreateInput> & {
  status?: TaskStatus;
};
