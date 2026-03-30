import { createRequire } from "node:module";
import { describe, expect, it } from "vitest";

const require = createRequire(import.meta.url);
const {
  isAppUrl,
  normalizeBaseUrl,
  resolveDesktopBundleRoot,
  resolveDesktopRuntimeConfig,
} = require("../desktop/runtime-manager.cjs");

describe("desktop runtime manager", () => {
  it("normalizes explicit attached urls", () => {
    const config = resolveDesktopRuntimeConfig({
      OPENCRAB_DESKTOP_TARGET_URL: "http://127.0.0.1:4567/app?foo=bar",
    });

    expect(config.mode).toBe("attach");
    expect(config.baseUrl).toBe("http://127.0.0.1:4567");
  });

  it("builds a managed runtime config by default", () => {
    const config = resolveDesktopRuntimeConfig({
      OPENCRAB_DESKTOP_PORT: "3456",
      OPENCRAB_DESKTOP_RUNTIME_SCRIPT: "dev",
    }, {
      packaged: false,
    });

    expect(config.mode).toBe("spawn");
    expect(config.runtimeProfile).toBe("development");
    expect(config.baseUrl).toBe("http://127.0.0.1:3456");
    expect(config.args).toEqual(["run", "dev", "--", "--port", "3456"]);
    expect(config.env.OPENCRAB_APP_ORIGIN).toBe("http://127.0.0.1:3456");
  });

  it("builds a production runtime config for packaged desktop", () => {
    const config = resolveDesktopRuntimeConfig({
      OPENCRAB_DESKTOP_PORT: "4567",
    }, {
      packaged: true,
      resourcesPath: "/Applications/OpenCrab.app/Contents/Resources",
    });

    expect(config.mode).toBe("spawn");
    expect(config.runtimeProfile).toBe("production");
    expect(config.baseUrl).toBe("http://127.0.0.1:4567");
    expect(config.cwd).toBe("/Applications/OpenCrab.app/Contents/Resources/desktop-runtime");
    expect(config.args).toEqual([
      "/Applications/OpenCrab.app/Contents/Resources/desktop-runtime/server.js",
    ]);
    expect(config.env.ELECTRON_RUN_AS_NODE).toBe("1");
    expect(config.env.OPENCRAB_RESOURCE_ROOT).toBe(
      "/Applications/OpenCrab.app/Contents/Resources/desktop-runtime",
    );
  });

  it("resolves the local runtime bundle root when not packaged", () => {
    expect(resolveDesktopBundleRoot({}, { packaged: false })).toContain(
      ".opencrab-desktop/runtime",
    );
  });

  it("normalizes urls and checks same-origin app navigation", () => {
    expect(normalizeBaseUrl("http://localhost:3000/path")).toBe("http://localhost:3000");
    expect(isAppUrl("http://localhost:3000/tasks", "http://localhost:3000")).toBe(true);
    expect(isAppUrl("https://opencrab-ai.com", "http://localhost:3000")).toBe(false);
  });
});
