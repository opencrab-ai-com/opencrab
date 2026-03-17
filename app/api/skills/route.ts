import { NextResponse } from "next/server";
import { createCustomSkill, listSkills } from "@/lib/skills/skill-store";

export function GET() {
  return NextResponse.json({
    skills: listSkills(),
  });
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      name?: string;
      summary?: string;
      detailsMarkdown?: string;
    };

    const skill = createCustomSkill({
      name: body.name || "",
      summary: body.summary || "",
      detailsMarkdown: body.detailsMarkdown,
    });

    return NextResponse.json({
      skill,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "创建技能失败。";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
