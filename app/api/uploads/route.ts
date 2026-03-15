import { NextResponse } from "next/server";
import { saveUpload } from "@/lib/resources/upload-store";

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const files = formData
      .getAll("files")
      .filter((entry): entry is File => typeof File !== "undefined" && entry instanceof File);

    if (files.length === 0) {
      return NextResponse.json({ error: "没有收到上传文件。" }, { status: 400 });
    }

    const attachments = await Promise.all(files.map((file) => saveUpload(file)));

    return NextResponse.json({ attachments });
  } catch (error) {
    const message = error instanceof Error ? error.message : "上传文件失败。";

    return NextResponse.json({ error: message }, { status: 500 });
  }
}
