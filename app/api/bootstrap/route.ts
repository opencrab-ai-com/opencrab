import { getSnapshot } from "@/lib/resources/local-store";
import { ensureBootstrapRuntimeReady } from "@/lib/runtime/runtime-startup";
import { noStoreJson } from "@/lib/server/api-route";

export async function GET() {
  ensureBootstrapRuntimeReady();
  const snapshot = getSnapshot();

  return noStoreJson(snapshot);
}
