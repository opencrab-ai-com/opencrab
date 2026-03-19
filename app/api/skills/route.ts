import { createCustomSkill, listSkillsCatalog } from "@/lib/skills/skill-store";
import { errorResponse, json, readJsonBody } from "@/lib/server/api-route";

export function GET() {
  return json({
    skills: listSkillsCatalog(),
  });
}

export async function POST(request: Request) {
  try {
    const body = await readJsonBody<{
      name?: string;
      summary?: string;
      detailsMarkdown?: string;
    }>(request, {});

    const skill = createCustomSkill({
      name: body.name || "",
      summary: body.summary || "",
      detailsMarkdown: body.detailsMarkdown,
    });

    return json({
      skill,
    });
  } catch (error) {
    return errorResponse(error, "创建技能失败。", 400);
  }
}
