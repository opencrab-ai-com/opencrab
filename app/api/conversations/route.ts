import { conversationManagementService } from "@/lib/modules/conversations/conversation-management-service";
import { json, readJsonBody } from "@/lib/server/api-route";

export async function POST(request: Request) {
  const body = await readJsonBody<{
    title?: string;
    folderId?: string | null;
    workspaceDir?: string | null;
    sandboxMode?: "read-only" | "workspace-write" | "danger-full-access" | null;
    projectId?: string | null;
    agentProfileId?: string | null;
    feishuChatSessionId?: string | null;
  }>(
    request,
    {},
  );
  const result = await conversationManagementService.create({
    title: body.title,
    folderId: body.folderId ?? null,
    workspaceDir: body.workspaceDir ?? null,
    sandboxMode: body.sandboxMode ?? null,
    projectId: body.projectId ?? null,
    agentProfileId: body.agentProfileId ?? null,
    feishuChatSessionId: body.feishuChatSessionId ?? null,
  });

  return json(result);
}
