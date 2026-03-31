import { chatGptConnectionErrorResponse } from "@/lib/chatgpt/connection-response";
import { openPendingChatGptConnectionInChrome } from "@/lib/chatgpt/connection";
import { json } from "@/lib/server/api-route";

export async function POST() {
  try {
    return json(await openPendingChatGptConnectionInChrome());
  } catch (error) {
    return chatGptConnectionErrorResponse(error, "在 Chrome 中打开 ChatGPT 失败");
  }
}
