import { projectPlanningService } from "@/lib/modules/projects/project-planning-service";
import type {
  ProjectPlanningAnswers,
  ProjectPlanningBrief,
  ProjectPlanningMode,
} from "@/lib/projects/project-planning";
import type { CodexReasoningEffort } from "@/lib/resources/opencrab-api-types";
import { errorResponse, noStoreJson, readJsonBody } from "@/lib/server/api-route";

export async function POST(request: Request) {
  try {
    const body = await readJsonBody<{
      mode?: ProjectPlanningMode;
      rawIntent?: string;
      answers?: ProjectPlanningAnswers;
      brief?: ProjectPlanningBrief;
      model?: string;
      reasoningEffort?: CodexReasoningEffort;
    }>(request, {});
    const normalizedModel = typeof body.model === "string" ? body.model.trim() : "";
    const plan = await projectPlanningService.plan({
      mode: body.mode,
      rawIntent: body.rawIntent || "",
      answers: body.answers,
      brief: body.brief,
      model: normalizedModel || undefined,
      reasoningEffort: body.reasoningEffort,
    });

    return noStoreJson({
      plan,
    });
  } catch (error) {
    return errorResponse(error, "生成团队规划失败。", 400, {
      request,
      operation: "plan_project",
    });
  }
}
