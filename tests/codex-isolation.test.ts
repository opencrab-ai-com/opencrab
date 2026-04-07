import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";

async function loadRuntimeEnvModule() {
  vi.resetModules();
  return import("@/lib/codex/runtime-env");
}

async function loadCodexOptionsModule() {
  vi.resetModules();
  return import("@/lib/codex/options");
}

describe("codex runtime isolation", () => {
  const originalHome = process.env.HOME;
  const originalOpencrabHome = process.env.OPENCRAB_HOME;
  const originalCodexHome = process.env.CODEX_HOME;
  const tempDirs: string[] = [];

  afterEach(() => {
    vi.resetModules();

    if (originalHome === undefined) {
      delete process.env.HOME;
    } else {
      process.env.HOME = originalHome;
    }

    if (originalOpencrabHome === undefined) {
      delete process.env.OPENCRAB_HOME;
    } else {
      process.env.OPENCRAB_HOME = originalOpencrabHome;
    }

    if (originalCodexHome === undefined) {
      delete process.env.CODEX_HOME;
    } else {
      process.env.CODEX_HOME = originalCodexHome;
    }

    tempDirs.forEach((dirPath) => {
      rmSync(dirPath, { recursive: true, force: true });
    });
    tempDirs.length = 0;
  });

  it("forces Codex child env to use OpenCrab's own runtime home", async () => {
    const systemHome = createTempDir("opencrab-system-home-");
    const opencrabHome = createTempDir("opencrab-runtime-home-");
    process.env.HOME = systemHome;
    process.env.OPENCRAB_HOME = opencrabHome;
    process.env.CODEX_HOME = path.join(systemHome, ".codex");

    const { buildOpenCrabCodexEnv } = await loadRuntimeEnvModule();
    const env = buildOpenCrabCodexEnv({
      HOME: systemHome,
      OPENCRAB_HOME: "/tmp/wrong-opencrab-home",
      CODEX_HOME: "/tmp/wrong-codex-home",
    });

    expect(env.HOME).toBe(systemHome);
    expect(env.OPENCRAB_HOME).toBe(opencrabHome);
    expect(env.CODEX_HOME).toBe(opencrabHome);
  });

  it("reads model cache from the OpenCrab runtime instead of ~/.codex", async () => {
    const systemHome = createTempDir("opencrab-system-home-");
    const opencrabHome = createTempDir("opencrab-runtime-home-");
    process.env.HOME = systemHome;
    process.env.OPENCRAB_HOME = opencrabHome;
    process.env.CODEX_HOME = path.join(systemHome, ".codex");

    mkdirSync(path.join(systemHome, ".codex"), { recursive: true });
    writeFileSync(
      path.join(systemHome, ".codex", "models_cache.json"),
      JSON.stringify([
        {
          slug: "from-user-codex-home",
          display_name: "User Codex Home",
        },
      ]),
      "utf8",
    );
    writeFileSync(
      path.join(opencrabHome, "models_cache.json"),
      JSON.stringify([
        {
          slug: "from-opencrab-home",
          display_name: "OpenCrab Runtime",
        },
      ]),
      "utf8",
    );

    const { getCodexOptions } = await loadCodexOptionsModule();
    const options = getCodexOptions();

    expect(options.models.map((model) => model.id)).toContain("from-opencrab-home");
    expect(options.models.map((model) => model.id)).not.toContain("from-user-codex-home");
  });

  function createTempDir(prefix: string) {
    const dirPath = mkdtempSync(path.join(os.tmpdir(), prefix));
    tempDirs.push(dirPath);
    return dirPath;
  }
});
