import { ensureRuntimeLock } from "@/lib/runtime/runtime-lock";
import { errorResponse, noStoreJson } from "@/lib/server/api-route";

export function GET() {
  try {
    ensureRuntimeLock();
    return noStoreJson({ ok: true });
  } catch (error) {
    return errorResponse(error, "OpenCrab runtime 当前不可用。", 500, {
      operation: "health_check_failed",
    });
  }
}
