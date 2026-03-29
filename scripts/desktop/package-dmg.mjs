import { existsSync, readFileSync, rmSync } from "node:fs";
import { execFileSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(SCRIPT_DIR, "..", "..");
const DIST_ROOT = path.join(REPO_ROOT, "dist", "desktop");
const APP_NAME = "OpenCrab";
const APP_BUNDLE_PATH = path.join(DIST_ROOT, `${APP_NAME}.app`);
const DMG_PATH = path.join(
  DIST_ROOT,
  `${APP_NAME}-${readVersion()}-${normalizeArch(process.arch)}.dmg`,
);

main();

function main() {
  if (process.platform !== "darwin") {
    throw new Error("DMG packaging is only supported on macOS.");
  }

  if (!existsSync(APP_BUNDLE_PATH)) {
    throw new Error("Desktop app bundle is missing. Run `npm run desktop:dist:dir` first.");
  }

  rmSync(DMG_PATH, { force: true });
  execFileSync(
    "hdiutil",
    [
      "create",
      "-volname",
      APP_NAME,
      "-srcfolder",
      APP_BUNDLE_PATH,
      "-ov",
      "-format",
      "UDZO",
      DMG_PATH,
    ],
    {
      stdio: "inherit",
    },
  );

  console.log(`Desktop DMG is ready: ${DMG_PATH}`);
}

function readVersion() {
  const packageJson = JSON.parse(
    readFileSync(path.join(REPO_ROOT, "package.json"), "utf8"),
  );

  return packageJson.version || "0.1.0";
}

function normalizeArch(value) {
  return value === "arm64" ? "arm64" : value === "x64" ? "x64" : value;
}
