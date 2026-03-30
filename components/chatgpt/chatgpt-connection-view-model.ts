import type { ChatGptConnectionStage } from "@/lib/resources/opencrab-api-types";

export type ChatGptPrimaryAction =
  | {
      kind: "start";
      label: string;
      disabled: boolean;
    }
  | {
      kind: "open_in_chrome";
      label: string;
      disabled: boolean;
    }
  | null;

export function resolveChatGptPrimaryAction(
  stage: ChatGptConnectionStage,
  isBusy: boolean,
): ChatGptPrimaryAction {
  switch (stage) {
    case "connecting":
      return {
        kind: "start",
        label: "正在准备...",
        disabled: true,
      };
    case "waiting_browser_auth":
      return {
        kind: "open_in_chrome",
        label: "在 Chrome 中重新打开",
        disabled: isBusy,
      };
    case "expired":
    case "error":
      return {
        kind: "start",
        label: "重新连接 ChatGPT",
        disabled: isBusy,
      };
    case "connected":
      return null;
    case "not_connected":
    default:
      return {
        kind: "start",
        label: "连接 ChatGPT",
        disabled: isBusy,
      };
  }
}
