"use client";

import { useRouter } from "next/navigation";
import { OpenCrabMark, OpenCrabWordmark } from "@/components/branding/opencrab-brand";
import { Composer } from "@/components/composer/composer";
import { useOpenCrabApp } from "@/components/app-shell/opencrab-provider";
import {
  formatBrowserSessionLabel,
  formatReasoningEffortLabel,
  formatSandboxModeLabel,
} from "@/lib/opencrab/labels";
import { usePersistedDraft } from "@/lib/opencrab/use-persisted-draft";
import type { UploadedAttachment } from "@/lib/resources/opencrab-api-types";

type HomeScreenProps = {
  title: string;
  description: string;
};

export function HomeScreen({ title, description }: HomeScreenProps) {
  const router = useRouter();
  const {
    codexModels,
    codexStatus,
    browserSessionStatus,
    selectedModel,
    selectedReasoningEffort,
    selectedSandboxMode,
    setSelectedModel,
    setSelectedReasoningEffort,
    sendMessage,
    stopMessage,
    uploadAttachments,
    isUploadingAttachments,
    errorMessage,
  } = useOpenCrabApp();
  const { draft, setDraft, clearDraft } = usePersistedDraft("opencrab:draft:home");

  async function handleSubmit(input: { content: string; attachments: UploadedAttachment[] }) {
    const conversationId = await sendMessage(input);

    if (!conversationId) {
      return false;
    }

    clearDraft();
    router.push(`/conversations/${conversationId}`);
    return true;
  }

  return (
    <div className="flex min-h-screen flex-col lg:h-full lg:min-h-0 lg:overflow-y-auto">
      <div className="flex items-center px-6 pt-5 lg:px-8">
        <h1 className="flex items-center gap-3">
          <OpenCrabMark className="h-8 w-8" />
          <OpenCrabWordmark className="text-[18px] font-semibold tracking-[-0.03em]" />
        </h1>
      </div>

      <section className="flex flex-1 flex-col items-center justify-center gap-8 px-6 pb-14 text-center lg:px-8">
        <div className="space-y-3">
          <h2 className="text-[36px] font-semibold tracking-[-0.05em] text-text sm:text-[48px]">
            {title}
          </h2>
          <p className="text-[14px] text-muted-strong">{description}</p>
        </div>

        <div className="w-full max-w-[1040px] space-y-3">
          <div className="flex flex-wrap gap-2 text-left text-[12px] text-muted-strong">
            <span className="rounded-full border border-line bg-surface-muted px-3 py-1.5">
              当前默认模型：{selectedModel}
            </span>
            <span className="rounded-full border border-line bg-surface-muted px-3 py-1.5">
              当前默认推理强度：{formatReasoningEffortLabel(selectedReasoningEffort)}
            </span>
            <span className="rounded-full border border-line bg-surface-muted px-3 py-1.5">
              当前默认权限：{formatSandboxModeLabel(selectedSandboxMode)}
            </span>
            <span className="rounded-full border border-line bg-surface-muted px-3 py-1.5">
              浏览器连接：{formatBrowserSessionLabel(browserSessionStatus)}
            </span>
          </div>
          {codexStatus?.ok === false ? (
            <p className="text-left text-[13px] text-[#a34942]">
              OpenCrab 当前还没有完成本机执行环境准备，请先完成初始登录后再回来继续发送。
            </p>
          ) : null}
          {errorMessage ? <p className="text-left text-[13px] text-[#a34942]">{errorMessage}</p> : null}
          <Composer
            value={draft}
            onChange={setDraft}
            onSubmit={handleSubmit}
            onStop={stopMessage}
            onUploadFiles={uploadAttachments}
            autoFocus
            canSubmit={codexModels.length > 0 && codexStatus?.ok !== false}
            disableOptionSelects={codexModels.length === 0}
            isUploading={isUploadingAttachments}
            isStreaming={false}
            submitLabel="发送"
            modelOptions={codexModels}
            selectedModel={selectedModel}
            selectedReasoningEffort={selectedReasoningEffort}
            onModelChange={setSelectedModel}
            onReasoningEffortChange={setSelectedReasoningEffort}
          />
        </div>
      </section>
    </div>
  );
}
