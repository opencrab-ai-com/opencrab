import crypto from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";
import { formatChannelReplyText } from "@/lib/channels/message-format";
import { getFeishuSecrets } from "@/lib/channels/secret-store";
import { getUploadById, saveUploadFromBuffer } from "@/lib/resources/upload-store";
import type { UploadedAttachment } from "@/lib/resources/opencrab-api-types";

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

type FeishuReactionResponse = {
  code: number;
  msg?: string;
  data?: {
    reaction_id?: string;
  };
};

type FeishuImageUploadResponse = {
  code: number;
  msg?: string;
  data?: {
    image_key?: string;
  };
};

type FeishuFileUploadResponse = {
  code: number;
  msg?: string;
  data?: {
    file_key?: string;
  };
};

type FeishuWebhookBody = {
  type?: string;
  challenge?: string;
  token?: string;
  encrypt?: string;
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
  | ({ kind: "message" } & FeishuInboundMessage)
  | {
      kind: "unsupported";
    };

export type FeishuInboundMessage = {
  dedupeKey: string;
  remoteMessageId: string;
  remoteChatId: string;
  remoteChatLabel: string;
  remoteUserId: string | null;
  remoteUserLabel: string | null;
  text: string;
  attachmentRefs: FeishuInboundAttachmentRef[];
};

type FeishuEventMessagePayload = {
  sender?: NonNullable<FeishuWebhookBody["event"]>["sender"];
  message?: NonNullable<FeishuWebhookBody["event"]>["message"];
  chat?: NonNullable<FeishuWebhookBody["event"]>["chat"];
  user?: NonNullable<FeishuWebhookBody["event"]>["user"];
};

type FeishuInboundAttachmentRef = {
  fileKey: string;
  messageId: string;
  resourceType: "image" | "file" | "media" | "audio" | "video";
  name: string;
  mimeType: string | null;
};

const FEISHU_RECEIPT_REACTIONS = ["DONE", "OK", "THUMBSUP", "玫瑰", "强"] as const;
const FEISHU_SUPPORTED_MESSAGE_TYPES = new Set([
  "text",
  "image",
  "file",
  "media",
  "audio",
  "video",
]);

export function normalizeFeishuWebhookBody(
  body: FeishuWebhookBody,
  headers: Headers,
): FeishuWebhookBody {
  const encryptKey = getFeishuSecrets().encryptKey?.trim();

  if (!encryptKey) {
    return body;
  }

  assertFeishuWebhookSignature(body, headers, encryptKey);

  if (!body.encrypt) {
    return body;
  }

  const decrypted = decryptFeishuPayload(body.encrypt, encryptKey);
  const parsed = JSON.parse(decrypted) as FeishuWebhookBody;

  return {
    ...parsed,
    token: parsed.token || body.token,
    header: parsed.header || body.header,
  };
}

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
  if (eventType !== "im.message.receive_v1") {
    return { kind: "unsupported" };
  }

  const parsed = parseFeishuEventMessage(body.event || {}, body.header?.event_id);

  if (!parsed) {
    return { kind: "unsupported" };
  }

  return {
    kind: "message",
    ...parsed,
  };
}

export function parseFeishuEventMessage(
  event: FeishuEventMessagePayload,
  eventId?: string,
): FeishuInboundMessage | null {
  const messageType = event.message?.message_type;
  const messageId = event.message?.message_id;
  const attachmentRefs = buildFeishuAttachmentRefs(
    messageType,
    event.message?.content,
    messageId,
  );
  const text = messageType === "text" ? extractFeishuText(event.message?.content) : null;
  const chatId = event.message?.chat_id;

  if (
    !messageType ||
    !FEISHU_SUPPORTED_MESSAGE_TYPES.has(messageType) ||
    !chatId ||
    !messageId ||
    (!text && attachmentRefs.length === 0)
  ) {
    return null;
  }

  return {
    dedupeKey: `feishu:${eventId || messageId}`,
    remoteMessageId: messageId,
    remoteChatId: chatId,
    remoteChatLabel: event.chat?.name || chatId,
    remoteUserId:
      event.sender?.sender_id?.open_id ||
      event.sender?.sender_id?.user_id ||
      null,
    remoteUserLabel: event.user?.name || null,
    text: text || "",
    attachmentRefs,
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
  return sendFeishuMessage(chatId, "text", {
    text:
      formatChannelReplyText(text).trim() ||
      "OpenCrab 已收到，但这次没有生成可发送的文本。",
  });
}

export async function sendFeishuReply(input: {
  chatId: string;
  text: string;
  attachments?: UploadedAttachment[];
}) {
  const renderedText = formatChannelReplyText(input.text);
  const shouldSendText = Boolean(renderedText.trim());
  const textResult = shouldSendText
    ? await sendFeishuTextMessage(input.chatId, renderedText)
    : { remoteMessageId: null as string | null };

  if (!input.attachments?.length) {
    return textResult;
  }

  let lastMessageId = textResult.remoteMessageId;

  for (const attachment of input.attachments) {
    const stored = getUploadById(attachment.id);

    if (!stored) {
      continue;
    }

    if (attachment.kind === "image") {
      const imageKey = await uploadFeishuImage({
        filePath: stored.storedPath,
        mimeType: attachment.mimeType,
      });
      const delivery = await sendFeishuMessage(input.chatId, "image", {
        image_key: imageKey,
      });
      lastMessageId = delivery.remoteMessageId || lastMessageId;
      continue;
    }

    const fileKey = await uploadFeishuFile({
      filePath: stored.storedPath,
      fileName: attachment.name,
      mimeType: attachment.mimeType,
    });
    const delivery = await sendFeishuMessage(input.chatId, "file", {
      file_key: fileKey,
    });
    lastMessageId = delivery.remoteMessageId || lastMessageId;
  }

  return {
    remoteMessageId: lastMessageId,
  };
}

export async function acknowledgeFeishuInboundMessage(input: {
  messageId: string;
}) {
  for (const emojiType of shuffleFeishuReceiptReactions()) {
    try {
      const payload = await callFeishuApi<FeishuReactionResponse>(
        `/open-apis/im/v1/messages/${encodeURIComponent(input.messageId)}/reactions`,
        {
          method: "POST",
          body: {
            reaction_type: {
              emoji_type: emojiType,
            },
          },
        },
      );

      return {
        ok: true,
        reactionId: payload.data?.reaction_id || null,
        emojiType,
      };
    } catch {
      continue;
    }
  }

  return {
    ok: false,
    reactionId: null,
    emojiType: null,
  };
}

export async function downloadFeishuAttachments(
  attachmentRefs: FeishuInboundAttachmentRef[],
) {
  if (attachmentRefs.length === 0) {
    return [];
  }

  const token = await getTenantAccessToken();
  const attachments: UploadedAttachment[] = [];

  for (const attachmentRef of attachmentRefs) {
    const url = new URL(
      `https://open.feishu.cn/open-apis/im/v1/messages/${encodeURIComponent(
        attachmentRef.messageId,
      )}/resources/${encodeURIComponent(attachmentRef.fileKey)}`,
    );
    url.searchParams.set("type", attachmentRef.resourceType);

    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      throw new Error(`飞书资源下载失败（${response.status}）。`);
    }

    const buffer = Buffer.from(await response.arrayBuffer());
    const mimeType = response.headers.get("content-type") || attachmentRef.mimeType;
    const name = resolveFeishuDownloadedFileName(
      response.headers.get("content-disposition"),
      attachmentRef,
      mimeType,
    );
    const attachment = await saveUploadFromBuffer({
      name,
      mimeType,
      buffer,
    });
    attachments.push(attachment);
  }

  return attachments;
}

async function sendFeishuMessage(
  chatId: string,
  msgType: "text" | "image" | "file",
  content: Record<string, string>,
) {
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
        msg_type: msgType,
        content: JSON.stringify(content),
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

async function uploadFeishuImage(input: {
  filePath: string;
  mimeType: string | null;
}) {
  const token = await getTenantAccessToken();
  const buffer = await fs.readFile(input.filePath);
  const formData = new FormData();
  formData.set("image_type", "message");
  formData.set(
    "image",
    new Blob([buffer], { type: input.mimeType || "image/png" }),
    path.basename(input.filePath),
  );

  const response = await fetch("https://open.feishu.cn/open-apis/im/v1/images", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
    },
    body: formData,
  });
  const payload = (await response.json()) as FeishuImageUploadResponse;

  if (!response.ok || payload.code !== 0 || !payload.data?.image_key) {
    throw new Error(payload.msg || `飞书图片上传失败（${response.status}）。`);
  }

  return payload.data.image_key;
}

async function uploadFeishuFile(input: {
  filePath: string;
  fileName: string;
  mimeType: string | null;
}) {
  const token = await getTenantAccessToken();
  const buffer = await fs.readFile(input.filePath);
  const formData = new FormData();
  formData.set("file_type", resolveFeishuFileType(input.fileName, input.mimeType));
  formData.set("file_name", input.fileName);
  formData.set(
    "file",
    new Blob([buffer], { type: input.mimeType || "application/octet-stream" }),
    input.fileName,
  );

  const response = await fetch("https://open.feishu.cn/open-apis/im/v1/files", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
    },
    body: formData,
  });
  const payload = (await response.json()) as FeishuFileUploadResponse;

  if (!response.ok || payload.code !== 0 || !payload.data?.file_key) {
    throw new Error(payload.msg || `飞书文件上传失败（${response.status}）。`);
  }

  return payload.data.file_key;
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

async function callFeishuApi<T>(
  endpoint: string,
  input: {
    method?: "GET" | "POST";
    body?: unknown;
  } = {},
) {
  const token = await getTenantAccessToken();
  const response = await fetch(`https://open.feishu.cn${endpoint}`, {
    method: input.method || "GET",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json; charset=utf-8",
    },
    body: input.body == null ? undefined : JSON.stringify(input.body),
  });
  const payload = (await response.json()) as { code?: number; msg?: string } & T;

  if (!response.ok || payload.code !== 0) {
    throw new Error(payload.msg || `飞书接口调用失败（${response.status}）。`);
  }

  return payload;
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

function buildFeishuAttachmentRefs(
  messageType: string | undefined,
  content: string | undefined,
  messageId: string | undefined,
) {
  if (!messageType || !content || !messageId) {
    return [];
  }

  const parsed = parseFeishuMessageContent(content);

  if (messageType === "image" && typeof parsed.image_key === "string") {
    return [
      {
        fileKey: parsed.image_key,
        messageId,
        resourceType: "image" as const,
        name: `feishu-image-${messageId}.png`,
        mimeType: "image/png",
      },
    ];
  }

  const fileKey = firstNonEmptyString(
    parsed.file_key,
    parsed.media_key,
    parsed.audio_key,
    parsed.video_key,
  );

  if (!fileKey) {
    return [];
  }

  return [
    {
      fileKey,
      messageId,
      resourceType: normalizeFeishuResourceType(messageType),
      name:
        firstNonEmptyString(parsed.file_name, parsed.name) ||
        buildDefaultFeishuAttachmentName(messageType, messageId),
      mimeType: guessFeishuAttachmentMimeType(messageType),
    },
  ];
}

function parseFeishuMessageContent(content: string) {
  try {
    return JSON.parse(content) as Record<string, string | undefined>;
  } catch {
    return {};
  }
}

function normalizeFeishuResourceType(
  messageType: string,
): FeishuInboundAttachmentRef["resourceType"] {
  if (
    messageType === "image" ||
    messageType === "file" ||
    messageType === "media" ||
    messageType === "audio" ||
    messageType === "video"
  ) {
    return messageType;
  }

  return "file";
}

function buildDefaultFeishuAttachmentName(messageType: string, messageId: string) {
  if (messageType === "audio") {
    return `feishu-audio-${messageId}.opus`;
  }

  if (messageType === "video" || messageType === "media") {
    return `feishu-media-${messageId}.mp4`;
  }

  return `feishu-file-${messageId}.bin`;
}

function guessFeishuAttachmentMimeType(messageType: string) {
  if (messageType === "image") {
    return "image/png";
  }

  if (messageType === "audio") {
    return "audio/ogg";
  }

  if (messageType === "video" || messageType === "media") {
    return "video/mp4";
  }

  return null;
}

function resolveFeishuDownloadedFileName(
  contentDisposition: string | null,
  attachmentRef: FeishuInboundAttachmentRef,
  mimeType: string | null,
) {
  const headerName = extractFileNameFromContentDisposition(contentDisposition);

  if (headerName) {
    return headerName;
  }

  if (path.extname(attachmentRef.name)) {
    return attachmentRef.name;
  }

  const extension = extensionFromMimeType(mimeType);
  return extension ? `${attachmentRef.name}${extension}` : attachmentRef.name;
}

function extractFileNameFromContentDisposition(value: string | null) {
  if (!value) {
    return null;
  }

  const utf8Match = value.match(/filename\*=UTF-8''([^;]+)/i);

  if (utf8Match?.[1]) {
    return decodeURIComponent(utf8Match[1]);
  }

  const match = value.match(/filename="?([^";]+)"?/i);
  return match?.[1] || null;
}

function extensionFromMimeType(mimeType: string | null) {
  switch ((mimeType || "").split(";")[0].trim().toLowerCase()) {
    case "image/jpeg":
      return ".jpg";
    case "image/png":
      return ".png";
    case "image/webp":
      return ".webp";
    case "image/gif":
      return ".gif";
    case "application/pdf":
      return ".pdf";
    case "application/msword":
      return ".doc";
    case "application/vnd.openxmlformats-officedocument.wordprocessingml.document":
      return ".docx";
    case "text/plain":
      return ".txt";
    case "text/markdown":
      return ".md";
    case "audio/ogg":
      return ".ogg";
    case "audio/mpeg":
      return ".mp3";
    case "video/mp4":
      return ".mp4";
    default:
      return "";
  }
}

function resolveFeishuFileType(fileName: string, mimeType: string | null) {
  const extension = path.extname(fileName).toLowerCase();

  if (extension === ".mp4" || mimeType?.startsWith("video/")) {
    return "mp4";
  }

  if (extension === ".pdf" || mimeType === "application/pdf") {
    return "pdf";
  }

  if (extension === ".doc" || extension === ".docx") {
    return "doc";
  }

  if (extension === ".xls" || extension === ".xlsx" || extension === ".csv") {
    return "xls";
  }

  if (extension === ".ppt" || extension === ".pptx") {
    return "ppt";
  }

  if (
    extension === ".opus" ||
    extension === ".ogg" ||
    extension === ".mp3" ||
    mimeType?.startsWith("audio/")
  ) {
    return "opus";
  }

  return "stream";
}

function firstNonEmptyString(...values: Array<string | undefined>) {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }
  }

  return null;
}

function shuffleFeishuReceiptReactions() {
  const values = [...FEISHU_RECEIPT_REACTIONS];

  for (let index = values.length - 1; index > 0; index -= 1) {
    const nextIndex = Math.floor(Math.random() * (index + 1));
    [values[index], values[nextIndex]] = [values[nextIndex], values[index]];
  }

  return values;
}

function assertFeishuWebhookSignature(
  body: FeishuWebhookBody,
  headers: Headers,
  encryptKey: string,
) {
  const timestamp = headers.get("x-lark-request-timestamp");
  const nonce = headers.get("x-lark-request-nonce");
  const signature = headers.get("x-lark-signature");

  if (!timestamp || !nonce || !signature) {
    throw new Error("飞书 webhook 缺少签名头。");
  }

  const computedSignature = crypto
    .createHash("sha256")
    .update(timestamp + nonce + encryptKey + JSON.stringify(body))
    .digest("hex");

  if (computedSignature !== signature) {
    throw new Error("飞书 webhook 签名校验失败。");
  }
}

function decryptFeishuPayload(encrypt: string, encryptKey: string) {
  const key = crypto.createHash("sha256").update(encryptKey).digest();
  const encryptedBuffer = Buffer.from(encrypt, "base64");
  const decipher = crypto.createDecipheriv(
    "aes-256-cbc",
    key,
    encryptedBuffer.subarray(0, 16),
  );

  let decrypted = decipher.update(
    encryptedBuffer.subarray(16).toString("hex"),
    "hex",
    "utf8",
  );
  decrypted += decipher.final("utf8");

  return decrypted;
}
