"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import type { ReactNode } from "react";
import { useCallback, useEffect, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { SkillIcon } from "@/components/skills/skill-icon";
import { AppPage } from "@/components/ui/app-page";
import { getSkillDetail, mutateSkill } from "@/lib/resources/opencrab-api";
import type { SkillAction, SkillRecord } from "@/lib/resources/opencrab-api-types";

export function SkillDetailScreen({ skillId }: { skillId: string }) {
  const router = useRouter();
  const [skill, setSkill] = useState<SkillRecord | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [pendingAction, setPendingAction] = useState<SkillAction | null>(null);

  const loadSkill = useCallback(async () => {
    setIsLoading(true);
    setErrorMessage(null);

    try {
      const response = await getSkillDetail(skillId);
      setSkill(response.skill);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "加载技能详情失败。");
    } finally {
      setIsLoading(false);
    }
  }, [skillId]);

  useEffect(() => {
    void loadSkill();
  }, [loadSkill]);

  async function handleAction(action: SkillAction) {
    setPendingAction(action);
    setErrorMessage(null);

    try {
      const response = await mutateSkill(skillId, action);

      if (!response.skill && skill?.isCustom && action === "uninstall") {
        router.push("/skills");
        return;
      }

      setSkill(response.skill);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "技能操作失败。");
    } finally {
      setPendingAction(null);
    }
  }

  return (
    <AppPage width="wide" contentClassName="space-y-8">
      <div className="flex items-center justify-between gap-4">
        <Link
          href="/skills"
          className="inline-flex h-10 items-center rounded-full border border-line bg-surface px-4 text-[13px] text-muted-strong transition hover:border-text/15 hover:text-text"
        >
          返回技能页
        </Link>
      </div>

      {isLoading ? (
        <div className="rounded-[24px] border border-line bg-surface p-6 shadow-soft text-[14px] text-muted-strong">
          正在加载技能详情...
        </div>
      ) : !skill ? (
        <div className="rounded-[24px] border border-line bg-surface p-6 shadow-soft text-[14px] text-muted-strong">
          没有找到这个技能。
        </div>
      ) : (
        <>
          <section className="rounded-[28px] border border-line bg-surface p-6 shadow-soft">
            <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
              <div className="flex items-start gap-5">
                <SkillIcon icon={skill.icon} />

                <div>
                  <div className="flex flex-wrap items-center gap-3">
                    <h1 className="text-[34px] font-semibold tracking-[-0.05em] text-text">{skill.name}</h1>
                    <StatusPill status={skill.status}>{skill.statusLabel}</StatusPill>
                  </div>
                  <p className="mt-3 max-w-[760px] text-[15px] leading-7 text-muted-strong">
                    {skill.summary}
                  </p>
                  <div className="mt-4 flex flex-wrap gap-2 text-[12px] text-muted-strong">
                    <MetaPill>{skill.originLabel}</MetaPill>
                    {skill.sourcePath ? <MetaPill>{skill.sourcePath}</MetaPill> : null}
                  </div>
                </div>
              </div>

              <div className="flex flex-wrap gap-3">
                {skill.status === "available" ? (
                  <PrimaryActionButton
                    disabled={pendingAction === "install"}
                    onClick={() => void handleAction("install")}
                  >
                    安装到 OpenCrab
                  </PrimaryActionButton>
                ) : (
                  <>
                    <SecondaryActionButton
                      disabled={pendingAction === "disable" || pendingAction === "enable"}
                      onClick={() =>
                        void handleAction(skill.status === "disabled" ? "enable" : "disable")
                      }
                    >
                      {skill.status === "disabled" ? "启用" : "禁用"}
                    </SecondaryActionButton>
                    <SecondaryActionButton
                      disabled={pendingAction === "uninstall"}
                      onClick={() => void handleAction("uninstall")}
                    >
                      卸载
                    </SecondaryActionButton>
                  </>
                )}
              </div>
            </div>

            <div className="mt-6 rounded-[18px] border border-line bg-surface-muted px-4 py-4 text-[13px] leading-6 text-muted-strong">
              {skill.note}
            </div>

            {errorMessage ? (
              <div className="mt-4 rounded-[18px] border border-[#f3d0cb] bg-[#fff3f1] px-4 py-3 text-[13px] text-[#b42318]">
                {errorMessage}
              </div>
            ) : null}
          </section>

          <div className="grid gap-6 xl:grid-cols-[0.82fr_1.18fr]">
            <section className="rounded-[24px] border border-line bg-surface p-6 shadow-soft">
              <h2 className="text-[18px] font-semibold tracking-[-0.03em] text-text">技能状态</h2>
              <div className="mt-5 grid gap-4">
                <InfoCard label="当前状态" value={skill.statusLabel} />
                <InfoCard label="来源" value={skill.originLabel} />
                <InfoCard
                  label="影响范围"
                  value="只影响 OpenCrab 的技能管理状态，不会修改 Codex app 的技能目录。"
                />
                <InfoCard
                  label="最近变更"
                  value={skill.updatedAt ? new Date(skill.updatedAt).toLocaleString("zh-CN") : "未记录"}
                />
              </div>
            </section>

            <section className="rounded-[24px] border border-line bg-surface p-6 shadow-soft">
              <h2 className="text-[18px] font-semibold tracking-[-0.03em] text-text">技能说明</h2>
              <div className="markdown-body mt-5 text-[14px] leading-7 text-muted-strong">
                {skill.detailsMarkdown ? (
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>{skill.detailsMarkdown}</ReactMarkdown>
                ) : (
                  <p>这个技能还没有补充说明文档。</p>
                )}
              </div>
            </section>
          </div>
        </>
      )}
    </AppPage>
  );
}

function InfoCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[18px] border border-line bg-surface-muted px-4 py-4">
      <div className="text-[11px] uppercase tracking-[0.12em] text-muted">{label}</div>
      <div className="mt-2 text-[14px] leading-6 text-text">{value}</div>
    </div>
  );
}

function PrimaryActionButton({
  children,
  onClick,
  disabled,
}: {
  children: ReactNode;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="rounded-full bg-[#111111] px-5 py-3 text-[13px] font-medium text-white transition hover:bg-[#262626] disabled:cursor-not-allowed disabled:bg-[#c9c9c5]"
    >
      {children}
    </button>
  );
}

function SecondaryActionButton({
  children,
  onClick,
  disabled,
}: {
  children: ReactNode;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="rounded-full border border-line bg-surface-muted px-5 py-3 text-[13px] font-medium text-text transition hover:bg-[#ecece7] disabled:cursor-not-allowed disabled:opacity-60"
    >
      {children}
    </button>
  );
}

function StatusPill({
  status,
  children,
}: {
  status: SkillRecord["status"];
  children: ReactNode;
}) {
  return (
    <span
      className={`rounded-full px-3 py-1.5 text-[12px] font-medium ${
        status === "installed"
          ? "bg-[#eef8f0] text-[#23633a]"
          : status === "disabled"
            ? "bg-[#f3f4f6] text-[#5f6368]"
            : "bg-[#f7f4ef] text-[#8a6b3d]"
      }`}
    >
      {children}
    </span>
  );
}

function MetaPill({ children }: { children: ReactNode }) {
  return (
    <span className="rounded-full border border-line bg-surface-muted px-3 py-1.5">
      {children}
    </span>
  );
}
