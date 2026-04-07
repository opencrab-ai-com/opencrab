import React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { FirstRunReadinessOverlay } from "@/components/app-shell/first-run-readiness-overlay";

const useOpenCrabAppMock = vi.hoisted(() => vi.fn());

vi.mock("@/components/app-shell/opencrab-provider", () => ({
  useOpenCrabApp: useOpenCrabAppMock,
}));

describe("first run readiness overlay", () => {
  beforeEach(() => {
    useOpenCrabAppMock.mockReset().mockReturnValue({
      isHydrated: true,
      runtimeReadiness: {
        ready: false,
        recommendedAction: "chatgpt_login",
        chrome: {
          ok: true,
          message: "Chrome ready",
        },
        codex: {
          ok: true,
          message: "Codex ready",
        },
        chatgpt: {
          ok: false,
          message: "ChatGPT pending",
        },
      },
      isChatGptConnectionPending: false,
      chatGptConnectionStatus: {
        stage: "waiting_browser_auth",
      },
      refreshRuntimeReadiness: vi.fn(),
    });
  });

  it("makes the blocking overlay itself vertically scrollable", () => {
    const markup = renderToStaticMarkup(React.createElement(FirstRunReadinessOverlay));

    expect(markup).toContain('class="fixed inset-0 z-[80]');
    expect(markup).toContain("overflow-y-auto");
  });
});
