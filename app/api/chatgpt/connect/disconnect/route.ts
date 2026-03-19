import { chatGptConnectionErrorResponse } from "@/lib/chatgpt/connection-response";
import { disconnectChatGptConnection } from "@/lib/chatgpt/connection";
import { json } from "@/lib/server/api-route";

export async function POST() {
  try {
    return json(await disconnectChatGptConnection());
  } catch (error) {
    return chatGptConnectionErrorResponse(error, "断开 ChatGPT 连接失败");
  }
}
