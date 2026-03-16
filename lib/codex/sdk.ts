import { Codex } from "@openai/codex-sdk";
import { readFileSync } from "node:fs";
import type { CodexReasoningEffort } from "@/lib/resources/opencrab-api-types";

const DEFAULT_MODEL = process.env.OPENCRAB_CODEX_MODEL || "gpt-5.4";
const DEFAULT_REASONING_EFFORT = normalizeReasoningEffort(
  process.env.OPENCRAB_CODEX_REASONING_EFFORT,
);
const DEFAULT_SANDBOX_MODE = normalizeSandboxMode(process.env.OPENCRAB_CODEX_SANDBOX_MODE);
const DEFAULT_NETWORK_ACCESS = process.env.OPENCRAB_CODEX_NETWORK_ACCESS === "true";
const DEFAULT_APPROVAL_POLICY = "never" as const;

type GenerateCodexReplyInput = {
  conversationTitle?: string;
  threadId?: string | null;
  content?: string;
  imagePaths?: string[];
  textAttachments?: Array<{
    name: string;
    storedPath: string;
  }>;
  model?: string;
  reasoningEffort?: CodexReasoningEffort;
};

type StreamCodexReplyInput = GenerateCodexReplyInput & {
  signal?: AbortSignal;
};

type CodexUsage = {
  input_tokens: number;
  cached_input_tokens: number;
  output_tokens: number;
} | null;

export type CodexReplyStreamEvent =
  | {
      type: "thinking";
      entries: string[];
    }
  | {
      type: "assistant";
      text: string;
    }
  | {
      type: "done";
      text: string;
      threadId: string | null;
      model: string;
      usage: CodexUsage;
      thinking: string[];
    };

export async function generateCodexReply({
  conversationTitle,
  threadId,
  content,
  imagePaths = [],
  textAttachments = [],
  model,
  reasoningEffort,
}: GenerateCodexReplyInput) {
  const codex = getCodexClient();
  const thread = threadId
    ? codex.resumeThread(threadId, buildThreadOptions({ model, reasoningEffort }))
    : codex.startThread(buildThreadOptions({ model, reasoningEffort }));

  const prompt = buildPrompt({
    conversationTitle,
    content,
    textAttachments,
  });

  const result = await thread.run([
    {
      type: "text",
      text: prompt,
    },
    ...imagePaths.map((path) => ({
      type: "local_image" as const,
      path,
    })),
  ]);

  const text = result.finalResponse?.trim();

  if (!text) {
    throw new Error("Codex SDK 未返回可用内容。");
  }

  return {
    text,
    threadId: thread.id,
    model: model || DEFAULT_MODEL,
    usage: result.usage,
  };
}

export async function getCodexStatus() {
  const codex = getCodexClient();
  const probeThread = codex.startThread(buildThreadOptions());
  const result = await probeThread.run("只回复：Codex 状态正常");

  return {
    ok: true,
    model: DEFAULT_MODEL,
    reasoningEffort: DEFAULT_REASONING_EFFORT,
    sandboxMode: DEFAULT_SANDBOX_MODE,
    networkAccessEnabled: DEFAULT_NETWORK_ACCESS,
    approvalPolicy: DEFAULT_APPROVAL_POLICY,
    reply: result.finalResponse?.trim() || "",
    threadId: probeThread.id,
    usage: result.usage,
  };
}

export async function* streamCodexReply({
  conversationTitle,
  threadId,
  content,
  imagePaths = [],
  textAttachments = [],
  model,
  reasoningEffort,
  signal,
}: StreamCodexReplyInput): AsyncGenerator<CodexReplyStreamEvent> {
  const codex = getCodexClient();
  const thread = threadId
    ? codex.resumeThread(threadId, buildThreadOptions({ model, reasoningEffort }))
    : codex.startThread(buildThreadOptions({ model, reasoningEffort }));

  const prompt = buildPrompt({
    conversationTitle,
    content,
    textAttachments,
  });

  const { events } = await thread.runStreamed(
    [
      {
        type: "text",
        text: prompt,
      },
      ...imagePaths.map((path) => ({
        type: "local_image" as const,
        path,
      })),
    ],
    { signal },
  );

  const thinkingMap = new Map<string, string>();
  let lastThinkingPayload = "";
  let assistantText = "";
  let usage: CodexUsage = null;

  for await (const event of events) {
    if (event.type === "turn.failed" || event.type === "error") {
      throw new Error(event.type === "error" ? event.message : event.error.message);
    }

    if (event.type === "turn.completed") {
      usage = event.usage;
      continue;
    }

    if (event.type !== "item.started" && event.type !== "item.updated" && event.type !== "item.completed") {
      continue;
    }

    const item = event.item;

    if (item.type === "agent_message") {
      if (item.text !== assistantText) {
        assistantText = item.text;
        yield {
          type: "assistant",
          text: assistantText,
        };
      }
      continue;
    }

    const nextThinkingEntry = getThinkingEntry(item);

    if (!nextThinkingEntry) {
      continue;
    }

    thinkingMap.set(item.id, nextThinkingEntry);
    const entries = Array.from(thinkingMap.values());
    const serialized = JSON.stringify(entries);

    if (serialized !== lastThinkingPayload) {
      lastThinkingPayload = serialized;
      yield {
        type: "thinking",
        entries,
      };
    }
  }

  const text = assistantText.trim();

  if (!text) {
    throw new Error("Codex SDK 未返回可用内容。");
  }

  yield {
    type: "done",
    text,
    threadId: thread.id,
    model: model || DEFAULT_MODEL,
    usage,
    thinking: Array.from(thinkingMap.values()),
  };
}

function getCodexClient() {
  return new Codex({
    env: buildChatGptLoginEnv(),
    config: {
      show_raw_agent_reasoning: true,
    },
  });
}

function buildChatGptLoginEnv() {
  const nextEnv: Record<string, string> = {};

  for (const [key, value] of Object.entries(process.env)) {
    if (typeof value !== "string") {
      continue;
    }

    if (key === "OPENAI_API_KEY" || key === "CODEX_API_KEY") {
      continue;
    }

    nextEnv[key] = value;
  }

  return nextEnv;
}

function buildThreadOptions(input?: {
  model?: string;
  reasoningEffort?: CodexReasoningEffort;
}) {
  return {
    model: input?.model || DEFAULT_MODEL,
    sandboxMode: DEFAULT_SANDBOX_MODE,
    workingDirectory: process.cwd(),
    skipGitRepoCheck: true,
    modelReasoningEffort: input?.reasoningEffort || DEFAULT_REASONING_EFFORT,
    networkAccessEnabled: DEFAULT_NETWORK_ACCESS,
    approvalPolicy: DEFAULT_APPROVAL_POLICY,
  };
}

function buildPrompt(
  input: Pick<GenerateCodexReplyInput, "conversationTitle" | "content" | "textAttachments">,
) {
  return [
    "你是 OpenCrab 的 Codex 助手。",
    "默认使用简体中文回复，除非用户明确要求其他语言。",
    "面向普通用户，表达要清楚、直接、少术语。",
    input.conversationTitle ? `当前对话标题：${input.conversationTitle}` : null,
    input.content ? `用户消息：${input.content}` : "用户本轮没有输入文字，请优先分析随附文件。",
    ...(input.textAttachments || []).map((file) => {
      const content = readFileSync(file.storedPath, "utf8");
      return [`附加文本文件：${file.name}`, "```text", content.slice(0, 12000), "```"].join("\n");
    }),
  ]
    .filter(Boolean)
    .join("\n");
}

function normalizeReasoningEffort(value: string | undefined) {
  switch (value) {
    case "minimal":
    case "low":
    case "medium":
    case "high":
    case "xhigh":
      return value;
    default:
      return "medium" as const;
  }
}

function normalizeSandboxMode(value: string | undefined) {
  switch (value) {
    case "read-only":
    case "workspace-write":
    case "danger-full-access":
      return value;
    default:
      return "read-only" as const;
  }
}

function getThinkingEntry(item: {
  type: string;
  id: string;
  text?: string;
  status?: string;
  command?: string;
  query?: string;
  server?: string;
  tool?: string;
  message?: string;
  items?: Array<{ text: string; completed: boolean }>;
}) {
  switch (item.type) {
    case "reasoning":
      return item.text?.trim() || null;
    case "command_execution":
      if (!item.command) {
        return null;
      }

      if (item.status === "failed") {
        return `正在执行命令，但上一次尝试失败：${item.command}`;
      }

      if (item.status === "completed") {
        return `已完成一项命令执行：${item.command}`;
      }

      return `正在执行命令：${item.command}`;
    case "web_search":
      return item.query ? `正在检索资料：${item.query}` : null;
    case "mcp_tool_call":
      if (!item.server || !item.tool) {
        return null;
      }

      return `正在调用工具：${item.server} / ${item.tool}`;
    case "todo_list":
      return item.items?.length
        ? `正在规划步骤：${item.items
            .map((todo) => `${todo.completed ? "已完成" : "待处理"} ${todo.text}`)
            .join("；")}`
        : null;
    case "error":
      return item.message ? `遇到一个中间错误：${item.message}` : null;
    default:
      return null;
  }
}
