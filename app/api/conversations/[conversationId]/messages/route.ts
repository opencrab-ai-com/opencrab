import { NextResponse } from "next/server";
import { addMessage } from "@/lib/resources/local-store";
import type { ConversationMessage } from "@/lib/seed-data";

export async function POST(
  request: Request,
  context: { params: Promise<{ conversationId: string }> },
) {
  const { conversationId } = await context.params;
  const body = (await request.json()) as Omit<ConversationMessage, "id">;
  const result = addMessage(conversationId, body);

  return NextResponse.json(result);
}
