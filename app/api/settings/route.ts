import type { AppSettings } from "@/lib/seed-data";
import { settingsService } from "@/lib/modules/settings/settings-service";
import {
  errorResponse,
  noStoreJson,
  readJsonBody,
} from "@/lib/server/api-route";

export async function GET() {
  return noStoreJson({
    settings: settingsService.getSettings(),
  });
}

export async function PATCH(request: Request) {
  try {
    const body = await readJsonBody<Partial<AppSettings>>(request, {});
    const snapshot = settingsService.updateSettings(body);

    return noStoreJson({ snapshot });
  } catch (error) {
    return errorResponse(error, "更新设置失败。", 400, {
      request,
      operation: "update_settings",
    });
  }
}
