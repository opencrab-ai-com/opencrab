import { getRuntimeReadiness } from "@/lib/runtime/first-run-readiness";
import { noStoreJson } from "@/lib/server/api-route";

export async function GET() {
  return noStoreJson(await getRuntimeReadiness());
}
