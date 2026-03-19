import { createFolder } from "@/lib/resources/local-store";
import { json, readJsonBody } from "@/lib/server/api-route";

export async function POST(request: Request) {
  const body = await readJsonBody<{ name?: string }>(request, {});
  const snapshot = createFolder(body.name ?? "");

  return json({ snapshot });
}
