import { afterEach, describe, expect, it, vi } from "vitest";
import { streamReplyToConversation } from "@/lib/resources/opencrab-api";
import type { ReplyStreamEvent } from "@/lib/resources/opencrab-api-types";

function createNdjsonResponse(events: ReplyStreamEvent[]) {
  const encoder = new TextEncoder();

  return new Response(
    new ReadableStream({
      start(controller) {
        for (const event of events) {
          controller.enqueue(encoder.encode(`${JSON.stringify(event)}\n`));
        }

        controller.close();
      },
    }),
    {
      status: 200,
      headers: {
        "Content-Type": "application/x-ndjson; charset=utf-8",
      },
    },
  );
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("streamReplyToConversation", () => {
  it("throws when the stream closes without a terminal event", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        createNdjsonResponse([
          {
            type: "assistant",
            text: "先给你一个草稿",
          },
        ]),
      ),
    );

    await expect(
      streamReplyToConversation(
        "conversation-1",
        {
          content: "你好",
          model: "gpt-5.4",
          reasoningEffort: "high",
          userMessageId: "message-user-1",
          assistantMessageId: "message-assistant-1",
        },
        {
          onEvent: vi.fn(),
        },
      ),
    ).rejects.toThrow("OpenCrab 回复流在完成前中断了，请重试。");
  });

  it("accepts a stream that ends with an error event", async () => {
    const onEvent = vi.fn();

    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        createNdjsonResponse([
          {
            type: "assistant",
            text: "先给你一个草稿",
          },
          {
            type: "error",
            error: "OpenCrab 回复在完成前中断了，请重试。",
          },
        ]),
      ),
    );

    await expect(
      streamReplyToConversation(
        "conversation-1",
        {
          content: "你好",
          model: "gpt-5.4",
          reasoningEffort: "high",
          userMessageId: "message-user-1",
          assistantMessageId: "message-assistant-1",
        },
        {
          onEvent,
        },
      ),
    ).resolves.toBeUndefined();

    expect(onEvent).toHaveBeenCalledTimes(2);
  });
});
