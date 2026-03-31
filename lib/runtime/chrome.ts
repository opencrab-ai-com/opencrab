import { execFile, spawn } from "node:child_process";
import { access } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

export type ChromeInstallationStatus = {
  ok: boolean;
  chromePath: string | null;
  message: string;
};

const POSIX_COMMAND_CANDIDATES = [
  "google-chrome",
  "google-chrome-stable",
  "chromium",
  "chromium-browser",
  "chrome",
];

export async function resolveChromeExecutable(
  env: NodeJS.ProcessEnv = process.env,
): Promise<string | null> {
  const override = resolveChromeOverride(env);

  if (override && (await isExecutableAvailable(override))) {
    return override;
  }

  for (const candidate of getPlatformChromeCandidates(env)) {
    if (await isExecutableAvailable(candidate)) {
      return candidate;
    }
  }

  return null;
}

export async function getChromeInstallationStatus(
  env: NodeJS.ProcessEnv = process.env,
): Promise<ChromeInstallationStatus> {
  const chromePath = await resolveChromeExecutable(env);

  if (!chromePath) {
    return {
      ok: false,
      chromePath: null,
      message: "OpenCrab 需要 Google Chrome 才能使用浏览器能力和 ChatGPT 登录。",
    };
  }

  return {
    ok: true,
    chromePath,
    message: "已检测到 Google Chrome，可以继续完成 OpenCrab 首次准备。",
  };
}

export async function openUrlInChrome(
  url: string,
  env: NodeJS.ProcessEnv = process.env,
) {
  const chromePath = await resolveChromeExecutable(env);

  if (!chromePath) {
    throw new Error("OpenCrab 需要 Google Chrome 才能打开 ChatGPT 登录页。");
  }

  const child = spawn(chromePath, [url], {
    detached: true,
    stdio: "ignore",
  });

  child.unref();

  return {
    chromePath,
  };
}

async function isExecutableAvailable(candidate: string) {
  if (!candidate) {
    return false;
  }

  if (path.isAbsolute(candidate)) {
    try {
      await access(candidate);
      return true;
    } catch {
      return false;
    }
  }

  try {
    await execFileAsync(candidate, ["--version"], {
      timeout: 4000,
    });
    return true;
  } catch {
    return false;
  }
}

function resolveChromeOverride(env: NodeJS.ProcessEnv) {
  const raw = env.OPENCRAB_CHROME_PATH?.trim();

  if (!raw) {
    return null;
  }

  if (path.isAbsolute(raw)) {
    return raw;
  }

  return path.resolve(env.OPENCRAB_RESOURCE_ROOT || process.cwd(), raw);
}

function getPlatformChromeCandidates(env: NodeJS.ProcessEnv) {
  switch (process.platform) {
    case "darwin":
      return [
        "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
        path.join(
          env.HOME || os.homedir(),
          "Applications",
          "Google Chrome.app",
          "Contents",
          "MacOS",
          "Google Chrome",
        ),
      ];
    case "win32":
      return [
        path.join(
          env.PROGRAMFILES || "C:\\Program Files",
          "Google",
          "Chrome",
          "Application",
          "chrome.exe",
        ),
        path.join(
          env["PROGRAMFILES(X86)"] || "C:\\Program Files (x86)",
          "Google",
          "Chrome",
          "Application",
          "chrome.exe",
        ),
        path.join(
          env.LOCALAPPDATA || "",
          "Google",
          "Chrome",
          "Application",
          "chrome.exe",
        ),
        "chrome.exe",
      ];
    default:
      return [
        "/usr/bin/google-chrome",
        "/usr/bin/google-chrome-stable",
        "/snap/bin/chromium",
        ...POSIX_COMMAND_CANDIDATES,
      ];
  }
}
