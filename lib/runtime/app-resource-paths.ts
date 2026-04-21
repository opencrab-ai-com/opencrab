import {
  joinFileSystemPath,
  resolveFileSystemPath,
} from "@/lib/shared/filesystem-paths";

export function resolveOpenCrabResourceRoot(env = process.env) {
  const configuredRoot = env.OPENCRAB_RESOURCE_ROOT?.trim();

  if (!configuredRoot) {
    return process.cwd();
  }

  return resolveFileSystemPath(configuredRoot, process.cwd());
}

export const OPENCRAB_RESOURCE_ROOT = resolveOpenCrabResourceRoot();

export function resolveOpenCrabResourcePath(...parts: string[]) {
  return joinFileSystemPath(OPENCRAB_RESOURCE_ROOT, ...parts);
}
