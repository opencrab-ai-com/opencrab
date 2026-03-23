import { projectManagementService } from "@/lib/modules/projects/project-management-service";
import { projectQueryService } from "@/lib/modules/projects/project-query-service";
import {
  errorResponse,
  noStoreJson,
  readJsonBody,
} from "@/lib/server/api-route";

export async function GET() {
  return noStoreJson({
    projects: projectQueryService.list(),
  });
}

export async function POST(request: Request) {
  try {
    const body = await readJsonBody<{
      conversationId?: string;
      goal?: string;
      workspaceDir?: string;
      agentProfileIds?: string[];
    }>(request, {});

    if (body.conversationId) {
      const detail = projectManagementService.createFromConversation(
        body.conversationId,
      );
      return noStoreJson(detail);
    }

    if (!body.goal) {
      throw new Error("请先填写团队目标。");
    }

    const detail = projectManagementService.create({
      goal: body.goal,
      workspaceDir: body.workspaceDir || "",
      agentProfileIds: Array.isArray(body.agentProfileIds) ? body.agentProfileIds : [],
    });

    return noStoreJson(detail);
  } catch (error) {
    return errorResponse(error, "创建团队模式失败。", 400, {
      request,
      operation: "create_project",
    });
  }
}
