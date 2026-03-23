import { uploadService } from "@/lib/modules/uploads/upload-service";
import {
  badRequestJson,
  errorResponse,
  noStoreJson,
} from "@/lib/server/api-route";

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const files = formData
      .getAll("files")
      .filter(
        (entry): entry is File =>
          typeof File !== "undefined" && entry instanceof File,
      );

    if (files.length === 0) {
      return badRequestJson("没有收到上传文件。");
    }

    const attachments = await uploadService.uploadFiles(files);

    return noStoreJson({ attachments });
  } catch (error) {
    return errorResponse(error, "上传文件失败。", 500, {
      request,
      operation: "upload_files",
    });
  }
}
