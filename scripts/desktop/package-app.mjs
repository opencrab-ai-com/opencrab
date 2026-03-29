import {
  cpSync,
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  renameSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { execFileSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(SCRIPT_DIR, "..", "..");
const PACKAGE_JSON_PATH = path.join(REPO_ROOT, "package.json");
const DIST_ROOT = path.join(REPO_ROOT, "dist", "desktop");
const APP_NAME = "OpenCrab";
const APP_ICON_SOURCE_DIR = path.join(REPO_ROOT, "public", "branding", "png-app");
const ELECTRON_APP_SOURCE = path.join(
  REPO_ROOT,
  "node_modules",
  "electron",
  "dist",
  "Electron.app",
);
const APP_BUNDLE_PATH = path.join(DIST_ROOT, `${APP_NAME}.app`);
const APP_RESOURCES_DIR = path.join(APP_BUNDLE_PATH, "Contents", "Resources");
const APP_RUNTIME_DIR = path.join(APP_RESOURCES_DIR, "app");
const APP_PACKAGE_JSON_PATH = path.join(APP_RUNTIME_DIR, "package.json");
const APP_SHELL_DIR = path.join(APP_RUNTIME_DIR, ".opencrab-desktop");
const APP_BUNDLE_ROOT = path.join(APP_RESOURCES_DIR, "desktop-bundle");
const APP_STANDALONE_DIR = path.join(APP_BUNDLE_ROOT, "standalone");
const APP_INFO_PLIST_PATH = path.join(APP_BUNDLE_PATH, "Contents", "Info.plist");
const APP_EXECUTABLE_DIR = path.join(APP_BUNDLE_PATH, "Contents", "MacOS");
const APP_EXECUTABLE_PATH = path.join(APP_EXECUTABLE_DIR, APP_NAME);
const APP_NODE_ALIAS_PATH = path.join(APP_EXECUTABLE_DIR, "node");
const APP_HELPER_EXECUTABLE_PATH = path.join(
  APP_BUNDLE_PATH,
  "Contents",
  "Frameworks",
  "Electron Helper.app",
  "Contents",
  "MacOS",
  "Electron Helper",
);
const APP_ICON_FILE_NAME = `${APP_NAME}.icns`;
const APP_ICON_PATH = path.join(APP_RESOURCES_DIR, APP_ICON_FILE_NAME);
const TEMP_ICONSET_DIR = path.join(DIST_ROOT, `${APP_NAME}.iconset`);
const PRUNED_STANDALONE_DIR_NAMES = [
  ".playwright-cli",
  "coverage",
  "dist",
  "docs",
  "output",
  "tests",
  "tmp",
];
const PRUNED_STANDALONE_FILE_SUFFIXES = [".dmg", ".tgz", ".tar.gz", ".zip"];
const ICONSET_SOURCE_FILES = [
  ["opencrab-mark-16.png", "icon_16x16.png"],
  ["opencrab-mark-32.png", "icon_16x16@2x.png"],
  ["opencrab-mark-32.png", "icon_32x32.png"],
  ["opencrab-mark-64.png", "icon_32x32@2x.png"],
  ["opencrab-mark-128.png", "icon_128x128.png"],
  ["opencrab-mark-256.png", "icon_128x128@2x.png"],
  ["opencrab-mark-256.png", "icon_256x256.png"],
  ["opencrab-mark-512.png", "icon_256x256@2x.png"],
  ["opencrab-mark-512.png", "icon_512x512.png"],
  ["opencrab-mark-1024.png", "icon_512x512@2x.png"],
];

main();

function main() {
  ensureBuildArtifactsExist();
  recreateAppBundle();
  customizeMacBundleMetadata();
  installRuntimePayload();
  signAppBundle();

  console.log(`Desktop app bundle is ready: ${APP_BUNDLE_PATH}`);
}

function ensureBuildArtifactsExist() {
  const requiredPaths = [
    ELECTRON_APP_SOURCE,
    APP_ICON_SOURCE_DIR,
    path.join(REPO_ROOT, ".opencrab-desktop", "main.js"),
    path.join(REPO_ROOT, ".next", "standalone", "server.js"),
  ];

  for (const requiredPath of requiredPaths) {
    if (!existsSync(requiredPath)) {
      throw new Error(`Missing required desktop artifact: ${requiredPath}`);
    }
  }
}

function recreateAppBundle() {
  mkdirSync(DIST_ROOT, { recursive: true });
  rmSync(APP_BUNDLE_PATH, { recursive: true, force: true });
  execFileSync("ditto", [ELECTRON_APP_SOURCE, APP_BUNDLE_PATH], {
    stdio: "ignore",
  });
}

function customizeMacBundleMetadata() {
  const packageJson = JSON.parse(readFileSync(PACKAGE_JSON_PATH, "utf8"));
  const version = packageJson.version || "0.1.0";
  const originalExecutablePath = path.join(APP_EXECUTABLE_DIR, "Electron");

  if (existsSync(originalExecutablePath)) {
    renameSync(originalExecutablePath, APP_EXECUTABLE_PATH);
  }

  rmSync(APP_NODE_ALIAS_PATH, { force: true });
  symlinkSync(path.relative(APP_EXECUTABLE_DIR, APP_HELPER_EXECUTABLE_PATH), APP_NODE_ALIAS_PATH);
  installAppIcon();

  setPlistValue("CFBundleDisplayName", APP_NAME);
  setPlistValue("CFBundleName", APP_NAME);
  setPlistValue("CFBundleExecutable", APP_NAME);
  setPlistValue("CFBundleIdentifier", "com.opencrab.desktop");
  setPlistValue("CFBundleIconFile", APP_ICON_FILE_NAME);
  setPlistValue("CFBundleShortVersionString", version);
  setPlistValue("CFBundleVersion", version);
  setPlistValue("LSApplicationCategoryType", "public.app-category.productivity");
  deletePlistKey("ElectronAsarIntegrity");
}

function installRuntimePayload() {
  mkdirSync(APP_RUNTIME_DIR, { recursive: true });
  rmSync(APP_SHELL_DIR, { recursive: true, force: true });
  cpSync(path.join(REPO_ROOT, ".opencrab-desktop"), APP_SHELL_DIR, {
    recursive: true,
    force: true,
    verbatimSymlinks: true,
  });

  rmSync(APP_STANDALONE_DIR, { recursive: true, force: true });
  mkdirSync(path.dirname(APP_STANDALONE_DIR), { recursive: true });
  cpSync(path.join(REPO_ROOT, ".next", "standalone"), APP_STANDALONE_DIR, {
    recursive: true,
    force: true,
    verbatimSymlinks: true,
  });
  pruneStandaloneArtifacts(APP_STANDALONE_DIR);

  rmSync(path.join(APP_RESOURCES_DIR, "default_app.asar"), { force: true });
  writeFileSync(
    APP_PACKAGE_JSON_PATH,
    JSON.stringify(
      {
        name: "opencrab-desktop",
        productName: APP_NAME,
        version: JSON.parse(readFileSync(PACKAGE_JSON_PATH, "utf8")).version || "0.1.0",
        main: ".opencrab-desktop/main.js",
      },
      null,
      2,
    ),
    "utf8",
  );
}

function setPlistValue(key, value) {
  execFileSync(
    "/usr/libexec/PlistBuddy",
    ["-c", `Set :${key} ${shellEscapePlistValue(value)}`, APP_INFO_PLIST_PATH],
    {
      stdio: "ignore",
    },
  );
}

function deletePlistKey(key) {
  try {
    execFileSync(
      "/usr/libexec/PlistBuddy",
      ["-c", `Delete :${key}`, APP_INFO_PLIST_PATH],
      {
        stdio: "ignore",
      },
    );
  } catch {
    // Ignore missing keys so repeated packaging stays idempotent.
  }
}

function shellEscapePlistValue(value) {
  return String(value).replace(/"/g, '\\"');
}

function installAppIcon() {
  rmSync(TEMP_ICONSET_DIR, { recursive: true, force: true });
  mkdirSync(TEMP_ICONSET_DIR, { recursive: true });

  for (const [sourceFileName, iconsetFileName] of ICONSET_SOURCE_FILES) {
    cpSync(
      path.join(APP_ICON_SOURCE_DIR, sourceFileName),
      path.join(TEMP_ICONSET_DIR, iconsetFileName),
      {
        force: true,
      },
    );
  }

  rmSync(APP_ICON_PATH, { force: true });
  execFileSync("iconutil", ["-c", "icns", TEMP_ICONSET_DIR, "-o", APP_ICON_PATH], {
    stdio: "ignore",
  });
  rmSync(path.join(APP_RESOURCES_DIR, "electron.icns"), { force: true });
  rmSync(TEMP_ICONSET_DIR, { recursive: true, force: true });
}

function pruneStandaloneArtifacts(standaloneDir) {
  for (const dirName of PRUNED_STANDALONE_DIR_NAMES) {
    rmSync(path.join(standaloneDir, dirName), {
      recursive: true,
      force: true,
    });
  }

  for (const entry of readdirSync(standaloneDir, { withFileTypes: true })) {
    if (!entry.isFile()) {
      continue;
    }

    if (!PRUNED_STANDALONE_FILE_SUFFIXES.some((suffix) => entry.name.endsWith(suffix))) {
      continue;
    }

    rmSync(path.join(standaloneDir, entry.name), {
      force: true,
    });
  }
}

function signAppBundle() {
  execFileSync(
    "codesign",
    ["--force", "--deep", "--sign", "-", "--timestamp=none", APP_BUNDLE_PATH],
    {
      stdio: "ignore",
    },
  );
}
