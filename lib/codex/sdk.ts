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

function getCodexClient() {
  return new Codex({
    env: buildChatGptLoginEnv(),
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
