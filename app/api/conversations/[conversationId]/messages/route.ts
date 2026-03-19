import { addMessage } from "@/lib/resources/local-store";
import {
  json,
  readJsonBody,
  readRouteParams,
  type RouteContext,
} from "@/lib/server/api-route";
import type { ConversationMessage } from "@/lib/seed-data";

export async function POST(
  request: Request,
  context: RouteContext<{ conversationId: string }>,
) {
  const { conversationId } = await readRouteParams(context);
  const body = await readJsonBody<Omit<ConversationMessage, "id">>(request);
  const result = addMessage(conversationId, body);

  return json(result);
}
