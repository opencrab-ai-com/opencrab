const { execFileSync, spawn } = require("node:child_process");
const { existsSync } = require("node:fs");
const path = require("node:path");

const OPENCRAB_ROOT = path.resolve(__dirname, "..");
const DEFAULT_BUNDLE_ROOT = path.join(OPENCRAB_ROOT, ".opencrab-desktop", "runtime");
const DEFAULT_PORT = 3400;
const DEFAULT_TIMEOUT_MS = 60_000;
const DEFAULT_POLL_INTERVAL_MS = 500;

function resolveDesktopRuntimeConfig(env = process.env, input = {}) {
  const attachedBaseUrl = normalizeBaseUrl(env.OPENCRAB_DESKTOP_TARGET_URL);

  if (attachedBaseUrl) {
    return {
      mode: "attach",
      baseUrl: attachedBaseUrl,
      timeoutMs: parsePositiveInt(env.OPENCRAB_DESKTOP_START_TIMEOUT_MS, DEFAULT_TIMEOUT_MS),
      pollIntervalMs: parsePositiveInt(
        env.OPENCRAB_DESKTOP_POLL_INTERVAL_MS,
        DEFAULT_POLL_INTERVAL_MS,
      ),
    };
  }

  const runtimeProfile = resolveDesktopRuntimeProfile(env, input);

  if (runtimeProfile === "production") {
    return resolveProductionDesktopRuntimeConfig(env, input);
  }

  return resolveDevelopmentDesktopRuntimeConfig(env, input);
}

function resolveDevelopmentDesktopRuntimeConfig(env, input) {
  const port = parsePositiveInt(env.OPENCRAB_DESKTOP_PORT, DEFAULT_PORT);
  const baseUrl =
    normalizeBaseUrl(env.OPENCRAB_DESKTOP_BASE_URL) || `http://127.0.0.1:${port}`;
  const runtimeScript = env.OPENCRAB_DESKTOP_RUNTIME_SCRIPT?.trim() || "dev";
  const proxyEnv = resolveDesktopProxyEnv(env, input);

  return {
    mode: "spawn",
    runtimeProfile: "development",
    baseUrl,
    port,
    cwd: OPENCRAB_ROOT,
    command: process.platform === "win32" ? "npm.cmd" : "npm",
    args: ["run", runtimeScript, "--", "--port", String(port)],
    env: {
      ...proxyEnv,
      OPENCRAB_APP_ORIGIN: baseUrl,
      OPENCRAB_RESOURCE_ROOT: OPENCRAB_ROOT,
      OPENCRAB_EXECUTION_ROOT: OPENCRAB_ROOT,
    },
    timeoutMs: parsePositiveInt(env.OPENCRAB_DESKTOP_START_TIMEOUT_MS, DEFAULT_TIMEOUT_MS),
    pollIntervalMs: parsePositiveInt(
      env.OPENCRAB_DESKTOP_POLL_INTERVAL_MS,
      DEFAULT_POLL_INTERVAL_MS,
    ),
  };
}

function resolveProductionDesktopRuntimeConfig(env, input) {
  const port = parsePositiveInt(env.OPENCRAB_DESKTOP_PORT, DEFAULT_PORT);
  const baseUrl =
    normalizeBaseUrl(env.OPENCRAB_DESKTOP_BASE_URL) || `http://127.0.0.1:${port}`;
  const bundleRoot = resolveDesktopBundleRoot(env, input);
  const proxyEnv = resolveDesktopProxyEnv(env, input);
  const helperExecutable = resolveDesktopHelperExecutable(input);
  const serverEntrypoint =
    env.OPENCRAB_DESKTOP_SERVER_ENTRYPOINT?.trim()
      ? path.resolve(bundleRoot, env.OPENCRAB_DESKTOP_SERVER_ENTRYPOINT)
      : path.join(bundleRoot, "server.js");

  return {
    mode: "spawn",
    runtimeProfile: "production",
    baseUrl,
    port,
    cwd: bundleRoot,
    bundleRoot,
    command: helperExecutable || process.execPath,
    args: [serverEntrypoint],
    requiredPaths: helperExecutable ? [serverEntrypoint, helperExecutable] : [serverEntrypoint],
    env: {
      ...proxyEnv,
      NODE_ENV: "production",
      HOSTNAME: "127.0.0.1",
      PORT: String(port),
      ELECTRON_RUN_AS_NODE: "1",
      OPENCRAB_APP_ORIGIN: baseUrl,
      OPENCRAB_RESOURCE_ROOT: bundleRoot,
      OPENCRAB_EXECUTION_ROOT: bundleRoot,
    },
    timeoutMs: parsePositiveInt(env.OPENCRAB_DESKTOP_START_TIMEOUT_MS, DEFAULT_TIMEOUT_MS),
    pollIntervalMs: parsePositiveInt(
      env.OPENCRAB_DESKTOP_POLL_INTERVAL_MS,
      DEFAULT_POLL_INTERVAL_MS,
    ),
  };
}

function resolveDesktopRuntimeProfile(env, input) {
  const explicitProfile =
    env.OPENCRAB_DESKTOP_RUNTIME_PROFILE?.trim() ||
    env.OPENCRAB_DESKTOP_RUNTIME_MODE?.trim();

  if (explicitProfile === "development" || explicitProfile === "production") {
    return explicitProfile;
  }

  return input.packaged ? "production" : "development";
}

function resolveDesktopBundleRoot(env, input) {
  const configuredRoot = env.OPENCRAB_DESKTOP_RUNTIME_BUNDLE_DIR?.trim();

  if (configuredRoot) {
    return path.resolve(configuredRoot);
  }

  if (input.packaged && input.resourcesPath) {
    return path.join(input.resourcesPath, "desktop-runtime");
  }

  return DEFAULT_BUNDLE_ROOT;
}

function resolveDesktopHelperExecutable(input = {}) {
  if (!input.packaged) {
    return null;
  }

  const helperBaseName = resolveDesktopExecutableBaseName(input);

  if (!helperBaseName) {
    return null;
  }

  const resourcesPath = input.resourcesPath;

  if (!resourcesPath) {
    return null;
  }

  return path.join(
    resourcesPath,
    "..",
    "Frameworks",
    `${helperBaseName} Helper.app`,
    "Contents",
    "MacOS",
    `${helperBaseName} Helper`,
  );
}

function resolveDesktopExecutableBaseName(input = {}) {
  if (input.executablePath) {
    return path.basename(input.executablePath);
  }

  if (input.resourcesPath) {
    const appBundlePath = path.dirname(path.dirname(input.resourcesPath));
    const appBundleName = path.basename(appBundlePath);

    if (appBundleName.endsWith(".app")) {
      return appBundleName.slice(0, -4);
    }
  }

  return null;
}

function createRuntimeManager(input = {}) {
  const config = input.config || resolveDesktopRuntimeConfig(input.env, input);
  let runtimeProcess = null;
  let startPromise = null;
  let stopping = false;

  return {
    config,
    get baseUrl() {
      return config.baseUrl;
    },
    async ensureStarted() {
      if (!startPromise) {
        startPromise = startRuntime(config);
      }

      try {
        return await startPromise;
      } catch (error) {
        startPromise = null;
        throw error;
      }
    },
    stop() {
      stopping = true;

      if (!runtimeProcess || !runtimeProcess.isRunning()) {
        return;
      }

      runtimeProcess.kill();
    },
  };

  async function startRuntime(runtimeConfig) {
    if (runtimeConfig.mode === "spawn") {
      ensureRuntimeConfigReady(runtimeConfig);

      runtimeProcess = defaultLaunchRuntimeProcess(runtimeConfig);

      attachRuntimeLogs(runtimeProcess.stdout, "stdout");
      attachRuntimeLogs(runtimeProcess.stderr, "stderr");

      runtimeProcess.onExit((code, signal) => {
        if (stopping) {
          return;
        }

        const detail =
          code !== null ? `code ${code}` : signal ? `signal ${signal}` : "unknown status";
        console.error(`[desktop:runtime] Shared runtime exited before app shutdown (${detail}).`);
      });
    }

    await waitForRuntimeReady(runtimeConfig, runtimeProcess);
    return runtimeConfig.baseUrl;
  }
}

async function waitForRuntimeReady(config, runtimeProcess) {
  const deadline = Date.now() + config.timeoutMs;

  while (Date.now() < deadline) {
    if (runtimeProcess && !runtimeProcess.isRunning()) {
      throw new Error("Shared runtime exited before it became ready.");
    }

    try {
      const response = await fetch(`${config.baseUrl}/api/health`);

      if (response.ok) {
        return;
      }
    } catch {
      // Poll until the runtime is ready or times out.
    }

    await sleep(config.pollIntervalMs);
  }

  throw new Error(`Timed out waiting for the shared runtime at ${config.baseUrl}.`);
}

function ensureRuntimeConfigReady(config) {
  for (const requiredPath of config.requiredPaths || []) {
    if (!existsSync(requiredPath)) {
      throw new Error(
        `Desktop runtime 缺少生产入口：${requiredPath}。请先运行 npm run desktop:bundle-runtime。`,
      );
    }
  }
}

function defaultLaunchRuntimeProcess(runtimeConfig) {
  const child = spawn(runtimeConfig.command, runtimeConfig.args, {
    cwd: runtimeConfig.cwd,
    env: {
      ...process.env,
      ...runtimeConfig.env,
    },
    stdio: ["ignore", "pipe", "pipe"],
  });

  return {
    stdout: child.stdout,
    stderr: child.stderr,
    isRunning() {
      return child.exitCode === null && !child.killed;
    },
    kill() {
      return child.kill();
    },
    onExit(listener) {
      child.once("exit", (code, signal) => {
        listener(code, signal);
      });
    },
  };
}

function normalizeBaseUrl(value) {
  const raw = value?.trim();

  if (!raw) {
    return null;
  }

  try {
    const url = new URL(raw);
    return `${url.protocol}//${url.host}`;
  } catch {
    return null;
  }
}

function isAppUrl(urlValue, baseUrl) {
  try {
    return new URL(urlValue).origin === new URL(baseUrl).origin;
  } catch {
    return false;
  }
}

function parsePositiveInt(value, fallback) {
  const parsed = Number.parseInt(value || "", 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function attachRuntimeLogs(stream, label) {
  if (!stream) {
    return;
  }

  stream.on("data", (chunk) => {
    const message = chunk.toString().trim();

    if (message) {
      console.log(`[desktop:${label}] ${message}`);
    }
  });
}

function resolveDesktopProxyEnv(env = {}, input = {}) {
  if (process.platform !== "darwin") {
    return {};
  }

  const configuredProxyEnv =
    input.systemProxyEnv ||
    readMacOsSystemProxyEnv(input.systemProxyOutput);

  if (!configuredProxyEnv || Object.keys(configuredProxyEnv).length === 0) {
    return {};
  }

  const nextEnv = {};

  if (!env.http_proxy && !env.HTTP_PROXY && configuredProxyEnv.http_proxy) {
    nextEnv.http_proxy = configuredProxyEnv.http_proxy;
    nextEnv.HTTP_PROXY = configuredProxyEnv.http_proxy;
  }

  if (!env.https_proxy && !env.HTTPS_PROXY && configuredProxyEnv.https_proxy) {
    nextEnv.https_proxy = configuredProxyEnv.https_proxy;
    nextEnv.HTTPS_PROXY = configuredProxyEnv.https_proxy;
  }

  if (!env.all_proxy && !env.ALL_PROXY && configuredProxyEnv.all_proxy) {
    nextEnv.all_proxy = configuredProxyEnv.all_proxy;
    nextEnv.ALL_PROXY = configuredProxyEnv.all_proxy;
  }

  if (!env.no_proxy && !env.NO_PROXY && configuredProxyEnv.no_proxy) {
    nextEnv.no_proxy = configuredProxyEnv.no_proxy;
    nextEnv.NO_PROXY = configuredProxyEnv.no_proxy;
  }

  return nextEnv;
}

let cachedMacOsSystemProxyEnv = null;

function readMacOsSystemProxyEnv(proxyOutput) {
  if (proxyOutput === undefined && cachedMacOsSystemProxyEnv) {
    return cachedMacOsSystemProxyEnv;
  }

  try {
    const output =
      proxyOutput ||
      execFileSync("scutil", ["--proxy"], {
        encoding: "utf8",
      });
    const parsed = parseMacOsSystemProxyOutput(output);

    if (proxyOutput === undefined) {
      cachedMacOsSystemProxyEnv = parsed;
    }

    return parsed;
  } catch {
    return {};
  }
}

function parseMacOsSystemProxyOutput(output) {
  const readValue = (key) => {
    const match = output.match(new RegExp(`${key}\\s*:\\s*(.+)$`, "m"));
    return match ? match[1].trim() : null;
  };
  const readEnabled = (key) => readValue(key) === "1";
  const readProxyUrl = (protocol, prefix) => {
    if (!readEnabled(`${prefix}Enable`)) {
      return null;
    }

    const host = readValue(`${prefix}Proxy`);
    const port = readValue(`${prefix}Port`);

    if (!host || !port) {
      return null;
    }

    return `${protocol}://${host}:${port}`;
  };
  const exceptionMatches = Array.from(output.matchAll(/^\s+\d+\s+:\s+(.+)$/gm))
    .map((match) => match[1]?.trim())
    .filter(Boolean);

  const httpProxy = readProxyUrl("http", "HTTP");
  const httpsProxy = readProxyUrl("http", "HTTPS");
  const socksProxy = readProxyUrl("socks5", "SOCKS");

  return {
    ...(httpProxy ? { http_proxy: httpProxy } : {}),
    ...(httpsProxy ? { https_proxy: httpsProxy } : {}),
    ...(!httpProxy && !httpsProxy && socksProxy ? { all_proxy: socksProxy } : {}),
    ...(exceptionMatches.length > 0 ? { no_proxy: exceptionMatches.join(",") } : {}),
  };
}

function sleep(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

module.exports = {
  createRuntimeManager,
  isAppUrl,
  normalizeBaseUrl,
  resolveDesktopProxyEnv,
  resolveDesktopBundleRoot,
  resolveDesktopRuntimeConfig,
};
