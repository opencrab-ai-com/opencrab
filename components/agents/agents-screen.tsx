"use client";

import Link from "next/link";
import { useDeferredValue, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { AgentAvatar } from "@/components/agents/agent-avatar";
import { AgentOnboardingDialog } from "@/components/agents/agent-onboarding-dialog";
import { useOpenCrabApp } from "@/components/app-shell/opencrab-provider";
import {
  isCustomAgentForDisplay,
  isSystemAgentForDisplay,
} from "@/lib/agents/display";
import { Button, buttonClassName } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import { MetaPill as UnifiedMetaPill, StatusPill as UnifiedStatusPill } from "@/components/ui/pill";
import type { AgentProfileRecord } from "@/lib/agents/types";

export function AgentsScreen() {
  const router = useRouter();
  const { agents, createConversation } = useOpenCrabApp();
  const [query, setQuery] = useState("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [pendingKey, setPendingKey] = useState<string | null>(null);
  const [isOnboardingOpen, setIsOnboardingOpen] = useState(false);
  const [selectedSystemCollectionId, setSelectedSystemCollectionId] = useState("all");
  const [selectedSystemGroupId, setSelectedSystemGroupId] = useState("all");
  const deferredQuery = useDeferredValue(query);
  const activeQuery = deferredQuery.trim();

  const filteredAgents = useMemo(() => {
    const normalized = activeQuery.toLowerCase();

    if (!normalized) {
      return agents;
    }

    return agents.filter((agent) =>
        `${agent.name} ${agent.summary} ${agent.roleLabel}`.toLowerCase().includes(normalized),
    );
  }, [activeQuery, agents]);

  const allSystemAgents = agents.filter(isSystemAgentForDisplay);
  const systemAgents = filteredAgents.filter(isSystemAgentForDisplay);
  const customAgents = filteredAgents.filter(isCustomAgentForDisplay);
  const systemAgentCount = agents.filter(isSystemAgentForDisplay).length;
  const customAgentCount = agents.filter(isCustomAgentForDisplay).length;
  const coreSystemAgentCount = agents.filter(
    (agent) => isSystemAgentForDisplay(agent) && agent.collectionId === "opencrab-core",
  ).length;
  const agencySystemAgentCount = agents.filter(
    (agent) => isSystemAgentForDisplay(agent) && agent.collectionId === "agency-agents",
  ).length;
  const systemCollectionOptions = useMemo(() => buildSystemCollectionOptions(allSystemAgents), [allSystemAgents]);
  const systemGroupOptions = useMemo(() => buildSystemGroupOptions(allSystemAgents), [allSystemAgents]);
  const isSearching = activeQuery.length > 0;
  const effectiveSelectedSystemCollectionId = isSearching ? "all" : selectedSystemCollectionId;
  const visibleSystemGroupOptions = useMemo(
    () =>
      effectiveSelectedSystemCollectionId === "all"
        ? systemGroupOptions
        : systemGroupOptions.filter((group) => group.collectionId === effectiveSelectedSystemCollectionId),
    [effectiveSelectedSystemCollectionId, systemGroupOptions],
  );
  const hasSelectedSystemGroup = visibleSystemGroupOptions.some((group) => group.id === selectedSystemGroupId);
  const effectiveSelectedSystemGroupId = isSearching
    ? "all"
    : hasSelectedSystemGroup
      ? selectedSystemGroupId
      : "all";
  const visibleSystemAgents = useMemo(() => {
    const scopedByCollection =
      effectiveSelectedSystemCollectionId === "all"
        ? systemAgents
        : systemAgents.filter((agent) => agent.collectionId === effectiveSelectedSystemCollectionId);

    return effectiveSelectedSystemGroupId === "all"
      ? scopedByCollection
      : scopedByCollection.filter((agent) => agent.groupId === effectiveSelectedSystemGroupId);
  }, [effectiveSelectedSystemCollectionId, effectiveSelectedSystemGroupId, systemAgents]);
  const groupedSystemAgents = useMemo(() => groupAgentsByGroup(visibleSystemAgents), [visibleSystemAgents]);
  const activeSystemCollectionOption =
    effectiveSelectedSystemCollectionId === "all"
      ? null
      : systemCollectionOptions.find((collection) => collection.id === effectiveSelectedSystemCollectionId) ?? null;
  const activeSystemGroupOption =
    effectiveSelectedSystemGroupId === "all"
      ? null
      : visibleSystemGroupOptions.find((group) => group.id === effectiveSelectedSystemGroupId) ?? null;
  const shouldShowSystemDirectory =
    !isSearching && effectiveSelectedSystemGroupId === "all" && visibleSystemGroupOptions.length > 1;

  function handleSelectSystemCollection(collectionId: string) {
    setSelectedSystemCollectionId(collectionId);

    if (collectionId === "all") {
      setSelectedSystemGroupId("all");
      return;
    }

    const currentGroup = systemGroupOptions.find((group) => group.id === selectedSystemGroupId);
    if (currentGroup && currentGroup.collectionId !== collectionId) {
      setSelectedSystemGroupId("all");
    }
  }

  function handleSelectSystemGroup(groupId: string) {
    if (groupId === "all") {
      setSelectedSystemGroupId("all");
      return;
    }

    const nextGroup = systemGroupOptions.find((group) => group.id === groupId);
    if (nextGroup) {
      setSelectedSystemCollectionId(nextGroup.collectionId);
    }
    setSelectedSystemGroupId(groupId);
  }

  async function handleStartConversation(agentId: string, agentName: string) {
    setPendingKey(`chat:${agentId}`);
    setErrorMessage(null);

    try {
      const conversationId = await createConversation({
        title: `${agentName} · 对话`,
        agentProfileId: agentId,
      });
      router.push(`/conversations/${conversationId}`);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "创建对话失败。");
    } finally {
      setPendingKey(null);
    }
  }

  return (
    <>
      <div className="space-y-8">
        <PageHeader
          title="智能体"
          description="把身份、职责和长期上下文收成可复用智能体，可单聊，也可加入 Team。"
          descriptionClassName="truncate whitespace-nowrap"
          className="mb-6"
          actions={
            <div className="flex w-full min-w-0 flex-wrap items-center justify-end gap-3 lg:max-w-[680px]">
              <label className="flex h-10 min-w-0 flex-1 basis-[260px] items-center gap-2 rounded-full border border-line bg-surface px-4 text-[13px] text-muted-strong sm:min-w-[240px]">
                <SearchIcon />
                <input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="搜索智能体"
                  className="w-full border-0 bg-transparent text-text outline-none placeholder:text-muted"
                />
              </label>

              <Button
                type="button"
                onClick={() => setIsOnboardingOpen(true)}
                variant="primary"
                className="shrink-0 gap-2"
              >
                <PlusIcon />
                <span>新智能体</span>
              </Button>
            </div>
          }
        />

        <OverviewStrip
          items={[
            { label: "系统总量", value: `${systemAgentCount}` },
            { label: "OpenCrab 核心", value: `${coreSystemAgentCount}` },
            { label: "扩展角色库", value: `${agencySystemAgentCount}` },
            { label: "自定义", value: `${customAgentCount}` },
          ]}
        />

        {errorMessage ? (
          <section className="rounded-[18px] border border-[#f3d0cb] bg-[#fff3f1] px-4 py-3 text-[13px] text-[#b42318]">
            {errorMessage}
          </section>
        ) : null}

        <section className="rounded-[28px] border border-line bg-surface p-6 shadow-soft">
          <div className="flex flex-col gap-2 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <h2 className="text-[24px] font-semibold tracking-[-0.04em] text-text">系统智能体库</h2>
              <p className="mt-2 text-[14px] leading-7 text-muted-strong">
                默认先看目录，再进入角色列表；搜索会直接跨全部系统命中结果。
              </p>
            </div>
            <div className="flex flex-wrap gap-2 text-[12px] text-muted-strong">
              <MetaPill>{systemGroupOptions.length} 个职能组</MetaPill>
              <MetaPill>{systemAgentCount} 个系统智能体</MetaPill>
            </div>
          </div>

          <div className="mt-6 space-y-5">
            <SystemAgentNavigationPanel
              query={activeQuery}
              collectionOptions={systemCollectionOptions}
              groupOptions={visibleSystemGroupOptions}
              selectedCollectionId={effectiveSelectedSystemCollectionId}
              selectedGroupId={effectiveSelectedSystemGroupId}
              activeCollection={activeSystemCollectionOption}
              onSelectCollection={handleSelectSystemCollection}
              onSelectGroup={handleSelectSystemGroup}
              totalGroupCount={systemGroupOptions.length}
              totalSystemAgentCount={systemAgentCount}
              visibleAgentCount={visibleSystemAgents.length}
            />

            {groupedSystemAgents.length === 0 ? (
              <div className="rounded-[22px] border border-dashed border-line bg-surface-muted px-5 py-7 text-[14px] text-muted-strong">
                {query ? "没有匹配的系统智能体" : "当前没有系统智能体"}
              </div>
            ) : shouldShowSystemDirectory ? (
              <SystemAgentDirectory
                activeCollection={activeSystemCollectionOption}
                groups={visibleSystemGroupOptions}
                onSelectGroup={handleSelectSystemGroup}
              />
            ) : (
              <div className="space-y-5">
                <SystemAgentFilterSummary
                  query={activeQuery}
                  visibleAgentCount={visibleSystemAgents.length}
                  activeCollection={activeSystemCollectionOption}
                  activeGroup={activeSystemGroupOption}
                  visibleGroupCount={visibleSystemGroupOptions.length}
                  canReturnToDirectory={!isSearching && visibleSystemGroupOptions.length > 1 && Boolean(activeSystemGroupOption)}
                  onReturnToDirectory={() => handleSelectSystemGroup("all")}
                />

                <div className="space-y-6">
                  {groupedSystemAgents.map((group) => (
                    <SystemAgentGroupSection
                      key={group.id}
                      group={group}
                      pendingKey={pendingKey}
                      onStartConversation={handleStartConversation}
                    />
                  ))}
                </div>
              </div>
            )}
          </div>
        </section>

        <AgentSection
          title="我的智能体"
          description="你自定义的长期角色，会保留 soul、职责、用户画像和工具偏好。"
          agents={customAgents}
          pendingKey={pendingKey}
          onStartConversation={handleStartConversation}
          emptyLabel={query ? "没有匹配的自定义智能体" : "还没有创建自定义智能体"}
        />
      </div>

      {isOnboardingOpen ? (
        <AgentOnboardingDialog onClose={() => setIsOnboardingOpen(false)} />
      ) : null}
    </>
  );
}

function AgentSection({
  title,
  description,
  agents,
  pendingKey,
  onStartConversation,
  isSystemSection = false,
  emptyLabel = "当前没有智能体",
}: {
  title: string;
  description: string;
  agents: ReturnType<typeof useOpenCrabApp>["agents"];
  pendingKey: string | null;
  onStartConversation: (agentId: string, agentName: string) => Promise<void>;
  isSystemSection?: boolean;
  emptyLabel?: string;
}) {
  return (
    <section className="rounded-[28px] border border-line bg-surface p-6 shadow-soft">
      <div className="flex flex-col gap-2 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h2 className="text-[24px] font-semibold tracking-[-0.04em] text-text">{title}</h2>
          <p className="mt-2 text-[14px] leading-7 text-muted-strong">{description}</p>
        </div>
        <span className="rounded-full border border-line bg-surface-muted px-3 py-1.5 text-[12px] text-muted-strong">
          {agents.length} 个
        </span>
      </div>

      {agents.length === 0 ? (
        <div className="mt-6 rounded-[22px] border border-dashed border-line bg-surface-muted px-5 py-7 text-[14px] text-muted-strong">
          {emptyLabel}
        </div>
      ) : (
        <AgentCardGrid
          agents={agents}
          pendingKey={pendingKey}
          onStartConversation={onStartConversation}
          isSystemSection={isSystemSection}
        />
      )}
    </section>
  );
}

function OverviewStrip({
  items,
}: {
  items: Array<{ label: string; value: string }>;
}) {
  return (
    <section className="rounded-[24px] border border-line bg-surface px-5 py-4 shadow-soft">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4 xl:gap-0">
        {items.map((item, index) => (
          <div
            key={item.label}
            className={index === 0 ? "" : "xl:border-l xl:border-line xl:pl-6"}
          >
            <div className="text-[12px] text-muted-strong">{item.label}</div>
            <div className="mt-2 text-[32px] font-semibold tracking-[-0.05em] text-text">{item.value}</div>
          </div>
        ))}
      </div>
    </section>
  );
}

function SystemAgentNavigationPanel({
  query,
  collectionOptions,
  groupOptions,
  selectedCollectionId,
  selectedGroupId,
  activeCollection,
  onSelectCollection,
  onSelectGroup,
  totalGroupCount,
  totalSystemAgentCount,
  visibleAgentCount,
}: {
  query: string;
  collectionOptions: ReturnType<typeof buildSystemCollectionOptions>;
  groupOptions: ReturnType<typeof buildSystemGroupOptions>;
  selectedCollectionId: string;
  selectedGroupId: string;
  activeCollection: ReturnType<typeof buildSystemCollectionOptions>[number] | null;
  onSelectCollection: (collectionId: string) => void;
  onSelectGroup: (groupId: string) => void;
  totalGroupCount: number;
  totalSystemAgentCount: number;
  visibleAgentCount: number;
}) {
  const selectValue = selectedGroupId === "all" ? "all" : selectedGroupId;
  const toolbarHint = query.trim()
    ? "搜索会自动跨全部集合和职能匹配结果，方便直接定位具体角色。"
    : activeCollection
      ? `当前锁定在 ${activeCollection.displayLabel}，建议先选职能，再进入具体角色。`
      : "默认先看职能目录，不直接铺开全部角色，浏览会更轻。";

  return (
    <section className="rounded-[24px] border border-line bg-[#fbfaf7] p-5">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
        <div className="min-w-0">
          <div className="text-[11px] font-medium uppercase tracking-[0.18em] text-muted">系统导航</div>
          <h3 className="mt-2 text-[18px] font-semibold tracking-[-0.03em] text-text">先选集合，再进职能</h3>
          <div className="mt-4 flex flex-wrap gap-2">
            <CollectionSegmentButton
              label="全部系统"
              count={totalSystemAgentCount}
              isActive={selectedCollectionId === "all"}
              onClick={() => onSelectCollection("all")}
            />
            {collectionOptions.map((collection) => (
              <CollectionSegmentButton
                key={collection.id}
                label={collection.displayLabel}
                count={collection.count}
                isActive={selectedCollectionId === collection.id}
                onClick={() => onSelectCollection(collection.id)}
              />
            ))}
          </div>
        </div>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <label className="flex min-w-[220px] items-center gap-3 rounded-[18px] border border-line bg-white px-4 py-3 text-[13px] text-muted-strong">
            <span className="shrink-0 font-medium text-text">职能组</span>
            <select
              value={selectValue}
              onChange={(event) => onSelectGroup(event.target.value)}
              className="w-full bg-transparent text-text outline-none"
            >
              <option value="all">
                {activeCollection ? "这个集合的全部职能" : "全部系统职能"}
              </option>
              {groupOptions.map((group) => (
                <option key={group.id} value={group.id}>
                  {group.label}
                  {selectedCollectionId === "all" ? ` · ${group.collectionDisplayLabel}` : ""} · {group.count}
                </option>
              ))}
            </select>
          </label>
          <MetaPill>{query.trim() ? `${visibleAgentCount} 个匹配结果` : `${groupOptions.length} 个职能组`}</MetaPill>
        </div>
      </div>

      <p className="mt-4 text-[13px] leading-6 text-muted-strong">{toolbarHint}</p>
    </section>
  );
}

function SystemAgentFilterSummary({
  query,
  visibleAgentCount,
  activeCollection,
  activeGroup,
  visibleGroupCount,
  canReturnToDirectory,
  onReturnToDirectory,
}: {
  query: string;
  visibleAgentCount: number;
  activeCollection: ReturnType<typeof buildSystemCollectionOptions>[number] | null;
  activeGroup: ReturnType<typeof buildSystemGroupOptions>[number] | null;
  visibleGroupCount: number;
  canReturnToDirectory: boolean;
  onReturnToDirectory: () => void;
}) {
  const heading = query.trim()
    ? "搜索结果"
    : activeGroup?.label ?? activeCollection?.displayLabel ?? "全部系统智能体";
  const description = query.trim()
    ? `关键词“${query.trim()}”会跨全部集合和职能匹配系统智能体，方便直接搜到角色。`
    : activeGroup?.description ??
      activeCollection?.description ??
      "跨全部系统集合浏览当前可用的系统智能体。";

  return (
    <section className="rounded-[24px] border border-line bg-[#f8f6f2] p-5">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <div className="text-[11px] font-medium uppercase tracking-[0.18em] text-muted">
            {query.trim() ? "搜索模式" : "当前范围"}
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <h3 className="text-[22px] font-semibold tracking-[-0.04em] text-text">{heading}</h3>
            {activeCollection ? (
              <Badge tone={activeCollection.id === "opencrab-core" ? "warm" : "neutral"}>
                {activeCollection.displayLabel}
              </Badge>
            ) : null}
          </div>
          <p className="mt-2 max-w-[720px] text-[13px] leading-6 text-muted-strong">{description}</p>
        </div>
        <div className="flex flex-wrap items-center justify-end gap-2">
          {canReturnToDirectory ? (
            <button
              type="button"
              onClick={onReturnToDirectory}
              className={buttonClassName({ variant: "secondary" })}
            >
              返回职能目录
            </button>
          ) : null}
          <MetaPill>{visibleAgentCount} 个智能体</MetaPill>
          <MetaPill>{activeGroup ? activeGroup.label : `${visibleGroupCount} 个职能组`}</MetaPill>
          <MetaPill>{activeCollection?.displayLabel ?? "全部集合"}</MetaPill>
        </div>
      </div>
    </section>
  );
}

function CollectionSegmentButton({
  label,
  count,
  isActive,
  onClick,
}: {
  label: string;
  count: number;
  isActive: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        "inline-flex items-center gap-2 rounded-full border px-4 py-2 text-[13px] transition",
        isActive
          ? "border-text bg-text text-white shadow-[0_12px_30px_rgba(15,23,42,0.14)]"
          : "border-line bg-white text-text hover:border-text/15 hover:bg-surface",
      ].join(" ")}
    >
      <span className="font-medium">{label}</span>
      <span className={["text-[12px]", isActive ? "text-white/72" : "text-muted-strong"].join(" ")}>{count}</span>
    </button>
  );
}

function SystemAgentDirectory({
  activeCollection,
  groups,
  onSelectGroup,
}: {
  activeCollection: ReturnType<typeof buildSystemCollectionOptions>[number] | null;
  groups: ReturnType<typeof buildSystemGroupOptions>;
  onSelectGroup: (groupId: string) => void;
}) {
  const heading = activeCollection ? `${activeCollection.displayLabel} 的职能目录` : "职能目录";
  const description = activeCollection
    ? "先选具体职能，再进入角色列表，会比直接翻长清单更快。"
    : "先按职能进入，再决定看哪一组角色。";

  return (
    <section className="rounded-[24px] border border-line bg-background p-5">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <div className="text-[11px] font-medium uppercase tracking-[0.18em] text-muted">目录浏览</div>
          <h3 className="mt-2 text-[22px] font-semibold tracking-[-0.04em] text-text">{heading}</h3>
          <p className="mt-2 text-[13px] leading-6 text-muted-strong">{description}</p>
        </div>
        <MetaPill>{groups.length} 组</MetaPill>
      </div>

      <div className="mt-5 grid gap-3 xl:grid-cols-2">
        {groups.map((group) => (
          <button
            key={group.id}
            type="button"
            onClick={() => onSelectGroup(group.id)}
            className="w-full rounded-[22px] border border-line bg-[#fcfbf8] px-5 py-4 text-left transition hover:border-text/15 hover:bg-white"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h4 className="text-[19px] font-semibold tracking-[-0.03em] text-text">{group.label}</h4>
                  {activeCollection || group.collectionDisplayLabel === group.label ? null : (
                    <Badge tone={group.collectionId === "opencrab-core" ? "warm" : "neutral"}>
                      {group.collectionDisplayLabel}
                    </Badge>
                  )}
                </div>
                <p className="mt-2 line-clamp-2 text-[13px] leading-6 text-muted-strong">{group.description}</p>
              </div>
              <MetaPill>{group.count}</MetaPill>
            </div>
            <div className="mt-4 flex items-center justify-between text-[12px] text-muted-strong">
              <span>{group.count} 个角色</span>
              <span className="font-medium text-text">进入此组</span>
            </div>
          </button>
        ))}
      </div>
    </section>
  );
}

function SystemAgentGroupSection({
  group,
  pendingKey,
  onStartConversation,
}: {
  group: ReturnType<typeof groupAgentsByGroup>[number];
  pendingKey: string | null;
  onStartConversation: (agentId: string, agentName: string) => Promise<void>;
}) {
  const collectionDisplayLabel = formatCollectionDisplayLabel(group.collectionId, group.collectionLabel);
  const showCollectionBadge = collectionDisplayLabel !== group.label;

  return (
    <section className="rounded-[24px] border border-line bg-background p-5">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-[20px] font-semibold tracking-[-0.03em] text-text">{group.label}</h3>
            {showCollectionBadge ? (
              <Badge tone={group.collectionId === "opencrab-core" ? "warm" : "neutral"}>
                {collectionDisplayLabel}
              </Badge>
            ) : null}
          </div>
          <p className="mt-2 text-[13px] leading-6 text-muted-strong">{group.description}</p>
        </div>
        <span className="rounded-full border border-line bg-surface-muted px-3 py-1.5 text-[12px] text-muted-strong">
          {group.agents.length} 个
        </span>
      </div>

      <div className="mt-5">
        <AgentCardGrid
          agents={group.agents}
          pendingKey={pendingKey}
          onStartConversation={onStartConversation}
          isSystemSection
        />
      </div>
    </section>
  );
}

function AgentCardGrid({
  agents,
  pendingKey,
  onStartConversation,
  isSystemSection,
}: {
  agents: ReturnType<typeof useOpenCrabApp>["agents"];
  pendingKey: string | null;
  onStartConversation: (agentId: string, agentName: string) => Promise<void>;
  isSystemSection: boolean;
}) {
  return (
    <div className="grid gap-4 xl:grid-cols-2">
      {agents.map((agent) => (
        <AgentCard
          key={agent.id}
          agent={agent}
          pendingKey={pendingKey}
          onStartConversation={onStartConversation}
          isSystemSection={isSystemSection}
        />
      ))}
    </div>
  );
}

function AgentCard({
  agent,
  pendingKey,
  onStartConversation,
  isSystemSection,
}: {
  agent: AgentProfileRecord;
  pendingKey: string | null;
  onStartConversation: (agentId: string, agentName: string) => Promise<void>;
  isSystemSection: boolean;
}) {
  return (
    <article className="rounded-[24px] border border-line bg-background p-5">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <AgentAvatar src={agent.avatarDataUrl} name={agent.name} size={52} />
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-[20px] font-semibold tracking-[-0.03em] text-text">{agent.name}</h3>
              <Badge tone={isSystemSection ? "warm" : "neutral"}>{isSystemSection ? "系统" : "自定义"}</Badge>
            </div>
            <div className="mt-2 text-[13px] text-muted-strong">{agent.roleLabel}</div>
          </div>
        </div>

        <div className="rounded-[18px] bg-[#f7f8fb] px-3 py-2 text-right text-[12px] text-muted-strong">
          <div>{formatAvailability(agent.availability)}</div>
          <div className="mt-1">{agent.fileCount} 个上下文文件</div>
        </div>
      </div>

      <p className="mt-4 text-[14px] leading-7 text-muted-strong">{agent.summary}</p>

      <div className="mt-4 flex flex-wrap gap-2 text-[12px] text-muted-strong">
        {agent.defaultReasoningEffort ? <MetaPill>{agent.defaultReasoningEffort}</MetaPill> : null}
        {agent.defaultSandboxMode ? <MetaPill>{agent.defaultSandboxMode}</MetaPill> : null}
        <MetaPill>{formatTeamRole(agent.teamRole)}</MetaPill>
        {isSystemSection ? <MetaPill>{agent.groupLabel}</MetaPill> : null}
        {agent.promoted ? <Badge tone="warm">推荐</Badge> : null}
      </div>

      <div className="mt-5 flex flex-wrap gap-3">
        <button
          type="button"
          onClick={() => void onStartConversation(agent.id, agent.name)}
          className={buttonClassName({ variant: "primary" })}
          disabled={pendingKey === `chat:${agent.id}`}
        >
          {pendingKey === `chat:${agent.id}` ? "创建中..." : "开始对话"}
        </button>
        <Link href={`/agents/${agent.id}`} className={buttonClassName({ variant: "secondary" })}>
          查看详情
        </Link>
      </div>
    </article>
  );
}

function Badge({ children, tone }: { children: React.ReactNode; tone: "warm" | "neutral" }) {
  return <UnifiedStatusPill tone={tone === "warm" ? "warning" : "neutral"}>{children}</UnifiedStatusPill>;
}

function MetaPill({ children }: { children: React.ReactNode }) {
  return <UnifiedMetaPill>{children}</UnifiedMetaPill>;
}

function formatAvailability(value: "solo" | "team" | "both") {
  switch (value) {
    case "solo":
      return "仅单聊";
    case "team":
      return "仅团队";
    default:
      return "单聊 + 团队";
  }
}

function formatTeamRole(value: "lead" | "research" | "writer" | "specialist") {
  switch (value) {
    case "lead":
      return "负责人";
    case "research":
      return "研究";
    case "writer":
      return "写作";
    default:
      return "专项";
  }
}

function buildSystemGroupOptions(agents: AgentProfileRecord[]) {
  return groupAgentsByGroup(agents).map((group) => ({
    id: group.id,
    label: group.label,
    description: group.description,
    collectionId: group.collectionId,
    collectionLabel: group.collectionLabel,
    collectionDisplayLabel: formatCollectionDisplayLabel(group.collectionId, group.collectionLabel),
    count: group.agents.length,
  }));
}

function buildSystemCollectionOptions(agents: AgentProfileRecord[]) {
  const collections = new Map<
    string,
    {
      id: string;
      label: string;
      displayLabel: string;
      description: string;
      order: number;
      count: number;
      groupIds: Set<string>;
    }
  >();

  agents.forEach((agent) => {
    const existing = collections.get(agent.collectionId);

    if (existing) {
      existing.count += 1;
      existing.groupIds.add(agent.groupId);
      return;
    }

    collections.set(agent.collectionId, {
      id: agent.collectionId,
      label: agent.collectionLabel,
      displayLabel: formatCollectionDisplayLabel(agent.collectionId, agent.collectionLabel),
      description: agent.collectionDescription,
      order: agent.collectionOrder,
      count: 1,
      groupIds: new Set([agent.groupId]),
    });
  });

  return Array.from(collections.values())
    .sort((left, right) => left.order - right.order)
    .map((collection) => ({
      id: collection.id,
      label: collection.label,
      displayLabel: collection.displayLabel,
      description: collection.description,
      order: collection.order,
      count: collection.count,
      groupCount: collection.groupIds.size,
    }));
}

function groupAgentsByGroup(agents: AgentProfileRecord[]) {
  const groups = new Map<
    string,
    {
      id: string;
      label: string;
      description: string;
      order: number;
      collectionId: string;
      collectionLabel: string;
      collectionOrder: number;
      agents: AgentProfileRecord[];
    }
  >();

  agents.forEach((agent) => {
    const existing = groups.get(agent.groupId);

    if (existing) {
      existing.agents.push(agent);
      return;
    }

    groups.set(agent.groupId, {
      id: agent.groupId,
      label: agent.groupLabel,
      description: agent.groupDescription,
      order: agent.groupOrder,
      collectionId: agent.collectionId,
      collectionLabel: agent.collectionLabel,
      collectionOrder: agent.collectionOrder,
      agents: [agent],
    });
  });

  return Array.from(groups.values()).sort((left, right) => {
    if (left.collectionOrder !== right.collectionOrder) {
      return left.collectionOrder - right.collectionOrder;
    }

    if (left.order !== right.order) {
      return left.order - right.order;
    }

    return left.label.localeCompare(right.label, "zh-Hans-CN");
  });
}

function formatCollectionDisplayLabel(collectionId: string, collectionLabel: string) {
  switch (collectionId) {
    case "opencrab-core":
      return "OpenCrab 核心";
    case "agency-agents":
      return "扩展角色库";
    default:
      return collectionLabel;
  }
}

function SearchIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path
        d="M11.2 10.4 14 13.2"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
      />
      <circle cx="7.2" cy="7.2" r="4.4" stroke="currentColor" strokeWidth="1.4" />
    </svg>
  );
}

function PlusIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path d="M8 3.2v9.6M3.2 8h9.6" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  );
}
