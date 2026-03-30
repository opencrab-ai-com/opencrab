import type {
  AppSnapshot,
  BrowserConnectionMode,
  ChatGptConnectionStatusResponse,
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
  RuntimeReadinessResponse,
  TaskDetailResponse,
  TaskListResponse,
  TaskSchedule,
  TaskStatus,
  UploadedAttachment,
} from "@/lib/resources/opencrab-api-types";
import type {
  AgentProfileDetailResponse,
  AgentProfileListResponse,
} from "@/lib/agents/types";
import type { ProjectDetailResponse, ProjectListResponse } from "@/lib/projects/types";
import type { AppLanguage, ConversationMessage } from "@/lib/seed-data";

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
  return requestWithFallback<CodexStatusResponse>(
    "/api/codex/status",
    {
      method: "GET",
    },
    {
      ok: false,
      error: "当前无法读取 OpenCrab 的运行状态，请稍后重试。",
      loginStatus: "missing",
      loginMethod: "chatgpt",
    } satisfies CodexStatusResponse,
  );
}

export async function getChatGptConnectionStatus() {
  return request<ChatGptConnectionStatusResponse>(
    "/api/chatgpt/connect/status",
    {
      method: "GET",
    },
  );
}

export async function startChatGptConnection() {
  return request<ChatGptConnectionStatusResponse>(
    "/api/chatgpt/connect/start",
    {
      method: "POST",
    },
  );
}

export async function cancelChatGptConnection() {
  return request<ChatGptConnectionStatusResponse>(
    "/api/chatgpt/connect/cancel",
    {
      method: "POST",
    },
  );
}

export async function disconnectChatGptConnection() {
  return request<ChatGptConnectionStatusResponse>(
    "/api/chatgpt/connect/disconnect",
    {
      method: "POST",
    },
  );
}

export async function openPendingChatGptConnectionInChrome() {
  return request<ChatGptConnectionStatusResponse>(
    "/api/chatgpt/connect/open",
    {
      method: "POST",
    },
  );
}

export async function getCodexBrowserSessionStatus() {
  return request<CodexBrowserSessionStatus>("/api/codex/browser-session", {
    method: "GET",
  });
}

export async function getRuntimeReadiness() {
  return request<RuntimeReadinessResponse>("/api/runtime/readiness", {
    method: "GET",
  });
}

export async function getSkillsCatalog() {
  return request<SkillsCatalogResponse>("/api/skills", {
    method: "GET",
  });
}

export async function getAgents() {
  return request<AgentProfileListResponse>("/api/agents", {
    method: "GET",
  });
}

export async function getAgentDetail(agentId: string) {
  return request<AgentProfileDetailResponse>(`/api/agents/${agentId}`, {
    method: "GET",
  });
}

export async function createAgent(input: {
  name: string;
  summary: string;
  avatarDataUrl?: string | null;
  roleLabel?: string;
  description?: string;
  availability?: "solo" | "team" | "both";
  teamRole?: "lead" | "research" | "writer" | "specialist";
  defaultModel?: string | null;
  defaultReasoningEffort?: CodexReasoningEffort | null;
  defaultSandboxMode?: CodexSandboxMode | null;
  starterPrompts?: string[];
  files?: Partial<{
    soul: string;
    responsibility: string;
    tools: string;
    user: string;
    knowledge: string;
  }>;
}) {
  return request<AgentProfileDetailResponse>("/api/agents", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export async function updateAgent(
  agentId: string,
  patch: Partial<{
    name: string;
    summary: string;
    avatarDataUrl: string | null;
    roleLabel: string;
    description: string;
    availability: "solo" | "team" | "both";
    teamRole: "lead" | "research" | "writer" | "specialist";
    defaultModel: string | null;
    defaultReasoningEffort: CodexReasoningEffort | null;
    defaultSandboxMode: CodexSandboxMode | null;
    starterPrompts: string[];
    files: Partial<{
      soul: string;
      responsibility: string;
      tools: string;
      user: string;
      knowledge: string;
    }>;
  }>,
) {
  return request<AgentProfileDetailResponse>(`/api/agents/${agentId}`, {
    method: "PATCH",
    body: JSON.stringify(patch),
  });
}

export async function deleteAgent(agentId: string) {
  return request<{ ok: boolean }>(`/api/agents/${agentId}`, {
    method: "DELETE",
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

export async function getProjects() {
  return request<ProjectListResponse>("/api/projects", {
    method: "GET",
  });
}

export async function getProjectDetail(projectId: string) {
  return request<ProjectDetailResponse>(`/api/projects/${projectId}`, {
    method: "GET",
  });
}

export async function createProject(input: {
  goal: string;
  workspaceDir: string;
  agentProfileIds: string[];
  model?: string;
  reasoningEffort?: CodexReasoningEffort;
  sandboxMode?: CodexSandboxMode;
}) {
  return request<ProjectDetailResponse>("/api/projects", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export async function runProject(projectId: string) {
  return request<ProjectDetailResponse>(`/api/projects/${projectId}`, {
    method: "POST",
  });
}

export async function pauseProject(projectId: string) {
  return request<ProjectDetailResponse>(`/api/projects/${projectId}`, {
    method: "PATCH",
    body: JSON.stringify({ action: "pause" }),
  });
}

export async function deleteProject(projectId: string) {
  return request<{ ok: boolean }>(`/api/projects/${projectId}`, {
    method: "DELETE",
  });
}

export async function replyToProjectConversation(
  projectId: string,
  input: {
    conversationId: string;
    content: string;
  },
) {
  return request<SnapshotMutationResult>(`/api/projects/${projectId}/chat`, {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export async function updateProjectCheckpoint(
  projectId: string,
  input: {
    action: "approve" | "request_changes" | "resume" | "rollback";
    note?: string | null;
  } | {
    action: "pause";
    note?: string | null;
  },
) {
  return request<ProjectDetailResponse>(`/api/projects/${projectId}`, {
    method: "PATCH",
    body: JSON.stringify(input),
  });
}

export async function reviewProjectLearningSuggestion(
  projectId: string,
  suggestionId: string,
  input: {
    action: "accept" | "dismiss";
    note?: string | null;
  },
) {
  return request<ProjectDetailResponse>(
    `/api/projects/${projectId}/learning-suggestions/${suggestionId}`,
    {
      method: "PATCH",
      body: JSON.stringify(input),
    },
  );
}

export async function reviewProjectLearningReuseCandidate(
  projectId: string,
  candidateId: string,
  input: {
    action: "confirm" | "dismiss";
    note?: string | null;
  },
) {
  return request<ProjectDetailResponse>(
    `/api/projects/${projectId}/learning-reuse-candidates/${candidateId}`,
    {
      method: "PATCH",
      body: JSON.stringify(input),
    },
  );
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
  conversationId?: string | null;
  projectId?: string | null;
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
    conversationId: string | null;
    projectId: string | null;
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
    defaultLanguage: AppLanguage;
    userDisplayName: string;
    userAvatarDataUrl: string | null;
    thinkingModeEnabled: boolean;
    allowOpenAiApiKeyForCommands: boolean;
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

export async function createConversation(input?: {
  title?: string;
  folderId?: string | null;
  workspaceDir?: string | null;
  sandboxMode?: CodexSandboxMode | null;
  projectId?: string | null;
  agentProfileId?: string | null;
}) {
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
    workspaceDir: string | null;
    sandboxMode: CodexSandboxMode | null;
    projectId: string | null;
    agentProfileId: string | null;
    codexThreadId: string | null;
    lastAssistantModel: string | null;
  }>,
) {
  return request<SnapshotMutationResult>(
    `/api/conversations/${conversationId}`,
    {
      method: "PATCH",
      body: JSON.stringify(patch),
    },
  );
}

export async function deleteConversation(conversationId: string) {
  return request<SnapshotMutationResult>(
    `/api/conversations/${conversationId}`,
    {
      method: "DELETE",
    },
  );
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
    sandboxMode?: CodexSandboxMode;
  },
  options: {
    signal?: AbortSignal;
    onEvent: (event: ReplyStreamEvent) => void;
  },
) {
  const response = await fetch(
    `/api/conversations/${conversationId}/reply/stream`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(input),
      signal: options.signal,
    },
  );

  await assertOk(response);

  if (!response.body) {
    throw new Error("流式响应不可用，请稍后再试。");
  }

  for await (const event of readNdjsonStream<ReplyStreamEvent>(response)) {
    options.onEvent(event);
  }
}

export async function updateProjectWorkspaceDir(
  projectId: string,
  workspaceDir: string,
) {
  return request<import("@/lib/projects/types").ProjectDetailResponse>(
    `/api/projects/${projectId}`,
    {
      method: "PATCH",
      body: JSON.stringify({ workspaceDir }),
    },
  );
}

export async function updateProjectSandboxMode(
  projectId: string,
  sandboxMode: CodexSandboxMode,
) {
  return request<import("@/lib/projects/types").ProjectDetailResponse>(
    `/api/projects/${projectId}`,
    {
      method: "PATCH",
      body: JSON.stringify({ sandboxMode }),
    },
  );
}

export async function pickLocalDirectory(input?: {
  title?: string;
  defaultPath?: string | null;
}) {
  return request<{
    ok: boolean;
    path: string | null;
    cancelled: boolean;
  }>("/api/local-files/pick-directory", {
    method: "POST",
    body: JSON.stringify(input ?? {}),
  });
}

async function request<T>(input: string, init: RequestInit) {
  const response = await fetch(input, buildRequestInit(init));
  await assertOk(response);
  return readJsonResponse<T>(response);
}

async function requestWithFallback<T>(
  input: string,
  init: RequestInit,
  fallback: T,
) {
  const response = await fetch(input, buildRequestInit(init));
  await assertOk(response);
  return readJsonResponse(response, fallback);
}

function buildRequestInit(init: RequestInit) {
  const isFormData =
    typeof FormData !== "undefined" && init.body instanceof FormData;

  return {
    ...init,
    headers: isFormData
      ? { ...(init.headers ?? {}) }
      : {
          "Content-Type": "application/json",
          ...(init.headers ?? {}),
        },
  };
}

async function assertOk(response: Response) {
  if (response.ok) {
    return;
  }

  throw await buildApiError(response);
}

async function buildApiError(response: Response) {
  const errorBody = await readJsonResponse<
    { error?: string; code?: string; requestId?: string } | null
  >(
    response,
    null,
  );
  const message = errorBody?.error || `API request failed: ${response.status}`;
  const suffix = errorBody?.requestId
    ? `（请求编号: ${errorBody.requestId}）`
    : "";

  return Object.assign(new Error(`${message}${suffix}`), {
    code: errorBody?.code || null,
    requestId: errorBody?.requestId || null,
    status: response.status,
  });
}

async function readJsonResponse<T>(
  response: Response,
  fallback?: T,
): Promise<T> {
  try {
    return (await response.json()) as T;
  } catch (error) {
    if (fallback !== undefined) {
      return fallback;
    }

    throw error;
  }
}

async function* readNdjsonStream<T>(response: Response) {
  if (!response.body) {
    return;
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

      if (trimmedLine) {
        yield JSON.parse(trimmedLine) as T;
      }
    }
  }

  const lastLine = buffer.trim();

  if (lastLine) {
    yield JSON.parse(lastLine) as T;
  }
}
