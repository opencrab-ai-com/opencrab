import { createRequire } from "node:module";
import { describe, expect, it } from "vitest";

const require = createRequire(import.meta.url);
const {
  buildIsolatedDesktopEnv,
  createIsolatedOpenCrabHome,
  resolveSystemHomeDirectory,
} = require("../desktop/runtime-home.cjs");

describe("desktop runtime home helpers", () => {
  it("creates an isolated OpenCrab home without changing the system home", () => {
    const isolated = createIsolatedOpenCrabHome();

    try {
      expect(isolated.rootDir).toContain("opencrab-isolated-runtime-");
      expect(isolated.openCrabHome).toContain("opencrab-home");
    } finally {
      isolated.cleanup();
    }
  });

  it("builds desktop env with isolated OPENCRAB_HOME while preserving HOME", () => {
    const env = buildIsolatedDesktopEnv(
      {
        HOME: "/Users/example",
      },
      {
        openCrabHome: "/tmp/opencrab-runtime/opencrab-home",
        runtimeProfile: "production",
        port: 3456,
      },
    );

    expect(env.HOME).toBe(resolveSystemHomeDirectory({ HOME: "/Users/example" }));
    expect(env.OPENCRAB_HOME).toBe("/tmp/opencrab-runtime/opencrab-home");
    expect(env.OPENCRAB_DESKTOP_RUNTIME_PROFILE).toBe("production");
    expect(env.OPENCRAB_DESKTOP_PORT).toBe("3456");
  });
});
