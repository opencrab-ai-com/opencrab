import { getRuntimeConnectionSnapshot } from "@/lib/runtime/runtime-connection-snapshot";
import { noStoreJson } from "@/lib/server/api-route";

export async function GET() {
  return noStoreJson(await getRuntimeConnectionSnapshot());
}
