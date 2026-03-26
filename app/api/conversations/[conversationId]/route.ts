import {
  deleteConversation,
  updateConversation,
} from "@/lib/resources/local-store";
import {
  json,
  readJsonBody,
  readRouteParams,
  type RouteContext,
} from "@/lib/server/api-route";

export async function PATCH(
  request: Request,
  context: RouteContext<{ conversationId: string }>,
) {
  const { conversationId } = await readRouteParams(context);
  const body = await readJsonBody<{
    title?: string;
    preview?: string;
    timeLabel?: string;
    folderId?: string | null;
    workspaceDir?: string | null;
    sandboxMode?: "read-only" | "workspace-write" | "danger-full-access" | null;
    projectId?: string | null;
    agentProfileId?: string | null;
    codexThreadId?: string | null;
    lastAssistantModel?: string | null;
  }>(request, {});
  const snapshot = updateConversation(conversationId, body);

  return json({ snapshot });
}

export async function DELETE(
  _request: Request,
  context: RouteContext<{ conversationId: string }>,
) {
  const { conversationId } = await readRouteParams(context);
  const snapshot = deleteConversation(conversationId);

  return json({ snapshot });
}
