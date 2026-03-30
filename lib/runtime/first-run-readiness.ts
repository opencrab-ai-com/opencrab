import { getChatGptConnectionStatus } from "@/lib/chatgpt/connection";
import { getCodexExecutableStatus } from "@/lib/codex/executable";
import { getChromeInstallationStatus } from "@/lib/runtime/chrome";
import type { RuntimeReadinessResponse } from "@/lib/resources/opencrab-api-types";

export async function getRuntimeReadiness(): Promise<RuntimeReadinessResponse> {
  const [chrome, codex, chatGptConnection] = await Promise.all([
    getChromeInstallationStatus(),
    getCodexExecutableStatus(),
    getChatGptConnectionStatus(),
  ]);

  const chatgpt = {
    ok: chatGptConnection.isConnected,
    stage: chatGptConnection.stage,
    message: chatGptConnection.message,
  } satisfies RuntimeReadinessResponse["chatgpt"];

  return {
    ready: chrome.ok && codex.ok && chatgpt.ok,
    requiredBrowser: "chrome",
    recommendedAction: resolveRecommendedAction({
      chromeOk: chrome.ok,
      codexOk: codex.ok,
      chatgptOk: chatgpt.ok,
    }),
    chrome,
    codex,
    chatgpt,
  };
}

function resolveRecommendedAction(input: {
  chromeOk: boolean;
  codexOk: boolean;
  chatgptOk: boolean;
}): RuntimeReadinessResponse["recommendedAction"] {
  if (!input.chromeOk) {
    return "install_chrome";
  }

  if (!input.codexOk) {
    return "repair_codex";
  }

  if (!input.chatgptOk) {
    return "connect_chatgpt";
  }

  return null;
}
