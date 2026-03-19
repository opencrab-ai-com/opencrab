import { chatGptConnectionErrorResponse } from "@/lib/chatgpt/connection-response";
import { startChatGptConnection } from "@/lib/chatgpt/connection";
import { json } from "@/lib/server/api-route";

export async function POST() {
  try {
    return json(await startChatGptConnection());
  } catch (error) {
    return chatGptConnectionErrorResponse(error, "发起 ChatGPT 连接失败");
  }
}
