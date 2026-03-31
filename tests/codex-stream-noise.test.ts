import { describe, expect, it } from "vitest";
import {
  isCodexTransportNoiseMessage,
  normalizeCodexTransportNoiseMessage,
} from "@/lib/codex/stream-noise";

describe("codex stream noise filter", () => {
  it("filters reconnect and broken-pipe transport noise", () => {
    expect(
      isCodexTransportNoiseMessage(
        "Reconnecting... 2/5 (stream disconnected before completion: Broken pipe (os error 32))",
      ),
    ).toBe(true);
  });

  it("filters connection-reset transport noise", () => {
    expect(
      isCodexTransportNoiseMessage(
        "Reconnecting... 2/5 (stream disconnected before completion: Connection reset by peer (os error 54))",
      ),
    ).toBe(true);
  });

  it("keeps normal reasoning text visible", () => {
    expect(isCodexTransportNoiseMessage("正在分析当前目录结构")).toBe(false);
  });

  it("maps transport noise to a user-facing retry message", () => {
    expect(
      normalizeCodexTransportNoiseMessage(
        "Reconnecting... 2/5 (stream disconnected before completion: Connection reset by peer (os error 54))",
      ),
    ).toBe("OpenCrab 与本机执行引擎的连接刚刚中断了，请重试。");
  });
});
