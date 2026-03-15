"use client";

import { useMemo, useState } from "react";
import { Composer } from "@/components/composer/composer";
import { useOpenCrabApp } from "@/components/app-shell/opencrab-provider";
import { ConversationThread } from "@/components/conversation/conversation-thread";

type ConversationDetailScreenProps = {
  conversationId: string;
};

export function ConversationDetailScreen({ conversationId }: ConversationDetailScreenProps) {
  const {
    conversations,
    codexModels,
    selectedModel,
    selectedReasoningEffort,
    setSelectedModel,
    setSelectedReasoningEffort,
    isHydrated,
    isSendingMessage,
    isUploadingAttachments,
    errorMessage,
    sendMessage,
    uploadAttachments,
  } = useOpenCrabApp();
  const [draft, setDraft] = useState("");
  const activeConversation = useMemo(
    () => conversations.find((item) => item.id === conversationId),
    [conversationId, conversations],
  );

  if (!isHydrated) {
    return (
      <div className="flex min-h-screen items-center justify-center px-6 text-center lg:h-full lg:min-h-0">
        <p className="text-[16px] text-muted-strong">正在加载对话...</p>
      </div>
    );
  }

  if (!activeConversation) {
    return (
      <div className="flex min-h-screen items-center justify-center px-6 text-center lg:h-full lg:min-h-0">
        <div className="space-y-3">
          <h1 className="text-[30px] font-semibold tracking-[-0.04em] text-text">这个对话已经不存在了</h1>
          <p className="text-[16px] text-muted-strong">可以从左侧选择其他对话，或点击“新对话”重新开始。</p>
        </div>
      </div>
    );
  }

  async function handleSubmit(input: { content: string; attachmentIds: string[] }) {
    const nextConversationId = await sendMessage({ conversationId, ...input });

    if (!nextConversationId) {
      return false;
    }

    setDraft("");
    return true;
  }

  return (
    <div className="flex min-h-screen flex-col lg:h-full lg:min-h-0">
      <div className="min-h-0 flex-1 overflow-y-auto">
        <ConversationThread conversationId={conversationId} title={activeConversation.title} />
      </div>
      <div className="shrink-0 border-t border-line bg-background px-4 py-4 lg:px-6">
        <div className="w-full max-w-[1180px] space-y-3">
          {isSendingMessage ? (
            <p className="text-[14px] text-muted-strong">正在调用 Codex 生成回复...</p>
          ) : null}
          {errorMessage ? <p className="text-[14px] text-[#a34942]">{errorMessage}</p> : null}
          <Composer
            value={draft}
            onChange={setDraft}
            onSubmit={handleSubmit}
            onUploadFiles={uploadAttachments}
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
      </div>
    </div>
  );
}
