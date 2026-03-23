import {
  type AgentCreateInput,
  agentService,
} from "@/lib/modules/agents/agent-service";
import {
  errorResponse,
  noStoreJson,
  readJsonBody,
} from "@/lib/server/api-route";

export function GET() {
  return noStoreJson({
    agents: agentService.list(),
  });
}

export async function POST(request: Request) {
  try {
    const body = await readJsonBody<Partial<AgentCreateInput>>(request, {});

    const agent = agentService.create({
      name: body.name || "",
      summary: body.summary || "",
      avatarDataUrl: body.avatarDataUrl,
      roleLabel: body.roleLabel,
      description: body.description,
      availability: body.availability,
      teamRole: body.teamRole,
      defaultModel: body.defaultModel,
      defaultReasoningEffort: body.defaultReasoningEffort,
      defaultSandboxMode: body.defaultSandboxMode,
      starterPrompts: body.starterPrompts,
      files: body.files,
    });

    return noStoreJson({
      agent,
    });
  } catch (error) {
    return errorResponse(error, "创建智能体失败。", 400, {
      request,
      operation: "create_agent",
    });
  }
}
