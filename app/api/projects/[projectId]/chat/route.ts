import { projectChatService } from "@/lib/modules/projects/project-chat-service";
import {
  errorResponse,
  noStoreJson,
  readJsonBody,
  readRouteParams,
  type RouteContext,
} from "@/lib/server/api-route";

export async function POST(
  request: Request,
  context: RouteContext<{ projectId: string }>,
) {
  try {
    const { projectId } = await readRouteParams(context);
    const body = await readJsonBody<{
      conversationId?: string;
      content?: string;
    }>(request, {});

    const snapshot = await projectChatService.reply({
      projectId,
      conversationId: body.conversationId || "",
      content: body.content || "",
    });

    return noStoreJson({ snapshot });
  } catch (error) {
    return errorResponse(error, "团队群聊回复失败。", 400, {
      request,
      operation: "project_chat_reply",
    });
  }
}
