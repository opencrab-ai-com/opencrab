import { chatGptConnectionErrorResponse } from "@/lib/chatgpt/connection-response";
import { getChatGptConnectionStatus } from "@/lib/chatgpt/connection";
import { json } from "@/lib/server/api-route";

export async function GET() {
  try {
    return json(await getChatGptConnectionStatus());
  } catch (error) {
    return chatGptConnectionErrorResponse(error, "读取 ChatGPT 连接状态失败");
  }
}
