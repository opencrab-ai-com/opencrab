import { existsSync } from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(SCRIPT_DIR, "..", "..");
const DESKTOP_BUILD_DIR = path.join(REPO_ROOT, ".opencrab-desktop");
const ELECTRON_CLI_PATH = path.join(REPO_ROOT, "node_modules", "electron", "cli.js");
const MAIN_ENTRY_PATH = path.join(DESKTOP_BUILD_DIR, "main.js");
const runtimeMode = process.argv[2] === "dev" ? "dev" : "standalone";

if (!existsSync(MAIN_ENTRY_PATH)) {
  throw new Error("Desktop shell bundle is missing. Run `npm run desktop:build-shell` first.");
}

if (!existsSync(ELECTRON_CLI_PATH)) {
  throw new Error("Electron CLI is missing. Reinstall dependencies so the desktop shell can launch.");
}

const child = spawn(process.execPath, [ELECTRON_CLI_PATH, MAIN_ENTRY_PATH], {
  cwd: REPO_ROOT,
  stdio: "inherit",
  env: {
    ...process.env,
    OPENCRAB_DESKTOP_RUNTIME_MODE: runtimeMode,
  },
});

child.on("exit", (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }

  process.exit(code ?? 0);
});
