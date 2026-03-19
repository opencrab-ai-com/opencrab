import { getCodexStatus } from "@/lib/codex/sdk";
import { getErrorMessage, json } from "@/lib/server/api-route";

export async function GET() {
  try {
    const status = await getCodexStatus();

    return json(status);
  } catch (error) {
    const message = getErrorMessage(error, "OpenCrab 运行状态检查失败。");

    return json({
      ok: false,
      error: message,
      loginStatus: "missing",
      loginMethod: "chatgpt",
    });
  }
}
