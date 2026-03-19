import { markChannelError } from "@/lib/channels/channel-store";
import {
  assertFeishuWebhookAuth,
  normalizeFeishuWebhookBody,
  parseFeishuWebhook,
} from "@/lib/channels/feishu";
import { enqueueFeishuInboundMessage } from "@/lib/channels/feishu-inbound";
import { errorResponse, json, readJsonBody } from "@/lib/server/api-route";

export async function POST(request: Request) {
  try {
    const rawBody = await readJsonBody<Record<string, unknown>>(request, {});
    const body = normalizeFeishuWebhookBody(rawBody, request.headers);

    assertFeishuWebhookAuth(body);

    const parsed = parseFeishuWebhook(body);

    if (parsed.kind === "challenge") {
      return json({
        challenge: parsed.challenge,
      });
    }

    if (parsed.kind === "unsupported") {
      return json({ ok: true, ignored: true });
    }

    return json(enqueueFeishuInboundMessage(parsed));
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "飞书 webhook 处理失败。";
    markChannelError("feishu", message);

    return errorResponse(error, "飞书 webhook 处理失败。");
  }
}
