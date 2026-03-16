import { NextResponse } from "next/server";
import { streamCodexReply } from "@/lib/codex/sdk";
import {
  ConversationTurnError,
  finalizeConversationTurn,
  prepareConversationTurn,
} from "@/lib/conversations/run-conversation-turn";
import { addMessage, updateConversation } from "@/lib/resources/local-store";
import type { ReplyStreamEvent } from "@/lib/resources/opencrab-api-types";
import type { CodexReasoningEffort, CodexSandboxMode } from "@/lib/resources/opencrab-api-types";

export async function POST(
  request: Request,
  context: { params: Promise<{ conversationId: string }> },
) {
  try {
    const { conversationId } = await context.params;
    const body = (await request.json()) as {
      content?: string;
      model?: string;
      reasoningEffort?: CodexReasoningEffort;
      sandboxMode?: CodexSandboxMode;
      attachmentIds?: string[];
      userMessageId?: string;
      assistantMessageId?: string;
    };
    const prepared = prepareConversationTurn({
      conversationId,
      content: body.content,
      model: body.model,
      reasoningEffort: body.reasoningEffort,
      sandboxMode: body.sandboxMode,
      attachmentIds: body.attachmentIds,
      userMessageId: body.userMessageId,
      assistantMessageId: body.assistantMessageId,
    });

    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        let latestText = "";
        let latestThinking: string[] = [];
        let latestThreadId: string | null = prepared.conversation.codexThreadId ?? null;
        let didComplete = false;

        function emit(event: ReplyStreamEvent) {
          controller.enqueue(encoder.encode(`${JSON.stringify(event)}\n`));
        }

        try {
          for await (const event of streamCodexReply({
            conversationTitle: prepared.conversation.title,
            threadId: prepared.conversation.codexThreadId,
            content: prepared.content,
            model: body.model,
            reasoningEffort: body.reasoningEffort,
            sandboxMode: body.sandboxMode,
            imagePaths: prepared.imagePaths,
            textAttachments: prepared.textAttachments,
            signal: request.signal,
          })) {
            if (event.type === "thread") {
              latestThreadId = event.threadId;
              updateConversation(conversationId, {
                codexThreadId: event.threadId,
                lastAssistantModel: body.model || prepared.conversation.lastAssistantModel || null,
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
          if (request.signal.aborted) {
            if (latestThreadId) {
              updateConversation(conversationId, {
                codexThreadId: latestThreadId,
                lastAssistantModel: body.model || prepared.conversation.lastAssistantModel || null,
              });
            }

            addMessage(conversationId, {
              id: prepared.assistantMessageId,
              role: "assistant",
              content: latestText.trim() || "已停止当前回复。",
              thinking: latestThinking,
              meta: `已停止 · ${body.model || prepared.conversation.lastAssistantModel || "Codex"}`,
              status: "stopped",
            });
          } else {
            const message = error instanceof Error ? error.message : "Codex SDK 调用失败。";
            emit({
              type: "error",
              error: message,
            });
          }
        } finally {
          if (!didComplete && !request.signal.aborted && !latestText.trim()) {
            emit({
              type: "error",
              error: "Codex 未返回可用内容，请稍后再试。",
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
  } catch (error) {
    if (error instanceof ConversationTurnError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }

    const message = error instanceof Error ? error.message : "Codex SDK 调用失败。";

    return NextResponse.json({ error: message }, { status: 500 });
  }
}
