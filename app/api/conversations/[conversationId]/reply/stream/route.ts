import { NextResponse } from "next/server";
import { streamCodexReply } from "@/lib/codex/sdk";
import { formatMessageTime } from "@/lib/conversations/utils";
import { addMessage, findConversation, updateConversation } from "@/lib/resources/mock-store";
import type { ReplyStreamEvent } from "@/lib/resources/opencrab-api-types";
import { getUploadsByIds } from "@/lib/resources/upload-store";
import type { CodexReasoningEffort } from "@/lib/resources/opencrab-api-types";

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
      attachmentIds?: string[];
      userMessageId?: string;
      assistantMessageId?: string;
    };
    const content = body.content?.trim();
    const attachmentIds = Array.isArray(body.attachmentIds) ? body.attachmentIds : [];
    const attachments = getUploadsByIds(attachmentIds);
    const conversation = findConversation(conversationId);
    const userMessageId = body.userMessageId || `message-${crypto.randomUUID()}`;
    const assistantMessageId = body.assistantMessageId || `message-${crypto.randomUUID()}`;

    if (!content && attachments.length === 0) {
      return NextResponse.json({ error: "缺少消息内容或附件。" }, { status: 400 });
    }

    if (!conversation) {
      return NextResponse.json({ error: "找不到对应对话。" }, { status: 404 });
    }

    addMessage(conversationId, {
      id: userMessageId,
      role: "user",
      content: buildUserMessagePreview(content, attachments.map((attachment) => attachment.name)),
      attachments: attachments.map((attachment) => ({
        id: attachment.id,
        name: attachment.name,
        kind: attachment.kind,
        size: attachment.size,
        mimeType: attachment.mimeType,
      })),
      meta: formatMessageTime(new Date()),
      status: "done",
    });

    const imagePaths = attachments
      .filter((attachment) => attachment.kind === "image")
      .map((attachment) => attachment.storedPath);
    const textAttachments = attachments
      .filter((attachment) => attachment.kind === "text")
      .map((attachment) => ({
        name: attachment.name,
        storedPath: attachment.storedPath,
      }));

    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        let latestText = "";
        let latestThinking: string[] = [];
        let latestThreadId: string | null = conversation.codexThreadId ?? null;
        let didComplete = false;

        function emit(event: ReplyStreamEvent) {
          controller.enqueue(encoder.encode(`${JSON.stringify(event)}\n`));
        }

        try {
          for await (const event of streamCodexReply({
            conversationTitle: conversation.title,
            threadId: conversation.codexThreadId,
            content,
            model: body.model,
            reasoningEffort: body.reasoningEffort,
            imagePaths,
            textAttachments,
            signal: request.signal,
          })) {
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
            updateConversation(conversationId, {
              codexThreadId: event.threadId,
              lastAssistantModel: event.model,
            });

            const assistantMessageResult = addMessage(conversationId, {
              id: assistantMessageId,
              role: "assistant",
              content: event.text,
              thinking: event.thinking,
              meta: `生成完成 · ${event.model}`,
              status: "done",
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
                lastAssistantModel: body.model || conversation.lastAssistantModel || null,
              });
            }

            addMessage(conversationId, {
              id: assistantMessageId,
              role: "assistant",
              content: latestText.trim() || "已停止当前回复。",
              thinking: latestThinking,
              meta: `已停止 · ${body.model || conversation.lastAssistantModel || "Codex"}`,
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
    const message = error instanceof Error ? error.message : "Codex SDK 调用失败。";

    return NextResponse.json({ error: message }, { status: 500 });
  }
}

function buildUserMessagePreview(content: string | undefined, attachmentNames: string[]) {
  const parts = [];

  if (content) {
    parts.push(content);
  }

  if (attachmentNames.length > 0) {
    parts.push(`附件：${attachmentNames.join("、")}`);
  }

  return parts.join("\n");
}
