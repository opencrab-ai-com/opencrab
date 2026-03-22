import Link from "next/link";
import { StatusPill as UnifiedStatusPill } from "@/components/ui/pill";
import type { ChannelDetail } from "@/lib/channels/types";

export function ChannelActivityPanel({ channel }: { channel: ChannelDetail }) {
  return (
    <details className="rounded-[24px] border border-line bg-surface p-6 shadow-soft">
      <summary className="cursor-pointer list-none text-[17px] font-semibold tracking-[-0.03em] text-text">
        最近对话与事件
      </summary>
      <div className="mt-5 space-y-6">
        <section>
          <h3 className="text-[15px] font-medium text-text">已绑定对话</h3>
          <div className="mt-4 space-y-3">
            {channel.bindings.length ? (
              channel.bindings.map((binding) => (
                <Link
                  key={binding.id}
                  href={`/conversations/${binding.conversationId}`}
                  className="block rounded-[18px] border border-line bg-background px-4 py-4 transition hover:border-text/20"
                >
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <div className="text-[14px] font-medium text-text">
                        {binding.remoteUserLabel || binding.remoteChatLabel}
                      </div>
                      <div className="mt-1 text-[12px] leading-5 text-muted">
                        chat: {binding.remoteChatLabel}
                      </div>
                      <div className="mt-1 text-[12px] leading-5 text-muted">
                        conversation: {binding.conversation?.title || binding.conversationId}
                      </div>
                    </div>
                    <div className="shrink-0 text-[12px] text-muted">
                      {binding.lastInboundAt || binding.updatedAt}
                    </div>
                  </div>
                </Link>
              ))
            ) : (
              <p className="text-[14px] text-muted-strong">还没有外部会话进入这个 channel。</p>
            )}
          </div>
        </section>

        <section>
          <h3 className="text-[15px] font-medium text-text">最近事件</h3>
          <div className="mt-4 space-y-3">
            {channel.events.length ? (
              channel.events.slice(0, 12).map((event) => (
                <div
                  key={event.id}
                  className="rounded-[18px] border border-line bg-background px-4 py-4"
                >
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-[13px] font-medium text-text">
                          {event.direction === "inbound"
                            ? "入站消息"
                            : event.direction === "outbound"
                              ? "出站消息"
                              : "系统事件"}
                        </span>
                        <EventStatusBadge status={event.status} />
                      </div>
                      <div className="mt-2 text-[13px] leading-6 text-muted-strong">
                        {event.summary}
                      </div>
                      {event.errorMessage ? (
                        <div className="mt-2 text-[12px] text-[#b42318]">{event.errorMessage}</div>
                      ) : null}
                    </div>
                    <div className="shrink-0 text-right text-[12px] text-muted">
                      <div className="font-mono">{event.createdAt}</div>
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <p className="text-[14px] text-muted-strong">这个 channel 还没有收到事件。</p>
            )}
          </div>
        </section>
      </div>
    </details>
  );
}

function EventStatusBadge({ status }: { status: string }) {
  const tone =
    status === "sent" || status === "processed"
      ? "success"
      : status === "error"
        ? "danger"
        : "neutral";

  return <UnifiedStatusPill tone={tone} size="sm">{status}</UnifiedStatusPill>;
}
