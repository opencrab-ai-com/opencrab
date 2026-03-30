import { beforeEach, describe, expect, it, vi } from "vitest";

const ensureBrowserSessionMock = vi.hoisted(() => vi.fn());
const ensureBrowserSessionWarmupMock = vi.hoisted(() => vi.fn());
const getBrowserSessionStatusMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/codex/browser-session", () => ({
  ensureBrowserSession: ensureBrowserSessionMock,
  ensureBrowserSessionWarmup: ensureBrowserSessionWarmupMock,
  getBrowserSessionStatus: getBrowserSessionStatusMock,
}));

describe("browser session route", () => {
  beforeEach(() => {
    ensureBrowserSessionMock.mockReset();
    ensureBrowserSessionWarmupMock.mockReset();
    getBrowserSessionStatusMock.mockReset();
  });

  it("uses the cooldown-aware warmup for unreachable status checks", async () => {
    getBrowserSessionStatusMock.mockResolvedValue({
      ok: false,
      status: "unreachable",
      mode: "current-browser",
      browserUrl: null,
      userDataDir: null,
      launchedByOpenCrab: false,
      chromePath: null,
      message: "not ready",
    });

    const { GET } = await import("@/app/api/codex/browser-session/route");
    const response = await GET();
    const payload = await response.json();

    expect(payload.status).toBe("unreachable");
    expect(ensureBrowserSessionWarmupMock).toHaveBeenCalledTimes(1);
    expect(ensureBrowserSessionWarmupMock).toHaveBeenCalledWith();
  });

  it("does not trigger extra warmup while a launch is already in progress", async () => {
    getBrowserSessionStatusMock.mockResolvedValue({
      ok: false,
      status: "launching",
      mode: "current-browser",
      browserUrl: null,
      userDataDir: null,
      launchedByOpenCrab: false,
      chromePath: null,
      message: "launching",
    });

    const { GET } = await import("@/app/api/codex/browser-session/route");
    const response = await GET();
    const payload = await response.json();

    expect(payload.status).toBe("launching");
    expect(ensureBrowserSessionWarmupMock).not.toHaveBeenCalled();
  });
});
