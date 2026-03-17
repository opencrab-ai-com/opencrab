import type {
  AppSnapshot,
  BrowserConnectionMode,
  CodexBrowserSessionStatus,
  CodexOptionsResponse,
  CodexReasoningEffort,
  CodexSandboxMode,
  CodexStatusResponse,
  CreateConversationResult,
  ReplyStreamEvent,
  SkillAction,
  SkillDetailResponse,
  SkillsCatalogResponse,
  SnapshotMutationResult,
  TaskDetailResponse,
  TaskListResponse,
  TaskSchedule,
  TaskStatus,
  UploadedAttachment,
} from "@/lib/resources/opencrab-api-types";
import type { ConversationMessage } from "@/lib/seed-data";

export async function getAppSnapshot() {
  return request<AppSnapshot>("/api/bootstrap", {
    method: "GET",
  });
}

export async function getCodexOptions() {
  return request<CodexOptionsResponse>("/api/codex/options", {
    method: "GET",
  });
}

export async function getCodexStatus() {
  const response = await fetch("/api/codex/status", {
    method: "GET",
  });

  try {
    return (await response.json()) as CodexStatusResponse;
  } catch {
    return {
      ok: false,
      error: "当前无法读取 OpenCrab 的运行状态，请稍后重试。",
      loginStatus: "missing",
      loginMethod: "chatgpt",
    } satisfies CodexStatusResponse;
  }
}

export async function getCodexBrowserSessionStatus() {
  return request<CodexBrowserSessionStatus>("/api/codex/browser-session", {
    method: "GET",
  });
}

export async function getSkillsCatalog() {
  return request<SkillsCatalogResponse>("/api/skills", {
    method: "GET",
  });
}

export async function getSkillDetail(skillId: string) {
  return request<SkillDetailResponse>(`/api/skills/${skillId}`, {
    method: "GET",
  });
}

export async function createSkill(input: {
  name: string;
  summary: string;
  detailsMarkdown?: string;
}) {
  return request<SkillDetailResponse>("/api/skills", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export async function mutateSkill(skillId: string, action: SkillAction) {
  return request<SkillDetailResponse>(`/api/skills/${skillId}`, {
    method: "PATCH",
    body: JSON.stringify({ action }),
  });
}

export async function getTasks() {
  return request<TaskListResponse>("/api/tasks", {
    method: "GET",
  });
}

export async function getTaskDetail(taskId: string) {
  return request<TaskDetailResponse>(`/api/tasks/${taskId}`, {
    method: "GET",
  });
}

export async function createTask(input: {
  name: string;
  prompt: string;
  timezone?: string | null;
  schedule: TaskSchedule;
}) {
  return request<TaskDetailResponse>("/api/tasks", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export async function updateTask(
  taskId: string,
  patch: Partial<{
    name: string;
    prompt: string;
    timezone: string | null;
    schedule: TaskSchedule;
    status: TaskStatus;
  }>,
) {
  return request<TaskDetailResponse>(`/api/tasks/${taskId}`, {
    method: "PATCH",
    body: JSON.stringify(patch),
  });
}

export async function deleteTask(taskId: string) {
  return request<{ ok: boolean }>(`/api/tasks/${taskId}`, {
    method: "DELETE",
  });
}

export async function runTask(taskId: string) {
  return request<TaskDetailResponse>(`/api/tasks/${taskId}/run`, {
    method: "POST",
  });
}

export async function warmCodexBrowserSession() {
  return request<CodexBrowserSessionStatus>("/api/codex/browser-session", {
    method: "POST",
  });
}

export async function updateSettings(
  patch: Partial<{
    defaultModel: string;
    defaultReasoningEffort: CodexReasoningEffort;
    defaultSandboxMode: CodexSandboxMode;
    browserConnectionMode: BrowserConnectionMode;
  }>,
) {
  return request<SnapshotMutationResult>("/api/settings", {
    method: "PATCH",
    body: JSON.stringify(patch),
  });
}

export async function createFolder(name: string) {
  return request<SnapshotMutationResult>("/api/folders", {
    method: "POST",
    body: JSON.stringify({ name }),
  });
}

export async function deleteFolder(folderId: string) {
  return request<SnapshotMutationResult>(`/api/folders/${folderId}`, {
    method: "DELETE",
  });
}

export async function updateFolder(folderId: string, name: string) {
  return request<SnapshotMutationResult>(`/api/folders/${folderId}`, {
    method: "PATCH",
    body: JSON.stringify({ name }),
  });
}

export async function createConversation(input?: { title?: string; folderId?: string | null }) {
  return request<CreateConversationResult>("/api/conversations", {
    method: "POST",
    body: JSON.stringify(input ?? {}),
  });
}

export async function updateConversation(
  conversationId: string,
  patch: Partial<{
    title: string;
    preview: string;
    timeLabel: string;
    folderId: string | null;
    codexThreadId: string | null;
    lastAssistantModel: string | null;
  }>,
) {
  return request<SnapshotMutationResult>(`/api/conversations/${conversationId}`, {
    method: "PATCH",
    body: JSON.stringify(patch),
  });
}

export async function deleteConversation(conversationId: string) {
  return request<SnapshotMutationResult>(`/api/conversations/${conversationId}`, {
    method: "DELETE",
  });
}

export async function addConversationMessage(
  conversationId: string,
  message: Omit<ConversationMessage, "id">,
) {
  return request<SnapshotMutationResult & { message: ConversationMessage }>(
    `/api/conversations/${conversationId}/messages`,
    {
      method: "POST",
      body: JSON.stringify(message),
    },
  );
}

export async function uploadAttachments(files: File[]) {
  const formData = new FormData();

  files.forEach((file) => {
    formData.append("files", file);
  });

  return request<{ attachments: UploadedAttachment[] }>("/api/uploads", {
    method: "POST",
    body: formData,
    headers: {},
  });
}

export async function replyToConversation(
  conversationId: string,
  input: {
    content?: string;
    model: string;
    reasoningEffort: CodexReasoningEffort;
    attachmentIds?: string[];
    sandboxMode?: CodexSandboxMode;
  },
) {
  return request<
    SnapshotMutationResult & {
      assistant: {
        text: string;
        model: string;
        threadId: string | null;
        usage: {
          input_tokens: number;
          cached_input_tokens: number;
          output_tokens: number;
        } | null;
      };
    }
  >(`/api/conversations/${conversationId}/reply`, {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export async function streamReplyToConversation(
  conversationId: string,
  input: {
    content?: string;
    model: string;
    reasoningEffort: CodexReasoningEffort;
    attachmentIds?: string[];
    userMessageId: string;
    assistantMessageId: string;
    sandboxMode: CodexSandboxMode;
  },
  options: {
    signal?: AbortSignal;
    onEvent: (event: ReplyStreamEvent) => void;
  },
) {
  const response = await fetch(`/api/conversations/${conversationId}/reply/stream`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(input),
    signal: options.signal,
  });

  if (!response.ok) {
    try {
      const error = (await response.json()) as { error?: string };
      throw new Error(error.error || `API request failed: ${response.status}`);
    } catch (error) {
      if (error instanceof Error) {
        throw error;
      }

      throw new Error(`API request failed: ${response.status}`);
    }
  }

  if (!response.body) {
    throw new Error("流式响应不可用，请稍后再试。");
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();

    if (done) {
      break;
    }

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() || "";

    for (const line of lines) {
      const trimmedLine = line.trim();

      if (!trimmedLine) {
        continue;
      }

      options.onEvent(JSON.parse(trimmedLine) as ReplyStreamEvent);
    }
  }

  const lastLine = buffer.trim();

  if (lastLine) {
    options.onEvent(JSON.parse(lastLine) as ReplyStreamEvent);
  }
}

async function request<T>(input: string, init: RequestInit) {
  const isFormData = typeof FormData !== "undefined" && init.body instanceof FormData;
  const headers = isFormData
    ? { ...(init.headers ?? {}) }
    : {
        "Content-Type": "application/json",
        ...(init.headers ?? {}),
      };

  const response = await fetch(input, {
    ...init,
    headers,
  });

  if (!response.ok) {
    try {
      const error = (await response.json()) as { error?: string };
      throw new Error(error.error || `API request failed: ${response.status}`);
    } catch (error) {
      if (error instanceof Error) {
        throw error;
      }

      throw new Error(`API request failed: ${response.status}`);
    }
  }

  return (await response.json()) as T;
}
