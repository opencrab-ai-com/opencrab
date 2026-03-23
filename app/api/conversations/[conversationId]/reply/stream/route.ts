import { buildConversationReplyStream } from "@/lib/modules/conversations/conversation-stream-service";
import type {
  CodexReasoningEffort,
  CodexSandboxMode,
} from "@/lib/resources/opencrab-api-types";
import {
  errorResponse,
  readJsonBody,
  readRouteParams,
  type RouteContext,
} from "@/lib/server/api-route";

export async function POST(
  request: Request,
  context: RouteContext<{ conversationId: string }>,
) {
  try {
    const { conversationId } = await readRouteParams(context);
    const body = await readJsonBody<{
      content?: string;
      model?: string;
      reasoningEffort?: CodexReasoningEffort;
      sandboxMode?: CodexSandboxMode;
      attachmentIds?: string[];
      userMessageId?: string;
      assistantMessageId?: string;
    }>(request, {});

    return buildConversationReplyStream({
      request,
      conversationId,
      body,
    });
  } catch (error) {
    return errorResponse(error, "OpenCrab 回复生成失败。", 500, {
      request,
      operation: "conversation_reply_stream",
    });
  }
}
