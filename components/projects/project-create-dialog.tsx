"use client";

import { useDeferredValue, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useOpenCrabApp } from "@/components/app-shell/opencrab-provider";
import {
  DialogHeader,
  DialogPrimaryButton,
  DialogSecondaryButton,
  DialogShell,
} from "@/components/ui/dialog";
import { buttonClassName } from "@/components/ui/button";
import { MetaPill } from "@/components/ui/pill";
import { isSelectableTeamAgent } from "@/lib/agents/display";
import type { AgentProfileRecord } from "@/lib/agents/types";
import {
  createProject as createProjectResource,
  pickLocalDirectory,
  planProject as planProjectResource,
} from "@/lib/resources/opencrab-api";
import {
  formatProjectGoalFromBrief,
  type ProjectPlanningAnswerValue,
  type ProjectPlanningAnswers,
  type ProjectPlanningBrief,
  type ProjectPlanningCapabilityGap,
  type ProjectPlanningQuestion,
  type ProjectPlanningResult,
} from "@/lib/projects/project-planning";

type ProjectCreateDialogProps = {
  isOpen: boolean;
  onClose: () => void;
};

type CreationStep = "goal" | "clarify" | "agents" | "launch";
type PlanningPendingPhase = "clarify" | "recommend" | null;

type PlanningConversationMessage = {
  id: string;
  role: "assistant" | "user";
  title: string;
  body: string;
  pending?: boolean;
  questions?: ProjectPlanningQuestion[];
};

type AgentLibraryCollection = {
  id: string;
  label: string;
  description: string;
  groups: AgentLibraryGroup[];
};

type AgentLibraryGroup = {
  id: string;
  label: string;
  description: string;
  agents: AgentProfileRecord[];
};

export function ProjectCreateDialog({ isOpen, onClose }: ProjectCreateDialogProps) {
  const router = useRouter();
  const { agents, selectedModel, selectedReasoningEffort } = useOpenCrabApp();
  const [activeStep, setActiveStep] = useState<CreationStep>("goal");
  const [rawIntent, setRawIntent] = useState("");
  const [workspaceDir, setWorkspaceDir] = useState("");
  const [clarifyPlan, setClarifyPlan] = useState<ProjectPlanningResult | null>(null);
  const [teamPlan, setTeamPlan] = useState<ProjectPlanningResult | null>(null);
  const [answers, setAnswers] = useState<ProjectPlanningAnswers>({});
  const [draftAnswers, setDraftAnswers] = useState<Record<string, ProjectPlanningAnswerValue>>({});
  const [conversationMessages, setConversationMessages] = useState<PlanningConversationMessage[]>([]);
  const [selectedAgentIds, setSelectedAgentIds] = useState<string[]>([]);
  const [agentQuery, setAgentQuery] = useState("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [pendingPhase, setPendingPhase] = useState<PlanningPendingPhase>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isPickingWorkspace, setIsPickingWorkspace] = useState(false);

  const deferredAgentQuery = useDeferredValue(agentQuery);
  const isPlanning = pendingPhase !== null;
  const closeDisabled = isPlanning || isSubmitting;

  const teamAgents = useMemo(
    () => agents.filter(isSelectableTeamAgent),
    [agents],
  );
  const agentsById = useMemo(
    () => new Map(teamAgents.map((agent) => [agent.id, agent] as const)),
    [teamAgents],
  );
  const validTeamAgentIds = useMemo(
    () => new Set(teamAgents.map((agent) => agent.id)),
    [teamAgents],
  );
  const clarifyReady = Boolean(clarifyPlan && clarifyPlan.questions.length === 0);
  const effectivePlan = teamPlan ?? clarifyPlan;

  const requiredAgentIds = useMemo(
    () =>
      teamPlan?.recommendedAgents
        .filter((item) => item.priority === "required" && validTeamAgentIds.has(item.agentId))
        .map((item) => item.agentId) ?? [],
    [teamPlan?.recommendedAgents, validTeamAgentIds],
  );
  const optionalRecommendations = useMemo(
    () =>
      teamPlan?.recommendedAgents.filter(
        (item) => item.priority === "optional" && validTeamAgentIds.has(item.agentId),
      ) ?? [],
    [teamPlan?.recommendedAgents, validTeamAgentIds],
  );
  const gapSuggestedAgentIds = useMemo(() => {
    const blockedIds = new Set([
      ...requiredAgentIds,
      ...optionalRecommendations.map((item) => item.agentId),
    ]);

    return Array.from(
      new Set(
        teamPlan?.capabilityGaps
          .flatMap((gap) => gap.suggestedAgentIds)
          .filter((agentId) => validTeamAgentIds.has(agentId) && !blockedIds.has(agentId)) ?? [],
      ),
    );
  }, [optionalRecommendations, requiredAgentIds, teamPlan?.capabilityGaps, validTeamAgentIds]);
  const gapSuggestedAgents = useMemo(
    () =>
      gapSuggestedAgentIds
        .map((agentId) => agentsById.get(agentId))
        .filter((agent): agent is AgentProfileRecord => Boolean(agent)),
    [agentsById, gapSuggestedAgentIds],
  );
  const otherManualAgents = useMemo(() => {
    const blockedIds = new Set([
      ...requiredAgentIds,
      ...optionalRecommendations.map((item) => item.agentId),
      ...gapSuggestedAgentIds,
    ]);

    return teamAgents.filter((agent) => !blockedIds.has(agent.id));
  }, [gapSuggestedAgentIds, optionalRecommendations, requiredAgentIds, teamAgents]);
  const agentLibraryCollections = useMemo(
    () => buildAgentLibraryCollections(otherManualAgents, deferredAgentQuery),
    [deferredAgentQuery, otherManualAgents],
  );
  const selectedAgentRecords = useMemo(
    () =>
      selectedAgentIds
        .map((agentId) => agentsById.get(agentId))
        .filter((agent): agent is AgentProfileRecord => Boolean(agent)),
    [agentsById, selectedAgentIds],
  );

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    setActiveStep("goal");
    setRawIntent("");
    setWorkspaceDir("");
    setClarifyPlan(null);
    setTeamPlan(null);
    setAnswers({});
    setDraftAnswers({});
    setConversationMessages([]);
    setSelectedAgentIds([]);
    setAgentQuery("");
    setErrorMessage(null);
    setPendingPhase(null);
    setIsSubmitting(false);
    setIsPickingWorkspace(false);
  }, [isOpen]);

  useEffect(() => {
    setSelectedAgentIds((current) => {
      const preservedManualIds = current.filter(
        (agentId) => validTeamAgentIds.has(agentId) && !requiredAgentIds.includes(agentId),
      );

      return Array.from(new Set([...requiredAgentIds, ...preservedManualIds]));
    });
  }, [requiredAgentIds, validTeamAgentIds]);

  if (!isOpen) {
    return null;
  }

  async function requestClarifyPlan(nextAnswers: ProjectPlanningAnswers, pendingBody: string) {
    const trimmedIntent = rawIntent.trim();

    if (!trimmedIntent) {
      setErrorMessage("请先写下你现在想推进的事情。");
      return;
    }

    const pendingId = createLocalId();

    setPendingPhase("clarify");
    setErrorMessage(null);
    setConversationMessages((current) => [
      ...current,
      {
        id: pendingId,
        role: "assistant",
        title: "规划 Agent",
        body: pendingBody,
        pending: true,
      },
    ]);

    try {
      const response = await planProjectResource({
        mode: "clarify",
        rawIntent: trimmedIntent,
        answers: nextAnswers,
        model: selectedModel,
        reasoningEffort: selectedReasoningEffort,
      });
      const nextPlan = response.plan;

      setClarifyPlan(nextPlan);
      setTeamPlan(null);
      setAnswers(nextAnswers);
      setDraftAnswers(buildDraftAnswers(nextPlan.questions, nextAnswers));
      setConversationMessages((current) =>
        replaceConversationMessage(current, pendingId, buildAssistantClarifyMessage(nextPlan)),
      );
    } catch (error) {
      setConversationMessages((current) =>
        replaceConversationMessage(current, pendingId, {
          id: pendingId,
          role: "assistant",
          title: "规划 Agent",
          body: "这一轮需求梳理失败了，你可以直接重试。",
        }),
      );
      setErrorMessage(error instanceof Error ? error.message : "生成任务草案失败。");
    } finally {
      setPendingPhase(null);
    }
  }

  async function requestRecommendationPlan(seedPlan: ProjectPlanningResult) {
    const trimmedIntent = rawIntent.trim();

    if (!trimmedIntent) {
      setErrorMessage("请先写下你现在想推进的事情。");
      return;
    }

    setPendingPhase("recommend");
    setErrorMessage(null);

    try {
      const response = await planProjectResource({
        mode: "recommend",
        rawIntent: trimmedIntent,
        answers,
        brief: seedPlan.brief,
        model: selectedModel,
        reasoningEffort: selectedReasoningEffort,
      });
      const nextPlan = response.plan;

      setTeamPlan(nextPlan);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "生成 Agent 推荐失败。");
    } finally {
      setPendingPhase(null);
    }
  }

  function resetPlanningArtifacts() {
    setClarifyPlan(null);
    setTeamPlan(null);
    setAnswers({});
    setDraftAnswers({});
    setConversationMessages([]);
    setSelectedAgentIds([]);
    setAgentQuery("");
    setErrorMessage(null);
  }

  function handleIntentChange(value: string) {
    setRawIntent(value);
    resetPlanningArtifacts();
    setActiveStep("goal");
  }

  function handleStartClarify() {
    const trimmedIntent = rawIntent.trim();

    if (!trimmedIntent) {
      setErrorMessage("请先写下你现在想推进的事情。");
      return;
    }

    resetPlanningArtifacts();
    setActiveStep("clarify");
    setConversationMessages([
      {
        id: createLocalId(),
        role: "user",
        title: "你的目标",
        body: trimmedIntent,
      },
    ]);
    void requestClarifyPlan({}, "我先把你的目标拆成可以继续追问的问题。");
  }

  function handleSubmitClarifyRound() {
    if (!clarifyPlan || clarifyPlan.questions.length === 0) {
      return;
    }

    const roundAnswers = collectAnswersFromQuestions(clarifyPlan.questions, draftAnswers);

    if (!roundAnswers) {
      setErrorMessage("先把这一轮的问题补完整，我们再继续往下走。");
      return;
    }

    const nextAnswers = mergePlanningAnswers(answers, roundAnswers);

    if (!nextAnswers) {
      setErrorMessage("先把这一轮的问题补完整，我们再继续往下走。");
      return;
    }

    setConversationMessages((current) => [
      ...current,
      {
        id: createLocalId(),
        role: "user",
        title: "你的补充",
        body: summarizeReply(clarifyPlan.questions, roundAnswers),
      },
    ]);
    void requestClarifyPlan(nextAnswers, "收到，我继续把需求收束到能进入配队的程度。");
  }

  function handleMoveToAgents() {
    if (!clarifyPlan || clarifyPlan.questions.length > 0) {
      setErrorMessage("先把需求澄清到稳定版本，再进入 Agent 推荐。");
      return;
    }

    setActiveStep("agents");

    if (!teamPlan) {
      void requestRecommendationPlan(clarifyPlan);
    }
  }

  function handleMoveToLaunch() {
    if (!teamPlan) {
      setErrorMessage("先生成 Agent 推荐，再确认成员与工作区。");
      return;
    }

    if (teamPlan.launchReadiness === "need_agents") {
      setErrorMessage("当前还缺关键 Agent，建议先补齐成员后再启动。");
      return;
    }

    setActiveStep("launch");
  }

  function handleRetryClarify() {
    void requestClarifyPlan(answers, "我继续梳理这条需求。");
  }

  function handleRetryRecommendation() {
    if (!clarifyPlan) {
      setErrorMessage("先把需求澄清到稳定版本，再进入 Agent 推荐。");
      return;
    }

    void requestRecommendationPlan(clarifyPlan);
  }

  async function handleCreateProject() {
    const trimmedIntent = rawIntent.trim();
    const planForCreate = teamPlan ?? clarifyPlan;
    const normalizedSelectedAgentIds = Array.from(
      new Set(selectedAgentIds.filter((agentId) => validTeamAgentIds.has(agentId))),
    );

    if (!trimmedIntent) {
      setErrorMessage("请先写下你现在想推进的事情。");
      return;
    }

    if (!planForCreate) {
      setErrorMessage("先完成需求澄清和 Agent 选择，再启动团队。");
      return;
    }

    if (planForCreate.launchReadiness === "need_agents") {
      setErrorMessage("当前还缺关键 Agent，建议先补齐成员后再启动。");
      return;
    }

    if (!workspaceDir.trim()) {
      setErrorMessage("请先指定这个团队的工作空间目录。");
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      const response = await createProjectResource({
        goal: formatProjectGoalFromBrief(planForCreate.brief),
        workspaceDir: workspaceDir.trim(),
        agentProfileIds: normalizedSelectedAgentIds,
        planningSnapshot: {
          rawIntent: trimmedIntent,
          answers,
          plannerSummary: planForCreate.plannerSummary,
          brief: planForCreate.brief,
          recommendedAgents: planForCreate.recommendedAgents,
          capabilityGaps: planForCreate.capabilityGaps,
          launchReadiness: planForCreate.launchReadiness,
          createdAt: new Date().toISOString(),
        },
        model: selectedModel,
        reasoningEffort: selectedReasoningEffort,
      });
      const nextProjectId = response.project?.id;

      if (!nextProjectId) {
        throw new Error("创建团队失败。");
      }

      onClose();
      router.push(`/projects/${nextProjectId}`);
      router.refresh();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "创建团队失败。");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handlePickWorkspace() {
    setIsPickingWorkspace(true);
    setErrorMessage(null);

    try {
      const result = await pickLocalDirectory({
        title: "为 Team 选择工作区目录",
        defaultPath: workspaceDir || undefined,
      });

      if (result.path) {
        setWorkspaceDir(result.path);
      }
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "打开目录选择器失败。");
    } finally {
      setIsPickingWorkspace(false);
    }
  }

  function handleGoToAgents() {
    onClose();
    router.push("/agents");
  }

  function handleGoBack() {
    if (activeStep === "launch") {
      setActiveStep("agents");
      return;
    }

    if (activeStep === "agents") {
      setActiveStep("clarify");
      return;
    }

    if (activeStep === "clarify") {
      setActiveStep("goal");
      return;
    }

    onClose();
  }

  function toggleAgentSelection(agentId: string) {
    if (!validTeamAgentIds.has(agentId)) {
      return;
    }

    setSelectedAgentIds((current) =>
      current.includes(agentId)
        ? current.filter((item) => item !== agentId)
        : [...current, agentId],
    );
  }

  const launchLabel =
    effectivePlan?.launchReadiness === "explore_only" ? "启动探索团队" : "启动团队";

  return (
    <DialogShell
      onClose={() => (closeDisabled ? null : onClose())}
      panelClassName="flex max-h-[min(920px,calc(100dvh-2rem))] max-w-[1160px] flex-col overflow-hidden p-0"
    >
      <div className="flex min-h-0 flex-1 flex-col">
        <div className="shrink-0 border-b border-line px-6 py-5">
          <DialogHeader
            title="新建团队"
            description={getStepDescription(activeStep)}
          />

          <div className="mt-5 flex flex-wrap items-center gap-2 text-[12px] text-muted-strong">
            <MetaPill>系统 PM 默认加入</MetaPill>
            <MetaPill>{teamAgents.length} 个可协作 Agent</MetaPill>
          </div>

          <PlanningStepRail activeStep={activeStep} />
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-6 py-6">
          {activeStep === "goal" ? (
            <div className="grid gap-6 lg:grid-cols-[1.05fr_0.95fr]">
              <section className="rounded-[24px] border border-line bg-background p-5">
                <div className="max-w-[620px]">
                  <div className="text-[13px] font-medium text-text">Step 1 / 输入目标</div>
                  <h3 className="mt-2 text-[24px] font-semibold tracking-[-0.04em] text-text">
                    先写下你现在想推进什么事
                  </h3>
                  <p className="mt-3 text-[14px] leading-7 text-muted-strong">
                    不需要一开始就写成 PRD。先把目标讲个大概，规划 Agent 会在下一步用对话方式帮你收束。
                  </p>
                </div>

                <textarea
                  value={rawIntent}
                  onChange={(event) => handleIntentChange(event.target.value)}
                  rows={9}
                  placeholder="例如：我想在 X 和小红书上推广 OpenCrab，但还没想清楚这轮应该先做品牌、拉新，还是先打个人影响力。"
                  className="mt-5 w-full rounded-[22px] border border-line bg-surface px-5 py-4 text-[15px] leading-8 text-text outline-none transition focus:border-text"
                />

                <div className="mt-5 grid gap-3 sm:grid-cols-2">
                  <HintCard
                    title="适合直接写的方式"
                    body="我想推进什么、现在最不确定什么、这轮大概想拿到什么结果。"
                  />
                  <HintCard
                    title="不需要现在决定"
                    body="暂时不用先想清楚要拉哪些 Agent，也不用一开始就填工作目录。"
                  />
                </div>
              </section>

              <section className="rounded-[24px] border border-line bg-background p-5">
                <div className="text-[13px] font-medium text-text">接下来会怎么走</div>
                <div className="mt-5 space-y-4">
                  <FlowPreviewCard
                    step="Step 2"
                    title="对话式澄清需求"
                    body="规划 Agent 先问 1 到 4 个关键问题。每一轮只问必要信息，直到最终 brief 稳定。"
                  />
                  <FlowPreviewCard
                    step="Step 3"
                    title="推荐最小可行团队"
                    body="只在需求收束后再做配队，并把候选 Agent 按类别整理，而不是完全平铺。"
                  />
                  <FlowPreviewCard
                    step="Step 4"
                    title="确认成员与工作区"
                    body="最后只做一件事：确认加入谁、默认工作目录在哪，然后启动团队。"
                  />
                </div>
              </section>
            </div>
          ) : null}

          {activeStep === "clarify" ? (
            <div className="grid gap-6 lg:grid-cols-[minmax(0,1.05fr)_340px]">
              <section className="space-y-4">
                <div className="rounded-[24px] border border-line bg-background p-5">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <div className="text-[13px] font-medium text-text">Step 2 / 澄清需求</div>
                      <p className="mt-2 text-[14px] leading-7 text-muted-strong">
                        这里用多轮对话把目标、交付物和边界收束清楚。只有需求稳定后，才进入 Agent 推荐。
                      </p>
                    </div>
                    <MetaPill>{conversationMessages.length} 条对话</MetaPill>
                  </div>

                  <div className="mt-5 space-y-3">
                    {conversationMessages.map((message) => (
                      <ConversationBubble key={message.id} message={message} />
                    ))}
                  </div>
                </div>

                {clarifyPlan?.questions.length ? (
                  <div className="rounded-[24px] border border-line bg-background p-5">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-[18px] font-semibold tracking-[-0.03em] text-text">
                        回答这一轮问题
                      </h3>
                      <MetaPill>{clarifyPlan.questions.length} 个关键问题</MetaPill>
                    </div>
                    <div className="mt-4 space-y-3">
                      {clarifyPlan.questions.map((question) => (
                        <PlanningQuestionField
                          key={question.id}
                          question={question}
                          value={draftAnswers[question.id]}
                          onChange={(value) =>
                            setDraftAnswers((current) => ({
                              ...current,
                              [question.id]: value,
                            }))
                          }
                        />
                      ))}
                    </div>
                  </div>
                ) : clarifyPlan ? (
                  <div className="rounded-[24px] border border-[#d7e4ff] bg-[#f6f9ff] px-5 py-5">
                    <div className="text-[16px] font-semibold text-text">需求已经收束到可进入配队</div>
                    <p className="mt-2 text-[14px] leading-7 text-muted-strong">
                      这一步先停在这里，下一步再让系统基于最终 brief 推荐最小可行团队。
                    </p>
                  </div>
                ) : null}
              </section>

              <aside className="space-y-4 lg:sticky lg:top-0 self-start">
                <BriefSnapshotCard
                  title="实时任务草案"
                  brief={clarifyPlan?.brief ?? buildShadowBrief(rawIntent)}
                />
                <StatusCard
                  tone={
                    pendingPhase === "clarify"
                      ? "info"
                      : clarifyReady
                        ? "neutral"
                        : "info"
                  }
                  title={
                    pendingPhase === "clarify"
                      ? "规划 Agent 正在梳理"
                      : clarifyReady
                        ? "已可进入 Agent 推荐"
                        : "还在持续收束需求"
                  }
                >
                  {clarifyPlan?.plannerSummary ||
                    "你一提交目标，我们就会先把它拆成多轮澄清对话，而不是直接进入团队运行。"}
                </StatusCard>
              </aside>
            </div>
          ) : null}

          {activeStep === "agents" ? (
            <div className="grid gap-6 lg:grid-cols-[minmax(0,1.04fr)_340px]">
              <section className="space-y-4">
                <div className="rounded-[24px] border border-line bg-background p-5">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <div className="text-[13px] font-medium text-text">Step 3 / 推荐 Agents</div>
                      <p className="mt-2 text-[14px] leading-7 text-muted-strong">
                        先看系统推荐的最小阵容，再决定保留哪些、去掉哪些，或手动补充。候选 Agent 会按类别收起展示，不再完全平铺。
                      </p>
                    </div>
                    <MetaPill>{teamAgents.length} 个可选 Agent</MetaPill>
                  </div>

                  {pendingPhase === "recommend" && !teamPlan ? (
                    <div className="mt-5 rounded-[22px] border border-dashed border-line bg-surface-muted px-5 py-8">
                      <div className="text-[16px] font-semibold text-text">正在匹配最合适的团队</div>
                      <p className="mt-2 text-[14px] leading-7 text-muted-strong">
                        这一步才会把当前 Agent 名册带进去做判断，所以你已经能先看到 Step 3 结构，不需要空等页面跳转。
                      </p>
                    </div>
                  ) : teamPlan ? (
                    <div className="mt-5 space-y-4">
                      <StatusCard tone={getReadinessTone(teamPlan)} title={formatReadinessTitle(teamPlan)}>
                        {teamPlan.plannerSummary}
                      </StatusCard>

                      <AgentRecommendationSection
                        title="系统建议加入"
                        emptyLabel="当前不需要额外成员，系统 PM 可以先独立推进。"
                        recommendations={teamPlan.recommendedAgents.filter((item) => item.priority === "required")}
                        agentsById={agentsById}
                        selectedAgentIds={selectedAgentIds}
                        onToggle={toggleAgentSelection}
                      />

                      <AgentCardGroup
                        title="为补位优先考虑"
                        description="这些成员是能力缺口里提到的现有补位选择。"
                        agents={gapSuggestedAgents}
                        selectedAgentIds={selectedAgentIds}
                        onToggle={toggleAgentSelection}
                      />

                      <AgentRecommendationSection
                        title="可选增强"
                        emptyLabel="当前没有额外的增强成员建议。"
                        recommendations={optionalRecommendations}
                        agentsById={agentsById}
                        selectedAgentIds={selectedAgentIds}
                        onToggle={toggleAgentSelection}
                      />
                    </div>
                  ) : (
                    <div className="mt-5 rounded-[22px] border border-dashed border-line bg-surface-muted px-5 py-8 text-[13px] leading-6 text-muted-strong">
                      这里会显示系统推荐的最小可行团队，以及它为什么这样配。
                    </div>
                  )}
                </div>

                {teamPlan ? (
                  <div className="rounded-[24px] border border-line bg-background p-5">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <h3 className="text-[18px] font-semibold tracking-[-0.03em] text-text">
                          更多候选岗位
                        </h3>
                        <p className="mt-2 text-[14px] leading-7 text-muted-strong">
                          只有在你确定需要时，再从岗位家族或自定义分组里补充成员，避免团队一开始就过重。
                        </p>
                      </div>
                      <div className="w-full max-w-[280px]">
                        <input
                          value={agentQuery}
                          onChange={(event) => setAgentQuery(event.target.value)}
                          placeholder="按名字、岗位、家族搜索"
                          className="w-full rounded-[16px] border border-line bg-surface px-4 py-2.5 text-[13px] text-text outline-none transition focus:border-text"
                        />
                      </div>
                    </div>

                    <div className="mt-4 space-y-4">
                      {agentLibraryCollections.length > 0 ? (
                        agentLibraryCollections.map((collection) => (
                          <AgentLibraryCollectionSection
                            key={collection.id}
                            collection={collection}
                            selectedAgentIds={selectedAgentIds}
                            onToggle={toggleAgentSelection}
                            forceOpen={Boolean(deferredAgentQuery.trim())}
                          />
                        ))
                      ) : (
                        <div className="rounded-[18px] border border-dashed border-line bg-surface-muted px-4 py-4 text-[13px] leading-6 text-muted-strong">
                          没有找到匹配的候选岗位，可以换个关键词再试。
                        </div>
                      )}
                    </div>
                  </div>
                ) : null}
              </section>

              <aside className="space-y-4 lg:sticky lg:top-0 self-start">
                <BriefSnapshotCard
                  title="最终任务 brief"
                  brief={clarifyPlan?.brief ?? buildShadowBrief(rawIntent)}
                />
                {teamPlan?.capabilityGaps.length ? (
                  <div className="space-y-3">
                    <div className="text-[15px] font-semibold text-text">当前能力缺口</div>
                    {teamPlan.capabilityGaps.map((gap) => (
                      <CapabilityGapCard key={gap.capability} gap={gap} agentsById={agentsById} />
                    ))}
                  </div>
                ) : null}
                <SelectionSummaryCard
                  selectedAgentRecords={selectedAgentRecords}
                  launchReadiness={teamPlan?.launchReadiness ?? "explore_only"}
                />
              </aside>
            </div>
          ) : null}

          {activeStep === "launch" ? (
            <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
              <section className="space-y-4">
                <div className="rounded-[24px] border border-line bg-background p-5">
                  <div className="text-[13px] font-medium text-text">Step 4 / 确认启动</div>
                  <h3 className="mt-2 text-[22px] font-semibold tracking-[-0.04em] text-text">
                    最后确认团队成员和默认工作区
                  </h3>
                  <p className="mt-3 text-[14px] leading-7 text-muted-strong">
                    这一步不再做需求判断，只把最终 brief、成员和工作目录确认一遍，然后启动团队。
                  </p>
                </div>

                <BriefSnapshotCard
                  title="本次启动会携带的 brief"
                  brief={effectivePlan?.brief ?? buildShadowBrief(rawIntent)}
                />

                <div className="rounded-[24px] border border-line bg-background p-5">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="text-[18px] font-semibold tracking-[-0.03em] text-text">最终成员</h3>
                    <MetaPill>{selectedAgentRecords.length + 1} 位成员</MetaPill>
                  </div>
                  <div className="mt-4 space-y-3">
                    <SelectedMemberCard
                      title="系统 PM"
                      subtitle="默认加入"
                      description="负责持续维护目标、拆解阶段并推动整个 Team 的推进。"
                    />
                    {selectedAgentRecords.length > 0 ? (
                      selectedAgentRecords.map((agent) => (
                        <SelectedMemberCard
                          key={agent.id}
                          title={agent.name}
                          subtitle={`${agent.roleLabel} · ${formatTeamRole(agent.teamRole)}`}
                          description={agent.summary}
                        />
                      ))
                    ) : (
                      <div className="rounded-[18px] border border-dashed border-line bg-surface-muted px-4 py-4 text-[13px] leading-6 text-muted-strong">
                        当前没有额外成员，团队会先以系统 PM 单人模式启动。
                      </div>
                    )}
                  </div>
                </div>
              </section>

              <aside className="space-y-4">
                <StatusCard tone={getReadinessTone(effectivePlan)} title={formatReadinessTitle(effectivePlan)}>
                  {effectivePlan?.plannerSummary ||
                    "确认完工作目录后，就可以启动团队。"}
                </StatusCard>

                <div className="rounded-[24px] border border-line bg-background p-5">
                  <div className="text-[15px] font-semibold text-text">工作空间目录</div>
                  <p className="mt-2 text-[13px] leading-6 text-muted-strong">
                    这里定义 Team 默认落地产出目录。后续真正运行时，默认仍以这个工作区为准。
                  </p>

                  <div className="mt-4 flex flex-col gap-2">
                    <input
                      value={workspaceDir}
                      onChange={(event) => setWorkspaceDir(event.target.value)}
                      placeholder="~/OpenCrab/workspaces/team-alpha"
                      className="min-w-0 rounded-[18px] border border-line bg-surface px-4 py-3 text-[14px] text-text outline-none transition focus:border-text"
                    />
                    <button
                      type="button"
                      onClick={() => void handlePickWorkspace()}
                      disabled={isSubmitting || isPlanning || isPickingWorkspace}
                      className={buttonClassName({
                        variant: "secondary",
                        className: "rounded-[18px] bg-surface-muted hover:bg-[#efeff1]",
                      })}
                    >
                      {isPickingWorkspace ? "打开中..." : "选择目录"}
                    </button>
                  </div>
                </div>
              </aside>
            </div>
          ) : null}

          {errorMessage ? (
            <div className="mt-5 rounded-[18px] border border-[#f3d0cb] bg-[#fff3f1] px-4 py-3 text-[13px] text-[#b42318]">
              {errorMessage}
            </div>
          ) : null}
        </div>

        <div className="shrink-0 border-t border-line bg-surface px-6 py-4">
          <div className="flex items-center justify-between gap-3">
            <div className="text-[12px] text-muted-strong">
              {activeStep === "clarify" && clarifyPlan?.questions.length
                ? "每一轮只问关键问题，需求收束后才进入配队。"
                : activeStep === "agents"
                  ? "先看系统推荐，再决定是否手动补充。"
                  : activeStep === "launch"
                    ? "确认目录后即可启动团队。"
                    : "先给系统一句模糊目标就够了。"}
            </div>
            <div className="flex items-center gap-3">
              <DialogSecondaryButton onClick={handleGoBack} disabled={closeDisabled}>
                {activeStep === "goal" ? "取消" : "上一步"}
              </DialogSecondaryButton>

              {activeStep === "goal" ? (
                <DialogPrimaryButton onClick={handleStartClarify} disabled={closeDisabled}>
                  开始梳理需求
                </DialogPrimaryButton>
              ) : null}

              {activeStep === "clarify" ? (
                <DialogPrimaryButton
                  onClick={
                    !clarifyPlan
                      ? handleRetryClarify
                      : clarifyPlan.questions.length
                        ? handleSubmitClarifyRound
                        : handleMoveToAgents
                  }
                  disabled={closeDisabled || (pendingPhase === "clarify" && activeStep === "clarify")}
                >
                  {pendingPhase === "clarify"
                    ? "梳理中..."
                    : !clarifyPlan
                      ? "重新梳理需求"
                      : clarifyPlan.questions.length
                      ? "发送这一轮回复"
                      : "继续看 Agent 推荐"}
                </DialogPrimaryButton>
              ) : null}

              {activeStep === "agents" ? (
                <DialogPrimaryButton
                  onClick={
                    pendingPhase === "recommend" && !teamPlan
                      ? () => null
                      : !teamPlan
                        ? handleRetryRecommendation
                        : teamPlan.launchReadiness === "need_agents"
                          ? handleGoToAgents
                          : handleMoveToLaunch
                  }
                  disabled={closeDisabled || (pendingPhase === "recommend" && !teamPlan)}
                >
                  {pendingPhase === "recommend" && !teamPlan
                    ? "匹配中..."
                    : teamPlan?.launchReadiness === "need_agents"
                      ? "去添加 Agent"
                      : !teamPlan
                        ? "重新生成 Agent 推荐"
                        : "确认成员与工作区"}
                </DialogPrimaryButton>
              ) : null}

              {activeStep === "launch" ? (
                <DialogPrimaryButton onClick={() => void handleCreateProject()} disabled={closeDisabled}>
                  {isSubmitting ? "创建中..." : launchLabel}
                </DialogPrimaryButton>
              ) : null}
            </div>
          </div>
        </div>
      </div>
    </DialogShell>
  );
}

function PlanningStepRail({ activeStep }: { activeStep: CreationStep }) {
  const steps: Array<{ key: CreationStep; label: string; number: string }> = [
    { key: "goal", number: "01", label: "输入目标" },
    { key: "clarify", number: "02", label: "对话澄清" },
    { key: "agents", number: "03", label: "推荐 Agents" },
    { key: "launch", number: "04", label: "确认启动" },
  ];

  return (
    <div className="mt-5 grid gap-2 sm:grid-cols-4">
      {steps.map((step, index) => {
        const isActive = step.key === activeStep;
        const isCompleted = getStepOrder(activeStep) > index;

        return (
          <div
            key={step.key}
            className={`rounded-[18px] border px-4 py-3 ${
              isActive
                ? "border-[#c9d8ff] bg-[#f6f9ff]"
                : isCompleted
                  ? "border-line bg-surface-muted"
                  : "border-line bg-background"
            }`}
          >
            <div className="text-[11px] uppercase tracking-[0.18em] text-muted">{step.number}</div>
            <div className="mt-2 text-[14px] font-medium text-text">{step.label}</div>
          </div>
        );
      })}
    </div>
  );
}

function HintCard({ title, body }: { title: string; body: string }) {
  return (
    <div className="rounded-[18px] border border-line bg-surface px-4 py-4">
      <div className="text-[14px] font-medium text-text">{title}</div>
      <p className="mt-2 text-[13px] leading-6 text-muted-strong">{body}</p>
    </div>
  );
}

function FlowPreviewCard({
  step,
  title,
  body,
}: {
  step: string;
  title: string;
  body: string;
}) {
  return (
    <div className="rounded-[20px] border border-line bg-surface px-4 py-4">
      <div className="text-[12px] uppercase tracking-[0.16em] text-muted">{step}</div>
      <div className="mt-2 text-[16px] font-semibold text-text">{title}</div>
      <p className="mt-2 text-[13px] leading-6 text-muted-strong">{body}</p>
    </div>
  );
}

function ConversationBubble({ message }: { message: PlanningConversationMessage }) {
  const isAssistant = message.role === "assistant";

  return (
    <div
      className={`rounded-[22px] border px-4 py-4 ${
        isAssistant ? "border-line bg-surface" : "border-[#d7e4ff] bg-[#f6f9ff]"
      }`}
    >
      <div className="flex items-center gap-2">
        <span className="text-[12px] font-medium uppercase tracking-[0.14em] text-muted">
          {isAssistant ? "Agent" : "You"}
        </span>
        <span className="text-[14px] font-medium text-text">{message.title}</span>
        {message.pending ? <MetaPill>思考中</MetaPill> : null}
      </div>
      <p className="mt-2 whitespace-pre-wrap text-[14px] leading-7 text-muted-strong">
        {message.body}
      </p>
      {message.questions?.length ? (
        <div className="mt-4 space-y-2">
          {message.questions.map((question) => (
            <div key={question.id} className="rounded-[16px] border border-line bg-background px-3 py-3">
              <div className="text-[14px] font-medium text-text">{question.title}</div>
              <p className="mt-1 text-[12px] leading-6 text-muted-strong">{question.description}</p>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function PlanningQuestionField({
  question,
  value,
  onChange,
}: {
  question: ProjectPlanningQuestion;
  value: ProjectPlanningAnswerValue | undefined;
  onChange: (value: ProjectPlanningAnswerValue) => void;
}) {
  return (
    <div className="rounded-[20px] border border-line bg-surface px-4 py-4">
      <div className="flex flex-wrap items-center gap-2">
        <div className="text-[15px] font-semibold text-text">{question.title}</div>
        {question.required ? <MetaPill>必填</MetaPill> : null}
      </div>
      <p className="mt-2 text-[12px] leading-6 text-muted-strong">{question.description}</p>

      {question.kind === "text" ? (
        <textarea
          value={typeof value === "string" ? value : ""}
          onChange={(event) => onChange(event.target.value)}
          rows={3}
          placeholder={question.placeholder || "补充这部分信息"}
          className="mt-3 w-full rounded-[16px] border border-line bg-background px-4 py-3 text-[14px] leading-7 text-text outline-none transition focus:border-text"
        />
      ) : (
        <div className="mt-3 space-y-2">
          {question.options.map((option) => {
            const checked =
              question.kind === "multi_select"
                ? Array.isArray(value) && value.includes(option.value)
                : value === option.value;

            return (
              <label
                key={option.value}
                className={`flex cursor-pointer gap-3 rounded-[16px] border px-3 py-3 transition ${
                  checked
                    ? "border-[#c9d8ff] bg-[#f6f9ff]"
                    : "border-line bg-background hover:border-text/12"
                }`}
              >
                <input
                  type={question.kind === "multi_select" ? "checkbox" : "radio"}
                  checked={checked}
                  onChange={() => {
                    if (question.kind === "multi_select") {
                      const current = Array.isArray(value) ? value : [];
                      onChange(
                        checked
                          ? current.filter((item) => item !== option.value)
                          : [...current, option.value],
                      );
                      return;
                    }

                    onChange(option.value);
                  }}
                  className="mt-1 h-4 w-4 rounded border-line"
                />
                <div className="min-w-0">
                  <div className="text-[14px] font-medium text-text">{option.label}</div>
                  {option.description ? (
                    <p className="mt-1 text-[12px] leading-6 text-muted-strong">{option.description}</p>
                  ) : null}
                </div>
              </label>
            );
          })}
        </div>
      )}
    </div>
  );
}

function BriefSnapshotCard({
  title,
  brief,
}: {
  title: string;
  brief: ProjectPlanningBrief;
}) {
  return (
    <div className="rounded-[24px] border border-line bg-background p-5">
      <div className="flex flex-wrap items-center gap-2">
        <div className="text-[15px] font-semibold text-text">{title}</div>
        <MetaPill>{formatClarityLabel(brief.clarity)}</MetaPill>
        <MetaPill>{formatTaskTypeLabel(brief.taskType)}</MetaPill>
      </div>

      <div className="mt-4 rounded-[18px] border border-line bg-surface px-4 py-4">
        <p className="text-[15px] font-medium text-text">{brief.goal}</p>
        <p className="mt-2 text-[13px] leading-6 text-muted-strong">{brief.summary}</p>
      </div>

      <div className="mt-4 grid gap-3">
        <BriefList
          title="本次交付"
          items={brief.deliverable ? [brief.deliverable] : []}
          emptyLabel="还没有明确交付物"
        />
        <BriefList title="成功标准" items={brief.successCriteria} emptyLabel="还没有显式成功标准" />
        <BriefList title="已知约束" items={brief.constraints} emptyLabel="当前没有额外约束" />
      </div>
    </div>
  );
}

function BriefList({
  title,
  items,
  emptyLabel,
}: {
  title: string;
  items: string[];
  emptyLabel: string;
}) {
  return (
    <div className="rounded-[18px] border border-line bg-surface px-4 py-4">
      <div className="text-[12px] uppercase tracking-[0.14em] text-muted">{title}</div>
      {items.length > 0 ? (
        <div className="mt-3 space-y-2">
          {items.map((item) => (
            <p key={item} className="text-[13px] leading-6 text-muted-strong">
              {item}
            </p>
          ))}
        </div>
      ) : (
        <p className="mt-3 text-[13px] leading-6 text-muted-strong">{emptyLabel}</p>
      )}
    </div>
  );
}

function AgentRecommendationSection({
  title,
  emptyLabel,
  recommendations,
  agentsById,
  selectedAgentIds,
  onToggle,
  locked = false,
}: {
  title: string;
  emptyLabel: string;
  recommendations: Array<ProjectPlanningResult["recommendedAgents"][number]>;
  agentsById: Map<string, AgentProfileRecord>;
  selectedAgentIds: string[];
  onToggle: (agentId: string) => void;
  locked?: boolean;
}) {
  return (
    <div className="space-y-3">
      <div className="text-[15px] font-semibold text-text">{title}</div>
      {recommendations.length > 0 ? (
        recommendations.map((item) => {
          const agent = agentsById.get(item.agentId);

          if (!agent) {
            return null;
          }

          return (
            <SelectableAgentCard
              key={item.agentId}
              agent={agent}
              checked={selectedAgentIds.includes(item.agentId)}
              onToggle={() => onToggle(item.agentId)}
              locked={locked}
              reason={item.reason}
              expectedContribution={item.expectedContribution}
            />
          );
        })
      ) : (
        <div className="rounded-[18px] border border-dashed border-line bg-surface-muted px-4 py-4 text-[13px] leading-6 text-muted-strong">
          {emptyLabel}
        </div>
      )}
    </div>
  );
}

function AgentCardGroup({
  title,
  description,
  agents,
  selectedAgentIds,
  onToggle,
}: {
  title: string;
  description: string;
  agents: AgentProfileRecord[];
  selectedAgentIds: string[];
  onToggle: (agentId: string) => void;
}) {
  if (agents.length === 0) {
    return null;
  }

  return (
    <div className="space-y-3">
      <div className="text-[15px] font-semibold text-text">{title}</div>
      <p className="text-[13px] leading-6 text-muted-strong">{description}</p>
      {agents.map((agent) => (
        <SelectableAgentCard
          key={agent.id}
          agent={agent}
          checked={selectedAgentIds.includes(agent.id)}
          onToggle={() => onToggle(agent.id)}
        />
      ))}
    </div>
  );
}

function AgentLibraryCollectionSection({
  collection,
  selectedAgentIds,
  onToggle,
  forceOpen,
}: {
  collection: AgentLibraryCollection;
  selectedAgentIds: string[];
  onToggle: (agentId: string) => void;
  forceOpen: boolean;
}) {
  return (
    <div className="rounded-[22px] border border-line bg-surface px-4 py-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="text-[15px] font-semibold text-text">{collection.label}</div>
          <p className="mt-1 text-[12px] leading-6 text-muted-strong">{collection.description}</p>
        </div>
        <MetaPill>{collection.groups.reduce((sum, group) => sum + group.agents.length, 0)} 位候选</MetaPill>
      </div>

      <div className="mt-4 space-y-3">
        {collection.groups.map((group) => (
          <AgentLibraryGroupSection
            key={group.id}
            group={group}
            selectedAgentIds={selectedAgentIds}
            onToggle={onToggle}
            forceOpen={forceOpen}
          />
        ))}
      </div>
    </div>
  );
}

function AgentLibraryGroupSection({
  group,
  selectedAgentIds,
  onToggle,
  forceOpen,
}: {
  group: AgentLibraryGroup;
  selectedAgentIds: string[];
  onToggle: (agentId: string) => void;
  forceOpen: boolean;
}) {
  const shouldDefaultOpen =
    forceOpen ||
    group.agents.length <= 3 ||
    group.agents.some((agent) => selectedAgentIds.includes(agent.id));
  const [isOpen, setIsOpen] = useState(shouldDefaultOpen);
  const effectiveOpen = shouldDefaultOpen || isOpen;
  const visibleAgents = effectiveOpen ? group.agents : group.agents.slice(0, 2);
  const canToggle = !shouldDefaultOpen;

  return (
    <div className="rounded-[18px] border border-line bg-background px-4 py-4">
      <button
        type="button"
        onClick={() => (canToggle ? setIsOpen((current) => !current) : null)}
        className="flex w-full items-start justify-between gap-4 text-left"
      >
        <div>
          <div className="text-[15px] font-semibold text-text">{group.label}</div>
          <p className="mt-1 text-[12px] leading-6 text-muted-strong">{group.description}</p>
        </div>
        <span className="text-[12px] text-muted-strong">
          {canToggle ? (effectiveOpen ? "收起" : `展开 ${group.agents.length} 位`) : "默认展开"}
        </span>
      </button>

      <div className="mt-4 space-y-3">
        {visibleAgents.map((agent) => (
          <SelectableAgentCard
            key={agent.id}
            agent={agent}
            checked={selectedAgentIds.includes(agent.id)}
            onToggle={() => onToggle(agent.id)}
            compact
          />
        ))}
      </div>
    </div>
  );
}

function SelectableAgentCard({
  agent,
  checked,
  onToggle,
  locked = false,
  reason,
  expectedContribution,
  compact = false,
}: {
  agent: AgentProfileRecord;
  checked: boolean;
  onToggle: () => void;
  locked?: boolean;
  reason?: string;
  expectedContribution?: string;
  compact?: boolean;
}) {
  return (
    <label
      className={`flex gap-3 rounded-[18px] border px-4 py-4 transition ${
        checked
          ? "border-[#c9d8ff] bg-[#f6f9ff]"
          : "border-line bg-surface hover:border-text/12"
      } ${locked ? "cursor-default" : "cursor-pointer"}`}
    >
      <input
        type="checkbox"
        checked={checked}
        onChange={() => (locked ? null : onToggle())}
        disabled={locked}
        className="mt-1 h-4 w-4 rounded border-line"
      />
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <div className="text-[15px] font-semibold text-text">{agent.name}</div>
          <MetaPill>{agent.roleLabel}</MetaPill>
          <MetaPill>{agent.familyLabel}</MetaPill>
        </div>
        <p className="mt-2 text-[13px] leading-6 text-muted-strong">{agent.summary}</p>
        {!compact ? (
          <p className="mt-2 text-[12px] leading-6 text-muted-strong">
            {formatTeamRole(agent.teamRole)} · {formatAgentRosterMeta(agent)}
          </p>
        ) : null}
        {reason ? <p className="mt-2 text-[12px] leading-6 text-text">推荐原因：{reason}</p> : null}
        {expectedContribution ? (
          <p className="mt-1 text-[12px] leading-6 text-muted-strong">
            预期产出：{expectedContribution}
          </p>
        ) : null}
      </div>
    </label>
  );
}

function CapabilityGapCard({
  gap,
  agentsById,
}: {
  gap: ProjectPlanningCapabilityGap;
  agentsById: Map<string, AgentProfileRecord>;
}) {
  const suggestedAgents = gap.suggestedAgentIds
    .map((agentId) => agentsById.get(agentId)?.name)
    .filter(Boolean)
    .join("、");

  return (
    <div className="rounded-[18px] border border-[#efd8d6] bg-[#fff7f5] px-4 py-4">
      <div className="flex flex-wrap items-center gap-2">
        <div className="text-[15px] font-semibold text-text">{gap.capability}</div>
        <MetaPill>{gap.blocking ? "阻塞项" : "风险项"}</MetaPill>
      </div>
      <p className="mt-2 text-[13px] leading-6 text-muted-strong">{gap.reason}</p>
      {suggestedAgents ? (
        <p className="mt-2 text-[12px] leading-6 text-text">当前可考虑的现有成员：{suggestedAgents}</p>
      ) : null}
      {gap.suggestedNewAgentName ? (
        <p className="mt-2 text-[12px] leading-6 text-text">
          建议先添加 {gap.suggestedNewAgentName}
          {gap.suggestedNewAgentSummary ? `：${gap.suggestedNewAgentSummary}` : ""}
        </p>
      ) : null}
    </div>
  );
}

function SelectionSummaryCard({
  selectedAgentRecords,
  launchReadiness,
}: {
  selectedAgentRecords: AgentProfileRecord[];
  launchReadiness: ProjectPlanningResult["launchReadiness"];
}) {
  return (
    <div className="rounded-[24px] border border-line bg-background p-5">
      <div className="text-[15px] font-semibold text-text">当前团队规模</div>
      <p className="mt-2 text-[13px] leading-6 text-muted-strong">
        系统 PM 始终在场，额外已选 {selectedAgentRecords.length} 位成员。
      </p>
      <div className="mt-4 flex flex-wrap gap-2">
        <MetaPill>总计 {selectedAgentRecords.length + 1} 位</MetaPill>
        <MetaPill>{launchReadiness === "explore_only" ? "探索团队" : "执行团队"}</MetaPill>
      </div>
    </div>
  );
}

function SelectedMemberCard({
  title,
  subtitle,
  description,
}: {
  title: string;
  subtitle: string;
  description: string;
}) {
  return (
    <div className="rounded-[18px] border border-line bg-surface px-4 py-4">
      <div className="flex flex-wrap items-center gap-2">
        <div className="text-[15px] font-semibold text-text">{title}</div>
        <MetaPill>{subtitle}</MetaPill>
      </div>
      <p className="mt-2 text-[13px] leading-6 text-muted-strong">{description}</p>
    </div>
  );
}

function StatusCard({
  tone,
  title,
  children,
}: {
  tone: "neutral" | "info" | "warning";
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div
      className={`rounded-[20px] border px-4 py-4 ${
        tone === "warning"
          ? "border-[#efd8d6] bg-[#fff7f5]"
          : tone === "info"
            ? "border-[#d7e4ff] bg-[#f6f9ff]"
            : "border-line bg-background"
      }`}
    >
      <div className="text-[15px] font-semibold text-text">{title}</div>
      <p className="mt-2 text-[13px] leading-6 text-muted-strong">{children}</p>
    </div>
  );
}

function buildAgentLibraryCollections(
  agents: AgentProfileRecord[],
  searchQuery: string,
) {
  const normalizedQuery = normalizeSearchText(searchQuery);
  const filteredAgents = normalizedQuery
    ? agents.filter((agent) =>
        normalizeSearchText(
          [
            agent.name,
            agent.summary,
            agent.roleLabel,
            agent.familyLabel,
            agent.familyDescription,
          ].join(" "),
        ).includes(normalizedQuery),
      )
    : agents;

  const collections = new Map<
    string,
    {
      id: string;
      label: string;
      description: string;
      order: number;
      groups: Map<
        string,
        {
          id: string;
          label: string;
          description: string;
          order: number;
          agents: AgentProfileRecord[];
        }
      >;
    }
  >();

  filteredAgents.forEach((agent) => {
    const collectionId = agent.source === "system" ? "system" : "custom";
    const existingCollection = collections.get(collectionId);
    const nextCollection =
      existingCollection ??
      {
        id: collectionId,
        label: formatAgentCollectionLabel(agent),
        description: formatAgentCollectionDescription(agent),
        order: agent.source === "system" ? 0 : 1_000,
        groups: new Map(),
      };
    const groupId = agent.familyId;
    const existingGroup = nextCollection.groups.get(groupId);

    if (existingGroup) {
      existingGroup.agents.push(agent);
    } else {
      nextCollection.groups.set(groupId, {
        id: groupId,
        label: agent.familyLabel,
        description: agent.familyDescription,
        order: agent.familyOrder,
        agents: [agent],
      });
    }

    collections.set(collectionId, nextCollection);
  });

  return Array.from(collections.values())
    .sort((left, right) => left.order - right.order)
    .map((collection) => ({
      id: collection.id,
      label: collection.label,
      description: collection.description,
      groups: Array.from(collection.groups.values())
        .sort((left, right) => left.order - right.order)
        .map((group) => ({
          id: group.id,
          label: group.label,
          description: group.description,
          agents: group.agents.sort((left, right) =>
            left.name.localeCompare(right.name, "zh-Hans-CN"),
          ),
        })),
    })) satisfies AgentLibraryCollection[];
}

function formatAgentCollectionLabel(agent: AgentProfileRecord) {
  if (agent.source === "system") {
    return "核心岗位";
  }

  return "自定义智能体";
}

function formatAgentCollectionDescription(agent: AgentProfileRecord) {
  if (agent.source === "system") {
    return "按岗位家族组织的核心岗位候选。";
  }

  return "你自己创建和维护的长期角色。";
}

function formatAgentRosterMeta(agent: AgentProfileRecord) {
  return agent.familyLabel;
}

function collectAnswersFromQuestions(
  questions: ProjectPlanningQuestion[],
  draftAnswers: Record<string, ProjectPlanningAnswerValue>,
) {
  const entries: Array<[string, ProjectPlanningAnswerValue]> = [];

  for (const question of questions) {
    const value = draftAnswers[question.id];

    if (typeof value === "string") {
      const trimmed = value.trim();

      if (!trimmed) {
        if (question.required) {
          return null;
        }
        continue;
      }

      entries.push([question.id, trimmed]);
      continue;
    }

    if (Array.isArray(value)) {
      const items = value.map((item) => item.trim()).filter(Boolean);

      if (items.length === 0) {
        if (question.required) {
          return null;
        }
        continue;
      }

      entries.push([question.id, items]);
      continue;
    }

    if (question.required) {
      return null;
    }
  }

  return Object.fromEntries(entries);
}

function buildDraftAnswers(
  questions: ProjectPlanningQuestion[],
  answers: ProjectPlanningAnswers,
) {
  return Object.fromEntries(
    questions.map((question) => {
      const value = answers[question.id];

      if (Array.isArray(value)) {
        return [question.id, value];
      }

      return [question.id, typeof value === "string" ? value : question.kind === "multi_select" ? [] : ""];
    }),
  );
}

function mergePlanningAnswers(
  baseAnswers: ProjectPlanningAnswers,
  nextAnswers: ProjectPlanningAnswers | null,
) {
  return nextAnswers
    ? {
        ...baseAnswers,
        ...nextAnswers,
      }
    : null;
}

function summarizeReply(
  questions: ProjectPlanningQuestion[],
  answers: ProjectPlanningAnswers,
) {
  return questions
    .map((question) => {
      const value = answers[question.id];

      if (!value) {
        return null;
      }

      const normalizedValue = Array.isArray(value)
        ? value
            .map((item) => resolveOptionLabel(question, item))
            .join("、")
        : question.kind === "text"
          ? value
          : resolveOptionLabel(question, value);

      return `${question.title}：${normalizedValue}`;
    })
    .filter(Boolean)
    .join("\n");
}

function resolveOptionLabel(question: ProjectPlanningQuestion, value: string) {
  return question.options.find((option) => option.value === value)?.label || value;
}

function replaceConversationMessage(
  messages: PlanningConversationMessage[],
  messageId: string,
  nextMessage: PlanningConversationMessage,
) {
  return messages.map((message) => (message.id === messageId ? nextMessage : message));
}

function buildAssistantClarifyMessage(plan: ProjectPlanningResult): PlanningConversationMessage {
  return {
    id: createLocalId(),
    role: "assistant",
    title: plan.questions.length > 0 ? "规划 Agent 继续追问" : "规划 Agent 已收束需求",
    body: plan.plannerSummary,
    questions: plan.questions,
  };
}

function buildShadowBrief(rawIntent: string): ProjectPlanningBrief {
  const normalizedGoal = rawIntent.trim() || "等待你先输入目标";

  return {
    summary: rawIntent.trim() || "这里会逐步生成需求摘要、交付物和边界。",
    goal: normalizedGoal,
    deliverable: null,
    successCriteria: [],
    constraints: [],
    outOfScope: [],
    taskType: "unknown",
    clarity: "low",
    executionMode: "explore",
  };
}

function getStepDescription(step: CreationStep) {
  switch (step) {
    case "clarify":
      return "先用多轮对话把需求讲清楚，再进入后面的配队。";
    case "agents":
      return "基于最终 brief 推荐最小可行团队，并把更多候选按分类展示。";
    case "launch":
      return "最后确认成员与工作区，然后再真正启动团队。";
    default:
      return "先写下模糊目标，再通过对话澄清、推荐 Agent、确认启动。";
  }
}

function getStepOrder(step: CreationStep) {
  switch (step) {
    case "clarify":
      return 1;
    case "agents":
      return 2;
    case "launch":
      return 3;
    default:
      return 0;
  }
}

function getReadinessTone(plan: ProjectPlanningResult | null | undefined) {
  if (!plan) {
    return "neutral" as const;
  }

  switch (plan.launchReadiness) {
    case "need_agents":
      return "warning" as const;
    case "explore_only":
      return "info" as const;
    default:
      return "neutral" as const;
  }
}

function formatReadinessTitle(plan: ProjectPlanningResult | null | undefined) {
  if (!plan) {
    return "等待规划结果";
  }

  switch (plan.launchReadiness) {
    case "need_agents":
      return "当前 Agents 还不够";
    case "explore_only":
      return "建议先用探索团队";
    default:
      return "当前可以启动团队";
  }
}

function formatTeamRole(value: AgentProfileRecord["teamRole"]) {
  switch (value) {
    case "lead":
      return "Lead";
    case "research":
      return "Research";
    case "writer":
      return "Writer";
    default:
      return "Specialist";
  }
}

function formatClarityLabel(value: ProjectPlanningResult["brief"]["clarity"]) {
  switch (value) {
    case "high":
      return "目标较清晰";
    case "medium":
      return "目标部分清晰";
    default:
      return "目标仍偏模糊";
  }
}

function formatTaskTypeLabel(value: ProjectPlanningResult["brief"]["taskType"]) {
  switch (value) {
    case "feature":
      return "新功能";
    case "bugfix":
      return "问题修复";
    case "research":
      return "调研分析";
    case "design":
      return "设计方案";
    case "implementation":
      return "实现开发";
    case "optimization":
      return "体验优化";
    default:
      return "任务待定";
  }
}

function normalizeSearchText(value: string) {
  return value.replace(/\s+/g, " ").trim().toLowerCase();
}

function createLocalId() {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}
