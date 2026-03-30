import { execFile, spawn } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";
import { promisify } from "node:util";
import type { ExecFileOptions, SpawnOptions } from "node:child_process";
import { getOpenCrabNodeExecutable } from "@/lib/runtime/node-exec";

const execFileAsync = promisify(execFile);

type CodexInvocation = {
  executablePath: string;
  command: string;
  argsPrefix: string[];
};

export type CodexExecutableStatus = {
  ok: boolean;
  executablePath: string | null;
  message: string;
};

export function resolveCodexExecutionRoot(env = process.env) {
  const configuredRoot = env.OPENCRAB_EXECUTION_ROOT?.trim();

  if (!configuredRoot) {
    return process.cwd();
  }

  return path.resolve(configuredRoot);
}

export function resolveCodexExecutablePath(env = process.env) {
  const executionRoot = resolveCodexExecutionRoot(env);
  const override = normalizeConfiguredPath(env.OPENCRAB_CODEX_PATH, executionRoot);

  if (override) {
    return override;
  }

  const nativeBinaryPath = resolveBundledCodexNativeBinaryPath(executionRoot);

  if (nativeBinaryPath) {
    return nativeBinaryPath;
  }

  const localBinPath = path.join(
    executionRoot,
    "node_modules",
    ".bin",
    process.platform === "win32" ? "codex.cmd" : "codex",
  );

  if (existsSync(localBinPath)) {
    return localBinPath;
  }

  const packageCliPath = path.join(
    executionRoot,
    "node_modules",
    "@openai",
    "codex",
    "bin",
    "codex.js",
  );

  if (existsSync(packageCliPath)) {
    return packageCliPath;
  }

  return "codex";
}

export function resolveCodexInvocation(env = process.env): CodexInvocation {
  const executablePath = resolveCodexExecutablePath(env);

  if (needsNodeLauncher(executablePath)) {
    return {
      executablePath,
      command: getOpenCrabNodeExecutable(env),
      argsPrefix: [executablePath],
    };
  }

  return {
    executablePath,
    command: executablePath,
    argsPrefix: [],
  };
}

export function spawnCodexCommand(args: string[], options: SpawnOptions = {}) {
  const invocation = resolveCodexInvocation(options.env);

  return spawn(invocation.command, [...invocation.argsPrefix, ...args], options);
}

export async function execCodexCommand(args: string[], options: ExecFileOptions = {}) {
  const invocation = resolveCodexInvocation(options.env);

  return execFileAsync(
    invocation.command,
    [...invocation.argsPrefix, ...args],
    options,
  );
}

export async function getCodexExecutableStatus(
  env: NodeJS.ProcessEnv = process.env,
): Promise<CodexExecutableStatus> {
  const invocation = resolveCodexInvocation(env);

  try {
    const { stdout, stderr } = await execFileAsync(
      invocation.command,
      [...invocation.argsPrefix, "--version"],
      {
        env,
        timeout: 5000,
      },
    );
    const output = `${stdout}\n${stderr}`.trim();

    return {
      ok: true,
      executablePath: invocation.executablePath,
      message: output || "OpenCrab 引擎已就绪。",
    };
  } catch (error) {
    return {
      ok: false,
      executablePath: invocation.executablePath || null,
      message: normalizeCodexExecutableError(error),
    };
  }
}

function normalizeConfiguredPath(
  value: string | undefined,
  executionRoot: string,
) {
  const raw = value?.trim();

  if (!raw) {
    return null;
  }

  if (raw === "codex") {
    return raw;
  }

  return path.isAbsolute(raw) ? raw : path.resolve(executionRoot, raw);
}

function needsNodeLauncher(executablePath: string) {
  return /\.(c|m)?js$/i.test(executablePath);
}

function resolveBundledCodexNativeBinaryPath(executionRoot: string) {
  const packageName = resolveCodexNativePackageName();

  if (!packageName) {
    return null;
  }

  const targetTriple = resolveCodexNativeTargetTriple();

  if (!targetTriple) {
    return null;
  }

  const nativeBinaryPath = path.join(
    executionRoot,
    "node_modules",
    "@openai",
    packageName,
    "vendor",
    targetTriple,
    "codex",
    process.platform === "win32" ? "codex.exe" : "codex",
  );

  return existsSync(nativeBinaryPath) ? nativeBinaryPath : null;
}

function resolveCodexNativePackageName() {
  if (process.platform === "darwin") {
    return process.arch === "arm64"
      ? "codex-darwin-arm64"
      : process.arch === "x64"
        ? "codex-darwin-x64"
        : null;
  }

  if (process.platform === "linux") {
    return process.arch === "arm64"
      ? "codex-linux-arm64"
      : process.arch === "x64"
        ? "codex-linux-x64"
        : null;
  }

  if (process.platform === "win32") {
    return process.arch === "arm64"
      ? "codex-win32-arm64"
      : process.arch === "x64"
        ? "codex-win32-x64"
        : null;
  }

  return null;
}

function resolveCodexNativeTargetTriple() {
  if (process.platform === "darwin") {
    return process.arch === "arm64"
      ? "aarch64-apple-darwin"
      : process.arch === "x64"
        ? "x86_64-apple-darwin"
        : null;
  }

  if (process.platform === "linux") {
    return process.arch === "arm64"
      ? "aarch64-unknown-linux-musl"
      : process.arch === "x64"
        ? "x86_64-unknown-linux-musl"
        : null;
  }

  if (process.platform === "win32") {
    return process.arch === "arm64"
      ? "aarch64-pc-windows-msvc"
      : process.arch === "x64"
        ? "x86_64-pc-windows-msvc"
        : null;
  }

  return null;
}

function normalizeCodexExecutableError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);

  if (/env:\s*node:\s*No such file or directory/i.test(message)) {
    return "OpenCrab 当前没有成功连上内置引擎运行时，请重新打开应用后再试。";
  }

  if (/spawn .* ENOENT/i.test(message) || /\bENOENT\b/i.test(message)) {
    return "OpenCrab 当前没有找到可用的内置引擎，请重新安装或重新打开应用。";
  }

  if (/Missing optional dependency/i.test(message)) {
    return "OpenCrab 当前缺少 Codex 的平台二进制依赖，请重新安装应用。";
  }

  if (/Unable to locate Codex CLI binaries/i.test(message)) {
    return "OpenCrab 当前没有找到可用的 Codex 执行入口，请重新安装应用。";
  }

  return message || "OpenCrab 当前无法检查引擎状态。";
}
