import { projectManagementService } from "@/lib/modules/projects/project-management-service";
import { projectQueryService } from "@/lib/modules/projects/project-query-service";
import type { ProjectPlanningSnapshot } from "@/lib/projects/project-planning";
import type {
  CodexReasoningEffort,
  CodexSandboxMode,
} from "@/lib/resources/opencrab-api-types";
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
      goal?: string;
      workspaceDir?: string;
      agentProfileIds?: string[];
      planningSnapshot?: ProjectPlanningSnapshot | null;
      model?: string;
      reasoningEffort?: CodexReasoningEffort;
      sandboxMode?: CodexSandboxMode;
    }>(request, {});
    const normalizedModel = typeof body.model === "string" ? body.model.trim() : "";
    const settingsInput = {
      model: normalizedModel || undefined,
      reasoningEffort: body.reasoningEffort,
      sandboxMode: body.sandboxMode,
    };

    if (!body.goal && !body.planningSnapshot?.brief?.goal) {
      throw new Error("请先填写团队目标。");
    }

    const detail = projectManagementService.create({
      goal: body.goal || "",
      workspaceDir: body.workspaceDir || "",
      agentProfileIds: Array.isArray(body.agentProfileIds) ? body.agentProfileIds : [],
      planningSnapshot: body.planningSnapshot ?? null,
      ...settingsInput,
    });

    return noStoreJson(detail);
  } catch (error) {
    return errorResponse(error, "创建团队模式失败。", 400, {
      request,
      operation: "create_project",
    });
  }
}
