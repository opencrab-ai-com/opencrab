import { existsSync } from "node:fs";
import path from "node:path";
import {
  getOpenCrabExecutionRoot,
  getOpenCrabResourceRoot,
  prependPathEntries,
  resolveNodeModulesBinExecutable,
} from "@/lib/runtime/resource-paths";

const CODEX_PACKAGE_BIN_RELATIVE_PATH = path.join(
  "node_modules",
  "@openai",
  "codex",
  "bin",
  "codex.js",
);
const PLATFORM_PACKAGE_BY_TARGET = {
  "x86_64-unknown-linux-musl": "@openai/codex-linux-x64",
  "aarch64-unknown-linux-musl": "@openai/codex-linux-arm64",
  "x86_64-apple-darwin": "@openai/codex-darwin-x64",
  "aarch64-apple-darwin": "@openai/codex-darwin-arm64",
  "x86_64-pc-windows-msvc": "@openai/codex-win32-x64",
  "aarch64-pc-windows-msvc": "@openai/codex-win32-arm64",
} as const;
const CODEX_BINARY_NAME = process.platform === "win32" ? "codex.exe" : "codex";

export function resolveCodexExecutablePath() {
  const override = process.env.OPENCRAB_CODEX_PATH?.trim();

  if (override) {
    return override;
  }

  const nativeBinaryPath = resolveBundledCodexBinaryPath();

  if (nativeBinaryPath) {
    return nativeBinaryPath;
  }

  const localBinPath = resolveNodeModulesBinExecutable("codex");

  if (localBinPath && existsSync(localBinPath)) {
    return localBinPath;
  }

  for (const root of [getOpenCrabExecutionRoot(), getOpenCrabResourceRoot()]) {
    const candidate = path.join(root, CODEX_PACKAGE_BIN_RELATIVE_PATH);

    if (existsSync(candidate)) {
      return candidate;
    }
  }

  return "codex";
}

export function prependCodexRuntimePath(env: Record<string, string>) {
  const supportPath = resolveBundledCodexSupportPath();

  if (!supportPath) {
    return env;
  }

  return prependPathEntries(env, [supportPath]);
}

function resolveBundledCodexBinaryPath() {
  const vendorRoot = resolveBundledCodexVendorRoot();
  const targetTriple = resolveCodexTargetTriple();

  if (!vendorRoot || !targetTriple) {
    return null;
  }

  const candidate = path.join(vendorRoot, targetTriple, "codex", CODEX_BINARY_NAME);
  return existsSync(candidate) ? candidate : null;
}

function resolveBundledCodexSupportPath() {
  const vendorRoot = resolveBundledCodexVendorRoot();
  const targetTriple = resolveCodexTargetTriple();

  if (!vendorRoot || !targetTriple) {
    return null;
  }

  const candidate = path.join(vendorRoot, targetTriple, "path");
  return existsSync(candidate) ? candidate : null;
}

function resolveBundledCodexVendorRoot() {
  const targetTriple = resolveCodexTargetTriple();

  if (!targetTriple) {
    return null;
  }

  const platformPackageName = PLATFORM_PACKAGE_BY_TARGET[targetTriple];

  for (const root of [getOpenCrabExecutionRoot(), getOpenCrabResourceRoot()]) {
    const platformVendorRoot = path.join(
      root,
      "node_modules",
      platformPackageName,
      "vendor",
    );

    if (existsSync(platformVendorRoot)) {
      return platformVendorRoot;
    }

    const localVendorRoot = path.join(
      root,
      "node_modules",
      "@openai",
      "codex",
      "vendor",
    );

    if (existsSync(localVendorRoot)) {
      return localVendorRoot;
    }
  }

  return null;
}

function resolveCodexTargetTriple() {
  switch (process.platform) {
    case "linux":
    case "android":
      switch (process.arch) {
        case "x64":
          return "x86_64-unknown-linux-musl" as const;
        case "arm64":
          return "aarch64-unknown-linux-musl" as const;
        default:
          return null;
      }
    case "darwin":
      switch (process.arch) {
        case "x64":
          return "x86_64-apple-darwin" as const;
        case "arm64":
          return "aarch64-apple-darwin" as const;
        default:
          return null;
      }
    case "win32":
      switch (process.arch) {
        case "x64":
          return "x86_64-pc-windows-msvc" as const;
        case "arm64":
          return "aarch64-pc-windows-msvc" as const;
        default:
          return null;
      }
    default:
      return null;
  }
}
