import { existsSync, mkdirSync } from "node:fs";
import path from "node:path";
import {
  OPENCRAB_CONVERSATION_WORKSPACES_DIR,
} from "@/lib/resources/runtime-paths";

const HOME_DIR = process.env.HOME || process.cwd();

export function getDefaultConversationWorkspaceDir(conversationId: string) {
  return ensureWorkspaceDirectory(
    path.join(OPENCRAB_CONVERSATION_WORKSPACES_DIR, conversationId),
  );
}

export function normalizeConversationWorkspaceDir(
  value: string | null | undefined,
  conversationId: string,
) {
  const resolved =
    resolveWorkspaceDirectoryInput(value) ??
    path.join(OPENCRAB_CONVERSATION_WORKSPACES_DIR, conversationId);

  return ensureWorkspaceDirectory(resolved);
}

export function normalizeProjectWorkspaceDir(value: string) {
  const resolved = resolveWorkspaceDirectoryInput(value);

  if (!resolved) {
    throw new Error("请先指定这个团队的工作空间目录。");
  }

  return ensureWorkspaceDirectory(resolved);
}

export function resolveWorkspaceDirectoryInput(value: string | null | undefined) {
  const raw = value?.trim() || "";

  if (!raw) {
    return null;
  }

  return path.resolve(expandHomeDirectory(raw));
}

function ensureWorkspaceDirectory(dirPath: string) {
  if (!existsSync(dirPath)) {
    mkdirSync(dirPath, { recursive: true });
  }

  return dirPath;
}

function expandHomeDirectory(value: string) {
  if (value === "~") {
    return HOME_DIR;
  }

  if (value.startsWith("~/") || value.startsWith("~\\")) {
    return path.join(HOME_DIR, value.slice(2));
  }

  return value;
}
