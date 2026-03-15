import { conversationMessages, conversations } from "@/lib/mock-data";

type ConversationThreadProps = {
  conversationId: string;
};

export function ConversationThread({ conversationId }: ConversationThreadProps) {
  const activeConversation = conversations.find((item) => item.id === conversationId);
  const messages = conversationMessages[conversationId] ?? [];

  return (
    <div className="flex flex-col px-6 pt-8 pb-10 lg:px-8">
      <div className="w-full max-w-[1180px]">
        <div className="mb-8 flex items-center justify-between gap-4">
          <div>
            <p className="text-sm text-muted">OpenCrab</p>
            <h1 className="mt-1 text-[26px] font-semibold tracking-[-0.03em] text-text">
              {activeConversation?.title ?? "对话"}
            </h1>
          </div>
          <div className="rounded-full border border-line bg-surface-muted px-4 py-2 text-sm text-muted-strong">
            GPT-5 Codex
          </div>
        </div>

        <div className="flex flex-col gap-6">
          {messages.map((message) => (
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
              {message.meta ? <div className="mt-3 text-xs text-muted">{message.meta}</div> : null}
            </article>
          ))}
        </div>
      </div>
    </div>
  );
}
