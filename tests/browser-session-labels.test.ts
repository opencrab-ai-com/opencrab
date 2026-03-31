import { describe, expect, it } from "vitest";
import {
  formatBrowserSessionLabel,
  getBrowserSessionPresentation,
} from "@/lib/opencrab/labels";

describe("browser session labels", () => {
  it("describes a ready browser session clearly", () => {
    const input = {
      ok: true,
      status: "ready" as const,
      mode: "current-browser" as const,
      browserUrl: null,
      userDataDir: null,
      launchedByOpenCrab: false,
      chromePath: null,
      message: "OpenCrab 已连接你当前正在使用的 Chrome。",
    };

    expect(formatBrowserSessionLabel(input)).toBe("已就绪");
    expect(getBrowserSessionPresentation(input).recoveryHint).toContain("现在可以直接让 OpenCrab 打开网页");
  });

  it("gives actionable recovery copy when the current browser is unreachable", () => {
    const input = {
      ok: false,
      status: "unreachable" as const,
      mode: "current-browser" as const,
      browserUrl: null,
      userDataDir: null,
      launchedByOpenCrab: false,
      chromePath: null,
      message: "OpenCrab 还没真正连上你当前正在使用的 Chrome。",
    };

    expect(formatBrowserSessionLabel(input)).toBe("等待当前浏览器");
    expect(getBrowserSessionPresentation(input).recoveryHint).toContain("先确认 Chrome 已经打开");
  });
});
