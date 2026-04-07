import { agentService } from "@/lib/modules/agents/agent-service";
import {
  errorResponse,
  noStoreJson,
  readRouteParams,
  type RouteContext,
} from "@/lib/server/api-route";

export async function POST(
  request: Request,
  context: RouteContext<{ agentId: string }>,
) {
  try {
    const { agentId } = await readRouteParams(context);
    const agent = agentService.reset(agentId);
    return noStoreJson({ agent });
  } catch (error) {
    return errorResponse(error, "恢复智能体默认配置失败。", 400, {
      request,
      operation: "reset_agent",
    });
  }
}
