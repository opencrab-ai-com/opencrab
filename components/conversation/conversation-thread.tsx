"use client";

import { useEffect, useMemo, useRef } from "react";
import Image from "next/image";
import { useOpenCrabApp } from "@/components/app-shell/opencrab-provider";
import type { AttachmentItem } from "@/lib/mock-data";
import { buildConversationDetailViewModel } from "@/lib/view-models/conversations";

type ConversationThreadProps = {
  conversationId: string;
  title?: string;
};

export function ConversationThread({ conversationId, title }: ConversationThreadProps) {
  const { conversations, conversationMessages } = useOpenCrabApp();
  const bottomRef = useRef<HTMLDivElement | null>(null);
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
        <div className="mb-8 flex items-center justify-between gap-4">
          <div>
            <p className="text-sm text-muted">OpenCrab</p>
            <h1 className="mt-1 text-[26px] font-semibold tracking-[-0.03em] text-text">
              {detailViewModel.title}
            </h1>
          </div>
          <div className="rounded-full border border-line bg-surface-muted px-4 py-2 text-sm text-muted-strong">
            {activeConversation?.lastAssistantModel || "Codex"}
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
              <div className="mb-2 text-xs text-muted">{message.role === "user" ? "你" : "OpenCrab"}</div>
              <p className="whitespace-pre-wrap text-[15px] leading-7">{message.content}</p>
              {message.attachments?.length ? (
                <div className="mt-3 flex flex-wrap gap-3">
                  {message.attachments.map((attachment) => (
                    <AttachmentCard key={attachment.id} attachment={attachment} />
                  ))}
                </div>
              ) : null}
              {message.meta ? <div className="mt-3 text-xs text-muted">{message.meta}</div> : null}
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
        <div className="border-t border-line px-3 py-2 text-[12px] text-muted-strong">{attachment.name}</div>
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
        <div className="truncate text-[13px] font-medium text-text">{attachment.name}</div>
        <div className="text-[12px] text-muted-strong">文本附件</div>
      </div>
    </a>
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
