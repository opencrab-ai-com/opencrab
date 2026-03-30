import { existsSync } from "node:fs";
import path from "node:path";
import {
  getOpenCrabNodeExecutable,
} from "@/lib/runtime/node-exec";
import {
  resolveOpenCrabResourceRoot,
} from "@/lib/runtime/app-resource-paths";

type BrowserMcpInvocation = {
  executablePath: string;
  command: string;
  argsPrefix: string[];
};

export function resolveBrowserMcpExecutablePath(env = process.env) {
  const resourceRoot = resolveOpenCrabResourceRoot(env);
  const override = normalizeConfiguredPath(
    env.OPENCRAB_CHROME_DEVTOOLS_MCP_PATH,
    resourceRoot,
  );

  if (override) {
    return override;
  }

  const bundledPackagePath = path.join(
    resourceRoot,
    "node_modules",
    "chrome-devtools-mcp",
    "build",
    "src",
    "bin",
    "chrome-devtools-mcp.js",
  );

  if (existsSync(bundledPackagePath)) {
    return bundledPackagePath;
  }

  const localBinPath = path.join(
    resourceRoot,
    "node_modules",
    ".bin",
    process.platform === "win32"
      ? "chrome-devtools-mcp.cmd"
      : "chrome-devtools-mcp",
  );

  if (existsSync(localBinPath)) {
    return localBinPath;
  }

  return process.platform === "win32"
    ? "chrome-devtools-mcp.cmd"
    : "chrome-devtools-mcp";
}

export function resolveBrowserMcpInvocation(
  env: NodeJS.ProcessEnv = process.env,
): BrowserMcpInvocation {
  const executablePath = resolveBrowserMcpExecutablePath(env);

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

function normalizeConfiguredPath(
  value: string | undefined,
  resourceRoot: string,
) {
  const raw = value?.trim();

  if (!raw) {
    return null;
  }

  return path.isAbsolute(raw) ? raw : path.resolve(resourceRoot, raw);
}

function needsNodeLauncher(executablePath: string) {
  return /\.(c|m)?js$/i.test(executablePath);
}
