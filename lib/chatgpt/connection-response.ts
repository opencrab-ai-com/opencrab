import type { ChatGptConnectionStatusResponse } from "@/lib/resources/opencrab-api-types";
import { getErrorMessage, json } from "@/lib/server/api-route";

export function buildChatGptConnectionErrorState(
  error: unknown,
  actionMessage: string,
): ChatGptConnectionStatusResponse {
  return {
    provider: "chatgpt",
    authMode: null,
    stage: "error",
    isConnected: false,
    authUrl: null,
    deviceCode: null,
    codeExpiresAt: null,
    startedAt: null,
    connectedAt: null,
    error: getErrorMessage(error, actionMessage),
    message: `${actionMessage}，请稍后重试。`,
  };
}

export function chatGptConnectionErrorResponse(
  error: unknown,
  actionMessage: string,
) {
  return json(buildChatGptConnectionErrorState(error, actionMessage), {
    status: 500,
  });
}
