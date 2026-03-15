import { NextResponse } from "next/server";
import { deleteConversation, updateConversation } from "@/lib/resources/mock-store";

export async function PATCH(
  request: Request,
  context: { params: Promise<{ conversationId: string }> },
) {
  const { conversationId } = await context.params;
  const body = (await request.json()) as {
    title?: string;
    preview?: string;
    timeLabel?: string;
    folderId?: string | null;
    codexThreadId?: string | null;
    lastAssistantModel?: string | null;
  };
  const snapshot = updateConversation(conversationId, body);

  return NextResponse.json({ snapshot });
}

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ conversationId: string }> },
) {
  const { conversationId } = await context.params;
  const snapshot = deleteConversation(conversationId);

  return NextResponse.json({ snapshot });
}
