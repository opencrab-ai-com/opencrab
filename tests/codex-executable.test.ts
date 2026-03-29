import { afterEach, describe, expect, it } from "vitest";
import {
  prependCodexRuntimePath,
  resolveCodexExecutablePath,
} from "@/lib/codex/codex-executable";

describe("codex executable resolver", () => {
  const originalCodexPath = process.env.OPENCRAB_CODEX_PATH;

  afterEach(() => {
    if (typeof originalCodexPath === "string") {
      process.env.OPENCRAB_CODEX_PATH = originalCodexPath;
    } else {
      delete process.env.OPENCRAB_CODEX_PATH;
    }
  });

  it("prefers OPENCRAB_CODEX_PATH when provided", () => {
    process.env.OPENCRAB_CODEX_PATH = "/tmp/custom-codex";

    expect(resolveCodexExecutablePath()).toBe("/tmp/custom-codex");
  });

  it("falls back to a local or shared codex executable candidate", () => {
    delete process.env.OPENCRAB_CODEX_PATH;

    expect(resolveCodexExecutablePath()).toMatch(
      /codex([/\\]codex|\.cmd|\.exe|\.js)?$/,
    );
  });

  it("adds the bundled codex support directory to PATH when available", () => {
    const env = { PATH: "/usr/bin" };
    const nextEnv = prependCodexRuntimePath(env);

    expect(nextEnv.PATH).toContain("/vendor/");
    expect(nextEnv.PATH).toContain("/path");
  });
});
