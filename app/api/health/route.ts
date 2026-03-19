import { noStoreJson } from "@/lib/server/api-route";

export function GET() {
  return noStoreJson({ ok: true });
}
