"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Composer } from "@/components/composer/composer";
import { useOpenCrabApp } from "@/components/app-shell/opencrab-provider";

type HomeScreenProps = {
  title: string;
  description: string;
};

export function HomeScreen({ title, description }: HomeScreenProps) {
  const router = useRouter();
  const {
    codexModels,
    selectedModel,
    selectedReasoningEffort,
    setSelectedModel,
    setSelectedReasoningEffort,
    sendMessage,
    uploadAttachments,
    isSendingMessage,
    isUploadingAttachments,
    errorMessage,
  } = useOpenCrabApp();
  const [draft, setDraft] = useState("");

  async function handleSubmit(input: { content: string; attachmentIds: string[] }) {
    const conversationId = await sendMessage(input);

    if (!conversationId) {
      return false;
    }

    setDraft("");
    router.push(`/conversations/${conversationId}`);
    return true;
  }

  return (
    <div className="flex min-h-screen flex-col">
      <div className="flex items-center px-6 pt-5 lg:px-8">
        <h1 className="text-[21px] font-semibold tracking-[-0.03em] text-text">OpenCrab</h1>
      </div>

      <section className="flex flex-1 flex-col items-center justify-center gap-8 px-6 pb-14 text-center lg:px-8">
        <div className="space-y-3">
          <h2 className="text-[44px] font-semibold tracking-[-0.05em] text-text sm:text-[56px]">
            {title}
          </h2>
          <p className="text-[16px] text-muted-strong">{description}</p>
        </div>

        <div className="w-full max-w-[1040px] space-y-3">
          {isSendingMessage ? (
            <p className="text-left text-[14px] text-muted-strong">正在调用 Codex 生成回复...</p>
          ) : null}
          {errorMessage ? <p className="text-left text-[14px] text-[#a34942]">{errorMessage}</p> : null}
          <Composer
            value={draft}
            onChange={setDraft}
            onSubmit={handleSubmit}
            onUploadFiles={uploadAttachments}
            autoFocus
            disabled={isSendingMessage || codexModels.length === 0}
            isUploading={isUploadingAttachments}
            submitLabel={isSendingMessage ? "发送中" : "发送"}
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
