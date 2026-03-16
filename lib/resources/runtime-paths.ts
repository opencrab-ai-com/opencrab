import path from "node:path";

const OPENCRAB_HOME =
  process.env.OPENCRAB_HOME ||
  path.join(process.env.HOME || process.cwd(), "Library", "Application Support", "OpenCrab");

export const OPENCRAB_RUNTIME_DIR = OPENCRAB_HOME;
export const OPENCRAB_UPLOADS_DIR = path.join(OPENCRAB_RUNTIME_DIR, "uploads");
export const OPENCRAB_UPLOADS_INDEX_PATH = path.join(OPENCRAB_UPLOADS_DIR, "index.json");
export const OPENCRAB_LOCAL_STORE_PATH = path.join(OPENCRAB_RUNTIME_DIR, "local-store.json");
export const OPENCRAB_CHROME_PROFILE_DIR = path.join(
  OPENCRAB_RUNTIME_DIR,
  "chrome-debug-profile",
);
