import { agentService, type AgentMutationInput } from "@/lib/modules/agents/agent-service";
import {
  errorResponse,
  noStoreJson,
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
  const agent = agentService.get(agentId);

  if (!agent) {
    return notFoundJson("智能体不存在。");
  }

  return noStoreJson({
    agent,
  });
}

export async function PATCH(
  request: Request,
  context: RouteContext<{ agentId: string }>,
) {
  try {
    const { agentId } = await readRouteParams(context);
    const body = await readJsonBody<AgentMutationInput>(request, {});
    const agent = agentService.update(agentId, body);

    return noStoreJson({
      agent,
    });
  } catch (error) {
    return errorResponse(error, "更新智能体失败。", 400, {
      request,
      operation: "update_agent",
    });
  }
}

export async function DELETE(
  _request: Request,
  context: RouteContext<{ agentId: string }>,
) {
  try {
    const { agentId } = await readRouteParams(context);
    const ok = agentService.remove(agentId);
    return noStoreJson({ ok });
  } catch (error) {
    return errorResponse(error, "删除智能体失败。", 400, {
      request: _request,
      operation: "delete_agent",
    });
  }
}
