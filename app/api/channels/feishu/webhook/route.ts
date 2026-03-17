import { NextResponse } from "next/server";
import { markChannelError } from "@/lib/channels/channel-store";
import {
  assertFeishuWebhookAuth,
  normalizeFeishuWebhookBody,
  parseFeishuWebhook,
} from "@/lib/channels/feishu";
import { enqueueFeishuInboundMessage } from "@/lib/channels/feishu-inbound";

export async function POST(request: Request) {
  try {
    const rawBody = (await request.json()) as Record<string, unknown>;
    const body = normalizeFeishuWebhookBody(rawBody, request.headers);

    assertFeishuWebhookAuth(body);

    const parsed = parseFeishuWebhook(body);

    if (parsed.kind === "challenge") {
      return NextResponse.json({
        challenge: parsed.challenge,
      });
    }

    if (parsed.kind === "unsupported") {
      return NextResponse.json({ ok: true, ignored: true });
    }

    return NextResponse.json(enqueueFeishuInboundMessage(parsed));
  } catch (error) {
    const message = error instanceof Error ? error.message : "飞书 webhook 处理失败。";
    markChannelError("feishu", message);

    return NextResponse.json({ error: message }, { status: 500 });
  }
}
