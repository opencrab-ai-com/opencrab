import { NextResponse } from "next/server";
import {
  ConversationTurnError,
  runConversationTurn,
} from "@/lib/conversations/run-conversation-turn";
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
    };
    const result = await runConversationTurn({
      conversationId,
      content: body.content,
      model: body.model,
      reasoningEffort: body.reasoningEffort,
      sandboxMode: body.sandboxMode,
      attachmentIds: body.attachmentIds,
    });

    return NextResponse.json({
      snapshot: result.snapshot,
      assistant: {
        text: result.assistant.text,
        model: result.assistant.model,
        threadId: result.assistant.threadId,
        usage: result.assistant.usage,
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
