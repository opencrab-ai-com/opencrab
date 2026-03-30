import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const {
  buildIsolatedDesktopEnv,
  createIsolatedOpenCrabHome,
  resolveElectronBinary,
  resolveSystemHomeDirectory,
} = require("../../desktop/runtime-home.cjs");

const projectRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
  "..",
);
const mode = resolveRuntimeProfile(process.argv[2]);
const isolatedHome = createIsolatedOpenCrabHome();
const env = buildIsolatedDesktopEnv(process.env, {
  openCrabHome: isolatedHome.openCrabHome,
  runtimeProfile: mode,
  port: process.env.OPENCRAB_DESKTOP_PORT,
});
const electronBinary = resolveElectronBinary(projectRoot);
const shouldPreserveOpenCrabHome =
  process.env.OPENCRAB_DESKTOP_PRESERVE_OPENCRAB_HOME === "1";

console.log(`[desktop:isolation] OpenCrab data dir: ${isolatedHome.openCrabHome}`);
console.log(
  `[desktop:isolation] System HOME preserved at: ${resolveSystemHomeDirectory(process.env)}`,
);
console.log(
  "[desktop:isolation] Note: this isolates OpenCrab state only; your system Chrome session and ChatGPT/Codex login stay at the normal system level.",
);

const child = spawn(electronBinary, ["desktop/main.cjs"], {
  cwd: projectRoot,
  env,
  stdio: "inherit",
});

let shuttingDown = false;

const cleanup = () => {
  if (shouldPreserveOpenCrabHome) {
    console.log(
      `[desktop:isolation] Preserved isolated OpenCrab data at ${isolatedHome.openCrabHome}`,
    );
    return;
  }

  isolatedHome.cleanup();
};

process.on("SIGINT", () => forwardSignal("SIGINT"));
process.on("SIGTERM", () => forwardSignal("SIGTERM"));

child.once("exit", (code, signal) => {
  cleanup();

  if (signal) {
    process.kill(process.pid, signal);
    return;
  }

  process.exit(code ?? 0);
});

child.once("error", (error) => {
  cleanup();
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});

function forwardSignal(signal) {
  if (shuttingDown) {
    return;
  }

  shuttingDown = true;

  if (!child.killed) {
    child.kill(signal);
  }
}

function resolveRuntimeProfile(value) {
  return value === "development" ? "development" : "production";
}
