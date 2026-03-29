import { getAgentProfile } from "@/lib/agents/agent-store";
import { streamCodexReply } from "@/lib/codex/sdk";
import {
  finalizeConversationTurn,
  prepareConversationTurn,
} from "@/lib/conversations/run-conversation-turn";
import { addMessage, updateConversation } from "@/lib/resources/local-store";
import type {
  CodexReasoningEffort,
  CodexSandboxMode,
  ReplyStreamEvent,
} from "@/lib/resources/opencrab-api-types";

const DEFAULT_REPLY_STREAM_HEARTBEAT_INTERVAL_MS = 10_000;
const REPLY_STREAM_IDLE_TIMEOUT_BY_REASONING_EFFORT_MS: Record<
  CodexReasoningEffort,
  number
> = {
  minimal: 60_000,
  low: 60_000,
  medium: 90_000,
  high: 180_000,
  xhigh: 300_000,
};

type BuildConversationReplyStreamInput = {
  request: Request;
  conversationId: string;
  body: {
    content?: string;
    model?: string;
    reasoningEffort?: CodexReasoningEffort;
    sandboxMode?: CodexSandboxMode;
    attachmentIds?: string[];
    userMessageId?: string;
    assistantMessageId?: string;
  };
};

class ReplyStreamIdleTimeoutError extends Error {
  constructor(readonly timeoutMs: number) {
    super(
      `OpenCrab 长时间没有返回内容（超过 ${Math.max(1, Math.round(timeoutMs / 1000))} 秒），本次回复已自动停止，请重试。`,
    );
    this.name = "ReplyStreamIdleTimeoutError";
  }
}

export async function buildConversationReplyStream(
  input: BuildConversationReplyStreamInput,
) {
  const prepared = prepareConversationTurn({
    conversationId: input.conversationId,
    content: input.body.content,
    model: input.body.model,
    reasoningEffort: input.body.reasoningEffort,
    sandboxMode: input.body.sandboxMode,
    attachmentIds: input.body.attachmentIds,
    userMessageId: input.body.userMessageId,
    assistantMessageId: input.body.assistantMessageId,
  });
  const encoder = new TextEncoder();
  const streamAbortController = createLinkedAbortController(input.request.signal);
  const stream = new ReadableStream({
    async start(controller) {
      let latestText = "";
      let latestThinking: string[] = [];
      let latestThreadId: string | null = prepared.conversation.codexThreadId ?? null;
      let didComplete = false;
      let didEmitTerminalEvent = false;
      const replyIterator = streamCodexReply({
        conversationTitle: prepared.conversation.title,
        threadId: prepared.conversation.codexThreadId,
        content: prepared.content,
        agentProfile: prepared.conversation.agentProfileId
          ? getAgentProfile(prepared.conversation.agentProfileId)
          : null,
        model: input.body.model,
        reasoningEffort: input.body.reasoningEffort,
        sandboxMode: input.body.sandboxMode ?? prepared.sandboxMode,
        workingDirectory: prepared.workingDirectory,
        imagePaths: prepared.imagePaths,
        textAttachments: prepared.textAttachments,
        signal: streamAbortController.signal,
      })[Symbol.asyncIterator]();

      function emit(event: ReplyStreamEvent) {
        controller.enqueue(encoder.encode(`${JSON.stringify(event)}\n`));
      }

      try {
        while (true) {
          const timeoutMs = resolveReplyStreamIdleTimeoutMs(input.body.reasoningEffort);
          const next = await readNextReplyStreamEventWithTimeout(
            replyIterator,
            timeoutMs,
            resolveReplyStreamHeartbeatIntervalMs(timeoutMs),
            {
              onHeartbeat: () => {
                controller.enqueue(encoder.encode("\n"));
              },
              onTimeout: () => {
                streamAbortController.abort();
              },
            },
          );

          if (next.done) {
            break;
          }

          const event = next.value;
          if (event.type === "thread") {
            latestThreadId = event.threadId;
            updateConversation(input.conversationId, {
              codexThreadId: event.threadId,
              lastAssistantModel:
                input.body.model || prepared.conversation.lastAssistantModel || null,
            });
            emit(event);
            continue;
          }

          if (event.type === "thinking") {
            latestThinking = event.entries;
            emit(event);
            continue;
          }

          if (event.type === "assistant") {
            latestText = event.text;
            emit(event);
            continue;
          }

          latestText = event.text;
          latestThinking = event.thinking;
          latestThreadId = event.threadId;
          const assistantMessageResult = finalizeConversationTurn(prepared, {
            text: event.text,
            model: event.model,
            threadId: event.threadId,
            usage: event.usage,
            thinking: event.thinking,
          });

          emit({
            type: "done",
            snapshot: assistantMessageResult.snapshot,
            assistant: {
              text: event.text,
              model: event.model,
              threadId: event.threadId,
              usage: event.usage,
              thinking: event.thinking,
            },
          });
          didComplete = true;
          didEmitTerminalEvent = true;
        }
      } catch (error) {
        if (input.request.signal.aborted) {
          if (latestThreadId) {
            updateConversation(input.conversationId, {
              codexThreadId: latestThreadId,
              lastAssistantModel:
                input.body.model || prepared.conversation.lastAssistantModel || null,
            });
          }

          addMessage(input.conversationId, {
            id: prepared.assistantMessageId,
            role: "assistant",
            content: latestText.trim() || "已停止当前回复。",
            thinking: latestThinking,
            meta: `已停止 · ${input.body.model || prepared.conversation.lastAssistantModel || "OpenCrab"}`,
            status: "stopped",
          });
        } else {
          emit({
            type: "error",
            error: getReplyStreamErrorMessage(error),
          });
          didEmitTerminalEvent = true;
        }
      } finally {
        streamAbortController.dispose();

        if (
          !didComplete &&
          !didEmitTerminalEvent &&
          !input.request.signal.aborted &&
          !latestText.trim()
        ) {
          emit({
            type: "error",
            error: "OpenCrab 当前没有返回可用内容，请稍后再试。",
          });
          didEmitTerminalEvent = true;
        }

        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "application/x-ndjson; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}

function getReplyStreamErrorMessage(error: unknown) {
  if (error instanceof ReplyStreamIdleTimeoutError) {
    return error.message;
  }

  return error instanceof Error ? error.message : "OpenCrab 回复生成失败。";
}

function resolveReplyStreamIdleTimeoutMs(reasoningEffort?: CodexReasoningEffort) {
  const parsed = Number.parseInt(
    process.env.OPENCRAB_REPLY_STREAM_IDLE_TIMEOUT_MS || "",
    10,
  );

  if (Number.isFinite(parsed) && parsed > 0) {
    return parsed;
  }

  return REPLY_STREAM_IDLE_TIMEOUT_BY_REASONING_EFFORT_MS[reasoningEffort || "medium"];
}

function resolveReplyStreamHeartbeatIntervalMs(timeoutMs: number) {
  const parsed = Number.parseInt(
    process.env.OPENCRAB_REPLY_STREAM_HEARTBEAT_INTERVAL_MS || "",
    10,
  );
  const configured = Number.isFinite(parsed) && parsed > 0
    ? parsed
    : DEFAULT_REPLY_STREAM_HEARTBEAT_INTERVAL_MS;

  return Math.min(configured, Math.max(1, timeoutMs));
}

async function readNextReplyStreamEventWithTimeout<T>(
  iterator: AsyncIterator<T>,
  timeoutMs: number,
  heartbeatIntervalMs: number,
  callbacks: {
    onHeartbeat: () => void;
    onTimeout: () => void;
  },
) {
  const startedAt = Date.now();
  const nextPromise = iterator.next();

  while (true) {
    const elapsedMs = Date.now() - startedAt;
    const remainingMs = timeoutMs - elapsedMs;

    if (remainingMs <= 0) {
      callbacks.onTimeout();
      throw new ReplyStreamIdleTimeoutError(timeoutMs);
    }

    const waitMs = Math.min(heartbeatIntervalMs, remainingMs);
    const result = await new Promise<
      | { kind: "next"; value: IteratorResult<T> }
      | { kind: "heartbeat" }
    >((resolve, reject) => {
      const timerId = setTimeout(() => {
        resolve({ kind: "heartbeat" });
      }, waitMs);

      nextPromise.then(
        (value) => {
          clearTimeout(timerId);
          resolve({ kind: "next", value });
        },
        (error) => {
          clearTimeout(timerId);
          reject(error);
        },
      );
    });

    if (result.kind === "next") {
      return result.value;
    }

    callbacks.onHeartbeat();
  }
}

function createLinkedAbortController(signal: AbortSignal) {
  const controller = new AbortController();
  const forwardAbort = () => {
    controller.abort();
  };

  if (signal.aborted) {
    controller.abort();
  } else {
    signal.addEventListener("abort", forwardAbort, { once: true });
  }

  return {
    signal: controller.signal,
    abort: () => controller.abort(),
    dispose: () => {
      signal.removeEventListener("abort", forwardAbort);
    },
  };
}
