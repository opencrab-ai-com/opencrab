import { getFeishuSecrets } from "@/lib/channels/secret-store";

type FeishuTokenResponse = {
  code: number;
  msg?: string;
  tenant_access_token?: string;
  expire?: number;
};

type FeishuMessageResponse = {
  code: number;
  msg?: string;
  data?: {
    message_id?: string;
  };
};

type FeishuWebhookBody = {
  type?: string;
  challenge?: string;
  token?: string;
  header?: {
    event_id?: string;
    event_type?: string;
    token?: string;
  };
  event?: {
    sender?: {
      sender_id?: {
        open_id?: string;
        union_id?: string;
        user_id?: string;
      };
      sender_type?: string;
      tenant_key?: string;
    };
    message?: {
      message_id?: string;
      chat_id?: string;
      chat_type?: string;
      message_type?: string;
      content?: string;
    };
    chat?: {
      chat_id?: string;
      name?: string;
      chat_type?: string;
    };
    user?: {
      name?: string;
    };
  };
};

const feishuTokenCache = new Map<
  string,
  {
    token: string;
    expiresAt: number;
  }
>();

export type FeishuWebhookParseResult =
  | {
      kind: "challenge";
      challenge: string;
    }
  | {
      kind: "message";
      dedupeKey: string;
      remoteMessageId: string;
      remoteChatId: string;
      remoteChatLabel: string;
      remoteUserId: string | null;
      remoteUserLabel: string | null;
      text: string;
    }
  | {
      kind: "unsupported";
    };

export function assertFeishuWebhookAuth(body: FeishuWebhookBody) {
  const verificationToken = getFeishuSecrets().verificationToken;

  if (!verificationToken) {
    return;
  }

  const incomingToken = body.token || body.header?.token;

  if (incomingToken !== verificationToken) {
    throw new Error("飞书 verification token 不匹配。");
  }
}

export function parseFeishuWebhook(body: FeishuWebhookBody): FeishuWebhookParseResult {
  if (body.type === "url_verification" && body.challenge) {
    return {
      kind: "challenge",
      challenge: body.challenge,
    };
  }

  const eventType = body.header?.event_type;
  const message = body.event?.message;

  if (eventType !== "im.message.receive_v1" || message?.message_type !== "text") {
    return { kind: "unsupported" };
  }

  const text = extractFeishuText(message.content);
  const chatId = message.chat_id;
  const messageId = message.message_id;

  if (!text || !chatId || !messageId) {
    return { kind: "unsupported" };
  }

  return {
    kind: "message",
    dedupeKey: `feishu:${body.header?.event_id || messageId}`,
    remoteMessageId: messageId,
    remoteChatId: chatId,
    remoteChatLabel: body.event?.chat?.name || chatId,
    remoteUserId:
      body.event?.sender?.sender_id?.open_id ||
      body.event?.sender?.sender_id?.user_id ||
      null,
    remoteUserLabel: body.event?.user?.name || null,
    text,
  };
}

export async function verifyFeishuApp() {
  const token = await getTenantAccessToken();

  return {
    appId: getFeishuSecrets().appId || null,
    accessTokenPreview: token.slice(0, 6),
  };
}

export async function sendFeishuTextMessage(chatId: string, text: string) {
  const token = await getTenantAccessToken();
  const response = await fetch(
    "https://open.feishu.cn/open-apis/im/v1/messages?receive_id_type=chat_id",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json; charset=utf-8",
      },
      body: JSON.stringify({
        receive_id: chatId,
        msg_type: "text",
        content: JSON.stringify({
          text: text.trim() || "OpenCrab 已收到，但这次没有生成可发送的文本。",
        }),
      }),
    },
  );
  const payload = (await response.json()) as FeishuMessageResponse;

  if (!response.ok || payload.code !== 0) {
    throw new Error(payload.msg || `飞书消息发送失败（${response.status}）。`);
  }

  return {
    remoteMessageId: payload.data?.message_id || null,
  };
}

async function getTenantAccessToken() {
  const { appId, appSecret } = getFeishuSecrets();

  if (!appId || !appSecret) {
    throw new Error("请先配置飞书 appId 和 appSecret。");
  }

  const cacheKey = `${appId}:${appSecret}`;
  const cached = feishuTokenCache.get(cacheKey);

  if (cached && cached.expiresAt > Date.now() + 60_000) {
    return cached.token;
  }

  const response = await fetch(
    "https://open.feishu.cn/open-apis/auth/v3/tenant_access_token/internal",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json; charset=utf-8",
      },
      body: JSON.stringify({
        app_id: appId,
        app_secret: appSecret,
      }),
    },
  );
  const payload = (await response.json()) as FeishuTokenResponse;

  if (!response.ok || payload.code !== 0 || !payload.tenant_access_token) {
    throw new Error(payload.msg || `飞书 access token 获取失败（${response.status}）。`);
  }

  feishuTokenCache.set(cacheKey, {
    token: payload.tenant_access_token,
    expiresAt: Date.now() + (payload.expire || 7200) * 1000,
  });

  return payload.tenant_access_token;
}

function extractFeishuText(content: string | undefined) {
  if (!content) {
    return null;
  }

  try {
    const parsed = JSON.parse(content) as { text?: string };
    return parsed.text?.trim() || null;
  } catch {
    return null;
  }
}
