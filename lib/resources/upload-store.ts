import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { execFile } from "node:child_process";
import { promises as fs } from "node:fs";
import path from "node:path";
import { promisify } from "node:util";
import {
  OPENCRAB_RUNTIME_DIR,
  OPENCRAB_UPLOADS_DIR as UPLOADS_DIR,
  OPENCRAB_UPLOADS_INDEX_PATH as UPLOADS_INDEX_PATH,
} from "@/lib/resources/runtime-paths";
import type { UploadedAttachment } from "@/lib/resources/opencrab-api-types";
const execFileAsync = promisify(execFile);

type StoredAttachment = UploadedAttachment & {
  storedPath: string;
  promptPath?: string;
};

export async function saveUpload(file: File) {
  const originalName = file.name || "upload";
  const safeName = sanitizeFileName(originalName);
  const mimeType = file.type || getMimeTypeFromName(originalName);
  const kind = getAttachmentKind(originalName, mimeType);

  if (!kind) {
    throw new Error("当前支持上传图片、文本文件、PDF 和 Word 文档。");
  }

  ensureUploadStore();

  const id = `upload-${crypto.randomUUID()}`;
  const storedName = `${id}-${safeName}`;
  const storedPath = path.join(UPLOADS_DIR, storedName);
  const arrayBuffer = await file.arrayBuffer();

  await fs.writeFile(storedPath, Buffer.from(arrayBuffer));

  const promptPath =
    kind === "text"
      ? await buildPromptPath({ name: originalName, mimeType, storedPath })
      : undefined;

  const attachment: StoredAttachment = {
    id,
    name: originalName,
    kind,
    size: file.size,
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

function ensureUploadStore() {
  if (!existsSync(STORE_DIR)) {
    mkdirSync(STORE_DIR, { recursive: true });
  }

  if (!existsSync(UPLOADS_DIR)) {
    mkdirSync(UPLOADS_DIR, { recursive: true });
  }

  if (!existsSync(UPLOADS_INDEX_PATH)) {
    writeFileSync(UPLOADS_INDEX_PATH, "[]", "utf8");
  }
}

const STORE_DIR = OPENCRAB_RUNTIME_DIR;

function readIndex() {
  ensureUploadStore();

  try {
    return JSON.parse(readFileSync(UPLOADS_INDEX_PATH, "utf8")) as StoredAttachment[];
  } catch {
    writeFileSync(UPLOADS_INDEX_PATH, "[]", "utf8");
    return [];
  }
}

function writeIndex(items: StoredAttachment[]) {
  ensureUploadStore();
  writeFileSync(UPLOADS_INDEX_PATH, JSON.stringify(items, null, 2), "utf8");
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
    const { stdout } = await execFileAsync("node", [path.join(process.cwd(), "scripts/pdf_extract.mjs"), filePath]);
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
