import type { SkillAction } from "@/lib/resources/opencrab-api-types";
import { getSkillDetail, mutateSkill } from "@/lib/skills/skill-store";
import {
  badRequestJson,
  errorResponse,
  json,
  notFoundJson,
  readJsonBody,
  readRouteParams,
  type RouteContext,
} from "@/lib/server/api-route";

export function GET(
  _request: Request,
  context: RouteContext<{ skillId: string }>,
) {
  return resolveSkill(context.params);
}

export async function PATCH(
  request: Request,
  context: RouteContext<{ skillId: string }>,
) {
  const { skillId } = await readRouteParams(context);
  const body = await readJsonBody<{ action?: SkillAction }>(request, {});

  if (!body.action) {
    return badRequestJson("缺少技能动作。");
  }

  try {
    const skill = await mutateSkill(skillId, body.action);

    return json({
      skill: skill ? await getSkillDetail(skillId) : null,
    });
  } catch (error) {
    return errorResponse(error, "技能操作失败。", 400);
  }
}

async function resolveSkill(paramsPromise: Promise<{ skillId: string }>) {
  const { skillId } = await paramsPromise;
  const skill = await getSkillDetail(skillId);

  if (!skill) {
    return notFoundJson("技能不存在。");
  }

  return json({
    skill,
  });
}
