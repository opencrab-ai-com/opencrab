"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useOpenCrabApp } from "@/components/app-shell/opencrab-provider";
import { Button, buttonClassName } from "@/components/ui/button";
import { generateAgentDraft } from "@/lib/agents/templates";
import type { AgentFiles, AgentTeamRole } from "@/lib/agents/types";

type OnboardingMessage = {
  id: string;
  role: "assistant" | "user";
  content: string;
};

type OnboardingFieldId =
  | "name"
  | "roleLabel"
  | "summary"
  | "description"
  | "availability"
  | "tone"
  | "responsibilities"
  | "boundaries"
  | "tools"
  | "userContext"
  | "knowledge";

type OnboardingAnswers = Record<OnboardingFieldId, string>;

type OnboardingPhase = "collecting" | "confirming" | "choosing_revision" | "editing_field" | "creating";

const FIELD_ORDER: Array<{
  id: OnboardingFieldId;
  label: string;
  prompt: string;
  placeholder: string;
}> = [
  {
    id: "name",
    label: "名称",
    prompt: "先从名字开始。你希望这个智能体叫什么？名字最好一看就知道它是谁、擅长什么。",
    placeholder: "例如：产品拆解师",
  },
  {
    id: "roleLabel",
    label: "角色标签",
    prompt: "我还需要一个简洁的角色标签，方便在 Team 里快速识别。你希望它的角色标签是什么？",
    placeholder: "例如：Strategist / Research Lead / Writer",
  },
  {
    id: "summary",
    label: "简介",
    prompt: "接着说一句最核心的简介：它最主要负责什么？我会把这句话当作它的长期使命基线。",
    placeholder: "例如：把模糊产品想法收束成可执行路线",
  },
  {
    id: "description",
    label: "定位补充",
    prompt: "再补一层定位：它通常在什么场景下被唤起，适合处理哪类问题，又和普通对话有什么明显区别？",
    placeholder: "例如：适合产品方案收束、MVP 路线、优先级取舍，不负责具体代码实现",
  },
  {
    id: "availability",
    label: "适用范围",
    prompt: "它更适合哪种使用方式：仅单聊、仅 Team、还是两边都能用？你直接自然回答就好，比如“更适合 Team，但单聊也可以”。",
    placeholder: "例如：两边都能用，但更偏 Team Lead",
  },
  {
    id: "tone",
    label: "风格气质",
    prompt: "你希望它整体是什么气质？比如更锋利、克制、温和、直接、偏判断型、偏整理型。这个信息会进入 identity.md。",
    placeholder: "例如：稳、直接、敢做取舍，但不要端着",
  },
  {
    id: "responsibilities",
    label: "职责重点",
    prompt: "请说说它必须做好的几件事。哪些事情如果它没做到，你会觉得这个智能体不合格？",
    placeholder: "例如：明确目标、做取舍、输出阶段方案、指出风险",
  },
  {
    id: "boundaries",
    label: "边界禁区",
    prompt: "那它不该做什么，或者哪些场景下必须更谨慎？这部分会进入 contract.md 和 identity.md。",
    placeholder: "例如：不要冒充定论，不要代替用户做高风险决定",
  },
  {
    id: "tools",
    label: "工具偏好",
    prompt: "你希望它怎么用工具？比如先读本地、再搜外部；或者要不要主动浏览、查资料、动文件。这个会进入 execution.md。",
    placeholder: "例如：先读本地文档，只有需要最新事实时再搜索",
  },
  {
    id: "userContext",
    label: "用户协作偏好",
    prompt: "它面对你时，需要记住哪些沟通偏好或协作习惯？例如篇幅、结构、澄清问题的频率、是否要先给结论。",
    placeholder: "例如：先给结论和建议，能自己收束就别把问题丢回来",
  },
  {
    id: "knowledge",
    label: "长期知识",
    prompt: "最后补长期知识。有没有什么背景、术语、上下文、产品事实，是它应该长期记住的？这个会进入 handoff.md 的长期协作与交接上下文。",
    placeholder: "例如：OpenCrab 是 chat-native 工作台，Team Mode 强调多人协作与运行收口，而不是 builder-first",
  },
];

const CONFIRM_KEYWORDS = ["确认", "可以创建", "可以结束", "没问题", "可以", "开始创建"];

export function AgentOnboardingDialog({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const { createAgent } = useOpenCrabApp();
  const [messages, setMessages] = useState<OnboardingMessage[]>(() => buildInitialMessages());
  const [answers, setAnswers] = useState<Partial<OnboardingAnswers>>({});
  const [phase, setPhase] = useState<OnboardingPhase>("collecting");
  const [activeFieldId, setActiveFieldId] = useState<OnboardingFieldId>(FIELD_ORDER[0].id);
  const [inputValue, setInputValue] = useState("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [revisionFieldId, setRevisionFieldId] = useState<OnboardingFieldId | null>(null);
  const scrollerRef = useRef<HTMLDivElement | null>(null);

  const activeField = useMemo(
    () => FIELD_ORDER.find((field) => field.id === activeFieldId) || FIELD_ORDER[0],
    [activeFieldId],
  );

  function appendMessage(role: OnboardingMessage["role"], content: string) {
    setMessages((current) => [
      ...current,
      {
        id: crypto.randomUUID(),
        role,
        content,
      },
    ]);
  }

  useEffect(() => {
    scrollerRef.current?.scrollTo({ top: scrollerRef.current.scrollHeight });
  }, [messages]);

  async function handleSubmit() {
    const content = inputValue.trim();

    if (!content || isSubmitting) {
      return;
    }

    appendMessage("user", content);
    setInputValue("");
    setErrorMessage(null);

    if (phase === "collecting") {
      const nextAnswers = { ...answers, [activeFieldId]: content };
      setAnswers(nextAnswers);

      const nextField = FIELD_ORDER.find((field) => !nextAnswers[field.id]?.trim());

      if (nextField) {
        setActiveFieldId(nextField.id);
        appendMessage("assistant", nextField.prompt);
        return;
      }

      setPhase("confirming");
      appendMessage("assistant", buildConfirmationMessage(nextAnswers as OnboardingAnswers));
      return;
    }

    if (phase === "confirming") {
      if (looksConfirmed(content)) {
        await finalizeCreation(answers as OnboardingAnswers);
        return;
      }

      const matchedField = matchField(content);

      if (matchedField) {
        setPhase("editing_field");
        setRevisionFieldId(matchedField);
        appendMessage("assistant", buildRevisionPrompt(matchedField));
        return;
      }

      setPhase("choosing_revision");
      appendMessage(
        "assistant",
        "收到，我们再打磨一下。你最想先修改哪一项？可以直接回复：名称、角色标签、简介、定位补充、适用范围、风格气质、职责重点、边界禁区、工具偏好、用户协作偏好、长期知识。",
      );
      return;
    }

    if (phase === "choosing_revision") {
      const matchedField = matchField(content);

      if (!matchedField) {
        appendMessage(
          "assistant",
          "我还没识别到你想改哪一项。你可以直接回复字段名，比如“工具偏好”或“长期知识”。",
        );
        return;
      }

      setPhase("editing_field");
      setRevisionFieldId(matchedField);
      appendMessage("assistant", buildRevisionPrompt(matchedField));
      return;
    }

    if (phase === "editing_field" && revisionFieldId) {
      const nextAnswers = { ...answers, [revisionFieldId]: content };
      setAnswers(nextAnswers);
      setRevisionFieldId(null);
      setPhase("confirming");
      appendMessage("assistant", buildConfirmationMessage(nextAnswers as OnboardingAnswers));
    }
  }

  async function finalizeCreation(finalAnswers: OnboardingAnswers) {
    setIsSubmitting(true);
    setPhase("creating");
    appendMessage("assistant", "好，我已经拿到足够信息了。现在开始为你初始化智能体，并生成一套可继续编辑的 md 初稿。");

    try {
      const payload = buildCreatePayload(finalAnswers);
      const agent = await createAgent(payload);

      if (!agent) {
        throw new Error("创建智能体失败。");
      }

      router.push(`/agents/${agent.id}`);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "创建智能体失败。");
      setPhase("confirming");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-[rgba(17,17,17,0.2)] p-4 backdrop-blur-[2px]"
      onClick={() => (isSubmitting ? null : onClose())}
      role="presentation"
    >
      <div
        className="grid h-[min(84vh,760px)] w-full max-w-[980px] grid-cols-1 overflow-hidden rounded-[30px] border border-line bg-surface shadow-[0_24px_90px_rgba(15,23,42,0.18)] lg:grid-cols-[1.25fr_0.75fr]"
        onClick={(event) => event.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        <div className="flex min-h-0 flex-col border-b border-line lg:border-r lg:border-b-0">
          <div className="border-b border-line px-6 py-5">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="text-[12px] uppercase tracking-[0.16em] text-muted">Agent Setup</div>
                <h2 className="mt-2 text-[28px] font-semibold tracking-[-0.05em] text-text">通过对话初始化智能体</h2>
                <p className="mt-2 max-w-[58ch] text-[14px] leading-7 text-muted-strong">
                  这不是普通表单。我会先连续提问，收集足够信息后，再通过对话方式和你确认是否可以结束初始化。
                </p>
              </div>

              <button
                type="button"
                onClick={() => (isSubmitting ? null : onClose())}
                className="rounded-full border border-line bg-background px-3 py-1.5 text-[12px] text-muted-strong transition hover:bg-surface-muted"
              >
                关闭
              </button>
            </div>
          </div>

          <div ref={scrollerRef} className="min-h-0 flex-1 overflow-y-auto px-6 py-6">
            <div className="space-y-4">
              {messages.map((message) => (
                <article
                  key={message.id}
                  className={`max-w-[680px] rounded-[24px] px-5 py-4 ${
                    message.role === "assistant"
                      ? "border border-line bg-background text-text shadow-soft"
                      : "ml-auto bg-[#f4f4f0] text-text"
                  }`}
                >
                  <div className="mb-2 text-[11px] text-muted">
                    {message.role === "assistant" ? "Agent 初始化助手" : "我"}
                  </div>
                  <p className="whitespace-pre-wrap text-[14px] leading-7">{message.content}</p>
                </article>
              ))}
            </div>
          </div>

          <div className="border-t border-line px-6 py-5">
            {errorMessage ? (
              <div className="mb-3 rounded-[16px] border border-[#f3d0cb] bg-[#fff3f1] px-4 py-3 text-[13px] text-[#b42318]">
                {errorMessage}
              </div>
            ) : null}

            <label className="block rounded-[24px] border border-line bg-background px-4 py-4 shadow-soft">
              <div className="mb-2 text-[12px] text-muted-strong">{activeField.label}</div>
              <textarea
                value={inputValue}
                onChange={(event) => setInputValue(event.target.value)}
                placeholder={activeField.placeholder}
                rows={4}
                className="w-full resize-none border-0 bg-transparent text-[14px] leading-7 text-text outline-none placeholder:text-muted"
                onKeyDown={(event) => {
                  if (event.key === "Enter" && !event.shiftKey) {
                    event.preventDefault();
                    void handleSubmit();
                  }
                }}
              />
            </label>

            <div className="mt-4 flex items-center justify-between gap-3">
              <div className="text-[12px] text-muted-strong">
                {phase === "confirming"
                  ? "如果信息已够，请直接回复“确认”或“可以创建”"
                  : "Enter 发送，Shift + Enter 换行"}
              </div>

              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={onClose}
                  disabled={isSubmitting}
                  className={buttonClassName({ variant: "secondary" })}
                >
                  取消
                </button>
                <Button type="button" onClick={() => void handleSubmit()} disabled={isSubmitting || !inputValue.trim()}>
                  {isSubmitting ? "创建中..." : "发送"}
                </Button>
              </div>
            </div>
          </div>
        </div>

        <aside className="hidden min-h-0 flex-col bg-[linear-gradient(180deg,#fbfbf8_0%,#f7f8fb_100%)] lg:flex">
          <div className="border-b border-line px-6 py-5">
            <div className="text-[12px] uppercase tracking-[0.16em] text-muted">Collection State</div>
            <h3 className="mt-2 text-[22px] font-semibold tracking-[-0.04em] text-text">信息收集进度</h3>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">
            <div className="space-y-3">
              {FIELD_ORDER.map((field) => {
                const answered = Boolean(answers[field.id]?.trim());
                return (
                  <div
                    key={field.id}
                    className={`rounded-[18px] border px-4 py-3 ${
                      answered
                        ? "border-[#cfe7d4] bg-[#eef8f0]"
                        : field.id === activeFieldId
                          ? "border-[#d7e4ff] bg-[#eef4ff]"
                          : "border-line bg-background"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="text-[13px] font-medium text-text">{field.label}</div>
                      <span className="text-[11px] text-muted-strong">{answered ? "已收集" : "待收集"}</span>
                    </div>
                    <p className="mt-2 text-[12px] leading-6 text-muted-strong">
                      {answered ? summarizeAnswer(answers[field.id] || "") : field.placeholder}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}

function buildInitialMessages(): OnboardingMessage[] {
  return [
    {
      id: crypto.randomUUID(),
      role: "assistant",
      content:
        "我会通过一小段对话帮你把新智能体初始化好。目标不是填表，而是把身份、职责、边界、工具偏好和长期上下文问清楚，最后再由我判断信息是否已经足够，然后和你确认是否可以结束。",
    },
    {
      id: crypto.randomUUID(),
      role: "assistant",
      content: FIELD_ORDER[0].prompt,
    },
  ];
}

function buildConfirmationMessage(answers: OnboardingAnswers) {
  return [
    "我判断当前信息已经足够完成初始化了。我先复述一下我的理解：",
    "",
    `- 名称：${answers.name}`,
    `- 角色标签：${answers.roleLabel}`,
    `- 简介：${answers.summary}`,
    `- 定位补充：${answers.description}`,
    `- 适用范围：${answers.availability}`,
    `- 风格气质：${summarizeAnswer(answers.tone)}`,
    `- 职责重点：${summarizeAnswer(answers.responsibilities)}`,
    `- 边界禁区：${summarizeAnswer(answers.boundaries)}`,
    "",
    "如果你认可，我就根据这些内容创建智能体，并生成 5 份 md 初稿。你可以直接回复“确认”或“可以创建”。如果还想调整，直接告诉我想改哪一项。",
  ].join("\n");
}

function buildRevisionPrompt(fieldId: OnboardingFieldId) {
  const field = FIELD_ORDER.find((item) => item.id === fieldId) || FIELD_ORDER[0];
  return `好，我们就改“${field.label}”。请直接告诉我你希望更新成什么内容。`;
}

function summarizeAnswer(value: string) {
  const normalized = value.replace(/\s+/g, " ").trim();
  return normalized.length > 60 ? `${normalized.slice(0, 57)}...` : normalized;
}

function looksConfirmed(value: string) {
  const normalized = value.trim().toLowerCase();
  return CONFIRM_KEYWORDS.some((keyword) => normalized.includes(keyword.toLowerCase()));
}

function matchField(value: string): OnboardingFieldId | null {
  const normalized = value.trim();

  const mappings: Array<[OnboardingFieldId, string[]]> = [
    ["name", ["名称", "名字"]],
    ["roleLabel", ["角色标签", "标签", "role"]],
    ["summary", ["简介", "使命", "核心职责"]],
    ["description", ["定位补充", "定位", "场景", "区别"]],
    ["availability", ["适用范围", "单聊", "团队", "team"]],
    ["tone", ["风格", "气质", "语气", "tone"]],
    ["responsibilities", ["职责重点", "职责", "必须做好"]],
    ["boundaries", ["边界", "禁区", "不要做", "谨慎"]],
    ["tools", ["工具", "工具偏好", "搜索", "浏览"]],
    ["userContext", ["用户协作偏好", "沟通偏好", "协作偏好", "用户画像"]],
    ["knowledge", ["长期知识", "知识", "背景", "术语"]],
  ];

  for (const [fieldId, keywords] of mappings) {
    if (keywords.some((keyword) => normalized.includes(keyword))) {
      return fieldId;
    }
  }

  return null;
}

function appendInterviewSection(markdown: string, title: string, content: string) {
  const trimmed = content.trim();

  if (!trimmed) {
    return markdown;
  }

  return `${markdown}\n\n## ${title}\n${trimmed}`;
}

function buildCreatePayload(answers: OnboardingAnswers) {
  const teamRole = inferTeamRole(answers.roleLabel, answers.summary);
  const availability = inferAvailability(answers.availability);
  const draft = generateAgentDraft({
    name: answers.name,
    summary: answers.summary,
    roleLabel: answers.roleLabel,
    description: answers.description,
    availability,
    teamRole,
  });

  const files: Partial<AgentFiles> = {
    identity: appendInterviewSection(
      draft.files.identity,
      "Interview Signals",
      [`- 期望气质与表达：${answers.tone}`, `- 适用范围：${answers.availability}`].join("\n"),
    ),
    contract: appendInterviewSection(
      appendInterviewSection(draft.files.contract, "Explicit Priorities", answers.responsibilities),
      "Explicit Boundaries",
      answers.boundaries,
    ),
    execution: appendInterviewSection(draft.files.execution, "Preferences From Interview", answers.tools),
    quality: appendInterviewSection(draft.files.quality, "Collaboration Preferences From Interview", answers.userContext),
    handoff: appendInterviewSection(draft.files.handoff, "Long-Term Context From Interview", answers.knowledge),
  };

  return {
    name: answers.name,
    summary: answers.summary,
    roleLabel: answers.roleLabel,
    description: [answers.description, `风格气质：${answers.tone}`].filter(Boolean).join("\n"),
    availability,
    teamRole,
    starterPrompts: draft.starterPrompts,
    files,
  };
}

function inferTeamRole(roleLabel: string, summary: string): AgentTeamRole {
  const text = `${roleLabel} ${summary}`.toLowerCase();

  if (/lead|manager|pm|strategy|strategist|产品|路线|规划/.test(text)) {
    return "lead";
  }

  if (/research|analyst|研究|调研|analysis/.test(text)) {
    return "research";
  }

  if (/writer|writing|文案|表达|editor/.test(text)) {
    return "writer";
  }

  return "specialist";
}

function inferAvailability(value: string): "solo" | "team" | "both" {
  const normalized = value.toLowerCase();

  if ((normalized.includes("单聊") || normalized.includes("solo")) && !normalized.includes("团队")) {
    return "solo";
  }

  if ((normalized.includes("团队") || normalized.includes("team")) && !normalized.includes("单聊")) {
    return "team";
  }

  return "both";
}
