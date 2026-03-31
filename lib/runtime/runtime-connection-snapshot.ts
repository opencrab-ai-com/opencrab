import { getCodexStatus } from "@/lib/codex/sdk";
import { getBrowserSessionStatus } from "@/lib/codex/browser-session";
import { getChatGptConnectionStatus } from "@/lib/chatgpt/connection";
import { buildChatGptConnectionErrorState } from "@/lib/chatgpt/connection-response";
import type {
  CodexBrowserSessionStatus,
  CodexStatusResponse,
  RuntimeReadinessResponse,
  RuntimeConnectionSnapshotResponse,
} from "@/lib/resources/opencrab-api-types";
import { getRuntimeReadiness } from "@/lib/runtime/first-run-readiness";

export async function getRuntimeConnectionSnapshot(): Promise<RuntimeConnectionSnapshotResponse> {
  const [
    codexStatus,
    chatGptConnectionStatus,
    browserSessionStatus,
    runtimeReadiness,
  ] = await Promise.all([
    getSafeCodexStatus(),
    getSafeChatGptConnectionStatus(),
    getSafeBrowserSessionStatus(),
    getSafeRuntimeReadiness(),
  ]);

  return {
    codexStatus,
    chatGptConnectionStatus,
    browserSessionStatus,
    runtimeReadiness,
  };
}

async function getSafeCodexStatus(): Promise<CodexStatusResponse> {
  try {
    return (await getCodexStatus()) as CodexStatusResponse;
  } catch (error) {
    return {
      ok: false,
      error:
        error instanceof Error
          ? error.message
          : "当前无法读取 OpenCrab 的运行状态，请稍后重试。",
      loginStatus: "missing",
      loginMethod: "chatgpt",
    };
  }
}

async function getSafeChatGptConnectionStatus() {
  try {
    return await getChatGptConnectionStatus();
  } catch (error) {
    return buildChatGptConnectionErrorState(
      error,
      "当前无法读取 ChatGPT 连接状态",
    );
  }
}

async function getSafeBrowserSessionStatus(): Promise<CodexBrowserSessionStatus> {
  try {
    return await getBrowserSessionStatus();
  } catch (error) {
    return {
      ok: false,
      status: "unreachable",
      mode: "current-browser",
      browserUrl: null,
      userDataDir: null,
      launchedByOpenCrab: false,
      chromePath: null,
      message:
        error instanceof Error
          ? error.message
          : "当前无法读取浏览器连接状态。",
    };
  }
}

async function getSafeRuntimeReadiness(): Promise<RuntimeReadinessResponse> {
  try {
    return await getRuntimeReadiness();
  } catch (error) {
    return {
      ready: false,
      requiredBrowser: "chrome",
      recommendedAction: null,
      chrome: {
        ok: false,
        chromePath: null,
        message: "当前无法读取 Chrome 准备状态。",
      },
      codex: {
        ok: false,
        executablePath: null,
        message: "当前无法读取 Codex 准备状态。",
      },
      chatgpt: {
        ok: false,
        stage: "error",
        message:
          error instanceof Error
            ? error.message
            : "当前无法读取首次准备状态。",
      },
    };
  }
}
