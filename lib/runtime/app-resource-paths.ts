import path from "node:path";

export function resolveOpenCrabResourceRoot(env = process.env) {
  const configuredRoot = env.OPENCRAB_RESOURCE_ROOT?.trim();

  if (!configuredRoot) {
    return process.cwd();
  }

  return path.resolve(configuredRoot);
}

export const OPENCRAB_RESOURCE_ROOT = resolveOpenCrabResourceRoot();

export function resolveOpenCrabResourcePath(...parts: string[]) {
  return path.join(OPENCRAB_RESOURCE_ROOT, ...parts);
}
