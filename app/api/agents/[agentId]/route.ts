import {
  deleteAgentProfile,
  getAgentProfile,
  updateAgentProfile,
} from "@/lib/agents/agent-store";
import {
  errorResponse,
  json,
  notFoundJson,
  readJsonBody,
  readRouteParams,
  type RouteContext,
} from "@/lib/server/api-route";

export async function GET(
  _request: Request,
  context: RouteContext<{ agentId: string }>,
) {
  const { agentId } = await readRouteParams(context);
  const agent = getAgentProfile(agentId);

  if (!agent) {
    return notFoundJson("智能体不存在。");
  }

  return json({
    agent,
  });
}

export async function PATCH(
  request: Request,
  context: RouteContext<{ agentId: string }>,
) {
  try {
    const { agentId } = await readRouteParams(context);
    const body = await readJsonBody<{
      name?: string;
      summary?: string;
      avatarDataUrl?: string | null;
      roleLabel?: string;
      description?: string;
      availability?: "solo" | "team" | "both";
      teamRole?: "lead" | "research" | "writer" | "specialist";
      defaultModel?: string | null;
      defaultReasoningEffort?: "minimal" | "low" | "medium" | "high" | "xhigh" | null;
      defaultSandboxMode?: "read-only" | "workspace-write" | "danger-full-access" | null;
      starterPrompts?: string[];
      files?: Partial<{
        soul: string;
        responsibility: string;
        tools: string;
        user: string;
        knowledge: string;
      }>;
    }>(request, {});

    const agent = updateAgentProfile(agentId, body);

    return json({
      agent,
    });
  } catch (error) {
    return errorResponse(error, "更新智能体失败。", 400);
  }
}

export async function DELETE(
  _request: Request,
  context: RouteContext<{ agentId: string }>,
) {
  try {
    const { agentId } = await readRouteParams(context);
    const ok = deleteAgentProfile(agentId);
    return json({ ok });
  } catch (error) {
    return errorResponse(error, "删除智能体失败。", 400);
  }
}
