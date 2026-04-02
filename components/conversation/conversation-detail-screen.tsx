"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { Composer, type ComposerMentionOption } from "@/components/composer/composer";
import { useOpenCrabApp } from "@/components/app-shell/opencrab-provider";
import { FeishuChatSessionDialog } from "@/components/conversation/feishu-chat-session-dialog";
import { ConversationThread } from "@/components/conversation/conversation-thread";
import { MetaPill as UnifiedMetaPill } from "@/components/ui/pill";
import { WorkspacePickerDialog } from "@/components/workspace/workspace-picker-dialog";
import {
  formatBrowserSessionLabel,
  getBrowserSessionPresentation,
  formatReasoningEffortLabel,
  formatSandboxModeLabel,
} from "@/lib/opencrab/labels";
import { usePersistedDraft } from "@/lib/opencrab/use-persisted-draft";
import type { ProjectDetail } from "@/lib/projects/types";
import {
  getProjectDetail as getProjectDetailResource,
  updateProjectFeishuChatSessionId as updateProjectFeishuChatSessionIdResource,
  updateProjectSandboxMode as updateProjectSandboxModeResource,
  updateProjectWorkspaceDir as updateProjectWorkspaceDirResource,
} from "@/lib/resources/opencrab-api";
import type {
  CodexSandboxMode,
  UploadedAttachment,
} from "@/lib/resources/opencrab-api-types";
import type { ConversationItem } from "@/lib/seed-data";

type ConversationDetailScreenProps = {
  conversationId: string;
};

const TEAM_CONVERSATION_SYNC_INTERVAL_MS = 8_000;
const CONVERSATION_REPLAY_SCROLL_PX_PER_SECOND = 180;

export function ConversationDetailScreen({ conversationId }: ConversationDetailScreenProps) {
  const {
    conversations,
    conversationMessages,
    agents,
    codexModels,
    codexStatus,
    browserSessionStatus,
    selectedModel,
    selectedReasoningEffort,
    isConversationStreaming,
    setSelectedModel,
    setSelectedReasoningEffort,
    setConversationSandboxMode,
    setConversationWorkspaceDir,
    setConversationFeishuChatSessionId,
    isHydrated,
    isUploadingAttachments,
    stopMessage,
    errorMessage,
    refreshSnapshot,
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
  const [teamMentionState, setTeamMentionState] = useState<{
    projectId: string | null;
    options: ComposerMentionOption[];
  }>({
    projectId: null,
    options: [],
  });
  const [, setTeamProjectDetail] = useState<ProjectDetail | null>(null);
  const [isReplayActive, setIsReplayActive] = useState(false);
  const [isWorkspaceDialogOpen, setIsWorkspaceDialogOpen] = useState(false);
  const [isFeishuDialogOpen, setIsFeishuDialogOpen] = useState(false);
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);
  const replayFrameRef = useRef<number | null>(null);
  const replayLastTickRef = useRef<number | null>(null);
  const isCurrentConversationSending = isConversationStreaming(conversationId);
  const hasConversationMessages = Boolean(conversationMessages[conversationId]);
  const activeAgent = useMemo(
    () => agents.find((item) => item.id === activeConversation?.agentProfileId) || null,
    [activeConversation?.agentProfileId, agents],
  );
  const conversationMode = useMemo(
    () => (activeConversation ? resolveConversationMode(activeConversation) : "default"),
    [activeConversation],
  );
  const mentionOptions =
    conversationMode === "team" && activeConversation?.projectId === teamMentionState.projectId
      ? teamMentionState.options
      : [];
  const activeSandboxMode = activeConversation?.sandboxMode ?? "workspace-write";
  const canBindFeishuChatSession =
    conversationMode === "default" || conversationMode === "agent" || conversationMode === "team";
  const browserSessionPresentation = getBrowserSessionPresentation(browserSessionStatus);
  useEffect(() => {
    if (!activeConversation?.projectId) {
      return;
    }

    let cancelled = false;

    void getProjectDetailResource(activeConversation.projectId)
      .then((detail) => {
        if (cancelled) {
          return;
        }

        setTeamProjectDetail(detail);
        setTeamMentionState({
          projectId: activeConversation.projectId ?? null,
          options: detail.agents.map((agent) => ({
            id: agent.id,
            label: agent.name,
            description: agent.role,
          })),
        });
      })
      .catch(() => {
        if (!cancelled) {
          setTeamProjectDetail(null);
          setTeamMentionState({
            projectId: activeConversation.projectId ?? null,
            options: [],
          });
        }
      });

    return () => {
      cancelled = true;
    };
  }, [activeConversation?.projectId]);

  useEffect(() => {
    if (conversationMode !== "team" || !activeConversation?.projectId) {
      return;
    }

    const projectId = activeConversation.projectId;
    let cancelled = false;

    const intervalId = window.setInterval(() => {
      if (
        cancelled ||
        document.visibilityState !== "visible" ||
        isCurrentConversationSending ||
        isInteractiveInputFocused()
      ) {
        return;
      }

      void Promise.all([
        refreshSnapshot(),
        getProjectDetailResource(projectId),
      ])
        .then(([, detail]) => {
          if (!cancelled) {
            setTeamProjectDetail(detail);
          }
        })
        .catch(() => {
          // Keep team runtime polling quiet; the page already shows the last good state.
        });
    }, TEAM_CONVERSATION_SYNC_INTERVAL_MS);

    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
    };
  }, [activeConversation?.projectId, conversationMode, isCurrentConversationSending, refreshSnapshot]);

  useEffect(() => {
    return () => {
      if (replayFrameRef.current) {
        cancelAnimationFrame(replayFrameRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (!isReplayActive) {
      if (replayFrameRef.current) {
        cancelAnimationFrame(replayFrameRef.current);
        replayFrameRef.current = null;
      }
      replayLastTickRef.current = null;
      return;
    }

    const container = scrollContainerRef.current;

    if (!container) {
      return;
    }

    container.scrollTo({ top: 0 });

    const step = (timestamp: number) => {
      const currentContainer = scrollContainerRef.current;

      if (!currentContainer) {
        setIsReplayActive(false);
        replayFrameRef.current = null;
        replayLastTickRef.current = null;
        return;
      }

      const previousTick = replayLastTickRef.current ?? timestamp;
      const deltaMs = timestamp - previousTick;
      replayLastTickRef.current = timestamp;

      const nextScrollTop =
        currentContainer.scrollTop +
        (CONVERSATION_REPLAY_SCROLL_PX_PER_SECOND * deltaMs) / 1000;
      const maxScrollTop = currentContainer.scrollHeight - currentContainer.clientHeight;

      currentContainer.scrollTop = Math.min(nextScrollTop, maxScrollTop);

      if (currentContainer.scrollTop >= maxScrollTop - 2) {
        setIsReplayActive(false);
        replayFrameRef.current = null;
        replayLastTickRef.current = null;
        return;
      }

      replayFrameRef.current = window.requestAnimationFrame(step);
    };

    replayFrameRef.current = window.requestAnimationFrame(step);

    return () => {
      if (replayFrameRef.current) {
        cancelAnimationFrame(replayFrameRef.current);
        replayFrameRef.current = null;
      }
      replayLastTickRef.current = null;
    };
  }, [isReplayActive]);

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

  function handleToggleReplay() {
    setIsReplayActive((current) => !current);
  }

  async function handleSaveWorkspace(nextWorkspaceDir: string | null) {
    if (!activeConversation) {
      return;
    }

    if (conversationMode === "team" && activeConversation.projectId) {
      const detail = await updateProjectWorkspaceDirResource(
        activeConversation.projectId,
        nextWorkspaceDir || "",
      );
      setTeamProjectDetail(detail);
      await refreshSnapshot();
      return;
    }

    await setConversationWorkspaceDir(conversationId, nextWorkspaceDir);
  }

  async function handleSaveSandboxMode(nextSandboxMode: CodexSandboxMode) {
    if (!activeConversation) {
      return;
    }

    if (conversationMode === "team" && activeConversation.projectId) {
      const detail = await updateProjectSandboxModeResource(
        activeConversation.projectId,
        nextSandboxMode,
      );
      setTeamProjectDetail(detail);
      await refreshSnapshot();
      return;
    }

    await setConversationSandboxMode(conversationId, nextSandboxMode);
  }

  async function handleSaveFeishuChatSessionId(nextFeishuChatSessionId: string | null) {
    if (!activeConversation) {
      return;
    }

    if (conversationMode === "team" && activeConversation.projectId) {
      const detail = await updateProjectFeishuChatSessionIdResource(
        activeConversation.projectId,
        nextFeishuChatSessionId,
      );
      setTeamProjectDetail(detail);
      await refreshSnapshot();
      return;
    }

    await setConversationFeishuChatSessionId(conversationId, nextFeishuChatSessionId);
  }

  return (
    <div className="flex min-h-screen flex-col lg:h-full lg:min-h-0">
      <div className="shrink-0 border-b border-line bg-background px-5 py-3 lg:px-6">
        <div className="mx-auto w-full max-w-[1180px]">
          <div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
            <div className="min-w-0">
              <h1 className="truncate text-[20px] font-semibold tracking-[-0.03em] text-text lg:text-[22px]">
                {activeConversation.title}
              </h1>
            </div>
            <div className="flex shrink-0 flex-wrap items-center gap-1.5">
              {canBindFeishuChatSession ? (
                <ActionPillButton
                  onClick={() => setIsFeishuDialogOpen(true)}
                  tone={activeConversation.feishuChatSessionId ? "active" : "default"}
                >
                  {activeConversation.feishuChatSessionId ? "飞书已绑定" : "绑定飞书"}
                </ActionPillButton>
              ) : null}
              <ActionPillButton
                onClick={handleToggleReplay}
                tone={isReplayActive ? "active" : "default"}
              >
                {isReplayActive ? "停止回放" : "回放"}
              </ActionPillButton>
              {conversationMode === "team" ? (
                <ActionPillLink href={`/projects/${activeConversation.projectId}`}>
                  返回 Team Room
                </ActionPillLink>
              ) : null}
              {conversationMode === "agent" && activeAgent ? (
                <ActionPillLink href={`/agents/${activeAgent.id}`}>
                  查看智能体配置
                </ActionPillLink>
              ) : null}
            </div>
          </div>
        </div>
      </div>
      <div
        ref={scrollContainerRef}
        className="min-h-0 flex-1 overflow-y-auto"
        onWheel={() => {
          if (isReplayActive) {
            setIsReplayActive(false);
          }
        }}
        onTouchStart={() => {
          if (isReplayActive) {
            setIsReplayActive(false);
          }
        }}
      >
        <ConversationThread conversationId={conversationId} />
      </div>
      <div className="shrink-0 border-t border-line bg-background px-4 py-2.5 lg:px-6">
        <div className="mx-auto w-full max-w-[1180px] space-y-2">
          {isCurrentConversationSending ? (
            <p className="text-[13px] text-muted-strong">OpenCrab 正在整理回复...</p>
          ) : null}
          <div className="flex flex-wrap gap-1.5 text-[11px] text-muted-strong">
            {conversationMode === "default" ? (
              <ModeStatusPill>普通对话</ModeStatusPill>
            ) : null}
            {conversationMode === "team" ? (
              <ModeStatusPill>团队群聊</ModeStatusPill>
            ) : null}
            {conversationMode === "channel" || conversationMode === "task" ? (
              <>
                <ModeStatusPill>
                  {getConversationModeLabel(conversationMode, activeConversation.source)}
                </ModeStatusPill>
                <StatusMetaPill>
                  {activeConversation.source === "task"
                    ? activeConversation.remoteUserLabel || activeConversation.title
                    : activeConversation.remoteUserLabel ||
                      activeConversation.remoteChatLabel ||
                      "远程会话"}
                </StatusMetaPill>
              </>
            ) : null}
            {conversationMode === "agent" && activeAgent ? (
              <>
                <ModeStatusPill>智能体单聊</ModeStatusPill>
                <StatusMetaPill>{activeAgent.name}</StatusMetaPill>
                <StatusMetaPill>{activeAgent.roleLabel}</StatusMetaPill>
              </>
            ) : null}
            {canBindFeishuChatSession && activeConversation.feishuChatSessionId ? (
              <StatusMetaPill>飞书会话：{activeConversation.feishuChatSessionId}</StatusMetaPill>
            ) : null}
            <StatusMetaPill>
              当前发送权限：{formatSandboxModeLabel(activeSandboxMode)}
            </StatusMetaPill>
            <StatusMetaPill>
              当前发送模型：{selectedModel}
            </StatusMetaPill>
            <StatusMetaPill>
              当前推理强度：{formatReasoningEffortLabel(selectedReasoningEffort)}
            </StatusMetaPill>
            <StatusMetaPill>
              浏览器连接：{formatBrowserSessionLabel(browserSessionStatus)}
            </StatusMetaPill>
          </div>
          {codexStatus?.ok === false ? (
            <p className="text-[13px] text-[#a34942]">
              先连接 ChatGPT，OpenCrab 才能继续发送和回复这条对话。
            </p>
          ) : null}
          {browserSessionStatus && !browserSessionStatus.ok ? (
            <p className="text-[13px] text-muted-strong">
              浏览器控制暂未就绪：{browserSessionPresentation.detail}
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
            workspaceLabel={activeConversation.workspaceDir?.trim() || "默认工作区"}
            workspaceTitle={
              activeConversation.workspaceDir?.trim() ||
              "默认：~/.opencrab/workspaces/conversations/<conversationId>"
            }
            onWorkspaceClick={() => setIsWorkspaceDialogOpen(true)}
            selectedSandboxMode={activeSandboxMode}
            onSandboxModeChange={handleSaveSandboxMode}
            mentionOptions={mentionOptions}
            compact
          />
        </div>
      </div>
      {isWorkspaceDialogOpen ? (
        <WorkspacePickerDialog
          title={conversationMode === "team" ? "更新 Team 工作区" : "修改对话工作区"}
          description={
            conversationMode === "team"
              ? "这里会同步更新整个 Team 的默认写入目录。已经产生的历史产物不会被搬迁，后续运行会基于新目录继续。"
              : "这里是这条对话的默认写入目录。留空时会恢复到 ~/.opencrab/workspaces/conversations/<conversationId>。"
          }
          initialValue={activeConversation.workspaceDir ?? null}
          allowEmpty={conversationMode !== "team"}
          defaultHint="~/.opencrab/workspaces/conversations/<conversationId>"
          confirmLabel={conversationMode === "team" ? "更新工作区" : "保存工作区"}
          onClose={() => setIsWorkspaceDialogOpen(false)}
          onConfirm={handleSaveWorkspace}
        />
      ) : null}
      {isFeishuDialogOpen ? (
        <FeishuChatSessionDialog
          title={conversationMode === "team" ? "绑定 Team 飞书群聊" : "绑定飞书群聊"}
          description={
            conversationMode === "team"
              ? "这里会把当前 Team 群聊绑定到一个飞书群聊会话 ID。保存后，同一个飞书群聊发来的消息会继续回到这条 Team 群聊。"
              : "这里会把当前对话绑定到一个飞书群聊会话 ID。保存后，同一个飞书群聊发来的消息会继续回到这条对话。"
          }
          initialValue={activeConversation.feishuChatSessionId ?? null}
          placeholder="oc_team_room_001"
          clearLabel="清空绑定"
          confirmLabel="保存绑定"
          onClose={() => setIsFeishuDialogOpen(false)}
          onConfirm={handleSaveFeishuChatSessionId}
        />
      ) : null}
    </div>
  );
}

function resolveConversationMode(conversation: ConversationItem) {
  if (conversation.projectId) {
    return "team" as const;
  }

  if (conversation.source === "telegram" || conversation.source === "feishu") {
    return "channel" as const;
  }

  if (conversation.source === "task") {
    return "task" as const;
  }

  if (conversation.agentProfileId) {
    return "agent" as const;
  }

  return "default" as const;
}

function getConversationModeLabel(
  mode: "channel" | "task",
  source: "telegram" | "feishu" | "task" | "local" | null | undefined,
) {
  if (mode === "task") {
    return "定时任务对话";
  }

  if (source === "telegram") {
    return "Telegram 对话";
  }

  return "飞书对话";
}

const PILL_BASE_CLASS_NAME =
  "inline-flex h-7 items-center justify-center rounded-full border px-2.5 py-1 text-[11px] font-medium leading-none [font:inherit]";

function ActionPillButton({
  children,
  tone = "default",
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  children: React.ReactNode;
  tone?: "default" | "active";
}) {
  const className =
    tone === "active"
      ? "border-[#d7e4ff] bg-[#eef4ff] text-[#2d56a3] hover:border-[#bfd3ff] hover:bg-[#e6efff]"
      : "border-line bg-surface text-muted-strong hover:bg-surface-muted hover:text-text";

  return (
    <button
      type="button"
      className={`${PILL_BASE_CLASS_NAME} appearance-none transition ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}

function ActionPillLink({
  href,
  children,
}: {
  href: string;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className={`${PILL_BASE_CLASS_NAME} border-line bg-surface text-muted-strong transition hover:bg-surface-muted hover:text-text`}
    >
      {children}
    </Link>
  );
}

function StatusMetaPill({ children }: { children: React.ReactNode }) {
  return <UnifiedMetaPill size="sm">{children}</UnifiedMetaPill>;
}

function ModeStatusPill({
  children,
}: {
  children: React.ReactNode;
}) {
  return <UnifiedMetaPill size="sm">{children}</UnifiedMetaPill>;
}

function isInteractiveInputFocused() {
  if (typeof document === "undefined") {
    return false;
  }

  const activeElement = document.activeElement;

  if (!activeElement) {
    return false;
  }

  if (activeElement instanceof HTMLInputElement || activeElement instanceof HTMLTextAreaElement) {
    return true;
  }

  if (activeElement instanceof HTMLSelectElement) {
    return true;
  }

  return activeElement instanceof HTMLElement && activeElement.isContentEditable;
}
