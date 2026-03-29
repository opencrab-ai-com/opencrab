import { existsSync } from "node:fs";
import path from "node:path";

const DESKTOP_BUNDLE_DIR_NAME = "desktop-bundle";
const STANDALONE_SERVER_RELATIVE_PATH = path.join("standalone", "server.js");

export function resolveDesktopProjectRoot() {
  return path.resolve(__dirname, "..");
}

export function resolveDesktopBundleRoot() {
  const configuredRoot = normalizeDirectory(process.env.OPENCRAB_DESKTOP_BUNDLE_ROOT);

  if (configuredRoot) {
    return configuredRoot;
  }

  return getPackagedBundleRoot() || resolveDesktopProjectRoot();
}

export function resolveDesktopStandaloneRoot() {
  const bundleRoot = resolveDesktopBundleRoot();
  const bundledStandaloneRoot = path.join(bundleRoot, "standalone");

  if (existsSync(path.join(bundledStandaloneRoot, "server.js"))) {
    return bundledStandaloneRoot;
  }

  return path.join(resolveDesktopProjectRoot(), ".next", "standalone");
}

export function resolveDesktopPublicDir() {
  const standalonePublicDir = path.join(resolveDesktopStandaloneRoot(), "public");

  if (existsSync(standalonePublicDir)) {
    return standalonePublicDir;
  }

  return path.join(resolveDesktopProjectRoot(), "public");
}

export function resolveDesktopExecutionRoot() {
  return normalizeDirectory(process.env.OPENCRAB_EXECUTION_ROOT) || resolveDesktopRuntimeHome();
}

function resolveDesktopRuntimeHome() {
  return (
    normalizeDirectory(process.env.OPENCRAB_HOME) ||
    path.join(process.env.HOME || process.cwd(), ".opencrab")
  );
}

function getPackagedBundleRoot() {
  const resourcesPath = normalizeDirectory(process.resourcesPath);

  if (!resourcesPath) {
    return null;
  }

  const candidate = path.join(resourcesPath, DESKTOP_BUNDLE_DIR_NAME);

  return existsSync(path.join(candidate, STANDALONE_SERVER_RELATIVE_PATH))
    ? candidate
    : null;
}

function normalizeDirectory(value: string | null | undefined) {
  const trimmed = value?.trim();

  if (!trimmed) {
    return null;
  }

  return path.resolve(trimmed);
}
