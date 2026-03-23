import { describe, expect, it, vi } from "vitest";
import { createUploadService } from "@/lib/modules/uploads/upload-service";

describe("uploadService", () => {
  it("uploads multiple files and blocks inaccessible downloads", async () => {
    const file = new File(["hello"], "hello.txt", { type: "text/plain" });
    const attachment = {
      id: "upload-1",
      name: "hello.txt",
      kind: "text" as const,
      size: 5,
      mimeType: "text/plain",
      storedPath: "/tmp/hello.txt",
    };
    const repository = {
      saveUpload: vi.fn(async () => ({
        id: attachment.id,
        name: attachment.name,
        kind: attachment.kind,
        size: attachment.size,
        mimeType: attachment.mimeType,
      })),
      getUploadById: vi.fn(() => attachment),
      canAccessAttachment: vi.fn(() => false),
    };
    const service = createUploadService({ repository });

    await expect(service.uploadFiles([file])).resolves.toEqual([
      {
        id: "upload-1",
        name: "hello.txt",
        kind: "text",
        size: 5,
        mimeType: "text/plain",
      },
    ]);
    expect(service.getDownloadableAttachment("upload-1")).toBeNull();
  });

  it("rejects uploads that exceed configured limits", async () => {
    const service = createUploadService({
      repository: {
        saveUpload: vi.fn(),
        getUploadById: vi.fn(() => null),
        canAccessAttachment: vi.fn(() => false),
      },
      policy: {
        maxFiles: 1,
        maxSingleFileBytes: 4,
        maxTotalBytes: 10,
      },
    });
    const file = new File(["hello"], "hello.txt", { type: "text/plain" });

    await expect(service.uploadFiles([file])).rejects.toThrow("超过单文件大小限制");
  });
});
