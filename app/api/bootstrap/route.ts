import { NextResponse } from "next/server";
import { getSnapshot } from "@/lib/resources/mock-store";

export async function GET() {
  return NextResponse.json(getSnapshot());
}
