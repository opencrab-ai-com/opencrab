const { existsSync, mkdtempSync, mkdirSync, rmSync } = require("node:fs");
const os = require("node:os");
const path = require("node:path");

function resolveSystemHomeDirectory(env = process.env) {
  try {
    const homeDir = os.userInfo().homedir;

    if (typeof homeDir === "string" && homeDir.trim()) {
      return homeDir;
    }
  } catch {
    // Fall back to environment-derived paths below.
  }

  return env.HOME || os.homedir() || process.cwd();
}

function createIsolatedOpenCrabHome(input = {}) {
  const prefix =
    input.prefix || path.join(os.tmpdir(), "opencrab-isolated-runtime-");
  const rootDir = mkdtempSync(prefix);
  const openCrabHome = path.join(rootDir, "opencrab-home");
  mkdirSync(openCrabHome, { recursive: true });

  return {
    rootDir,
    openCrabHome,
    cleanup() {
      rmSync(rootDir, { recursive: true, force: true });
    },
  };
}

function buildIsolatedDesktopEnv(env = process.env, input = {}) {
  const nextEnv = {
    ...env,
    HOME: resolveSystemHomeDirectory(env),
    OPENCRAB_HOME: input.openCrabHome,
    CODEX_HOME: input.openCrabHome,
  };

  if (input.runtimeProfile) {
    nextEnv.OPENCRAB_DESKTOP_RUNTIME_PROFILE = input.runtimeProfile;
  }

  if (input.port) {
    nextEnv.OPENCRAB_DESKTOP_PORT = String(input.port);
  }

  return nextEnv;
}

function resolveElectronBinary(projectRoot) {
  const binaryName = process.platform === "win32" ? "electron.cmd" : "electron";
  const binaryPath = path.join(projectRoot, "node_modules", ".bin", binaryName);

  if (!existsSync(binaryPath)) {
    throw new Error(
      `缺少 Electron 可执行文件：${binaryPath}。请先安装项目依赖。`,
    );
  }

  return binaryPath;
}

module.exports = {
  buildIsolatedDesktopEnv,
  createIsolatedOpenCrabHome,
  resolveElectronBinary,
  resolveSystemHomeDirectory,
};
