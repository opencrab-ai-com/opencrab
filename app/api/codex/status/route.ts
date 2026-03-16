import { NextResponse } from "next/server";
import { getCodexStatus } from "@/lib/codex/sdk";

export async function GET() {
  try {
    const status = await getCodexStatus();

    return NextResponse.json(status);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Codex SDK 状态检查失败。";

    return NextResponse.json({
      ok: false,
      error: message,
      loginStatus: "missing",
      loginMethod: "chatgpt",
    });
  }
}
