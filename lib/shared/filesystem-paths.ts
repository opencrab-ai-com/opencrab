import path from "node:path";

const PATH_SEPARATOR_PATTERN = /[\\/]+/g;

export function joinFileSystemPath(root: string, ...parts: string[]) {
  let result = path.normalize(root);

  for (const part of parts) {
    const normalizedPart = normalizeRelativePathPart(part);

    if (!normalizedPart) {
      continue;
    }

    result = appendPathPart(result, normalizedPart);
  }

  return path.normalize(result);
}

export function expandHomeDirectory(value: string, homeDir: string) {
  const trimmed = value.trim();

  if (trimmed === "~") {
    return path.normalize(homeDir);
  }

  if (trimmed.startsWith("~/") || trimmed.startsWith("~\\")) {
    return joinFileSystemPath(homeDir, trimmed.slice(2));
  }

  return trimmed;
}

export function resolveFileSystemPath(
  value: string,
  baseDir: string,
  homeDir = process.env.HOME || baseDir,
) {
  const expanded = expandHomeDirectory(value, homeDir);

  if (isAbsoluteFileSystemPath(expanded)) {
    return path.normalize(expanded);
  }

  return joinFileSystemPath(baseDir, expanded);
}

function normalizeRelativePathPart(part: string) {
  return part
    .trim()
    .replace(PATH_SEPARATOR_PATTERN, path.sep)
    .replace(new RegExp(`^${escapeForRegex(path.sep)}+|${escapeForRegex(path.sep)}+$`, "g"), "");
}

function appendPathPart(base: string, part: string) {
  if (!base) {
    return part;
  }

  return /[\\/]$/.test(base) ? `${base}${part}` : `${base}${path.sep}${part}`;
}

function isAbsoluteFileSystemPath(value: string) {
  return path.isAbsolute(value) || path.win32.isAbsolute(value) || path.posix.isAbsolute(value);
}

function escapeForRegex(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
