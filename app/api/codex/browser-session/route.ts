import { NextResponse } from "next/server";
import { ensureBrowserSession, getBrowserSessionStatus } from "@/lib/codex/browser-session";

export const dynamic = "force-dynamic";

export async function GET() {
  const status = await getBrowserSessionStatus();
  return NextResponse.json(status);
}

export async function POST() {
  const status = await ensureBrowserSession();
  return NextResponse.json(status);
}
