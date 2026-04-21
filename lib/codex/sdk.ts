import { Codex } from "@openai/codex-sdk";
import { readFileSync } from "node:fs";
import type { AgentProfileDetail } from "@/lib/agents/types";
import { createCodexAppServerClient } from "@/lib/codex/app-server-client";
import { buildChromeDevtoolsMcpConfig, ensureBrowserSession } from "@/lib/codex/browser-session";
import {
  isCodexTransportNoiseMessage,
  normalizeCodexTransportNoiseMessage,
} from "@/lib/codex/stream-noise";
import { buildOpenCrabCodexEnv } from "@/lib/codex/runtime-env";
import {
  resolveCodexExecutablePath,
} from "@/lib/codex/executable";
import {
  getCodexOptions,
  resolvePreferredModelOption,
  resolvePreferredReasoningEffort,
} from "@/lib/codex/options";
import { getAppLanguagePromptInstruction } from "@/lib/opencrab/languages";
import { listSkills } from "@/lib/skills/skill-store";
import { getSnapshot } from "@/lib/resources/local-store";
import { OPENCRAB_DEFAULT_WORKSPACE_DIR } from "@/lib/resources/runtime-paths";
import type { CodexReasoningEffort, CodexSandboxMode } from "@/lib/resources/opencrab-api-types";
import type { ConversationPlanStep } from "@/lib/seed-data";

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
  agentProfile?: AgentProfileDetail | null;
  imagePaths?: string[];
  textAttachments?: Array<{
    name: string;
    storedPath: string;
  }>;
  model?: string;
  reasoningEffort?: CodexReasoningEffort;
  sandboxMode?: CodexSandboxMode;
  workingDirectory?: string;
  onThreadReady?: (threadId: string | null) => void;
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
      type: "plan";
      steps: ConversationPlanStep[];
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
      planSteps: ConversationPlanStep[];
    };

export async function generateCodexReply({
  conversationTitle,
  threadId,
  content,
  agentProfile,
  imagePaths = [],
  textAttachments = [],
  model,
  reasoningEffort,
  sandboxMode,
  workingDirectory,
  onThreadReady,
}: GenerateCodexReplyInput) {
  try {
    await ensureBrowserSession();
    await ensureCodexLogin();
    const modelConfig = resolveModelConfig({
      model,
      reasoningEffort,
    });
    const codex = getCodexClient();
    const thread = threadId
      ? codex.resumeThread(threadId, buildThreadOptions({ ...modelConfig, sandboxMode, workingDirectory }))
      : codex.startThread(buildThreadOptions({ ...modelConfig, sandboxMode, workingDirectory }));

    onThreadReady?.(thread.id);

    const prompt = buildPrompt({
      conversationTitle,
      content,
      agentProfile,
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
  } catch (error) {
    throw normalizeCodexRuntimeError(error);
  }
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
  agentProfile,
  imagePaths = [],
  textAttachments = [],
  model,
  reasoningEffort,
  sandboxMode,
  workingDirectory,
  signal,
}: StreamCodexReplyInput): AsyncGenerator<CodexReplyStreamEvent> {
  try {
    await ensureBrowserSession();
    await ensureCodexLogin();
    const modelConfig = resolveModelConfig({
      model,
      reasoningEffort,
    });
    const codex = getCodexClient();
    const thread = threadId
      ? codex.resumeThread(threadId, buildThreadOptions({ ...modelConfig, sandboxMode, workingDirectory }))
      : codex.startThread(buildThreadOptions({ ...modelConfig, sandboxMode, workingDirectory }));

    const prompt = buildPrompt({
      conversationTitle,
      content,
      agentProfile,
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
    let lastPlanPayload = "";
    let assistantText = "";
    let usage: CodexUsage = null;
    let latestPlanSteps: ConversationPlanStep[] = [];

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

      const nextPlanSteps = getPlanSteps(item);

      if (nextPlanSteps) {
        const serializedPlan = JSON.stringify(nextPlanSteps);

        if (serializedPlan !== lastPlanPayload) {
          lastPlanPayload = serializedPlan;
          latestPlanSteps = nextPlanSteps;
          yield {
            type: "plan",
            steps: nextPlanSteps,
          };
        }

        continue;
      }

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
      planSteps: latestPlanSteps,
    };
  } catch (error) {
    throw normalizeCodexRuntimeError(error);
  }
}

function getCodexClient() {
  const runtimeSkillEntries = listSkills()
    .filter((skill) => Boolean(skill.sourcePath))
    .map((skill) => ({
      path: skill.sourcePath!,
      enabled: skill.status === "installed",
    }));

  return new Codex({
    codexPathOverride: resolveCodexExecutablePath(),
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

export function buildChatGptLoginEnv(): Record<string, string> {
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

  return buildOpenCrabCodexEnv(nextEnv);
}

function buildThreadOptions(input?: {
  model?: string;
  reasoningEffort?: CodexReasoningEffort;
  sandboxMode?: CodexSandboxMode;
  workingDirectory?: string;
}) {
  const modelConfig = resolveModelConfig({
    model: input?.model,
    reasoningEffort: input?.reasoningEffort,
  });

  return {
    model: modelConfig.model,
    sandboxMode: input?.sandboxMode || DEFAULT_SANDBOX_MODE,
    workingDirectory: input?.workingDirectory || OPENCRAB_DEFAULT_WORKSPACE_DIR,
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
  input: Pick<
    GenerateCodexReplyInput,
    "conversationTitle" | "content" | "textAttachments" | "agentProfile"
  >,
) {
  const settings = getSnapshot().settings;
  const skills = listSkills();
  const enabledSkills = skills.filter(
    (skill) => skill.status === "installed" && Boolean(skill.sourcePath),
  );
  const disabledSkills = skills.filter(
    (skill) => skill.status === "disabled" && Boolean(skill.sourcePath),
  );
  const mountedAgentSkills = input.agentProfile
    ? enabledSkills.filter((skill) => {
        const allowedSkillIds = new Set([
          ...(input.agentProfile?.defaultSkillIds || []),
          ...(input.agentProfile?.optionalSkillIds || []),
        ]);

        return allowedSkillIds.has(skill.id);
      })
    : [];

  return [
    "你是 OpenCrab 自己的智能助手。",
    getAppLanguagePromptInstruction(settings.defaultLanguage),
    "面向普通用户，表达要清楚、直接、少术语。",
    input.agentProfile
      ? [
          `当前这条对话绑定了智能体：${input.agentProfile.name}`,
          `角色：${input.agentProfile.roleLabel}`,
          `简介：${input.agentProfile.summary}`,
          input.agentProfile.description
            ? `定位补充：${input.agentProfile.description}`
            : null,
          input.agentProfile.ownedOutcomes?.length
            ? ["该岗位负责的结果：", ...input.agentProfile.ownedOutcomes.map((item) => `- ${item}`)].join("\n")
            : null,
          input.agentProfile.outOfScope?.length
            ? ["该岗位明确不负责：", ...input.agentProfile.outOfScope.map((item) => `- ${item}`)].join("\n")
            : null,
          input.agentProfile.deliverables?.length
            ? [
                "默认交付物：",
                ...input.agentProfile.deliverables.map((item) =>
                  `- ${item.label}${item.required === false ? "（可选）" : "（必需）"}`,
                ),
              ].join("\n")
            : null,
          input.agentProfile.qualityGates?.length
            ? ["完成前必须通过的质量门：", ...input.agentProfile.qualityGates.map((item) => `- ${item}`)].join(
                "\n",
              )
            : null,
          input.agentProfile.handoffTargets?.length
            ? ["超出职责范围时优先交接给：", ...input.agentProfile.handoffTargets.map((item) => `- ${item}`)].join(
                "\n",
              )
            : null,
          buildAgentPromptSection("IDENTITY", input.agentProfile.files.identity),
          buildAgentPromptSection("CONTRACT", input.agentProfile.files.contract),
          buildAgentPromptSection("EXECUTION", input.agentProfile.files.execution),
          buildAgentPromptSection("QUALITY", input.agentProfile.files.quality),
          buildAgentPromptSection("HANDOFF", input.agentProfile.files.handoff),
          "你必须优先遵守这份智能体配置；默认目标是在该岗位职责范围内直接形成可交付结果，而不是只给建议。",
          "如果当前请求部分超出岗位边界，先完成职责范围内的交付，再明确指出应交接给哪个核心岗位以及原因。",
          "如果你声称完成，必须确保默认交付物和质量门已经满足；不要把分析、方案或口头建议伪装成交付。",
        ]
          .filter(Boolean)
          .join("\n")
      : null,
    "涉及浏览器、网页、页面交互、表单填写、点击、抓取页面可见内容时，优先使用 chrome-devtools MCP。",
    "只有在 chrome-devtools MCP 当前不可用、明确做不到，或者连续失败时，才降级到其他方式，例如命令行、Playwright 或直接请求网页。",
    "如果浏览器操作发生了降级，最终回复里用一句短话说明你改用了其他办法。",
    input.agentProfile && mountedAgentSkills.length > 0
      ? [
          "当前岗位默认挂载的可用 skills：",
          ...mountedAgentSkills.map((skill) => `- ${skill.id}: ${skill.summary}`),
        ].join("\n")
      : input.agentProfile
        ? "当前岗位没有已挂载的可用 skills，请优先依赖岗位合同、上下文和工具能力闭环。"
        : enabledSkills.length > 0
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

export function buildCodexPromptForTesting(
  input: Pick<
    GenerateCodexReplyInput,
    "conversationTitle" | "content" | "textAttachments" | "agentProfile"
  >,
) {
  return buildPrompt(input);
}

function buildAgentPromptSection(title: string, content: string) {
  const trimmed = content.trim();

  if (!trimmed) {
    return null;
  }

  return [`[${title}]`, trimmed].join("\n");
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
      return sanitizeThinkingEntry(item.text);
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
      return null;
    case "error":
      if (!item.message || isCodexTransportNoiseMessage(item.message)) {
        return null;
      }

      return `遇到一个中间错误：${item.message}`;
    default:
      return null;
  }
}

function getPlanSteps(item: {
  type: string;
  id: string;
  items?: Array<{ text: string; completed: boolean }>;
}) {
  if (item.type !== "todo_list" || !item.items?.length) {
    return null;
  }

  return item.items.map((todo, index) => ({
    id: `${item.id}:${index}`,
    text: todo.text?.trim() || `步骤 ${index + 1}`,
    status: todo.completed ? ("completed" as const) : ("pending" as const),
  }));
}

function sanitizeThinkingEntry(value: string | undefined) {
  const normalized = value?.trim();

  if (!normalized || isCodexTransportNoiseMessage(normalized)) {
    return null;
  }

  return normalized;
}

export async function getCodexLoginStatus() {
  try {
    const appServer = await createCodexAppServerClient(
      buildChatGptLoginEnv() as NodeJS.ProcessEnv,
    );

    try {
      const response = await appServer.request<{
        account: {
          type: "apiKey" | "chatgpt";
          email?: string;
          planType?: string;
        } | null;
        requiresOpenaiAuth: boolean;
      }>("account/read", {
        refreshToken: false,
      });

      if (response.account?.type === "chatgpt") {
        return {
          ok: true as const,
        };
      }

      return {
        ok: false as const,
        error: response.requiresOpenaiAuth
          ? "当前没有检测到可用的 ChatGPT 登录状态。"
          : "当前没有检测到可用的本机执行环境登录状态。",
      };
    } finally {
      appServer.close();
    }
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

function normalizeCodexRuntimeError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  const normalizedTransportNoiseMessage = normalizeCodexTransportNoiseMessage(message);

  if (normalizedTransportNoiseMessage) {
    return new Error(normalizedTransportNoiseMessage);
  }

  if (/Unable to locate Codex CLI binaries/i.test(message)) {
    return new Error(
      "OpenCrab 当前找不到本机可用的 Codex 执行入口。请先重新安装项目依赖，或确认 `node_modules/.bin/codex` 可用后再试。",
    );
  }

  if (/Missing optional dependency/i.test(message)) {
    return new Error(
      "OpenCrab 当前缺少 Codex 的平台二进制依赖。请重新安装项目依赖，并确保安装时没有跳过 optional dependencies。",
    );
  }

  return error instanceof Error ? error : new Error(message);
}
