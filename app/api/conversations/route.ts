import { NextResponse } from "next/server";
import { createConversation } from "@/lib/resources/mock-store";

export async function POST(request: Request) {
  const body = (await request.json()) as { title?: string; folderId?: string | null };
  const result = createConversation({
    title: body.title,
    folderId: body.folderId ?? null,
  });

  return NextResponse.json(result);
}
