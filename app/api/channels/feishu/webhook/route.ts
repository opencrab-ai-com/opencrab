import { NextResponse } from "next/server";
import { findEventByDedupeKey, markChannelError } from "@/lib/channels/channel-store";
import {
  handleInboundChannelTextMessage,
  recordIgnoredInboundEvent,
  recordOutboundDelivery,
} from "@/lib/channels/dispatcher";
import {
  assertFeishuWebhookAuth,
  parseFeishuWebhook,
  sendFeishuTextMessage,
} from "@/lib/channels/feishu";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as Record<string, unknown>;

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

    if (findEventByDedupeKey("feishu", parsed.dedupeKey)) {
      recordIgnoredInboundEvent({
        channelId: "feishu",
        dedupeKey: parsed.dedupeKey,
        remoteChatId: parsed.remoteChatId,
        remoteMessageId: parsed.remoteMessageId,
        summary: "重复飞书事件，已忽略。",
      });

      return NextResponse.json({ ok: true, duplicate: true });
    }

    const handled = await handleInboundChannelTextMessage({
      channelId: "feishu",
      ...parsed,
    });
    const delivery = await sendFeishuTextMessage(parsed.remoteChatId, handled.replyText);

    recordOutboundDelivery({
      channelId: "feishu",
      binding: handled.binding,
      remoteMessageId: delivery.remoteMessageId,
      text: handled.replyText,
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "飞书 webhook 处理失败。";
    markChannelError("feishu", message);

    return NextResponse.json({ error: message }, { status: 500 });
  }
}
