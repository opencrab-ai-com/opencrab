import {
  ensureBrowserSession,
  ensureBrowserSessionWarmup,
  getBrowserSessionStatus,
} from "@/lib/codex/browser-session";
import { errorResponse, json } from "@/lib/server/api-route";

export const dynamic = "force-dynamic";

export async function GET() {
  const status = await getBrowserSessionStatus();

  if (
    !status.ok &&
    status.status !== "launching" &&
    status.status !== "missing_browser"
  ) {
    void ensureBrowserSessionWarmup();
  }

  return json(status);
}

export async function POST() {
  try {
    const status = await ensureBrowserSession();
    return json(status);
  } catch (error) {
    return errorResponse(
      error,
      "OpenCrab 当前还不能稳定连接浏览器，请稍后再试。",
      503,
    );
  }
}
