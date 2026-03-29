export type OpenCrabAppMode = "source" | "standalone" | "desktop";

const VALID_APP_MODES = new Set<OpenCrabAppMode>(["source", "standalone", "desktop"]);

export function getOpenCrabAppMode(): OpenCrabAppMode {
  const configured = normalizeAppMode(process.env.OPENCRAB_APP_MODE);

  if (configured) {
    return configured;
  }

  if (typeof process.versions.electron === "string") {
    return "desktop";
  }

  const entryPath = process.argv[1] || "";

  if (entryPath.includes(`${pathSeparator()}.next${pathSeparator()}standalone${pathSeparator()}`)) {
    return "standalone";
  }

  return "source";
}

export function isDesktopAppMode() {
  return getOpenCrabAppMode() === "desktop";
}

function normalizeAppMode(value: string | undefined): OpenCrabAppMode | null {
  const trimmed = value?.trim();

  if (!trimmed || !VALID_APP_MODES.has(trimmed as OpenCrabAppMode)) {
    return null;
  }

  return trimmed as OpenCrabAppMode;
}

function pathSeparator() {
  return process.platform === "win32" ? "\\" : "/";
}
