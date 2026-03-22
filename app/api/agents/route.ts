import { createAgentProfile, listAgentProfiles } from "@/lib/agents/agent-store";
import { errorResponse, json, readJsonBody } from "@/lib/server/api-route";

export function GET() {
  return json({
    agents: listAgentProfiles(),
  });
}

export async function POST(request: Request) {
  try {
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

    const agent = createAgentProfile({
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

    return json({
      agent,
    });
  } catch (error) {
    return errorResponse(error, "创建智能体失败。", 400);
  }
}
