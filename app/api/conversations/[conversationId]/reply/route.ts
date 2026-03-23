import { conversationTurnService } from "@/lib/modules/conversations/conversation-turn-service";
import type {
  CodexReasoningEffort,
  CodexSandboxMode,
} from "@/lib/resources/opencrab-api-types";
import {
  errorResponse,
  noStoreJson,
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
    }>(request, {});
    const result = await conversationTurnService.reply({
      conversationId,
      content: body.content,
      model: body.model,
      reasoningEffort: body.reasoningEffort,
      sandboxMode: body.sandboxMode,
      attachmentIds: body.attachmentIds,
    });

    return noStoreJson({
      snapshot: result.snapshot,
      assistant: {
        text: result.assistant.text,
        model: result.assistant.model,
        threadId: result.assistant.threadId,
        usage: result.assistant.usage,
      },
    });
  } catch (error) {
    return errorResponse(error, "OpenCrab 回复生成失败。", 500, {
      request,
      operation: "conversation_reply",
    });
  }
}
