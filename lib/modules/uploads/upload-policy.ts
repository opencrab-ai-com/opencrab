import { OpenCrabError } from "@/lib/shared/errors/opencrab-error";

const DEFAULT_MAX_UPLOAD_FILES = 8;
const DEFAULT_MAX_SINGLE_FILE_BYTES = 25 * 1024 * 1024;
const DEFAULT_MAX_TOTAL_UPLOAD_BYTES = 40 * 1024 * 1024;

export type UploadPolicy = {
  maxFiles: number;
  maxSingleFileBytes: number;
  maxTotalBytes: number;
};

export function getUploadPolicy(): UploadPolicy {
  return {
    maxFiles: readPositiveIntegerEnv(
      "OPENCRAB_UPLOAD_MAX_FILES",
      DEFAULT_MAX_UPLOAD_FILES,
    ),
    maxSingleFileBytes: readPositiveIntegerEnv(
      "OPENCRAB_UPLOAD_MAX_FILE_BYTES",
      DEFAULT_MAX_SINGLE_FILE_BYTES,
    ),
    maxTotalBytes: readPositiveIntegerEnv(
      "OPENCRAB_UPLOAD_MAX_TOTAL_BYTES",
      DEFAULT_MAX_TOTAL_UPLOAD_BYTES,
    ),
  };
}

export function assertUploadPolicy(files: File[], policy = getUploadPolicy()) {
  if (files.length > policy.maxFiles) {
    throw new OpenCrabError(
      `单次最多只能上传 ${policy.maxFiles} 个附件。`,
      {
        statusCode: 400,
        code: "upload_limit_files",
        details: {
          maxFiles: policy.maxFiles,
          receivedFiles: files.length,
        },
      },
    );
  }

  const totalBytes = files.reduce((sum, file) => sum + file.size, 0);

  if (totalBytes > policy.maxTotalBytes) {
    throw new OpenCrabError(
      `单次上传总大小不能超过 ${formatBytes(policy.maxTotalBytes)}。`,
      {
        statusCode: 413,
        code: "upload_limit_total_size",
        details: {
          maxTotalBytes: policy.maxTotalBytes,
          receivedTotalBytes: totalBytes,
        },
      },
    );
  }

  for (const file of files) {
    if (file.size > policy.maxSingleFileBytes) {
      throw new OpenCrabError(
        `附件“${file.name || "未命名文件"}”超过单文件大小限制（${formatBytes(policy.maxSingleFileBytes)}）。`,
        {
          statusCode: 413,
          code: "upload_limit_file_size",
          details: {
            maxSingleFileBytes: policy.maxSingleFileBytes,
            fileName: file.name || null,
            fileSize: file.size,
          },
        },
      );
    }
  }
}

function readPositiveIntegerEnv(name: string, fallback: number) {
  const raw = process.env[name]?.trim();

  if (!raw) {
    return fallback;
  }

  const parsed = Number.parseInt(raw, 10);

  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function formatBytes(value: number) {
  if (value < 1024) {
    return `${value} B`;
  }

  if (value < 1024 * 1024) {
    return `${Math.round((value / 1024) * 10) / 10} KB`;
  }

  const mb = value / (1024 * 1024);
  return `${Math.round(mb * 10) / 10} MB`;
}
