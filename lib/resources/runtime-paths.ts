import path from "node:path";

export const OPENCRAB_RUNTIME_DIR = path.join(process.cwd(), ".opencrab");
export const OPENCRAB_UPLOADS_DIR = path.join(OPENCRAB_RUNTIME_DIR, "uploads");
export const OPENCRAB_UPLOADS_INDEX_PATH = path.join(OPENCRAB_UPLOADS_DIR, "index.json");
export const OPENCRAB_MOCK_STORE_PATH = path.join(OPENCRAB_RUNTIME_DIR, "mock-store.json");
export const OPENCRAB_CHROME_PROFILE_DIR = path.join(
  OPENCRAB_RUNTIME_DIR,
  "chrome-debug-profile",
);
