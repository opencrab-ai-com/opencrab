import { saveUpload } from "@/lib/resources/upload-store";
import { badRequestJson, errorResponse, json } from "@/lib/server/api-route";

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

    const attachments = await Promise.all(
      files.map((file) => saveUpload(file)),
    );

    return json({ attachments });
  } catch (error) {
    return errorResponse(error, "上传文件失败。");
  }
}
