import { chatGptConnectionErrorResponse } from "@/lib/chatgpt/connection-response";
import { cancelChatGptConnection } from "@/lib/chatgpt/connection";
import { json } from "@/lib/server/api-route";

export async function POST() {
  try {
    return json(await cancelChatGptConnection());
  } catch (error) {
    return chatGptConnectionErrorResponse(error, "取消 ChatGPT 连接失败");
  }
}
