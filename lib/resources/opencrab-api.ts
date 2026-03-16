import type {
  AppSnapshot,
  CodexOptionsResponse,
  CodexReasoningEffort,
  CreateConversationResult,
  ReplyStreamEvent,
  SnapshotMutationResult,
  UploadedAttachment,
} from "@/lib/resources/opencrab-api-types";
import type { ConversationMessage } from "@/lib/mock-data";

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

export async function updateSettings(
  patch: Partial<{
    defaultModel: string;
    defaultReasoningEffort: CodexReasoningEffort;
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
