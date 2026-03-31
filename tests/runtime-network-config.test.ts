import { describe, expect, it } from "vitest";
import runtimeNetworkConfig from "@/lib/runtime/runtime-network-config.shared.js";

const {
  DEFAULT_OPENCRAB_APP_PORT,
  DEFAULT_OPENCRAB_DESKTOP_PORT,
  buildOpenCrabRuntimeEnv,
  isOpenCrabAppUrl,
  normalizeOpenCrabBaseUrl,
  resolveOpenCrabAppOrigin,
  resolveOpenCrabLocalBaseUrl,
} = runtimeNetworkConfig;

describe("runtime network config", () => {
  it("prefers an explicit app origin when present", () => {
    expect(
      resolveOpenCrabAppOrigin({
        OPENCRAB_APP_ORIGIN: "http://127.0.0.1:4567/app?foo=bar",
      } as unknown as NodeJS.ProcessEnv),
    ).toBe("http://127.0.0.1:4567");
  });

  it("falls back to runtime host and port when no explicit app origin exists", () => {
    expect(
      resolveOpenCrabAppOrigin(
        {
          HOSTNAME: "0.0.0.0",
          PORT: "3000",
        } as unknown as NodeJS.ProcessEnv,
        {
          fallbackHostname: "127.0.0.1",
          fallbackPort: DEFAULT_OPENCRAB_APP_PORT,
        },
      ),
    ).toBe("http://0.0.0.0:3000");
  });

  it("builds local loopback urls from the shared fallback config", () => {
    expect(
      resolveOpenCrabLocalBaseUrl(
        {} as unknown as NodeJS.ProcessEnv,
        {
          fallbackHostname: "127.0.0.1",
          fallbackPort: DEFAULT_OPENCRAB_DESKTOP_PORT,
        },
      ),
    ).toBe("http://127.0.0.1:3400");
  });

  it("builds the shared runtime env contract", () => {
    expect(
      buildOpenCrabRuntimeEnv({
        appOrigin: "http://127.0.0.1:3400/app",
        port: 3400,
        resourceRoot: "/tmp/opencrab-runtime",
        executionRoot: "/tmp/opencrab-runtime",
        nodeEnv: "production",
        fallbackPort: DEFAULT_OPENCRAB_DESKTOP_PORT,
      }),
    ).toEqual({
      NODE_ENV: "production",
      HOSTNAME: "127.0.0.1",
      PORT: "3400",
      OPENCRAB_APP_ORIGIN: "http://127.0.0.1:3400",
      OPENCRAB_RESOURCE_ROOT: "/tmp/opencrab-runtime",
      OPENCRAB_EXECUTION_ROOT: "/tmp/opencrab-runtime",
    });
  });

  it("shares the same url normalization and app-origin checks across runtimes", () => {
    expect(normalizeOpenCrabBaseUrl("http://localhost:3000/path")).toBe(
      "http://localhost:3000",
    );
    expect(
      isOpenCrabAppUrl(
        "http://localhost:3000/tasks",
        "http://localhost:3000",
      ),
    ).toBe(true);
    expect(
      isOpenCrabAppUrl(
        "https://opencrab-ai.com",
        "http://localhost:3000",
      ),
    ).toBe(false);
  });
});
