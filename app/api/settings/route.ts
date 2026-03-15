import { NextResponse } from "next/server";
import type { AppSettings } from "@/lib/mock-data";
import { getSnapshot, updateSettings } from "@/lib/resources/mock-store";

export async function GET() {
  return NextResponse.json({
    settings: getSnapshot().settings,
  });
}

export async function PATCH(request: Request) {
  const body = (await request.json()) as Partial<AppSettings>;
  const snapshot = updateSettings(body);

  return NextResponse.json({ snapshot });
}
