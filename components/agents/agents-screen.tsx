"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { AgentAvatar } from "@/components/agents/agent-avatar";
import { AgentOnboardingDialog } from "@/components/agents/agent-onboarding-dialog";
import { useOpenCrabApp } from "@/components/app-shell/opencrab-provider";
import { Button, buttonClassName } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import { MetaPill as UnifiedMetaPill, StatusPill as UnifiedStatusPill } from "@/components/ui/pill";

const HIDDEN_SYSTEM_AGENT_IDS = new Set([
  "product-strategist",
  "research-analyst",
  "writer-editor",
]);

const PROMOTED_SYSTEM_AGENT_IDS = new Set([
  "agent-5567fae0-173c-4b15-8d64-db83ffb058ab",
  "agent-6e418784-be7c-4e6f-9d4e-3b55806f08f0",
  "agent-7b89ec55-53d2-47c7-affd-58e672d1b226",
]);

export function AgentsScreen() {
  const router = useRouter();
  const { agents, createConversation } = useOpenCrabApp();
  const [query, setQuery] = useState("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [pendingKey, setPendingKey] = useState<string | null>(null);
  const [isOnboardingOpen, setIsOnboardingOpen] = useState(false);

  const filteredAgents = useMemo(() => {
    const normalized = query.trim().toLowerCase();

    if (!normalized) {
      return agents;
    }

    return agents.filter((agent) =>
      `${agent.name} ${agent.summary} ${agent.roleLabel}`.toLowerCase().includes(normalized),
    );
  }, [agents, query]);

  const systemAgents = filteredAgents.filter(isSystemAgentForDisplay);
  const customAgents = filteredAgents.filter(isCustomAgentForDisplay);
  const systemAgentCount = agents.filter(isSystemAgentForDisplay).length;
  const customAgentCount = agents.filter(isCustomAgentForDisplay).length;
  const visibleAgentCount = systemAgentCount + customAgentCount;

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
            <div className="flex w-full flex-wrap items-center justify-end gap-3 lg:w-[680px] lg:flex-nowrap">
              <label className="flex h-10 min-w-[240px] flex-1 items-center gap-2 rounded-full border border-line bg-surface px-4 text-[13px] text-muted-strong">
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
                className="gap-2"
              >
                <PlusIcon />
                <span>新智能体</span>
              </Button>
            </div>
          }
        />

        <section className="grid gap-3 sm:grid-cols-3">
          <OverviewCard label="全部" value={`${visibleAgentCount}`} />
          <OverviewCard label="系统内置" value={`${systemAgentCount}`} />
          <OverviewCard label="自定义" value={`${customAgentCount}`} />
        </section>

        {errorMessage ? (
          <section className="rounded-[18px] border border-[#f3d0cb] bg-[#fff3f1] px-4 py-3 text-[13px] text-[#b42318]">
            {errorMessage}
          </section>
        ) : null}

        <AgentSection
          title="系统智能体"
          description="可直接拿来做单聊，也会作为 Team Mode 的默认成员资产。"
          agents={systemAgents}
          pendingKey={pendingKey}
          onStartConversation={handleStartConversation}
          isSystemSection
        />

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
        <div className="mt-6 grid gap-4 xl:grid-cols-2">
          {agents.map((agent) => (
            <article key={agent.id} className="rounded-[24px] border border-line bg-background p-5">
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-start gap-3">
                  <AgentAvatar src={agent.avatarDataUrl} name={agent.name} size={52} />
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-[20px] font-semibold tracking-[-0.03em] text-text">{agent.name}</h3>
                      <Badge tone={isSystemSection ? "warm" : "neutral"}>
                        {isSystemSection ? "系统" : "自定义"}
                      </Badge>
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
          ))}
        </div>
      )}
    </section>
  );
}

function OverviewCard({ label, value }: { label: string; value: string }) {
  return (
    <article className="rounded-[24px] border border-line bg-surface p-5 shadow-soft">
      <div className="text-[12px] text-muted-strong">{label}</div>
      <div className="mt-3 text-[30px] font-semibold tracking-[-0.04em] text-text">{value}</div>
    </article>
  );
}

function Badge({ children, tone }: { children: React.ReactNode; tone: "warm" | "neutral" }) {
  return <UnifiedStatusPill tone={tone === "warm" ? "warning" : "neutral"}>{children}</UnifiedStatusPill>;
}

function MetaPill({ children }: { children: React.ReactNode }) {
  return <UnifiedMetaPill>{children}</UnifiedMetaPill>;
}

function isSystemAgentForDisplay(agent: ReturnType<typeof useOpenCrabApp>["agents"][number]) {
  if (PROMOTED_SYSTEM_AGENT_IDS.has(agent.id)) {
    return true;
  }

  return agent.source === "system" && !HIDDEN_SYSTEM_AGENT_IDS.has(agent.id);
}

function isCustomAgentForDisplay(agent: ReturnType<typeof useOpenCrabApp>["agents"][number]) {
  return agent.source === "custom" && !PROMOTED_SYSTEM_AGENT_IDS.has(agent.id);
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
      return "Lead";
    case "research":
      return "Research";
    case "writer":
      return "Writer";
    default:
      return "Specialist";
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
