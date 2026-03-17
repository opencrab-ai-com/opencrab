import { NextResponse } from "next/server";
import type { SkillAction } from "@/lib/resources/opencrab-api-types";
import { getSkill, mutateSkill } from "@/lib/skills/skill-store";

export function GET(
  _request: Request,
  context: { params: Promise<{ skillId: string }> },
) {
  return resolveSkill(context.params);
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ skillId: string }> },
) {
  const { skillId } = await context.params;
  const body = (await request.json()) as { action?: SkillAction };

  if (!body.action) {
    return NextResponse.json({ error: "缺少技能动作。" }, { status: 400 });
  }

  try {
    const skill = mutateSkill(skillId, body.action);

    return NextResponse.json({
      skill,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "技能操作失败。";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

async function resolveSkill(paramsPromise: Promise<{ skillId: string }>) {
  const { skillId } = await paramsPromise;
  const skill = getSkill(skillId);

  if (!skill) {
    return NextResponse.json({ error: "技能不存在。" }, { status: 404 });
  }

  return NextResponse.json({
    skill,
  });
}
