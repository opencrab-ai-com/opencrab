import {
  errorResponse,
  noStoreJson,
} from "@/lib/server/api-route";
import {
  isAttachmentPathAllowed,
  resolveExistingPath,
} from "@/lib/resources/attachment-access-policy";
import { revealNativePath } from "@/lib/server/native-directory-picker";

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

    await revealNativePath(resolvedPath);

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
