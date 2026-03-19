import type { AppSettings } from "@/lib/seed-data";
import { getSnapshot, updateSettings } from "@/lib/resources/local-store";
import { json, readJsonBody } from "@/lib/server/api-route";

export async function GET() {
  return json({
    settings: getSnapshot().settings,
  });
}

export async function PATCH(request: Request) {
  const body = await readJsonBody<Partial<AppSettings>>(request, {});
  const snapshot = updateSettings(body);

  return json({ snapshot });
}
