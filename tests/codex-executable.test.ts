import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  resolveCodexExecutablePath,
  resolveCodexExecutionRoot,
  resolveCodexInvocation,
} from "@/lib/codex/executable";

describe("codex executable resolution", () => {
  const tempRoots: string[] = [];

  afterEach(() => {
    tempRoots.forEach((dirPath) => {
      rmSync(dirPath, { recursive: true, force: true });
    });
    tempRoots.length = 0;
  });

  it("prefers an explicit override and resolves it from the execution root", () => {
    const tempRoot = createTempRoot();

    expect(
      resolveCodexExecutablePath(asEnv({
        OPENCRAB_EXECUTION_ROOT: tempRoot,
        OPENCRAB_CODEX_PATH: "vendor/codex.js",
      })),
    ).toBe(path.join(tempRoot, "vendor", "codex.js"));
  });

  it("falls back to node_modules/.bin/codex when available", () => {
    const tempRoot = createTempRoot();
    const localBinPath = path.join(
      tempRoot,
      "node_modules",
      ".bin",
      process.platform === "win32" ? "codex.cmd" : "codex",
    );

    writeStub(localBinPath);

    expect(
      resolveCodexExecutablePath(asEnv({
        OPENCRAB_EXECUTION_ROOT: tempRoot,
      })),
    ).toBe(localBinPath);
  });

  it("prefers the bundled native Codex binary over js launchers when available", () => {
    const tempRoot = createTempRoot();
    const nativeBinaryPath = path.join(
      tempRoot,
      "node_modules",
      "@openai",
      process.platform === "darwin"
        ? process.arch === "arm64"
          ? "codex-darwin-arm64"
          : "codex-darwin-x64"
        : process.platform === "linux"
          ? process.arch === "arm64"
            ? "codex-linux-arm64"
            : "codex-linux-x64"
          : process.arch === "arm64"
            ? "codex-win32-arm64"
            : "codex-win32-x64",
      "vendor",
      process.platform === "darwin"
        ? process.arch === "arm64"
          ? "aarch64-apple-darwin"
          : "x86_64-apple-darwin"
        : process.platform === "linux"
          ? process.arch === "arm64"
            ? "aarch64-unknown-linux-musl"
            : "x86_64-unknown-linux-musl"
          : process.arch === "arm64"
            ? "aarch64-pc-windows-msvc"
            : "x86_64-pc-windows-msvc",
      "codex",
      process.platform === "win32" ? "codex.exe" : "codex",
    );
    const packageCliPath = path.join(
      tempRoot,
      "node_modules",
      "@openai",
      "codex",
      "bin",
      "codex.js",
    );

    writeStub(nativeBinaryPath);
    writeStub(packageCliPath);

    expect(
      resolveCodexExecutablePath(asEnv({
        OPENCRAB_EXECUTION_ROOT: tempRoot,
      })),
    ).toBe(nativeBinaryPath);
  });

  it("uses the package launcher when only @openai/codex/bin/codex.js exists", () => {
    const tempRoot = createTempRoot();
    const packageCliPath = path.join(
      tempRoot,
      "node_modules",
      "@openai",
      "codex",
      "bin",
      "codex.js",
    );

    writeStub(packageCliPath);

    const invocation = resolveCodexInvocation(asEnv({
      OPENCRAB_EXECUTION_ROOT: tempRoot,
    }));

    expect(
      resolveCodexExecutablePath(asEnv({
        OPENCRAB_EXECUTION_ROOT: tempRoot,
      })),
    ).toBe(
      packageCliPath,
    );
    expect(invocation.command).toBe(process.execPath);
    expect(invocation.argsPrefix).toEqual([packageCliPath]);
  });

  it("falls back to the process cwd when execution root is not configured", () => {
    expect(resolveCodexExecutionRoot(asEnv({}))).toBe(process.cwd());
  });
  function createTempRoot() {
    const tempRoot = mkdtempSync(path.join(os.tmpdir(), "opencrab-codex-exec-"));
    tempRoots.push(tempRoot);
    return tempRoot;
  }
});

function writeStub(filePath: string) {
  mkdirSync(path.dirname(filePath), { recursive: true });
  writeFileSync(filePath, "#!/usr/bin/env node\n", "utf8");
}

function asEnv(values: Record<string, string>) {
  return values as unknown as NodeJS.ProcessEnv;
}
