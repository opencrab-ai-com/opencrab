import { NextResponse } from "next/server";
import { generateCodexReply } from "@/lib/codex/sdk";
import { formatMessageTime } from "@/lib/conversations/utils";
import { getUploadsByIds } from "@/lib/resources/upload-store";
import { addMessage, findConversation, updateConversation } from "@/lib/resources/mock-store";
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
    };
    const content = body.content?.trim();
    const attachmentIds = Array.isArray(body.attachmentIds) ? body.attachmentIds : [];
    const attachments = getUploadsByIds(attachmentIds);
    const imagePaths = attachments
      .filter((attachment) => attachment.kind === "image")
      .map((attachment) => attachment.storedPath);
    const textAttachments = attachments
      .filter((attachment) => attachment.kind === "text")
      .map((attachment) => ({
        name: attachment.name,
        storedPath: attachment.storedPath,
      }));

    if (!content && attachments.length === 0) {
      return NextResponse.json({ error: "缺少消息内容或附件。" }, { status: 400 });
    }

    const conversation = findConversation(conversationId);

    if (!conversation) {
      return NextResponse.json({ error: "找不到对应对话。" }, { status: 404 });
    }

    addMessage(conversationId, {
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

    const reply = await generateCodexReply({
      conversationTitle: conversation.title,
      threadId: conversation.codexThreadId,
      content,
      model: body.model,
      reasoningEffort: body.reasoningEffort,
      imagePaths,
      textAttachments,
    });

    updateConversation(conversationId, {
      codexThreadId: reply.threadId,
      lastAssistantModel: reply.model,
    });

    const assistantMessageResult = addMessage(conversationId, {
      role: "assistant",
      content: reply.text,
      meta: `生成完成 · ${reply.model}`,
      status: "done",
    });

    return NextResponse.json({
      snapshot: assistantMessageResult.snapshot,
      assistant: {
        text: reply.text,
        model: reply.model,
        threadId: reply.threadId,
        usage: reply.usage,
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
