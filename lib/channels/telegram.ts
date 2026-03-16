import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { getUploadById, saveUploadFromBuffer } from "@/lib/resources/upload-store";
import { getTelegramSecrets } from "@/lib/channels/secret-store";
import type { UploadedAttachment } from "@/lib/resources/opencrab-api-types";

type TelegramApiResponse<T> = {
  ok: boolean;
  result?: T;
  description?: string;
};

type TelegramGetMeResult = {
  id: number;
  username?: string;
  first_name?: string;
};

type TelegramWebhookInfoResult = {
  url?: string;
  pending_update_count?: number;
  last_error_message?: string;
};

type TelegramSendMessageResult = {
  message_id: number;
};

type TelegramReactionTypeEmoji = {
  type: "emoji";
  emoji: string;
};

type TelegramFileResult = {
  file_path?: string;
};

type TelegramPhotoSize = {
  file_id?: string;
  file_size?: number;
};

type TelegramDocument = {
  file_id?: string;
  file_name?: string;
  mime_type?: string;
  file_size?: number;
};

type TelegramUpdate = {
  update_id?: number;
  message?: {
    message_id?: number;
    text?: string;
    caption?: string;
    chat?: {
      id?: number | string;
      title?: string;
      username?: string;
      first_name?: string;
      last_name?: string;
      type?: string;
    };
    from?: {
      id?: number | string;
      username?: string;
      first_name?: string;
      last_name?: string;
    };
    photo?: TelegramPhotoSize[];
    document?: TelegramDocument;
  };
};

type TelegramInboundAttachmentRef = {
  fileId: string;
  name: string;
  mimeType: string | null;
};

export type TelegramInboundMessage = {
  dedupeKey: string;
  remoteMessageId: string;
  remoteChatId: string;
  remoteChatLabel: string;
  remoteUserId: string | null;
  remoteUserLabel: string | null;
  text: string;
  attachmentRefs: TelegramInboundAttachmentRef[];
};

const execFileAsync = promisify(execFile);
const TELEGRAM_API_BASE_URL = "https://api.telegram.org";
const TELEGRAM_FETCH_TIMEOUT_MS = 5_000;
const TELEGRAM_CURL_TIMEOUT_SECONDS = 8;
const TELEGRAM_FILE_DOWNLOAD_TIMEOUT_SECONDS = 20;
const TELEGRAM_RECEIPT_REACTIONS = ["👍", "👌", "❤️", "🔥"] as const;

export function assertTelegramWebhookAuth(request: Request) {
  const webhookSecret = getTelegramSecrets().webhookSecret;

  if (!webhookSecret) {
    return;
  }

  const incomingSecret = request.headers.get("x-telegram-bot-api-secret-token");

  if (incomingSecret !== webhookSecret) {
    throw new Error("Telegram webhook secret 不匹配。");
  }
}

export function parseTelegramInboundMessage(body: TelegramUpdate): TelegramInboundMessage | null {
  const message = body.message;

  if (!message) {
    return null;
  }

  const text = message.text?.trim() || message.caption?.trim() || "";
  const chatId = message.chat?.id;
  const messageId = message.message_id;
  const attachmentRefs = buildTelegramAttachmentRefs(message);

  if (
    chatId === undefined ||
    chatId === null ||
    messageId === undefined ||
    messageId === null ||
    (!text && attachmentRefs.length === 0)
  ) {
    return null;
  }

  const remoteChatId = String(chatId);
  const remoteUserId =
    message?.from?.id === undefined || message?.from?.id === null ? null : String(message.from.id);
  const remoteUserLabel = joinDisplayName(
    message?.from?.first_name,
    message?.from?.last_name,
    message?.from?.username,
  );

  return {
    dedupeKey: `telegram:${body.update_id ?? messageId}`,
    remoteMessageId: String(messageId),
    remoteChatId,
    remoteChatLabel: buildTelegramChatLabel(message),
    remoteUserId,
    remoteUserLabel,
    text,
    attachmentRefs,
  };
}

export async function verifyTelegramBot() {
  const botToken = getTelegramSecrets().botToken;

  if (!botToken) {
    throw new Error("请先配置 Telegram bot token。");
  }

  const response = await callTelegramApi<TelegramGetMeResult>(botToken, "getMe", {});

  return {
    botUsername: response.username ? `@${response.username}` : null,
    botName: response.first_name || null,
  };
}

export async function configureTelegramWebhook(input: {
  webhookUrl: string;
  secretToken?: string;
}) {
  const botToken = getTelegramSecrets().botToken;

  if (!botToken) {
    throw new Error("请先配置 Telegram bot token。");
  }

  await callTelegramApi<boolean>(botToken, "setWebhook", {
    url: input.webhookUrl,
    ...(input.secretToken ? { secret_token: input.secretToken } : {}),
  });

  const webhookInfo = await getTelegramWebhookInfo(botToken);

  return {
    webhookUrl: webhookInfo.url || null,
    pendingUpdateCount: webhookInfo.pending_update_count || 0,
    lastErrorMessage: webhookInfo.last_error_message || null,
    isConfigured: webhookInfo.url === input.webhookUrl,
  };
}

export async function disconnectTelegramWebhook() {
  const botToken = getTelegramSecrets().botToken;

  if (!botToken) {
    throw new Error("请先配置 Telegram bot token。");
  }

  await callTelegramApi<boolean>(botToken, "deleteWebhook", {
    drop_pending_updates: false,
  });

  const webhookInfo = await getTelegramWebhookInfo(botToken);

  return {
    currentWebhookUrl: webhookInfo.url || null,
    pendingUpdateCount: webhookInfo.pending_update_count || 0,
    lastWebhookError: webhookInfo.last_error_message || null,
  };
}

export async function getTelegramConnectionSummary(expectedWebhookUrl?: string | null) {
  const bot = await verifyTelegramBot();
  const botToken = getTelegramSecrets().botToken;

  if (!botToken) {
    throw new Error("请先配置 Telegram bot token。");
  }

  const webhookInfo = await getTelegramWebhookInfo(botToken);
  const currentWebhookUrl = webhookInfo.url || null;

  return {
    botUsername: bot.botUsername,
    botName: bot.botName,
    currentWebhookUrl,
    pendingUpdateCount: webhookInfo.pending_update_count || 0,
    lastWebhookError: webhookInfo.last_error_message || null,
    webhookConfigured: Boolean(
      expectedWebhookUrl && currentWebhookUrl && currentWebhookUrl === expectedWebhookUrl,
    ),
  };
}

export async function sendTelegramTextMessage(chatId: string, text: string) {
  const botToken = getTelegramSecrets().botToken;

  if (!botToken) {
    throw new Error("Telegram bot token 未配置。");
  }

  let lastMessageId: string | null = null;

  for (const chunk of splitTelegramText(text)) {
    const response = await callTelegramApi<TelegramSendMessageResult>(botToken, "sendMessage", {
      chat_id: chatId,
      text: chunk,
    });
    lastMessageId = response.message_id ? String(response.message_id) : lastMessageId;
  }

  return {
    remoteMessageId: lastMessageId,
  };
}

export async function acknowledgeTelegramInboundMessage(input: {
  chatId: string;
  messageId: string;
}) {
  const candidates = buildTelegramReceiptReactionCandidates();

  for (const emoji of candidates) {
    try {
      await setTelegramMessageReaction({
        chatId: input.chatId,
        messageId: input.messageId,
        emoji,
      });

      return {
        ok: true,
        emoji,
      };
    } catch {
      continue;
    }
  }

  return {
    ok: false,
    emoji: null,
  };
}

export async function downloadTelegramAttachments(
  attachmentRefs: TelegramInboundAttachmentRef[],
) {
  const botToken = getTelegramSecrets().botToken;

  if (!botToken || attachmentRefs.length === 0) {
    return [];
  }

  const attachments: UploadedAttachment[] = [];

  for (const attachmentRef of attachmentRefs) {
    const file = await callTelegramApi<TelegramFileResult>(botToken, "getFile", {
      file_id: attachmentRef.fileId,
    });

    if (!file.file_path) {
      throw new Error("Telegram 没有返回可下载的文件地址。");
    }

    const buffer = await downloadTelegramFileBuffer(botToken, file.file_path);
    const attachment = await saveUploadFromBuffer({
      name: attachmentRef.name,
      mimeType: attachmentRef.mimeType,
      buffer,
    });
    attachments.push(attachment);
  }

  return attachments;
}

export async function sendTelegramReply(input: {
  chatId: string;
  text: string;
  attachments?: UploadedAttachment[];
}) {
  const shouldSendText = Boolean(input.text.trim());
  const textResult = shouldSendText
    ? await sendTelegramTextMessage(input.chatId, input.text)
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

    const response =
      attachment.kind === "image"
        ? await callTelegramMultipartApi<TelegramSendMessageResult>({
            method: "sendPhoto",
            chatId: input.chatId,
            fieldName: "photo",
            filePath: stored.storedPath,
            fileName: attachment.name,
            mimeType: attachment.mimeType || "image/jpeg",
          })
        : await callTelegramMultipartApi<TelegramSendMessageResult>({
            method: "sendDocument",
            chatId: input.chatId,
            fieldName: "document",
            filePath: stored.storedPath,
            fileName: attachment.name,
            mimeType: attachment.mimeType || "application/octet-stream",
          });

    lastMessageId = response.message_id ? String(response.message_id) : lastMessageId;
  }

  return {
    remoteMessageId: lastMessageId,
  };
}

async function callTelegramApi<T>(
  botToken: string,
  method: string,
  body: Record<string, unknown>,
) {
  const url = `${TELEGRAM_API_BASE_URL}/bot${botToken}/${method}`;

  try {
    return await callTelegramApiWithFetch<T>(url, body);
  } catch (error) {
    if (!shouldRetryTelegramRequestWithCurl(error)) {
      throw normalizeTelegramApiError(error);
    }
  }

  try {
    return await callTelegramApiWithCurl<T>(url, body);
  } catch (error) {
    throw normalizeTelegramApiError(error);
  }
}

async function getTelegramWebhookInfo(botToken: string) {
  return callTelegramApi<TelegramWebhookInfoResult>(botToken, "getWebhookInfo", {});
}

async function setTelegramMessageReaction(input: {
  chatId: string;
  messageId: string;
  emoji: string;
}) {
  const botToken = getTelegramSecrets().botToken;

  if (!botToken) {
    throw new Error("Telegram bot token 未配置。");
  }

  const numericMessageId = Number(input.messageId);

  if (!Number.isInteger(numericMessageId)) {
    throw new Error("Telegram message_id 无效，无法设置表情反应。");
  }

  return callTelegramApi<boolean>(botToken, "setMessageReaction", {
    chat_id: input.chatId,
    message_id: numericMessageId,
    reaction: [
      {
        type: "emoji",
        emoji: input.emoji,
      } satisfies TelegramReactionTypeEmoji,
    ],
    is_big: false,
  });
}

function splitTelegramText(text: string) {
  const normalized = text.trim() || "OpenCrab 已收到，但这次没有生成可发送的文本。";
  const chunks: string[] = [];

  for (let index = 0; index < normalized.length; index += 3800) {
    chunks.push(normalized.slice(index, index + 3800));
  }

  return chunks.length > 0 ? chunks : [normalized];
}

function buildTelegramReceiptReactionCandidates() {
  const randomReaction =
    TELEGRAM_RECEIPT_REACTIONS[
      Math.floor(Math.random() * TELEGRAM_RECEIPT_REACTIONS.length)
    ];

  return Array.from(new Set([randomReaction, "👍"]));
}

function buildTelegramChatLabel(message: NonNullable<TelegramUpdate["message"]>) {
  return (
    message.chat?.title ||
    joinDisplayName(message.chat?.first_name, message.chat?.last_name, message.chat?.username) ||
    `Chat ${message.chat?.id ?? ""}`.trim()
  );
}

function buildTelegramAttachmentRefs(message: NonNullable<TelegramUpdate["message"]>) {
  const refs: TelegramInboundAttachmentRef[] = [];
  const largestPhoto = message.photo?.reduce<TelegramPhotoSize | null>((largest, current) => {
    if (!current.file_id) {
      return largest;
    }

    if (!largest) {
      return current;
    }

    return (current.file_size || 0) >= (largest.file_size || 0) ? current : largest;
  }, null);

  if (largestPhoto?.file_id) {
    refs.push({
      fileId: largestPhoto.file_id,
      name: `telegram-photo-${message.message_id || Date.now()}.jpg`,
      mimeType: "image/jpeg",
    });
  }

  if (message.document?.file_id) {
    refs.push({
      fileId: message.document.file_id,
      name:
        message.document.file_name ||
        `telegram-document-${message.message_id || Date.now()}`,
      mimeType: message.document.mime_type || null,
    });
  }

  return refs;
}

function joinDisplayName(
  firstName?: string,
  lastName?: string,
  username?: string,
) {
  const fullName = [firstName, lastName].filter(Boolean).join(" ").trim();

  if (fullName) {
    return fullName;
  }

  if (username) {
    return `@${username}`;
  }

  return null;
}

async function callTelegramApiWithFetch<T>(url: string, body: Record<string, unknown>) {
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
    cache: "no-store",
    signal: AbortSignal.timeout(TELEGRAM_FETCH_TIMEOUT_MS),
  });

  const payload = (await response.json()) as TelegramApiResponse<T>;

  return unwrapTelegramResult(payload, response.status);
}

async function callTelegramApiWithCurl<T>(url: string, body: Record<string, unknown>) {
  const { stdout } = await execFileAsync("curl", [
    "-sS",
    "--max-time",
    String(TELEGRAM_CURL_TIMEOUT_SECONDS),
    "-X",
    "POST",
    "-H",
    "Content-Type: application/json",
    "--data",
    JSON.stringify(body),
    url,
  ]);

  const payload = JSON.parse(stdout) as TelegramApiResponse<T>;

  return unwrapTelegramResult(payload);
}

async function callTelegramMultipartApi<T>(input: {
  method: string;
  chatId: string;
  fieldName: "photo" | "document";
  filePath: string;
  fileName: string;
  mimeType: string;
}) {
  const botToken = getTelegramSecrets().botToken;

  if (!botToken) {
    throw new Error("Telegram bot token 未配置。");
  }

  const { stdout } = await execFileAsync("curl", [
    "-sS",
    "--max-time",
    String(TELEGRAM_FILE_DOWNLOAD_TIMEOUT_SECONDS),
    "-X",
    "POST",
    "-F",
    `chat_id=${input.chatId}`,
    "-F",
    `${input.fieldName}=@${input.filePath};type=${input.mimeType};filename=${input.fileName}`,
    `${TELEGRAM_API_BASE_URL}/bot${botToken}/${input.method}`,
  ]);

  const payload = JSON.parse(stdout) as TelegramApiResponse<T>;

  return unwrapTelegramResult(payload);
}

async function downloadTelegramFileBuffer(botToken: string, filePath: string) {
  const url = `${TELEGRAM_API_BASE_URL}/file/bot${botToken}/${filePath}`;

  try {
    const response = await fetch(url, {
      cache: "no-store",
      signal: AbortSignal.timeout(TELEGRAM_FETCH_TIMEOUT_MS),
    });

    if (!response.ok) {
      throw new Error(`Telegram 文件下载失败（${response.status}）。`);
    }

    const arrayBuffer = await response.arrayBuffer();
    return Buffer.from(arrayBuffer);
  } catch (error) {
    if (!shouldRetryTelegramRequestWithCurl(error)) {
      throw normalizeTelegramApiError(error);
    }
  }

  return execCurlBuffer([
    "-sS",
    "-L",
    "--max-time",
    String(TELEGRAM_FILE_DOWNLOAD_TIMEOUT_SECONDS),
    url,
  ]);
}

function unwrapTelegramResult<T>(payload: TelegramApiResponse<T>, status?: number) {
  if (!payload.ok || !("result" in payload)) {
    throw new Error(payload.description || `Telegram API 调用失败${status ? `（${status}）` : ""}。`);
  }

  return payload.result as T;
}

function shouldRetryTelegramRequestWithCurl(error: unknown) {
  const message = getTelegramErrorText(error).toLowerCase();

  return [
    "fetch failed",
    "econnreset",
    "timed out",
    "timeout",
    "ehostunreach",
    "enetunreach",
    "eai_again",
    "self signed certificate",
  ].some((pattern) => message.includes(pattern));
}

function normalizeTelegramApiError(error: unknown) {
  if (!(error instanceof Error)) {
    return new Error("Telegram API 调用失败。");
  }

  const message = getTelegramErrorText(error).toLowerCase();

  if (
    [
      "econnreset",
      "fetch failed",
      "recv failure",
      "timed out",
      "timeout",
      "failed to connect",
      "could not resolve host",
      "ehostunreach",
      "enetunreach",
      "eai_again",
      "ssl",
      "certificate",
    ].some((pattern) => message.includes(pattern))
  ) {
    return new Error(
      "OpenCrab 当前无法访问 Telegram API。请检查这台机器的网络、VPN 或代理配置，确认 OpenCrab 进程本身可以连到 https://api.telegram.org 。",
    );
  }

  return error;
}

function getTelegramErrorText(error: unknown) {
  if (!(error instanceof Error)) {
    return "";
  }

  const execError = error as Error & {
    cause?: unknown;
    stderr?: string;
    stdout?: string;
  };

  return [
    execError.message,
    String(execError.cause || ""),
    execError.stderr || "",
    execError.stdout || "",
  ]
    .filter(Boolean)
    .join("\n");
}

function execCurlBuffer(args: string[]) {
  return new Promise<Buffer>((resolve, reject) => {
    execFile("curl", args, { encoding: "buffer", maxBuffer: 25 * 1024 * 1024 }, (error, stdout) => {
      if (error) {
        reject(error);
        return;
      }

      resolve(stdout as Buffer);
    });
  });
}
