import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { copyDesktopRuntimeAssets } from "./copy-runtime-assets.mjs";

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(SCRIPT_DIR, "..", "..");
const NEXT_DIR = path.join(REPO_ROOT, ".next");
const STANDALONE_DIR = path.join(NEXT_DIR, "standalone");
const STANDALONE_SERVER_PATH = path.join(STANDALONE_DIR, "server.js");

main();

function main() {
  ensureStandaloneBuildExists();
  copyDesktopRuntimeAssets({
    repoRoot: REPO_ROOT,
    standaloneDir: STANDALONE_DIR,
  });

  console.log("OpenCrab standalone bundle is ready.");
  console.log(`Standalone root: ${STANDALONE_DIR}`);
}

function ensureStandaloneBuildExists() {
  if (existsSync(STANDALONE_SERVER_PATH)) {
    return;
  }

  throw new Error(
    [
      "Next standalone output is missing.",
      "Run `npm run build:web` first so `.next/standalone/server.js` is generated.",
    ].join(" "),
  );
}
