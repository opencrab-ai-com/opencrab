import path from "node:path";

const OPENCRAB_HOME =
  process.env.OPENCRAB_HOME ||
  path.join(process.env.HOME || process.cwd(), "Library", "Application Support", "OpenCrab");

export const OPENCRAB_RUNTIME_DIR = OPENCRAB_HOME;
export const OPENCRAB_UPLOADS_DIR = path.join(OPENCRAB_RUNTIME_DIR, "uploads");
export const OPENCRAB_UPLOADS_INDEX_PATH = path.join(OPENCRAB_UPLOADS_DIR, "index.json");
export const OPENCRAB_LOCAL_STORE_PATH = path.join(OPENCRAB_RUNTIME_DIR, "local-store.json");
export const OPENCRAB_CHANNEL_STORE_PATH = path.join(OPENCRAB_RUNTIME_DIR, "channels.json");
export const OPENCRAB_RUNTIME_CONFIG_PATH = path.join(OPENCRAB_RUNTIME_DIR, "runtime-config.json");
export const OPENCRAB_SKILLS_STORE_PATH = path.join(OPENCRAB_RUNTIME_DIR, "skills.json");
export const OPENCRAB_TASKS_STORE_PATH = path.join(OPENCRAB_RUNTIME_DIR, "tasks.json");
export const OPENCRAB_CHANNEL_SECRET_STORE_PATH = path.join(
  OPENCRAB_RUNTIME_DIR,
  "channel-secrets.json",
);
export const OPENCRAB_TUNNEL_LOG_DIR = path.join(OPENCRAB_RUNTIME_DIR, "tunnels");
export const OPENCRAB_CHROME_PROFILE_DIR = path.join(
  OPENCRAB_RUNTIME_DIR,
  "chrome-debug-profile",
);
