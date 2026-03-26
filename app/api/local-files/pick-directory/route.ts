import {
  errorResponse,
  noStoreJson,
  readJsonBody,
} from "@/lib/server/api-route";
import { pickNativeDirectory } from "@/lib/server/native-directory-picker";

export async function POST(request: Request) {
  try {
    const body = await readJsonBody<{
      title?: string;
      defaultPath?: string | null;
    }>(request, {});
    const pickedPath = await pickNativeDirectory({
      title: body.title,
      defaultPath: body.defaultPath ?? null,
    });

    return noStoreJson({
      ok: true,
      path: pickedPath,
      cancelled: !pickedPath,
    });
  } catch (error) {
    return errorResponse(error, "打开目录选择器失败。", 500, {
      request,
      operation: "pick_local_directory",
    });
  }
}
