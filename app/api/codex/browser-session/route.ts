import {
  ensureBrowserSession,
  ensureBrowserSessionWarmup,
  getBrowserSessionStatus,
} from "@/lib/codex/browser-session";
import { json } from "@/lib/server/api-route";

export const dynamic = "force-dynamic";

export async function GET() {
  const status = await getBrowserSessionStatus();

  if (
    !status.ok &&
    status.status !== "launching" &&
    status.status !== "missing_browser"
  ) {
    void ensureBrowserSessionWarmup({ force: true });
  }

  return json(status);
}

export async function POST() {
  const status = await ensureBrowserSession();
  return json(status);
}
