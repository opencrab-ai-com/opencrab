import { deleteFolder, updateFolder } from "@/lib/resources/local-store";
import {
  json,
  readJsonBody,
  readRouteParams,
  type RouteContext,
} from "@/lib/server/api-route";

export async function PATCH(
  request: Request,
  context: RouteContext<{ folderId: string }>,
) {
  const { folderId } = await readRouteParams(context);
  const body = await readJsonBody<{ name?: string }>(request, {});
  const snapshot = updateFolder(folderId, body.name ?? "");

  return json({ snapshot });
}

export async function DELETE(
  _request: Request,
  context: RouteContext<{ folderId: string }>,
) {
  const { folderId } = await readRouteParams(context);
  const snapshot = deleteFolder(folderId);

  return json({ snapshot });
}
