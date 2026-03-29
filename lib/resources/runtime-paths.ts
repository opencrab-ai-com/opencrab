import {
  cpSync,
  existsSync,
  mkdirSync,
  readdirSync,
  renameSync,
  rmSync,
} from "node:fs";
import path from "node:path";

const HOME_DIR = process.env.HOME || process.cwd();
const DEFAULT_OPENCRAB_HOME = path.join(HOME_DIR, ".opencrab");
const LEGACY_OPENCRAB_HOME = path.join(HOME_DIR, "Library", "Application Support", "OpenCrab");

const OPENCRAB_HOME = process.env.OPENCRAB_HOME || DEFAULT_OPENCRAB_HOME;

export const OPENCRAB_RUNTIME_DIR = OPENCRAB_HOME;
export const OPENCRAB_RUNTIME_LOCK_DIR = path.join(OPENCRAB_RUNTIME_DIR, ".runtime-lock");
export const OPENCRAB_RUNTIME_LOCK_INFO_PATH = path.join(
  OPENCRAB_RUNTIME_LOCK_DIR,
  "owner.json",
);
export const OPENCRAB_STATE_DIR = path.join(OPENCRAB_RUNTIME_DIR, "state");
export const OPENCRAB_UPLOADS_DIR = path.join(OPENCRAB_RUNTIME_DIR, "uploads");
export const OPENCRAB_UPLOADS_INDEX_PATH = path.join(OPENCRAB_UPLOADS_DIR, "index.json");
export const OPENCRAB_LOGS_DIR = path.join(OPENCRAB_RUNTIME_DIR, "logs");
export const OPENCRAB_BROWSER_DIR = path.join(OPENCRAB_RUNTIME_DIR, "browser");
export const OPENCRAB_SKILLS_DIR = path.join(OPENCRAB_RUNTIME_DIR, "skills");
export const OPENCRAB_AGENTS_DIR = path.join(OPENCRAB_RUNTIME_DIR, "agents");
export const OPENCRAB_WORKSPACES_DIR = path.join(OPENCRAB_RUNTIME_DIR, "workspaces");
export const OPENCRAB_CONVERSATION_WORKSPACES_DIR = path.join(
  OPENCRAB_WORKSPACES_DIR,
  "conversations",
);
export const OPENCRAB_DEFAULT_WORKSPACE_DIR = path.join(
  OPENCRAB_WORKSPACES_DIR,
  "default",
);
export const OPENCRAB_LOCAL_STORE_PATH = path.join(OPENCRAB_STATE_DIR, "local-store.json");
export const OPENCRAB_CHANNEL_STORE_PATH = path.join(OPENCRAB_STATE_DIR, "channels.json");
export const OPENCRAB_RUNTIME_CONFIG_PATH = path.join(OPENCRAB_STATE_DIR, "runtime-config.json");
export const OPENCRAB_SKILLS_STORE_PATH = path.join(OPENCRAB_STATE_DIR, "skills.json");
export const OPENCRAB_TASKS_STORE_PATH = path.join(OPENCRAB_STATE_DIR, "tasks.json");
export const OPENCRAB_PROJECTS_STORE_PATH = path.join(OPENCRAB_STATE_DIR, "projects.json");
export const OPENCRAB_CHANNEL_SECRET_STORE_PATH = path.join(
  OPENCRAB_STATE_DIR,
  "channel-secrets.json",
);
export const OPENCRAB_TUNNEL_LOG_DIR = path.join(OPENCRAB_LOGS_DIR, "tunnels");
export const OPENCRAB_CHROME_PROFILE_DIR = path.join(
  OPENCRAB_BROWSER_DIR,
  "chrome-debug-profile",
);

const LEGACY_ROOT_ITEM_MIGRATIONS = [
  ["local-store.json", OPENCRAB_LOCAL_STORE_PATH],
  ["channels.json", OPENCRAB_CHANNEL_STORE_PATH],
  ["channel-secrets.json", OPENCRAB_CHANNEL_SECRET_STORE_PATH],
  ["runtime-config.json", OPENCRAB_RUNTIME_CONFIG_PATH],
  ["skills.json", OPENCRAB_SKILLS_STORE_PATH],
  ["tasks.json", OPENCRAB_TASKS_STORE_PATH],
  ["uploads", OPENCRAB_UPLOADS_DIR],
  ["tunnels", OPENCRAB_TUNNEL_LOG_DIR],
  ["chrome-debug-profile", OPENCRAB_CHROME_PROFILE_DIR],
] as const;

prepareRuntimeLayout();

function prepareRuntimeLayout() {
  migrateLegacyRuntimeDir();
  migrateLegacyLayoutWithinHome(OPENCRAB_RUNTIME_DIR);

  [
    OPENCRAB_RUNTIME_DIR,
    OPENCRAB_STATE_DIR,
    OPENCRAB_UPLOADS_DIR,
    OPENCRAB_LOGS_DIR,
    OPENCRAB_BROWSER_DIR,
    OPENCRAB_SKILLS_DIR,
    OPENCRAB_AGENTS_DIR,
    OPENCRAB_WORKSPACES_DIR,
    OPENCRAB_CONVERSATION_WORKSPACES_DIR,
    OPENCRAB_DEFAULT_WORKSPACE_DIR,
  ].forEach((dir) => {
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }
  });
}

function migrateLegacyRuntimeDir() {
  if (process.env.OPENCRAB_HOME || OPENCRAB_RUNTIME_DIR !== DEFAULT_OPENCRAB_HOME) {
    return;
  }

  if (!existsSync(LEGACY_OPENCRAB_HOME)) {
    return;
  }

  migrateLegacyLayoutWithinHome(LEGACY_OPENCRAB_HOME);

  if (isDirectoryEmpty(LEGACY_OPENCRAB_HOME)) {
    rmSync(LEGACY_OPENCRAB_HOME, { recursive: true, force: true });
  }
}

function migrateLegacyLayoutWithinHome(sourceRoot: string) {
  for (const [legacyName, targetPath] of LEGACY_ROOT_ITEM_MIGRATIONS) {
    const sourcePath = path.join(sourceRoot, legacyName);

    if (!existsSync(sourcePath) || existsSync(targetPath)) {
      continue;
    }

    movePath(sourcePath, targetPath);
  }
}

function movePath(sourcePath: string, targetPath: string) {
  mkdirSync(path.dirname(targetPath), { recursive: true });

  try {
    renameSync(sourcePath, targetPath);
  } catch {
    cpSync(sourcePath, targetPath, {
      recursive: true,
      force: false,
      errorOnExist: true,
    });
    rmSync(sourcePath, { recursive: true, force: true });
  }
}

function isDirectoryEmpty(dirPath: string) {
  try {
    return readdirSync(dirPath).length === 0;
  } catch {
    return false;
  }
}
