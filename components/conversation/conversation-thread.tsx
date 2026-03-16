"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { useOpenCrabApp } from "@/components/app-shell/opencrab-provider";
import type { AttachmentItem } from "@/lib/seed-data";
import { buildConversationDetailViewModel } from "@/lib/view-models/conversations";

type ConversationThreadProps = {
  conversationId: string;
  title?: string;
};

export function ConversationThread({ conversationId, title }: ConversationThreadProps) {
  const { conversations, conversationMessages } = useOpenCrabApp();
  const bottomRef = useRef<HTMLDivElement | null>(null);
  const [thinkingOverrides, setThinkingOverrides] = useState<Record<string, boolean>>({});
  const activeConversation = useMemo(
    () => conversations.find((item) => item.id === conversationId),
    [conversationId, conversations],
  );
  const detailViewModel = useMemo(
    () =>
      buildConversationDetailViewModel({
        title: title ?? activeConversation?.title,
        messages: conversationMessages[conversationId] ?? [],
      }),
    [activeConversation?.title, conversationId, conversationMessages, title],
  );

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: "end" });
  }, [detailViewModel.messages]);

  return (
    <div className="flex flex-col px-6 pt-8 pb-10 lg:px-8">
      <div className="w-full max-w-[1180px]">
        <div className="mb-8">
          <div>
            <p className="text-[13px] text-muted">OpenCrab</p>
            <h1 className="mt-1 text-[22px] font-semibold tracking-[-0.03em] text-text">
              {detailViewModel.title}
            </h1>
          </div>
        </div>

        <div className="flex flex-col gap-6">
          {detailViewModel.messages.map((message) => (
            <article
              key={message.id}
              className={`max-w-[760px] rounded-[24px] px-5 py-4 ${
                message.role === "user"
                  ? "self-end bg-[#f4f4f0] text-text"
                  : "self-start border border-line bg-surface text-text shadow-soft"
              }`}
            >
              <div className="mb-2 text-[11px] text-muted">{message.role === "user" ? "你" : "OpenCrab"}</div>
              {message.role === "assistant" && message.thinking?.length ? (
                <ThinkingPanel
                  entries={message.thinking}
                  isPending={message.status === "pending"}
                  isExpanded={thinkingOverrides[message.id] ?? message.status === "pending"}
                  onToggle={() =>
                    setThinkingOverrides((current) => ({
                      ...current,
                      [message.id]: !(current[message.id] ?? (message.status === "pending")),
                    }))
                  }
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
          ))}
          <div ref={bottomRef} />
        </div>
      </div>
    </div>
  );
}

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

function MarkdownMessage({ content }: { content: string }) {
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
}

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

  return "文本附件";
}
