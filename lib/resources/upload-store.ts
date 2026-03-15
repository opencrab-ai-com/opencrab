import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { promises as fs } from "node:fs";
import path from "node:path";
import type { UploadedAttachment } from "@/lib/resources/opencrab-api-types";

const STORE_DIR = path.join(process.cwd(), ".opencrab");
const UPLOADS_DIR = path.join(STORE_DIR, "uploads");
const UPLOADS_INDEX_PATH = path.join(UPLOADS_DIR, "index.json");

type StoredAttachment = UploadedAttachment & {
  storedPath: string;
};

export async function saveUpload(file: File) {
  const name = sanitizeFileName(file.name || "upload");
  const mimeType = file.type || getMimeTypeFromName(name);
  const kind = getAttachmentKind(name, mimeType);

  if (!kind) {
    throw new Error("当前只支持上传图片和文本文件。");
  }

  ensureUploadStore();

  const id = `upload-${crypto.randomUUID()}`;
  const storedName = `${id}-${name}`;
  const storedPath = path.join(UPLOADS_DIR, storedName);
  const arrayBuffer = await file.arrayBuffer();

  await fs.writeFile(storedPath, Buffer.from(arrayBuffer));

  const attachment: StoredAttachment = {
    id,
    name,
    kind,
    size: file.size,
    mimeType,
    storedPath,
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

  if (mimeType.startsWith("text/") || mimeType === "application/json" || textExtensions.has(extension)) {
    return "text" as const;
  }

  return null;
}

function sanitizeFileName(name: string) {
  return name.replace(/[^a-zA-Z0-9._-]/g, "-");
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
    default:
      return "application/octet-stream";
  }
}
