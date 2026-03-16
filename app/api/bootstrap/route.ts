import { NextResponse } from "next/server";
import { getSnapshot } from "@/lib/resources/local-store";

export async function GET() {
  return NextResponse.json(getSnapshot());
}
