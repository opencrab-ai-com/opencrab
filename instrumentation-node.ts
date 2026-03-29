import { ensureRuntimeLock } from "./lib/runtime/runtime-lock";

export function registerNodeInstrumentation() {
  ensureRuntimeLock();
}
