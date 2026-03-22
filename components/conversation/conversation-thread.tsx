"use client";

import { memo, useCallback, useDeferredValue, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { AgentAvatar } from "@/components/agents/agent-avatar";
import { useOpenCrabApp } from "@/components/app-shell/opencrab-provider";
import type { AgentProfileRecord } from "@/lib/agents/types";
import type { AttachmentItem } from "@/lib/seed-data";
import { formatConversationMessageTimestamp } from "@/lib/conversations/utils";
import { buildConversationDetailViewModel } from "@/lib/view-models/conversations";

type ConversationThreadProps = {
  conversationId: string;
};

const INITIAL_VISIBLE_MESSAGE_COUNT = 18;
const MESSAGE_PAGE_SIZE = 12;
const LOAD_MORE_THRESHOLD_PX = 80;

export const ConversationThread = memo(function ConversationThread({
  conversationId,
}: ConversationThreadProps) {
  return <ConversationThreadBody key={conversationId} conversationId={conversationId} />;
});

function ConversationThreadBody({ conversationId }: ConversationThreadProps) {
  const { agents, conversations, conversationMessages } = useOpenCrabApp();
  const threadRef = useRef<HTMLDivElement | null>(null);
  const bottomRef = useRef<HTMLDivElement | null>(null);
  const shouldStickToBottomRef = useRef(true);
  const prependScrollAnchorRef = useRef<{ scrollHeight: number; scrollTop: number } | null>(null);
  const [thinkingOverrides, setThinkingOverrides] = useState<Record<string, boolean>>({});
  const [visibleStartIndex, setVisibleStartIndex] = useState(() =>
    Math.max((conversationMessages[conversationId] ?? []).length - INITIAL_VISIBLE_MESSAGE_COUNT, 0),
  );
  const activeConversation = useMemo(
    () => conversations.find((item) => item.id === conversationId),
    [conversationId, conversations],
  );
  const agentsById = useMemo(() => new Map(agents.map((agent) => [agent.id, agent] as const)), [agents]);
  const agentsByName = useMemo(() => new Map(agents.map((agent) => [agent.name, agent] as const)), [agents]);
  const rawMessages = conversationMessages[conversationId] ?? [];
  const deferredMessages = useDeferredValue(rawMessages);
  const detailViewModel = useMemo(
    () =>
      buildConversationDetailViewModel({
        title: activeConversation?.title,
        messages: deferredMessages,
      }),
    [activeConversation?.title, deferredMessages],
  );
  const effectiveVisibleStartIndex =
    visibleStartIndex > detailViewModel.messages.length - 1
      ? Math.max(detailViewModel.messages.length - INITIAL_VISIBLE_MESSAGE_COUNT, 0)
      : visibleStartIndex;
  const visibleMessages = useMemo(
    () => detailViewModel.messages.slice(effectiveVisibleStartIndex),
    [detailViewModel.messages, effectiveVisibleStartIndex],
  );
  const hiddenMessageCount = effectiveVisibleStartIndex;
  const tailKey = useMemo(() => {
    const lastMessage = visibleMessages.at(-1);

    if (!lastMessage) {
      return `${conversationId}:0`;
    }

    return [
      conversationId,
      visibleMessages.length,
      lastMessage.id,
      lastMessage.status,
      lastMessage.content.length,
      lastMessage.thinking?.length || 0,
    ].join(":");
  }, [conversationId, visibleMessages]);

  const revealEarlierMessages = useCallback(() => {
    const container = threadRef.current?.parentElement;

    if (!container) {
      return;
    }

    setVisibleStartIndex((current) => {
      if (current <= 0) {
        return 0;
      }

      prependScrollAnchorRef.current = {
        scrollHeight: container.scrollHeight,
        scrollTop: container.scrollTop,
      };

      return Math.max(0, current - MESSAGE_PAGE_SIZE);
    });
  }, []);

  useEffect(() => {
    const container = threadRef.current?.parentElement;

    if (!container) {
      return;
    }

    const updateStickiness = () => {
      const distanceToBottom =
        container.scrollHeight - container.scrollTop - container.clientHeight;
      shouldStickToBottomRef.current = distanceToBottom <= 80;

      if (
        container.scrollTop <= LOAD_MORE_THRESHOLD_PX &&
        effectiveVisibleStartIndex > 0 &&
        !prependScrollAnchorRef.current
      ) {
        revealEarlierMessages();
      }
    };

    updateStickiness();
    container.addEventListener("scroll", updateStickiness, { passive: true });

    return () => {
      container.removeEventListener("scroll", updateStickiness);
    };
  }, [conversationId, effectiveVisibleStartIndex, revealEarlierMessages]);

  useLayoutEffect(() => {
    const container = threadRef.current?.parentElement;
    const anchor = prependScrollAnchorRef.current;

    if (!container || !anchor) {
      return;
    }

    const addedHeight = container.scrollHeight - anchor.scrollHeight;
    container.scrollTo({ top: anchor.scrollTop + addedHeight });
    prependScrollAnchorRef.current = null;
  }, [visibleStartIndex, visibleMessages.length]);

  useEffect(() => {
    if (!shouldStickToBottomRef.current) {
      return;
    }

    requestAnimationFrame(() => {
      bottomRef.current?.scrollIntoView({ block: "end" });
    });
  }, [tailKey]);

  return (
    <div ref={threadRef} className="flex flex-col px-6 pt-8 pb-10 lg:px-8">
      <div className="mx-auto w-full max-w-[1180px]">
        <div className="flex flex-col gap-6">
          {hiddenMessageCount > 0 ? (
            <button
              type="button"
              onClick={revealEarlierMessages}
              className="mx-auto w-full max-w-[760px] rounded-[20px] border border-dashed border-line bg-surface-muted/70 px-4 py-3 text-left text-[13px] leading-6 text-muted-strong transition hover:bg-surface-muted"
            >
              已折叠更早的 {hiddenMessageCount} 条消息，向上滚动或点这里继续加载，避免长历史把当前输入拖慢。
            </button>
          ) : null}
          {visibleMessages.map((message) => (
            <ConversationMessageCard
              key={message.id}
              message={message}
              avatarDataUrl={resolveAssistantAvatar({
                agentsById,
                agentsByName,
                activeConversationAgentId: activeConversation?.agentProfileId ?? null,
                message,
              })}
              isThinkingExpanded={thinkingOverrides[message.id] ?? message.status === "pending"}
              onToggleThinking={() =>
                setThinkingOverrides((current) => ({
                  ...current,
                  [message.id]: !(current[message.id] ?? (message.status === "pending")),
                }))
              }
            />
          ))}
          <div ref={bottomRef} />
        </div>
      </div>
    </div>
  );
}

const ConversationMessageCard = memo(function ConversationMessageCard({
  message,
  avatarDataUrl,
  isThinkingExpanded,
  onToggleThinking,
}: {
  message: ReturnType<typeof buildConversationDetailViewModel>["messages"][number];
  avatarDataUrl: string | null;
  isThinkingExpanded: boolean;
  onToggleThinking: () => void;
}) {
  const actorName =
    message.role === "assistant"
      ? message.actorLabel || "OpenCrab"
      : message.source === "telegram"
        ? "Telegram 用户"
        : message.source === "feishu"
          ? "飞书用户"
          : message.source === "task"
            ? "定时任务"
            : "我";

  return (
    <article
      className={`max-w-[760px] rounded-[24px] px-5 py-4 ${
        message.role === "user"
          ? "self-end bg-[#f4f4f0] text-text"
          : "self-start border border-line bg-surface text-text shadow-soft"
      }`}
    >
      <div className="mb-3 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          {message.role === "assistant" ? (
            <AgentAvatar src={avatarDataUrl} name={actorName} size={32} className="rounded-[14px]" />
          ) : null}
          <div className="inline-flex items-center gap-2 rounded-full border border-[#e8e3d7] bg-[#fbf8f1] px-3 py-1.5">
            <span className="text-[13px] font-semibold tracking-[-0.02em] text-text">{actorName}</span>
          </div>
        </div>
        <span className="text-[11px] text-muted">{formatConversationMessageTimestamp(message.timestamp)}</span>
      </div>
      {message.role === "assistant" && message.thinking?.length ? (
        <ThinkingPanel
          entries={message.thinking}
          isPending={message.status === "pending"}
          isExpanded={isThinkingExpanded}
          onToggle={onToggleThinking}
        />
      ) : null}

      {message.content ? (
        message.role === "assistant" ? (
          <MarkdownMessage content={message.content} />
        ) : (
          <p className="whitespace-pre-wrap text-[14px] leading-[1.8]">{message.content}</p>
        )
      ) : message.role === "assistant" && message.status === "pending" ? (
        <p className="text-[14px] leading-[1.8] text-muted-strong">OpenCrab 正在回复中...</p>
      ) : null}
      {message.attachments?.length ? (
        <div className="mt-3 flex flex-wrap gap-3">
          {message.attachments.map((attachment) => (
            <AttachmentCard key={attachment.id} attachment={attachment} />
          ))}
        </div>
      ) : null}
      {message.role === "assistant" && message.usedAttachmentNames?.length ? (
        <div className="mt-3 rounded-[16px] border border-line bg-surface-muted px-3 py-2 text-[11px] text-muted-strong">
          本轮已结合附件：{message.usedAttachmentNames.join("、")}
        </div>
      ) : null}
      {message.meta ? (
        <div className="mt-3 flex items-center gap-2 text-[11px] text-muted">
          {message.role === "assistant" && message.status === "pending" ? <ThinkingSpinner isActive /> : null}
          <span>{message.meta}</span>
        </div>
      ) : null}
    </article>
  );
});

function AttachmentCard({ attachment }: { attachment: AttachmentItem }) {
  if (attachment.kind === "image") {
    return (
      <a
        href={`/api/uploads/${attachment.id}`}
        target="_blank"
        rel="noreferrer"
        className="block overflow-hidden rounded-[18px] border border-line bg-surface-muted"
      >
        <Image
          src={`/api/uploads/${attachment.id}`}
          alt={attachment.name}
          width={220}
          height={144}
          unoptimized
          className="h-[144px] w-[220px] object-cover"
        />
        <div className="border-t border-line px-3 py-2">
          <div className="text-[11px] text-muted-strong">{attachment.name}</div>
          {attachment.wasUsedInReply ? (
            <div className="mt-1 text-[10px] font-medium text-[#0b66da]">已用于本轮回复</div>
          ) : null}
        </div>
      </a>
    );
  }

  return (
    <a
      href={`/api/uploads/${attachment.id}`}
      target="_blank"
      rel="noreferrer"
      className="flex min-w-[220px] items-center gap-3 rounded-[18px] border border-line bg-surface-muted px-4 py-3"
    >
      <TextFileIcon />
      <div className="min-w-0">
        <div className="truncate text-[12px] font-medium text-text">{attachment.name}</div>
        <div className="text-[11px] text-muted-strong">
          {getAttachmentLabel(attachment)}
          {attachment.wasUsedInReply ? " · 已用于本轮回复" : ""}
        </div>
      </div>
    </a>
  );
}

function resolveAssistantAvatar({
  agentsById,
  agentsByName,
  activeConversationAgentId,
  message,
}: {
  agentsById: Map<string, AgentProfileRecord>;
  agentsByName: Map<string, AgentProfileRecord>;
  activeConversationAgentId: string | null;
  message: ReturnType<typeof buildConversationDetailViewModel>["messages"][number];
}) {
  if (message.role !== "assistant") {
    return null;
  }

  const conversationAgent = activeConversationAgentId ? agentsById.get(activeConversationAgentId) ?? null : null;

  if (conversationAgent?.avatarDataUrl) {
    return conversationAgent.avatarDataUrl;
  }

  if (message.actorLabel) {
    return agentsByName.get(message.actorLabel)?.avatarDataUrl ?? null;
  }

  return null;
}

function ThinkingPanel({
  entries,
  isPending,
  isExpanded,
  onToggle,
}: {
  entries: string[];
  isPending: boolean;
  isExpanded: boolean;
  onToggle: () => void;
}) {
  return (
    <div className="mb-3 rounded-[18px] border border-dashed border-line bg-surface-muted px-4 py-3">
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-center justify-between gap-3 text-left"
      >
        <div className="flex items-center gap-2 text-[11px] font-medium text-muted-strong">
          <ThinkingSpinner isActive={isPending} />
          <span>{isPending ? "Thinking" : "本轮思考过程"}</span>
        </div>
        <div className="flex items-center gap-2 text-[11px] text-muted">
          {!isPending ? <span>{isExpanded ? "收起" : "查看详情"}</span> : null}
          <ChevronIcon expanded={isExpanded} />
        </div>
      </button>

      {isExpanded ? (
        <div className="mt-3 space-y-2 border-t border-line pt-3">
          {entries.map((entry, index) => (
            <p
              key={`thinking-${index}`}
              className="whitespace-pre-wrap text-[12px] leading-6 text-muted-strong"
            >
              {entry}
            </p>
          ))}
        </div>
      ) : null}
    </div>
  );
}

const MarkdownMessage = memo(function MarkdownMessage({ content }: { content: string }) {
  return (
    <div className="markdown-body text-[14px] leading-[1.8] text-text">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          a: ({ ...props }) => (
            <a
              {...props}
              target="_blank"
              rel="noreferrer"
              className="text-[#0b66da] underline underline-offset-2"
            />
          ),
          code: ({ className, children, ...props }) => {
            const isBlock = Boolean(className);

            if (!isBlock) {
              return (
                <code
                  {...props}
                  className="rounded bg-[#f3f3ef] px-1.5 py-0.5 text-[0.92em] text-[#3f3f39]"
                >
                  {children}
                </code>
              );
            }

            return (
              <code {...props} className={className}>
                {children}
              </code>
            );
          },
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
});

function TextFileIcon() {
  return (
    <svg viewBox="0 0 20 20" className="h-5 w-5 shrink-0 fill-none stroke-current text-muted-strong" strokeWidth="1.7">
      <path d="M6 2.5h5l3 3V16a1.5 1.5 0 0 1-1.5 1.5h-6A1.5 1.5 0 0 1 5 16V4A1.5 1.5 0 0 1 6.5 2.5" />
      <path d="M11 2.5V6h3.5" />
      <path d="M7.5 9h5M7.5 12h5M7.5 15H11" strokeLinecap="round" />
    </svg>
  );
}

function ChevronIcon({ expanded }: { expanded: boolean }) {
  return (
    <svg
      viewBox="0 0 20 20"
      className={`h-4 w-4 shrink-0 stroke-current transition-transform ${expanded ? "rotate-180" : ""}`}
      strokeWidth="1.7"
    >
      <path d="m5.5 7.5 4.5 4.5 4.5-4.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function ThinkingSpinner({ isActive = false }: { isActive?: boolean }) {
  return (
    <span className="flex items-center gap-1">
      <span className={`h-1.5 w-1.5 rounded-full bg-current ${isActive ? "animate-pulse" : "opacity-70"}`} />
      <span
        className={`h-1.5 w-1.5 rounded-full bg-current ${isActive ? "animate-pulse [animation-delay:120ms]" : "opacity-50"}`}
      />
      <span
        className={`h-1.5 w-1.5 rounded-full bg-current ${isActive ? "animate-pulse [animation-delay:240ms]" : "opacity-30"}`}
      />
    </span>
  );
}

function getAttachmentLabel(attachment: AttachmentItem) {
  if (attachment.mimeType === "application/pdf") {
    return "PDF 文档";
  }

  if (
    attachment.mimeType === "application/msword" ||
    attachment.mimeType === "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
  ) {
    return "Word 文档";
  }

  if (attachment.kind === "file") {
    return "文件附件";
  }

  return "文本附件";
}
