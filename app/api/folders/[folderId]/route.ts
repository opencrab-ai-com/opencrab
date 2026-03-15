import { NextResponse } from "next/server";
import { deleteFolder, updateFolder } from "@/lib/resources/mock-store";

export async function PATCH(
  request: Request,
  context: { params: Promise<{ folderId: string }> },
) {
  const { folderId } = await context.params;
  const body = (await request.json()) as { name?: string };
  const snapshot = updateFolder(folderId, body.name ?? "");

  return NextResponse.json({ snapshot });
}

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ folderId: string }> },
) {
  const { folderId } = await context.params;
  const snapshot = deleteFolder(folderId);

  return NextResponse.json({ snapshot });
}
