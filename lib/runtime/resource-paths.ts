import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { getOpenCrabAppMode } from "@/lib/runtime/app-mode";

const RESOURCE_MARKER_NAMES = ["scripts", "skills", "agents-src", "public"] as const;

let cachedResourceRoot: string | null = null;

export function getOpenCrabResourceRoot() {
  if (cachedResourceRoot) {
    return cachedResourceRoot;
  }

  const configuredRoot = normalizeDirectory(process.env.OPENCRAB_RESOURCE_ROOT);

  if (configuredRoot) {
    cachedResourceRoot = configuredRoot;
    return configuredRoot;
  }

  const detectedRoot = detectResourceRoot();
  cachedResourceRoot = detectedRoot;
  return detectedRoot;
}

export function getOpenCrabExecutionRoot() {
  return (
    normalizeDirectory(process.env.OPENCRAB_EXECUTION_ROOT) ||
    path.resolve(process.cwd())
  );
}

export function resolveNodeRuntimeExecutablePath(execPath = process.execPath) {
  return resolveElectronHelperExecutablePath(execPath) || execPath;
}

export function getOpenCrabScriptsDir() {
  return path.join(getOpenCrabResourceRoot(), "scripts");
}

export function getOpenCrabBrowserMcpProxyScriptPath() {
  return path.join(getOpenCrabScriptsDir(), "browser_mcp_stdio_proxy.mjs");
}

export function getOpenCrabPdfExtractScriptPath() {
  return path.join(getOpenCrabScriptsDir(), "pdf_extract.mjs");
}

export function getOpenCrabBundledSkillsSourceRoot() {
  return path.join(getOpenCrabResourceRoot(), "skills");
}

export function getOpenCrabSystemAgentSourceDir() {
  return path.join(getOpenCrabResourceRoot(), "agents-src", "system");
}

export function getOpenCrabSystemAgentGroupsFilePath() {
  return path.join(getOpenCrabResourceRoot(), "agents-src", "system-groups.json");
}

export function getOpenCrabSystemAgentAvatarDir() {
  return path.join(getOpenCrabResourceRoot(), "public", "agent-avatars", "system");
}

export function getOpenCrabExecutionArtifactRoots() {
  const executionRoot = getOpenCrabExecutionRoot();

  return dedupePaths([
    executionRoot,
    path.join(executionRoot, "output"),
    path.join(executionRoot, "tmp"),
    path.join(executionRoot, ".playwright-cli"),
  ]);
}

export function resolveNodeModulesBinExecutable(binaryName: string) {
  const executableName =
    process.platform === "win32" ? `${binaryName}.cmd` : binaryName;

  for (const root of dedupePaths([
    getOpenCrabExecutionRoot(),
    getOpenCrabResourceRoot(),
  ])) {
    const candidate = path.join(root, "node_modules", ".bin", executableName);

    if (existsSync(candidate)) {
      return candidate;
    }
  }

  return null;
}

export function resolvePackageBinScript(packageName: string, binaryName: string) {
  for (const root of dedupePaths([
    getOpenCrabExecutionRoot(),
    getOpenCrabResourceRoot(),
  ])) {
    const packageJsonPath = path.join(root, "node_modules", packageName, "package.json");

    if (!existsSync(packageJsonPath)) {
      continue;
    }

    try {
      const packageJson = JSON.parse(readFileSync(packageJsonPath, "utf8")) as {
        bin?: string | Record<string, string>;
      };
      const relativeBinPath =
        typeof packageJson.bin === "string"
          ? packageJson.bin
          : packageJson.bin?.[binaryName];

      if (!relativeBinPath) {
        continue;
      }

      const candidate = path.join(path.dirname(packageJsonPath), relativeBinPath);

      if (existsSync(candidate)) {
        return candidate;
      }
    } catch {
      continue;
    }
  }

  return null;
}

export function prependBundledRuntimeBinToPath(env: Record<string, string>) {
  const runtimeBinDir = path.dirname(process.execPath);
  return prependPathEntries(env, [runtimeBinDir]);
}

export function prependPathEntries(
  env: Record<string, string>,
  entries: Array<string | null | undefined>,
) {
  const currentEntries = (env.PATH || "")
    .split(path.delimiter)
    .filter(Boolean);

  env.PATH = [...entries, ...currentEntries]
    .filter((entry): entry is string => Boolean(entry))
    .filter((entry, index, allEntries) => allEntries.indexOf(entry) === index)
    .join(path.delimiter);

  return env;
}

export function markCurrentRuntimeAsNode(env: Record<string, string>) {
  if (shouldUseElectronRunAsNode()) {
    env.ELECTRON_RUN_AS_NODE = "1";
  }

  return env;
}

export function shouldUseElectronRunAsNode() {
  return (
    process.env.ELECTRON_RUN_AS_NODE === "1" ||
    typeof process.versions.electron === "string"
  );
}

function detectResourceRoot() {
  const startPoints = dedupePaths(
    [
      process.cwd(),
      process.argv[1] ? path.dirname(path.resolve(process.argv[1])) : null,
      process.env.OPENCRAB_SOURCE_ROOT,
      getOpenCrabAppMode() === "standalone"
        ? path.resolve(process.cwd(), "..")
        : null,
    ].map(normalizeDirectory),
  );

  for (const startPoint of startPoints) {
    const match = findNearestResourceRoot(startPoint);

    if (match) {
      return match;
    }
  }

  return path.resolve(process.cwd());
}

function resolveElectronHelperExecutablePath(execPath: string) {
  if (process.platform !== "darwin") {
    return null;
  }

  const normalizedExecPath = path.resolve(execPath);
  const macOsDir = path.dirname(normalizedExecPath);
  const contentsDir = path.dirname(macOsDir);

  if (path.basename(macOsDir) !== "MacOS" || path.basename(contentsDir) !== "Contents") {
    return null;
  }

  const frameworksDir = path.join(contentsDir, "Frameworks");
  const executableName = path.basename(normalizedExecPath, path.extname(normalizedExecPath));
  const helperCandidates = [
    path.join(frameworksDir, "Electron Helper.app", "Contents", "MacOS", "Electron Helper"),
    path.join(
      frameworksDir,
      `${executableName} Helper.app`,
      "Contents",
      "MacOS",
      `${executableName} Helper`,
    ),
  ];

  for (const candidate of helperCandidates) {
    if (existsSync(candidate)) {
      return candidate;
    }
  }

  return null;
}

function findNearestResourceRoot(startDir: string) {
  let currentDir = startDir;

  while (true) {
    if (isLikelyResourceRoot(currentDir)) {
      return currentDir;
    }

    const parentDir = path.dirname(currentDir);

    if (parentDir === currentDir) {
      return null;
    }

    currentDir = parentDir;
  }
}

function isLikelyResourceRoot(dirPath: string) {
  const markerCount = RESOURCE_MARKER_NAMES.filter((name) =>
    existsSync(path.join(dirPath, name)),
  ).length;

  if (markerCount >= 3) {
    return true;
  }

  return (
    markerCount >= 2 &&
    existsSync(path.join(dirPath, "package.json"))
  );
}

function normalizeDirectory(value: string | null | undefined) {
  const trimmed = value?.trim();

  if (!trimmed) {
    return null;
  }

  return path.resolve(trimmed);
}

function dedupePaths(values: Array<string | null>) {
  return [...new Set(values.filter((value): value is string => Boolean(value)))];
}
