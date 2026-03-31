import { statSync } from "node:fs";
import path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import {
  errorResponse,
  noStoreJson,
} from "@/lib/server/api-route";
import {
  isAttachmentPathAllowed,
  resolveExistingPath,
} from "@/lib/resources/attachment-access-policy";

const execFileAsync = promisify(execFile);

export async function GET(request: Request) {
  try {
    const requestUrl = new URL(request.url);
    const rawPath = requestUrl.searchParams.get("path")?.trim() || "";
    const resolvedPath = resolveExistingPath(rawPath);

    if (!resolvedPath) {
      return noStoreJson(
        {
          error: "文件不存在，无法打开所在目录。",
        },
        { status: 404 },
      );
    }

    if (!isAttachmentPathAllowed(resolvedPath)) {
      return noStoreJson(
        {
          error: "当前路径不在允许访问的工作区范围内。",
        },
        { status: 403 },
      );
    }

    await revealPathInFileManager(resolvedPath);

    return noStoreJson({
      ok: true,
      path: resolvedPath,
    });
  } catch (error) {
    return errorResponse(error, "打开本地文件目录失败。", 500, {
      request,
      operation: "open_local_file_directory",
    });
  }
}

async function revealPathInFileManager(targetPath: string) {
  const stats = statSync(targetPath);
  const isDirectory = stats.isDirectory();

  switch (process.platform) {
    case "darwin":
      if (isDirectory) {
        await execFileAsync("open", [targetPath]);
        return;
      }

      await execFileAsync("open", ["-R", targetPath]);
      return;
    case "win32":
      if (isDirectory) {
        await execFileAsync("explorer.exe", [targetPath]);
        return;
      }

      await execFileAsync("explorer.exe", [`/select,${targetPath}`]);
      return;
    default:
      await execFileAsync("xdg-open", [isDirectory ? targetPath : path.dirname(targetPath)]);
  }
}
