import { existsSync, readFileSync, realpathSync } from "node:fs";
import path from "node:path";
import {
  OPENCRAB_PROJECTS_STORE_PATH,
  OPENCRAB_LOCAL_STORE_PATH,
  OPENCRAB_UPLOADS_DIR,
} from "@/lib/resources/runtime-paths";
import { getOpenCrabExecutionArtifactRoots } from "@/lib/runtime/resource-paths";

type StoredProjectRooms = {
  rooms?: Array<{
    workspaceDir?: string | null;
  }>;
};

type StoredConversations = {
  conversations?: Array<{
    workspaceDir?: string | null;
  }>;
};

const STATIC_ATTACHMENT_ROOTS = [
  OPENCRAB_UPLOADS_DIR,
  ...getOpenCrabExecutionArtifactRoots(),
];

export function isAttachmentPathAllowed(filePath: string) {
  const resolvedTarget = resolveExistingPath(filePath);

  if (!resolvedTarget) {
    return false;
  }

  return getAllowedAttachmentRoots().some((root) => isWithinRoot(resolvedTarget, root));
}

export function resolveExistingPath(filePath: string) {
  if (!filePath.trim()) {
    return null;
  }

  const resolved = path.resolve(filePath);

  if (!existsSync(resolved)) {
    return null;
  }

  try {
    return realpathSync.native(resolved);
  } catch {
    return resolved;
  }
}

function getAllowedAttachmentRoots() {
  const roots = new Set<string>();

  for (const root of STATIC_ATTACHMENT_ROOTS) {
    roots.add(resolveRootPath(root));
  }

  for (const workspaceDir of readProjectWorkspaceRoots()) {
    roots.add(resolveRootPath(workspaceDir));
  }

  for (const workspaceDir of readConversationWorkspaceRoots()) {
    roots.add(resolveRootPath(workspaceDir));
  }

  return [...roots];
}

function readProjectWorkspaceRoots() {
  if (!existsSync(OPENCRAB_PROJECTS_STORE_PATH)) {
    return [];
  }

  try {
    const parsed = JSON.parse(readFileSync(OPENCRAB_PROJECTS_STORE_PATH, "utf8")) as StoredProjectRooms;

    return (parsed.rooms || [])
      .map((room) => room.workspaceDir?.trim() || "")
      .filter(Boolean);
  } catch {
    return [];
  }
}

function readConversationWorkspaceRoots() {
  if (!existsSync(OPENCRAB_LOCAL_STORE_PATH)) {
    return [];
  }

  try {
    const parsed = JSON.parse(readFileSync(OPENCRAB_LOCAL_STORE_PATH, "utf8")) as StoredConversations;

    return (parsed.conversations || [])
      .map((conversation) => conversation.workspaceDir?.trim() || "")
      .filter(Boolean);
  } catch {
    return [];
  }
}

function resolveRootPath(rootPath: string) {
  const resolved = path.resolve(rootPath);

  if (!existsSync(resolved)) {
    return resolved;
  }

  try {
    return realpathSync.native(resolved);
  } catch {
    return resolved;
  }
}

function isWithinRoot(targetPath: string, rootPath: string) {
  const relative = path.relative(rootPath, targetPath);
  return relative === "" || (!relative.startsWith("..") && !path.isAbsolute(relative));
}
