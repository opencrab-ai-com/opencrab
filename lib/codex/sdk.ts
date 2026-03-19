import { Codex } from "@openai/codex-sdk";
import { execFile } from "node:child_process";
import { readFileSync } from "node:fs";
import { promisify } from "node:util";
import { buildChromeDevtoolsMcpConfig, ensureBrowserSession } from "@/lib/codex/browser-session";
import {
  getCodexOptions,
  resolvePreferredModelOption,
  resolvePreferredReasoningEffort,
} from "@/lib/codex/options";
import { getAppLanguagePromptInstruction } from "@/lib/opencrab/languages";
import { listSkills } from "@/lib/skills/skill-store";
import { getSnapshot } from "@/lib/resources/local-store";
import type { CodexReasoningEffort, CodexSandboxMode } from "@/lib/resources/opencrab-api-types";

const execFileAsync = promisify(execFile);

const CONFIGURED_DEFAULT_MODEL = process.env.OPENCRAB_CODEX_MODEL;
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
  sandboxMode?: CodexSandboxMode;
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
      type: "thread";
      threadId: string | null;
    }
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
  sandboxMode,
}: GenerateCodexReplyInput) {
  await ensureBrowserSession();
  await ensureCodexLogin();
  const modelConfig = resolveModelConfig({
    model,
    reasoningEffort,
  });
  const codex = getCodexClient();
  const thread = threadId
    ? codex.resumeThread(threadId, buildThreadOptions({ ...modelConfig, sandboxMode }))
    : codex.startThread(buildThreadOptions({ ...modelConfig, sandboxMode }));

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
    throw new Error("OpenCrab 当前没有生成可用回复。");
  }

  return {
    text,
    threadId: thread.id,
    model: modelConfig.model,
    usage: result.usage,
  };
}

export async function getCodexStatus() {
  const login = await getCodexLoginStatus();
  const modelConfig = resolveModelConfig();

  if (!login.ok) {
    return {
      ok: false as const,
      error: login.error,
      loginStatus: "missing" as const,
      loginMethod: "chatgpt" as const,
    };
  }

  return {
    ok: true,
    model: modelConfig.model,
    reasoningEffort: modelConfig.reasoningEffort,
    sandboxMode: DEFAULT_SANDBOX_MODE,
    networkAccessEnabled: DEFAULT_NETWORK_ACCESS,
    approvalPolicy: DEFAULT_APPROVAL_POLICY,
    reply: "OpenCrab 已就绪",
    threadId: null,
    usage: null,
    loginStatus: "logged_in" as const,
    loginMethod: "chatgpt" as const,
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
  sandboxMode,
  signal,
}: StreamCodexReplyInput): AsyncGenerator<CodexReplyStreamEvent> {
  await ensureBrowserSession();
  await ensureCodexLogin();
  const modelConfig = resolveModelConfig({
    model,
    reasoningEffort,
  });
  const codex = getCodexClient();
  const thread = threadId
    ? codex.resumeThread(threadId, buildThreadOptions({ ...modelConfig, sandboxMode }))
    : codex.startThread(buildThreadOptions({ ...modelConfig, sandboxMode }));

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

  yield {
    type: "thread",
    threadId: thread.id,
  };

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
    throw new Error("OpenCrab 当前没有生成可用回复。");
  }

  yield {
    type: "done",
    text,
    threadId: thread.id,
    model: modelConfig.model,
    usage,
    thinking: Array.from(thinkingMap.values()),
  };
}

function getCodexClient() {
  const runtimeSkillEntries = listSkills()
    .filter((skill) => Boolean(skill.sourcePath))
    .map((skill) => ({
      path: skill.sourcePath!,
      enabled: skill.status === "installed",
    }));

  return new Codex({
    env: buildChatGptLoginEnv(),
    config: {
      show_raw_agent_reasoning: true,
      mcp_servers: buildChromeDevtoolsMcpConfig(),
      skills: {
        config: runtimeSkillEntries,
      },
    },
  });
}

export function buildChatGptLoginEnv() {
  const nextEnv: Record<string, string> = {};
  const allowOpenAiApiKeyForCommands = getSnapshot().settings.allowOpenAiApiKeyForCommands === true;

  for (const [key, value] of Object.entries(process.env)) {
    if (typeof value !== "string") {
      continue;
    }

    if (key === "CODEX_API_KEY") {
      continue;
    }

    if (key === "OPENAI_API_KEY" && !allowOpenAiApiKeyForCommands) {
      continue;
    }

    nextEnv[key] = value;
  }

  return nextEnv;
}

function buildThreadOptions(input?: {
  model?: string;
  reasoningEffort?: CodexReasoningEffort;
  sandboxMode?: CodexSandboxMode;
}) {
  const modelConfig = resolveModelConfig({
    model: input?.model,
    reasoningEffort: input?.reasoningEffort,
  });

  return {
    model: modelConfig.model,
    sandboxMode: input?.sandboxMode || DEFAULT_SANDBOX_MODE,
    workingDirectory: process.cwd(),
    skipGitRepoCheck: true,
    modelReasoningEffort: modelConfig.reasoningEffort,
    networkAccessEnabled: DEFAULT_NETWORK_ACCESS,
    approvalPolicy: DEFAULT_APPROVAL_POLICY,
  };
}

function resolveModelConfig(input?: {
  model?: string;
  reasoningEffort?: CodexReasoningEffort;
}) {
  const options = getCodexOptions();
  const modelOption = resolvePreferredModelOption(
    options.models,
    input?.model || CONFIGURED_DEFAULT_MODEL || options.defaultModel,
  );

  return {
    model: modelOption.id,
    reasoningEffort: resolvePreferredReasoningEffort(
      modelOption,
      input?.reasoningEffort || DEFAULT_REASONING_EFFORT,
    ),
  };
}

function buildPrompt(
  input: Pick<GenerateCodexReplyInput, "conversationTitle" | "content" | "textAttachments">,
) {
  const settings = getSnapshot().settings;
  const skills = listSkills();
  const enabledSkills = skills.filter(
    (skill) => skill.status === "installed" && Boolean(skill.sourcePath),
  );
  const disabledSkills = skills.filter(
    (skill) => skill.status === "disabled" && Boolean(skill.sourcePath),
  );

  return [
    "你是 OpenCrab 自己的智能助手。",
    getAppLanguagePromptInstruction(settings.defaultLanguage),
    "面向普通用户，表达要清楚、直接、少术语。",
    "涉及浏览器、网页、页面交互、表单填写、点击、抓取页面可见内容时，优先使用 chrome-devtools MCP。",
    "只有在 chrome-devtools MCP 当前不可用、明确做不到，或者连续失败时，才降级到其他方式，例如命令行、Playwright 或直接请求网页。",
    "如果浏览器操作发生了降级，最终回复里用一句短话说明你改用了其他办法。",
    enabledSkills.length > 0
      ? [
          "OpenCrab 当前已启用的 skills（只有这些算可用）：",
          ...enabledSkills.map((skill) => `- ${skill.id}: ${skill.summary}`),
        ].join("\n")
      : "OpenCrab 当前没有启用任何 skills。",
    disabledSkills.length > 0
      ? [
          "OpenCrab 当前已禁用的 skills（即使共享目录里仍然存在，也一律视为不可用）：",
          ...disabledSkills.map((skill) => `- ${skill.id}: ${skill.summary}`),
          "当用户询问你有哪些 skills、当前可用什么能力、或者让你选择一个 skill 时，不要列出这些已禁用 skills，也不要主动使用它们。",
        ].join("\n")
      : null,
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
      return "workspace-write" as const;
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

export async function getCodexLoginStatus() {
  try {
    const { stdout, stderr } = await execFileAsync("codex", ["login", "status"], {
      env: buildChatGptLoginEnv() as NodeJS.ProcessEnv,
    });
    const output = `${stdout}\n${stderr}`.trim();

    if (/Logged in using ChatGPT/i.test(output)) {
      return {
        ok: true as const,
      };
    }

    return {
      ok: false as const,
      error: output || "当前没有检测到可用的本机执行环境登录状态。",
    };
  } catch (error) {
    return {
      ok: false as const,
      error: error instanceof Error ? error.message : "当前没有检测到可用的本机执行环境登录状态。",
    };
  }
}

async function ensureCodexLogin() {
  const login = await getCodexLoginStatus();

  if (!login.ok) {
    throw new Error(`${login.error} 请先连接 ChatGPT 后再重试。`);
  }
}
