"use client";

import { useMemo } from "react";
import { Composer } from "@/components/composer/composer";
import { useOpenCrabApp } from "@/components/app-shell/opencrab-provider";
import { ConversationThread } from "@/components/conversation/conversation-thread";
import {
  formatBrowserSessionLabel,
  formatReasoningEffortLabel,
  formatSandboxModeLabel,
} from "@/lib/opencrab/labels";
import { usePersistedDraft } from "@/lib/opencrab/use-persisted-draft";
import type { UploadedAttachment } from "@/lib/resources/opencrab-api-types";

type ConversationDetailScreenProps = {
  conversationId: string;
};

export function ConversationDetailScreen({ conversationId }: ConversationDetailScreenProps) {
  const {
    conversations,
    conversationMessages,
    codexModels,
    codexStatus,
    browserSessionStatus,
    selectedModel,
    selectedReasoningEffort,
    selectedSandboxMode,
    isConversationStreaming,
    setSelectedModel,
    setSelectedReasoningEffort,
    isHydrated,
    isUploadingAttachments,
    stopMessage,
    errorMessage,
    sendMessage,
    uploadAttachments,
  } = useOpenCrabApp();
  const activeConversation = useMemo(
    () => conversations.find((item) => item.id === conversationId),
    [conversationId, conversations],
  );
  const { draft, setDraft, clearDraft } = usePersistedDraft(
    `opencrab:draft:conversation:${conversationId}`,
  );
  const isCurrentConversationSending = isConversationStreaming(conversationId);
  const hasConversationMessages = Boolean(conversationMessages[conversationId]);

  if (!isHydrated) {
    return (
      <div className="flex min-h-screen items-center justify-center px-6 text-center lg:h-full lg:min-h-0">
        <p className="text-[14px] text-muted-strong">正在加载对话...</p>
      </div>
    );
  }

  if (!activeConversation) {
    if (hasConversationMessages || isCurrentConversationSending) {
      return (
        <div className="flex min-h-screen items-center justify-center px-6 text-center lg:h-full lg:min-h-0">
          <p className="text-[14px] text-muted-strong">正在准备对话...</p>
        </div>
      );
    }

    return (
      <div className="flex min-h-screen items-center justify-center px-6 text-center lg:h-full lg:min-h-0">
        <div className="space-y-3">
          <h1 className="text-[24px] font-semibold tracking-[-0.04em] text-text">这个对话已经不存在了</h1>
          <p className="text-[14px] text-muted-strong">可以从左侧选择其他对话，或点击“新对话”重新开始。</p>
        </div>
      </div>
    );
  }

  async function handleSubmit(input: { content: string; attachments: UploadedAttachment[] }) {
    const nextConversationId = await sendMessage({ conversationId, ...input });

    if (!nextConversationId) {
      return false;
    }

    clearDraft();
    return true;
  }

  return (
    <div className="flex min-h-screen flex-col lg:h-full lg:min-h-0">
      <div className="min-h-0 flex-1 overflow-y-auto">
        <ConversationThread conversationId={conversationId} title={activeConversation.title} />
      </div>
      <div className="shrink-0 border-t border-line bg-background px-4 py-4 lg:px-6">
        <div className="w-full max-w-[1180px] space-y-3">
          {isCurrentConversationSending ? (
            <p className="text-[13px] text-muted-strong">正在调用 Codex 生成回复...</p>
          ) : null}
          <div className="flex flex-wrap gap-2 text-[12px] text-muted-strong">
            <span className="rounded-full border border-line bg-surface-muted px-3 py-1.5">
              当前发送权限：{formatSandboxModeLabel(selectedSandboxMode)}
            </span>
            <span className="rounded-full border border-line bg-surface-muted px-3 py-1.5">
              当前发送模型：{selectedModel}
            </span>
            <span className="rounded-full border border-line bg-surface-muted px-3 py-1.5">
              当前推理强度：{formatReasoningEffortLabel(selectedReasoningEffort)}
            </span>
            <span className="rounded-full border border-line bg-surface-muted px-3 py-1.5">
              浏览器连接：{formatBrowserSessionLabel(browserSessionStatus)}
            </span>
          </div>
          {codexStatus?.ok === false ? (
            <p className="text-[13px] text-[#a34942]">
              Codex 尚未登录。请先在本机终端执行 <code>codex login</code>，再回来继续发送。
            </p>
          ) : null}
          {errorMessage ? <p className="text-[13px] text-[#a34942]">{errorMessage}</p> : null}
          <Composer
            value={draft}
            onChange={setDraft}
            onSubmit={handleSubmit}
            onStop={() => stopMessage(conversationId)}
            onUploadFiles={uploadAttachments}
            canSubmit={codexModels.length > 0 && codexStatus?.ok !== false}
            disableOptionSelects={codexModels.length === 0}
            isUploading={isUploadingAttachments}
            isStreaming={isCurrentConversationSending}
            submitLabel={isCurrentConversationSending ? "停止回复" : "发送"}
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
