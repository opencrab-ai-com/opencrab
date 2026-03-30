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
  const stream = new ReadableStream({
    async start(controller) {
      let latestText = "";
      let latestThinking: string[] = [];
      let latestThreadId: string | null = prepared.conversation.codexThreadId ?? null;
      let didComplete = false;
      let emittedErrorMessage: string | null = null;

      function emit(event: ReplyStreamEvent) {
        controller.enqueue(encoder.encode(`${JSON.stringify(event)}\n`));
      }

      try {
        for await (const event of streamCodexReply({
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
          signal: input.request.signal,
        })) {
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
          emittedErrorMessage =
            error instanceof Error ? error.message : "OpenCrab 回复生成失败。";
          emit({
            type: "error",
            error: emittedErrorMessage,
          });
        }
      } finally {
        if (
          !didComplete &&
          !input.request.signal.aborted &&
          !latestText.trim() &&
          !emittedErrorMessage
        ) {
          emit({
            type: "error",
            error: "OpenCrab 当前没有返回可用内容，请稍后再试。",
          });
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
