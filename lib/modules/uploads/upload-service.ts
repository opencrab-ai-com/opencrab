import { canAccessAttachment, getUploadById, saveUpload } from "@/lib/resources/upload-store";
import type { UploadedAttachment } from "@/lib/resources/opencrab-api-types";
import {
  assertUploadPolicy,
  getUploadPolicy,
  type UploadPolicy,
} from "@/lib/modules/uploads/upload-policy";

type StoredAttachment = NonNullable<ReturnType<typeof getUploadById>>;

export type UploadRepository = {
  saveUpload: (file: File) => Promise<UploadedAttachment>;
  getUploadById: (attachmentId: string) => StoredAttachment | null;
  canAccessAttachment: (attachment: Pick<StoredAttachment, "storedPath">) => boolean;
};

type UploadServiceDependencies = {
  repository?: UploadRepository;
  policy?: UploadPolicy;
};

export function createUploadService(dependencies: UploadServiceDependencies = {}) {
  const repository = dependencies.repository ?? localUploadRepository;
  const policy = dependencies.policy ?? getUploadPolicy();

  return {
    async uploadFiles(files: File[]) {
      assertUploadPolicy(files, policy);
      return Promise.all(files.map((file) => repository.saveUpload(file)));
    },
    getDownloadableAttachment(attachmentId: string) {
      const attachment = repository.getUploadById(attachmentId);

      if (!attachment || !repository.canAccessAttachment(attachment)) {
        return null;
      }

      return attachment;
    },
  };
}

const localUploadRepository: UploadRepository = {
  saveUpload,
  getUploadById,
  canAccessAttachment,
};

export const uploadService = createUploadService();
