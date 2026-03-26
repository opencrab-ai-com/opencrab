"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ChatGptConnectionPanel } from "@/components/chatgpt/chatgpt-connection-panel";
import { Composer } from "@/components/composer/composer";
import { WorkspacePickerDialog } from "@/components/workspace/workspace-picker-dialog";
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
  const [workspaceDir, setWorkspaceDir] = useState<string | null>(null);
  const [sandboxMode, setSandboxMode] = useState<"read-only" | "workspace-write" | "danger-full-access">(
    "workspace-write",
  );
  const [isWorkspaceDialogOpen, setIsWorkspaceDialogOpen] = useState(false);
  const {
    codexModels,
    codexStatus,
    browserSessionStatus,
    selectedModel,
    selectedReasoningEffort,
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
    const conversationId = await sendMessage({
      ...input,
      workspaceDir,
      sandboxMode,
    });

    if (!conversationId) {
      return false;
    }

    clearDraft();
    router.push(`/conversations/${conversationId}`);
    return true;
  }

  return (
    <div className="flex min-h-screen flex-col lg:h-full lg:min-h-0 lg:overflow-y-auto">
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
              新对话权限：{formatSandboxModeLabel(sandboxMode)}
            </span>
            <span className="rounded-full border border-line bg-surface-muted px-3 py-1.5">
              浏览器连接：{formatBrowserSessionLabel(browserSessionStatus)}
            </span>
          </div>
          {codexStatus?.ok === false ? (
            <ChatGptConnectionPanel compact />
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
            workspaceLabel={workspaceDir?.trim() || "自动工作区"}
            workspaceTitle={
              workspaceDir?.trim() ||
              "发送后自动创建：~/.opencrab/workspaces/conversations/<conversationId>"
            }
            onWorkspaceClick={() => setIsWorkspaceDialogOpen(true)}
            selectedSandboxMode={sandboxMode}
            onSandboxModeChange={async (mode) => {
              setSandboxMode(mode);
            }}
          />
        </div>
      </section>
      {isWorkspaceDialogOpen ? (
        <WorkspacePickerDialog
          title="设置新对话工作区"
          description="这里会成为下一条新对话的默认写入目录。留空时，OpenCrab 会在 ~/.opencrab/workspaces/conversations/<conversationId> 自动创建独立工作区。"
          initialValue={workspaceDir}
          allowEmpty
          defaultHint="~/.opencrab/workspaces/conversations/<conversationId>"
          confirmLabel="保存工作区"
          onClose={() => setIsWorkspaceDialogOpen(false)}
          onConfirm={async (nextValue) => {
            setWorkspaceDir(nextValue);
          }}
        />
      ) : null}
    </div>
  );
}
