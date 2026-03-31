import { existsSync, mkdirSync, statSync } from "node:fs";
import { execFile } from "node:child_process";
import { promises as fs } from "node:fs";
import path from "node:path";
import { promisify } from "node:util";
import {
  OPENCRAB_UPLOADS_DIR as UPLOADS_DIR,
  OPENCRAB_UPLOADS_INDEX_PATH as UPLOADS_INDEX_PATH,
} from "@/lib/resources/runtime-paths";
import type { UploadedAttachment } from "@/lib/resources/opencrab-api-types";
import {
  isAttachmentPathAllowed,
  resolveExistingPath,
} from "@/lib/resources/attachment-access-policy";
import { createSyncJsonFileStore } from "@/lib/infrastructure/json-store/sync-json-file-store";
import { resolveOpenCrabResourcePath } from "@/lib/runtime/app-resource-paths";
import { execOpenCrabNodeScript } from "@/lib/runtime/node-exec";
const execFileAsync = promisify(execFile);

type StoredAttachment = UploadedAttachment & {
  storedPath: string;
  promptPath?: string;
};
const indexStore = createSyncJsonFileStore<StoredAttachment[]>({
  filePath: UPLOADS_INDEX_PATH,
  seed: () => [],
  normalize: (value) => normalizeStoredAttachments(Array.isArray(value) ? value : []),
});

export async function saveUpload(file: File) {
  const originalName = file.name || "upload";
  const mimeType = file.type || getMimeTypeFromName(originalName);
  const arrayBuffer = await file.arrayBuffer();

  return saveUploadFromBuffer({
    name: originalName,
    mimeType,
    buffer: Buffer.from(arrayBuffer),
  });
}

export async function saveUploadFromBuffer(input: {
  name: string;
  mimeType?: string | null;
  buffer: Buffer;
}) {
  const originalName = input.name || "upload";
  const safeName = sanitizeFileName(originalName);
  const mimeType = input.mimeType || getMimeTypeFromName(originalName);
  const kind = getAttachmentKind(originalName, mimeType);

  if (!kind) {
    throw new Error("当前暂时无法识别这个附件类型。");
  }

  ensureUploadStore();

  const id = `upload-${crypto.randomUUID()}`;
  const storedName = `${id}-${safeName}`;
  const storedPath = path.join(UPLOADS_DIR, storedName);

  await fs.writeFile(storedPath, input.buffer);

  const promptPath =
    kind === "text"
      ? await buildPromptPath({ name: originalName, mimeType, storedPath })
      : undefined;

  const attachment: StoredAttachment = {
    id,
    name: originalName,
    kind,
    size: input.buffer.byteLength,
    mimeType,
    storedPath,
    promptPath,
  };

  const items = readIndex();
  items.push(attachment);
  writeIndex(items);

  return toPublicAttachment(attachment);
}

export function getUploadsByIds(ids: string[]) {
  if (ids.length === 0) {
    return [];
  }

  const items = readIndex();

  return ids
    .map((id) => items.find((item) => item.id === id))
    .filter((item): item is StoredAttachment => Boolean(item));
}

export function getUploadById(id: string) {
  return readIndex().find((item) => item.id === id) || null;
}

export function registerOutputAttachmentsFromText(content: string) {
  if (!content.trim()) {
    return [];
  }

  const items = readIndex();
  const nextItems = [...items];
  const registered: UploadedAttachment[] = [];

  for (const filePath of extractCandidatePaths(content)) {
    const resolvedPath = resolveExistingPath(filePath);

    if (!resolvedPath || !isAttachmentPathAllowed(resolvedPath)) {
      continue;
    }

    const existing = nextItems.find((item) => item.storedPath === resolvedPath);

    if (existing) {
      registered.push(toPublicAttachment(existing));
      continue;
    }

    const name = path.basename(filePath);
    const mimeType = getMimeTypeFromName(name);
    const kind = getAttachmentKind(name, mimeType);

    if (!kind) {
      continue;
    }

    const attachment: StoredAttachment = {
      id: `output-${crypto.randomUUID()}`,
      name,
      kind,
      size: safeReadFileSize(resolvedPath),
      mimeType,
      storedPath: resolvedPath,
    };

    nextItems.push(attachment);
    registered.push(toPublicAttachment(attachment));
  }

  if (nextItems.length !== items.length) {
    writeIndex(nextItems);
  }

  return registered;
}

export function canAccessAttachment(attachment: Pick<StoredAttachment, "storedPath">) {
  return isAttachmentPathAllowed(attachment.storedPath);
}

function ensureUploadStore() {
  if (!existsSync(UPLOADS_DIR)) {
    mkdirSync(UPLOADS_DIR, { recursive: true });
  }
}

function readIndex() {
  ensureUploadStore();
  return indexStore.read();
}

function writeIndex(items: StoredAttachment[]) {
  ensureUploadStore();
  indexStore.write(items);
}

function safeReadFileSize(filePath: string) {
  try {
    return statSync(filePath).size;
  } catch {
    return 0;
  }
}

function extractCandidatePaths(content: string) {
  const supportedExtensions = [
    "png",
    "jpg",
    "jpeg",
    "webp",
    "gif",
    "pdf",
    "doc",
    "docx",
    "txt",
    "md",
    "markdown",
    "json",
    "csv",
    "ts",
    "tsx",
    "js",
    "jsx",
    "py",
    "html",
    "css",
    "xml",
    "yml",
    "yaml",
  ].join("|");
  const pattern = new RegExp(
    String.raw`(\/(?:[^\/\n\r\t"'<>` + "`" + String.raw`]+\/)*[^\/\n\r\t"'<>` + "`" + String.raw`]+\.(?:${supportedExtensions}))`,
    "gi",
  );
  const matches = new Set<string>();

  for (const match of content.matchAll(pattern)) {
    const raw = match[1]?.trim();

    if (!raw) {
      continue;
    }

    matches.add(raw.replace(/[),.，。；;！？!]+$/u, ""));
  }

  return [...matches];
}

function toPublicAttachment(attachment: StoredAttachment): UploadedAttachment {
  return {
    id: attachment.id,
    name: attachment.name,
    kind: attachment.kind,
    size: attachment.size,
    mimeType: attachment.mimeType,
  };
}

function normalizeStoredAttachments(items: Array<Partial<StoredAttachment> | undefined>) {
  const normalized: StoredAttachment[] = [];

  for (const item of structuredClone(items || [])) {
    const storedPath = typeof item?.storedPath === "string" ? resolveExistingPath(item.storedPath) : null;

    if (!storedPath) {
      continue;
    }

    normalized.push({
      id: item?.id || `upload-${crypto.randomUUID()}`,
      name: item?.name || path.basename(storedPath),
      kind:
        item?.kind === "image" || item?.kind === "text" || item?.kind === "file"
          ? item.kind
          : getAttachmentKind(
                item?.name || path.basename(storedPath),
                item?.mimeType || "application/octet-stream",
              ) || "file",
      size: typeof item?.size === "number" ? item.size : safeReadFileSize(storedPath),
      mimeType: item?.mimeType || getMimeTypeFromName(item?.name || path.basename(storedPath)),
      storedPath,
      promptPath: typeof item?.promptPath === "string" ? resolveExistingPath(item.promptPath) || undefined : undefined,
    });
  }

  return normalized;
}

function getAttachmentKind(name: string, mimeType: string) {
  if (mimeType.startsWith("image/")) {
    return "image" as const;
  }

  const extension = path.extname(name).toLowerCase();
  const textExtensions = new Set([
    ".txt",
    ".md",
    ".markdown",
    ".json",
    ".csv",
    ".ts",
    ".tsx",
    ".js",
    ".jsx",
    ".py",
    ".html",
    ".css",
    ".xml",
    ".yml",
    ".yaml",
  ]);
  const documentExtensions = new Set([".pdf", ".doc", ".docx"]);
  const documentMimeTypes = new Set([
    "application/pdf",
    "application/msword",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ]);

  if (
    mimeType.startsWith("text/") ||
    mimeType === "application/json" ||
    textExtensions.has(extension) ||
    documentExtensions.has(extension) ||
    documentMimeTypes.has(mimeType)
  ) {
    return "text" as const;
  }

  if (mimeType.startsWith("application/") || mimeType.startsWith("audio/") || mimeType.startsWith("video/")) {
    return "file" as const;
  }

  return null;
}

function sanitizeFileName(name: string) {
  const trimmed = name.trim();
  const sanitized = trimmed.replace(/[\\/:\0]/g, "-");

  return sanitized || "upload";
}

function getMimeTypeFromName(name: string) {
  const extension = path.extname(name).toLowerCase();

  switch (extension) {
    case ".md":
    case ".txt":
    case ".csv":
    case ".html":
    case ".css":
    case ".xml":
    case ".yml":
    case ".yaml":
      return "text/plain";
    case ".json":
      return "application/json";
    case ".png":
      return "image/png";
    case ".jpg":
    case ".jpeg":
      return "image/jpeg";
    case ".webp":
      return "image/webp";
    case ".gif":
      return "image/gif";
    case ".pdf":
      return "application/pdf";
    case ".doc":
      return "application/msword";
    case ".docx":
      return "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
    default:
      return "application/octet-stream";
  }
}

async function buildPromptPath(input: {
  name: string;
  mimeType: string;
  storedPath: string;
}) {
  const extension = path.extname(input.name).toLowerCase();

  if (isPlainTextLike(extension, input.mimeType)) {
    return input.storedPath;
  }

  const extractedText = await extractDocumentText(input.storedPath, extension);
  const extractedPath = `${input.storedPath}.txt`;

  await fs.writeFile(extractedPath, extractedText, "utf8");

  return extractedPath;
}

function isPlainTextLike(extension: string, mimeType: string) {
  const textExtensions = new Set([
    ".txt",
    ".md",
    ".markdown",
    ".json",
    ".csv",
    ".ts",
    ".tsx",
    ".js",
    ".jsx",
    ".py",
    ".html",
    ".css",
    ".xml",
    ".yml",
    ".yaml",
  ]);

  return mimeType.startsWith("text/") || mimeType === "application/json" || textExtensions.has(extension);
}

async function extractDocumentText(filePath: string, extension: string) {
  if (extension === ".pdf") {
    const { stdout } = await execOpenCrabNodeScript(
      resolveOpenCrabResourcePath("scripts", "pdf_extract.mjs"),
      [filePath],
    );
    const text = stdout.trim();

    if (!text) {
      throw new Error("这个 PDF 里没有提取到可用文字，暂时还不支持纯扫描版 PDF。");
    }

    return text;
  }

  if (extension === ".doc" || extension === ".docx") {
    const { stdout } = await execFileAsync("textutil", [
      "-convert",
      "txt",
      "-stdout",
      filePath,
    ]);
    const text = stdout.trim();

    if (!text) {
      throw new Error("这个 Word 文档没有提取到可用文字，请换一个包含文本内容的文档试试。");
    }

    return text;
  }

  throw new Error("当前还不支持读取这个文档格式。");
}
