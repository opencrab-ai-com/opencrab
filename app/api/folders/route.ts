import { NextResponse } from "next/server";
import { createFolder } from "@/lib/resources/mock-store";

export async function POST(request: Request) {
  const body = (await request.json()) as { name?: string };
  const snapshot = createFolder(body.name ?? "");

  return NextResponse.json({ snapshot });
}
