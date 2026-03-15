import { NextResponse } from "next/server";
import { getCodexOptions } from "@/lib/codex/options";

export async function GET() {
  return NextResponse.json(getCodexOptions());
}
