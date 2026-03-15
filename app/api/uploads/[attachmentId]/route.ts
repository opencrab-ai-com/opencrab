import { createReadStream, existsSync } from "node:fs";
import { NextResponse } from "next/server";
import { getUploadById } from "@/lib/resources/upload-store";

export async function GET(
  _request: Request,
  context: { params: Promise<{ attachmentId: string }> },
) {
  const { attachmentId } = await context.params;
  const attachment = getUploadById(attachmentId);

  if (!attachment || !existsSync(attachment.storedPath)) {
    return NextResponse.json({ error: "附件不存在。" }, { status: 404 });
  }

  const stream = createReadStream(attachment.storedPath);

  return new NextResponse(stream as never, {
    headers: {
      "Content-Type": attachment.mimeType,
      "Cache-Control": "no-store",
    },
  });
}
