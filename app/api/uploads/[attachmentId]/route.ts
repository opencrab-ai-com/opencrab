import { createReadStream, existsSync } from "node:fs";
import { NextResponse } from "next/server";
import { uploadService } from "@/lib/modules/uploads/upload-service";
import {
  notFoundJson,
  readRouteParams,
  type RouteContext,
} from "@/lib/server/api-route";

export async function GET(
  _request: Request,
  context: RouteContext<{ attachmentId: string }>,
) {
  const { attachmentId } = await readRouteParams(context);
  const attachment = uploadService.getDownloadableAttachment(attachmentId);

  if (!attachment || !existsSync(attachment.storedPath)) {
    return notFoundJson("附件不存在。");
  }

  const stream = createReadStream(attachment.storedPath);

  return new NextResponse(stream as never, {
    headers: {
      "Content-Type": attachment.mimeType,
      "Cache-Control": "no-store",
    },
  });
}
