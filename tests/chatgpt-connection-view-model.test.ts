import { describe, expect, it } from "vitest";
import { resolveChatGptPrimaryAction } from "@/components/chatgpt/chatgpt-connection-view-model";

describe("chatgpt connection view model", () => {
  it("uses connect as the default primary action", () => {
    expect(resolveChatGptPrimaryAction("not_connected", false)).toEqual({
      kind: "start",
      label: "连接 ChatGPT",
      disabled: false,
    });
  });

  it("disables the primary action while the browser login is still being prepared", () => {
    expect(resolveChatGptPrimaryAction("connecting", false)).toEqual({
      kind: "start",
      label: "正在准备...",
      disabled: true,
    });
  });

  it("switches to reopening Chrome once the login page is ready", () => {
    expect(resolveChatGptPrimaryAction("waiting_browser_auth", false)).toEqual({
      kind: "open_in_chrome",
      label: "在 Chrome 中重新打开",
      disabled: false,
    });
  });

  it("asks for a reconnect after an expired or failed login attempt", () => {
    expect(resolveChatGptPrimaryAction("expired", false)).toEqual({
      kind: "start",
      label: "重新连接 ChatGPT",
      disabled: false,
    });

    expect(resolveChatGptPrimaryAction("error", true)).toEqual({
      kind: "start",
      label: "重新连接 ChatGPT",
      disabled: true,
    });
  });

  it("hides the primary action once ChatGPT is connected", () => {
    expect(resolveChatGptPrimaryAction("connected", false)).toBeNull();
  });
});
