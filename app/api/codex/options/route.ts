import { getCodexOptions } from "@/lib/codex/options";
import { json } from "@/lib/server/api-route";

export async function GET() {
  return json(getCodexOptions());
}
