"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { Composer, type ComposerMentionOption } from "@/components/composer/composer";
import { useOpenCrabApp } from "@/components/app-shell/opencrab-provider";
import { ConversationThread } from "@/components/conversation/conversation-thread";
import { MetaPill as UnifiedMetaPill } from "@/components/ui/pill";
import {
  formatBrowserSessionLabel,
  formatReasoningEffortLabel,
  formatSandboxModeLabel,
} from "@/lib/opencrab/labels";
import { usePersistedDraft } from "@/lib/opencrab/use-persisted-draft";
import type { ProjectDetail } from "@/lib/projects/types";
import { getProjectDetail as getProjectDetailResource } from "@/lib/resources/opencrab-api";
import type { UploadedAttachment } from "@/lib/resources/opencrab-api-types";
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
    selectedSandboxMode,
    isConversationStreaming,
    setSelectedModel,
    setSelectedReasoningEffort,
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
  const [teamProjectDetail, setTeamProjectDetail] = useState<ProjectDetail | null>(null);
  const [isReplayActive, setIsReplayActive] = useState(false);
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
  const visibleTeamProjectDetail =
    teamProjectDetail?.project?.id === activeConversation?.projectId ? teamProjectDetail : null;
  const teamProject = visibleTeamProjectDetail?.project ?? null;
  const teamOpenMailboxThreadCount = useMemo(
    () => visibleTeamProjectDetail?.mailboxThreads.filter((thread) => thread.status === "open").length ?? 0,
    [visibleTeamProjectDetail?.mailboxThreads],
  );
  const teamPendingHumanReviewSuggestionCount = useMemo(
    () =>
      visibleTeamProjectDetail?.learningSuggestions.filter(
        (suggestion) => suggestion.requiresHumanReview && suggestion.status === "open",
      ).length ?? 0,
    [visibleTeamProjectDetail?.learningSuggestions],
  );
  const teamPendingLearningReuseCandidateCount = useMemo(
    () =>
      visibleTeamProjectDetail?.learningReuseCandidates.filter(
        (candidate) => candidate.sourceProjectId === activeConversation?.projectId && candidate.status === "pending_review",
      ).length ?? 0,
    [activeConversation?.projectId, visibleTeamProjectDetail?.learningReuseCandidates],
  );
  const teamPrimarySuggestion = useMemo(
    () =>
      visibleTeamProjectDetail?.learningSuggestions.find(
        (suggestion) => suggestion.requiresHumanReview && suggestion.status === "open",
      ) ??
      visibleTeamProjectDetail?.learningSuggestions.find((suggestion) => suggestion.status === "open") ??
      null,
    [visibleTeamProjectDetail?.learningSuggestions],
  );
  const teamConversationSummary = useMemo(() => {
    if (!teamProject) {
      return null;
    }

    return buildTeamConversationSummary(teamProject, {
      pendingHumanReviewSuggestionCount: teamPendingHumanReviewSuggestionCount,
      pendingLearningReuseCandidateCount: teamPendingLearningReuseCandidateCount,
      openMailboxThreadCount: teamOpenMailboxThreadCount,
      primarySuggestionTitle: teamPrimarySuggestion?.title ?? null,
    });
  }, [
    teamPendingLearningReuseCandidateCount,
    teamOpenMailboxThreadCount,
    teamPendingHumanReviewSuggestionCount,
    teamPrimarySuggestion?.title,
    teamProject,
  ]);

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
          {conversationMode === "team" && teamProject && teamConversationSummary ? (
            <div className="mt-3 rounded-[18px] border border-line bg-surface px-4 py-3">
              <div className="flex flex-wrap gap-1.5 text-[11px] text-muted-strong">
                <StatusMetaPill>运行状态：{formatTeamProjectStatus(teamProject.runStatus)}</StatusMetaPill>
                <StatusMetaPill>{teamProject.memberCount} 位成员</StatusMetaPill>
                <StatusMetaPill>{teamConversationSummary.headline}</StatusMetaPill>
                {teamPendingHumanReviewSuggestionCount > 0 ? (
                  <StatusMetaPill>{teamPendingHumanReviewSuggestionCount} 条待人审建议</StatusMetaPill>
                ) : null}
                {teamPendingLearningReuseCandidateCount > 0 ? (
                  <StatusMetaPill>{teamPendingLearningReuseCandidateCount} 条待确认复用候选</StatusMetaPill>
                ) : null}
                {teamOpenMailboxThreadCount > 0 ? (
                  <StatusMetaPill>{teamOpenMailboxThreadCount} 条待处理线程</StatusMetaPill>
                ) : null}
              </div>
              <p className="mt-2 text-[13px] leading-6 text-muted-strong">{teamConversationSummary.summary}</p>
            </div>
          ) : null}
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
            <StatusMetaPill>
              当前发送权限：{formatSandboxModeLabel(selectedSandboxMode)}
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
            mentionOptions={mentionOptions}
            compact
          />
        </div>
      </div>
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

function formatTeamProjectStatus(status: NonNullable<ProjectDetail["project"]>["runStatus"]) {
  switch (status) {
    case "running":
      return "运行中";
    case "paused":
      return "已暂停";
    case "waiting_approval":
      return "待确认";
    case "waiting_user":
      return "待补充";
    case "completed":
      return "已完成";
    default:
      return "准备中";
  }
}

function buildTeamConversationSummary(
  project: NonNullable<ProjectDetail["project"]>,
  input: {
    pendingHumanReviewSuggestionCount: number;
    pendingLearningReuseCandidateCount: number;
    openMailboxThreadCount: number;
    primarySuggestionTitle: string | null;
  },
) {
  switch (project.runStatus) {
    case "waiting_approval":
      return {
        headline: project.openGateCount ? "当前停在自治 Gate" : "当前停在确认检查点",
        summary: project.openGateCount
          ? project.latestGateSummary ||
            "团队已经命中当前自治边界，继续前需要你先放行或改方向。"
          : project.summary || "团队已经交回阶段结果，当前更适合先回 Team Room 处理确认或补充。",
      };
    case "waiting_user":
      return {
        headline: "当前停在补充检查点",
        summary:
          project.latestUserRequest ||
          "团队正在等待新的方向、边界或验收标准。补充后再继续推进，会比继续翻群聊更高效。",
      };
    case "running":
      return {
        headline: project.latestRunStepLabel || project.activeTaskTitle || "团队正在推进",
        summary:
          project.latestRecoverySummary ||
          (input.pendingHumanReviewSuggestionCount > 0
            ? `当前已有 ${input.pendingHumanReviewSuggestionCount} 条建议进入待人审边界，等这一轮稍微收口后就可以回 Team Room 处理。`
            : input.pendingLearningReuseCandidateCount > 0
              ? `当前已有 ${input.pendingLearningReuseCandidateCount} 条跨项目复用候选等待确认，回 Team Room 可以直接决定它们是否进入候选库。`
            : "这里主要作为 frontstage 入口；想判断团队为什么这样推进，回 Team Room 看 Runtime Health 和 Learning Loop 会更清楚。"),
      };
    case "completed":
      return {
        headline: "本轮已完成收口",
        summary:
          input.primarySuggestionTitle
            ? `这轮已经沉淀出“${input.primarySuggestionTitle}”等后续建议。群聊更适合继续提新目标，回 Team Room 更适合看最终结果和建议收口。`
            : "这一轮已经完成最终整理。群聊适合开启下一轮，Team Room 更适合回看结果、运行记录和交付物。",
      };
    case "paused":
      return {
        headline: "团队当前已暂停",
        summary:
          project.latestRecoverySummary ||
          "暂停会保留当前上下文和分工状态。恢复前，建议先回 Team Room 看最近恢复动作和待处理线程。",
      };
    default:
      return {
        headline: "团队尚未开始运行",
        summary:
          input.openMailboxThreadCount > 0
            ? `当前已有 ${input.openMailboxThreadCount} 条协作线程，但团队还没有正式开始这轮运行。`
            : "这里已经是团队群聊入口，但还没进入正式推进状态。可以直接发新要求，也可以回 Team Room 先确认分工和目标。",
      };
  }
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
