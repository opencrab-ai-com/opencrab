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
  const [selectedSystemFamilyId, setSelectedSystemFamilyId] = useState("all");
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
  const systemFamilyOptions = useMemo(() => buildSystemFamilyOptions(allSystemAgents), [allSystemAgents]);
  const promotedSystemAgentCount = agents.filter(
    (agent) => isSystemAgentForDisplay(agent) && agent.promoted,
  ).length;
  const isSearching = activeQuery.length > 0;
  const hasSelectedSystemFamily = systemFamilyOptions.some((family) => family.id === selectedSystemFamilyId);
  const effectiveSelectedSystemFamilyId = isSearching
    ? "all"
    : hasSelectedSystemFamily
      ? selectedSystemFamilyId
      : "all";
  const visibleSystemAgents = useMemo(() => {
    return effectiveSelectedSystemFamilyId === "all"
      ? systemAgents
      : systemAgents.filter((agent) => getSystemFamilyId(agent) === effectiveSelectedSystemFamilyId);
  }, [effectiveSelectedSystemFamilyId, systemAgents]);
  const groupedSystemAgents = useMemo(() => groupAgentsByFamily(visibleSystemAgents), [visibleSystemAgents]);
  const activeSystemFamilyOption =
    effectiveSelectedSystemFamilyId === "all"
      ? null
      : systemFamilyOptions.find((family) => family.id === effectiveSelectedSystemFamilyId) ?? null;
  const shouldShowSystemDirectory =
    !isSearching && effectiveSelectedSystemFamilyId === "all" && systemFamilyOptions.length > 1;

  function handleSelectSystemFamily(familyId: string) {
    if (familyId === "all") {
      setSelectedSystemFamilyId("all");
      return;
    }
    setSelectedSystemFamilyId(familyId);
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
            { label: "核心岗位", value: `${systemAgentCount}` },
            { label: "岗位家族", value: `${systemFamilyOptions.length}` },
            { label: "默认推荐", value: `${promotedSystemAgentCount}` },
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
              <h2 className="text-[24px] font-semibold tracking-[-0.04em] text-text">核心岗位目录</h2>
              <p className="mt-2 text-[14px] leading-7 text-muted-strong">
                这些岗位默认对各自职责范围内的结果负责；先选岗位，再把工作交给它闭环。
              </p>
            </div>
            <div className="flex flex-wrap gap-2 text-[12px] text-muted-strong">
              <MetaPill>{systemFamilyOptions.length} 个岗位家族</MetaPill>
              <MetaPill>{systemAgentCount} 个核心岗位</MetaPill>
            </div>
          </div>

          {!isSearching ? (
            <div className="mt-5 flex flex-wrap items-center gap-2 border-t border-line/70 pt-5">
              <span className="text-[12px] font-medium text-muted-strong">岗位家族</span>
              <CollectionSegmentButton
                label="全部岗位"
                count={systemAgentCount}
                isActive={effectiveSelectedSystemFamilyId === "all"}
                onClick={() => handleSelectSystemFamily("all")}
              />
              {systemFamilyOptions.map((family) => (
                <CollectionSegmentButton
                  key={family.id}
                  label={family.label}
                  count={family.count}
                  isActive={effectiveSelectedSystemFamilyId === family.id}
                  onClick={() => handleSelectSystemFamily(family.id)}
                />
              ))}
            </div>
          ) : null}

          <div className="mt-6 space-y-5">
            {groupedSystemAgents.length === 0 ? (
              <div className="rounded-[22px] border border-dashed border-line bg-surface-muted px-5 py-7 text-[14px] text-muted-strong">
                {query ? "没有匹配的核心岗位" : "当前没有核心岗位"}
              </div>
            ) : shouldShowSystemDirectory ? (
              <SystemAgentDirectory
                families={systemFamilyOptions}
                onSelectFamily={handleSelectSystemFamily}
              />
            ) : (
              <div className="space-y-5">
                <SystemAgentFilterSummary
                  query={activeQuery}
                  visibleAgentCount={visibleSystemAgents.length}
                  activeFamily={activeSystemFamilyOption}
                  totalFamilyCount={systemFamilyOptions.length}
                  canReturnToDirectory={!isSearching && systemFamilyOptions.length > 1 && Boolean(activeSystemFamilyOption)}
                  onReturnToDirectory={() => handleSelectSystemFamily("all")}
                />

                <div className="space-y-6">
                  {groupedSystemAgents.map((family) => (
                    <SystemAgentFamilySection
                      key={family.id}
                      family={family}
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
          description="你自定义的长期角色，会保留 identity、contract、execution、quality 和 handoff 五个岗位合同文件。"
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

function SystemAgentFilterSummary({
  query,
  visibleAgentCount,
  activeFamily,
  totalFamilyCount,
  canReturnToDirectory,
  onReturnToDirectory,
}: {
  query: string;
  visibleAgentCount: number;
  activeFamily: ReturnType<typeof buildSystemFamilyOptions>[number] | null;
  totalFamilyCount: number;
  canReturnToDirectory: boolean;
  onReturnToDirectory: () => void;
}) {
  const heading = query.trim()
    ? "搜索结果"
    : activeFamily?.label ?? "全部核心岗位";
  const description = query.trim()
    ? `关键词“${query.trim()}”会跨全部岗位和家族匹配结果，方便直接找到合适的岗位。`
    : activeFamily?.description ?? "跨全部岗位家族浏览当前可用的核心岗位。";

  return (
    <section className="rounded-[24px] border border-line bg-[#f8f6f2] p-5">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <div className="text-[11px] font-medium uppercase tracking-[0.18em] text-muted">
            {query.trim() ? "搜索模式" : "当前范围"}
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <h3 className="text-[22px] font-semibold tracking-[-0.04em] text-text">{heading}</h3>
            {activeFamily ? <Badge tone="warm">岗位家族</Badge> : null}
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
              返回岗位家族
            </button>
          ) : null}
          <MetaPill>{visibleAgentCount} 个岗位</MetaPill>
          <MetaPill>{activeFamily ? activeFamily.label : `${totalFamilyCount} 个家族`}</MetaPill>
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
  families,
  onSelectFamily,
}: {
  families: ReturnType<typeof buildSystemFamilyOptions>;
  onSelectFamily: (familyId: string) => void;
}) {
  const heading = "岗位家族目录";
  const description = "先按岗位家族进入，再决定把工作交给哪个结果 owner，会比直接翻长清单更快。";

  return (
    <section className="rounded-[24px] border border-line bg-background p-5">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <div className="text-[11px] font-medium uppercase tracking-[0.18em] text-muted">目录浏览</div>
          <h3 className="mt-2 text-[22px] font-semibold tracking-[-0.04em] text-text">{heading}</h3>
          <p className="mt-2 text-[13px] leading-6 text-muted-strong">{description}</p>
        </div>
        <MetaPill>{families.length} 组</MetaPill>
      </div>

      <div className="mt-5 grid gap-3 xl:grid-cols-2">
        {families.map((family) => (
          <button
            key={family.id}
            type="button"
            onClick={() => onSelectFamily(family.id)}
            className="w-full rounded-[22px] border border-line bg-[#fcfbf8] px-5 py-4 text-left transition hover:border-text/15 hover:bg-white"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h4 className="text-[19px] font-semibold tracking-[-0.03em] text-text">{family.label}</h4>
                </div>
                <p className="mt-2 line-clamp-2 text-[13px] leading-6 text-muted-strong">{family.description}</p>
              </div>
              <MetaPill>{family.count}</MetaPill>
            </div>
            <div className="mt-4 flex items-center justify-between text-[12px] text-muted-strong">
              <span>{family.count} 个岗位</span>
              <span className="font-medium text-text">进入此家族</span>
            </div>
          </button>
        ))}
      </div>
    </section>
  );
}

function SystemAgentFamilySection({
  family,
  pendingKey,
  onStartConversation,
}: {
  family: ReturnType<typeof groupAgentsByFamily>[number];
  pendingKey: string | null;
  onStartConversation: (agentId: string, agentName: string) => Promise<void>;
}) {
  return (
    <section className="rounded-[24px] border border-line bg-background p-5">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-[20px] font-semibold tracking-[-0.03em] text-text">{family.label}</h3>
            <Badge tone="warm">岗位家族</Badge>
          </div>
          <p className="mt-2 text-[13px] leading-6 text-muted-strong">{family.description}</p>
        </div>
        <span className="rounded-full border border-line bg-surface-muted px-3 py-1.5 text-[12px] text-muted-strong">
          {family.agents.length} 个
        </span>
      </div>

      <div className="mt-5">
        <AgentCardGrid
          agents={family.agents}
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

      {isSystemSection ? (
        <div className="mt-4 space-y-3 rounded-[18px] border border-line/80 bg-surface px-4 py-4">
          <InfoList label="负责结果" items={agent.ownedOutcomes?.slice(0, 3) ?? []} />
          <InfoList
            label="默认交付"
            items={(agent.deliverables ?? []).slice(0, 3).map((item) => item.label)}
          />
          <InfoList label="不适合" items={agent.outOfScope?.slice(0, 3) ?? []} />
        </div>
      ) : null}

      <div className="mt-4 flex flex-wrap gap-2 text-[12px] text-muted-strong">
        {agent.defaultReasoningEffort ? <MetaPill>{agent.defaultReasoningEffort}</MetaPill> : null}
        {agent.defaultSandboxMode ? <MetaPill>{agent.defaultSandboxMode}</MetaPill> : null}
        <MetaPill>{formatTeamRole(agent.teamRole)}</MetaPill>
        {isSystemSection ? <MetaPill>{agent.familyLabel}</MetaPill> : null}
        {agent.promoted ? <Badge tone="warm">推荐</Badge> : null}
      </div>

      <div className="mt-5 flex flex-wrap gap-3">
        <button
          type="button"
          onClick={() => void onStartConversation(agent.id, agent.name)}
          className={buttonClassName({ variant: "primary" })}
          disabled={pendingKey === `chat:${agent.id}`}
        >
          {pendingKey === `chat:${agent.id}`
            ? "创建中..."
            : isSystemSection
              ? "交给这个岗位"
              : "开始对话"}
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

function buildSystemFamilyOptions(agents: AgentProfileRecord[]) {
  return groupAgentsByFamily(agents).map((family) => ({
    id: family.id,
    label: family.label,
    description: family.description,
    count: family.agents.length,
  }));
}

function groupAgentsByFamily(agents: AgentProfileRecord[]) {
  const families = new Map<
    string,
    {
      id: string;
      label: string;
      description: string;
      order: number;
      agents: AgentProfileRecord[];
    }
  >();

  agents.forEach((agent) => {
    const familyId = getSystemFamilyId(agent);
    const existing = families.get(familyId);

    if (existing) {
      existing.agents.push(agent);
      return;
    }

    families.set(familyId, {
      id: familyId,
      label: agent.familyLabel,
      description: agent.familyDescription,
      order: agent.familyOrder,
      agents: [agent],
    });
  });

  return Array.from(families.values()).sort((left, right) => {
    if (left.order !== right.order) {
      return left.order - right.order;
    }

    return left.label.localeCompare(right.label, "zh-Hans-CN");
  });
}

function getSystemFamilyId(agent: AgentProfileRecord) {
  return agent.familyId;
}

function InfoList({ label, items }: { label: string; items: string[] }) {
  if (items.length === 0) {
    return null;
  }

  return (
    <div className="space-y-2">
      <div className="text-[11px] font-medium uppercase tracking-[0.16em] text-muted">{label}</div>
      <div className="flex flex-wrap gap-2">
        {items.map((item) => (
          <MetaPill key={`${label}:${item}`}>{item}</MetaPill>
        ))}
      </div>
    </div>
  );
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
