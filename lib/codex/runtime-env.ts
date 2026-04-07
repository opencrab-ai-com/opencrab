import {
  OPENCRAB_CODEX_HOME,
  OPENCRAB_RUNTIME_DIR,
} from "@/lib/resources/runtime-paths";

export function buildOpenCrabCodexEnv(
  baseEnv: NodeJS.ProcessEnv | Record<string, string | undefined> = process.env,
  overrides: Record<string, string> = {},
): Record<string, string> {
  const nextEnv: Record<string, string> = {};

  for (const [key, value] of Object.entries(baseEnv)) {
    if (typeof value === "string") {
      nextEnv[key] = value;
    }
  }

  return {
    ...nextEnv,
    ...overrides,
    OPENCRAB_HOME: OPENCRAB_RUNTIME_DIR,
    CODEX_HOME: OPENCRAB_CODEX_HOME,
  };
}
