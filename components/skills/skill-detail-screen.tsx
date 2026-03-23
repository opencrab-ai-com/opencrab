"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import type { ReactNode } from "react";
import { useCallback, useEffect, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { SkillIcon } from "@/components/skills/skill-icon";
import { AppPage } from "@/components/ui/app-page";
import { Button, buttonClassName } from "@/components/ui/button";
import { MetaPill as UnifiedMetaPill, StatusPill as UnifiedStatusPill } from "@/components/ui/pill";
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
          className={buttonClassName({ variant: "secondary" })}
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
            <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-start">
              <div className="flex min-w-0 items-start gap-5">
                <SkillIcon icon={skill.icon} />

                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-3">
                    <h1 className="text-[32px] font-semibold tracking-[-0.05em] text-text">{skill.name}</h1>
                    <StatusPill status={skill.status}>{skill.statusLabel}</StatusPill>
                  </div>
                  <p className="mt-3 max-w-[760px] text-[15px] leading-7 text-muted-strong">
                    {skill.summary}
                  </p>
                  <div className="mt-4 flex flex-wrap gap-2 text-[12px] text-muted-strong">
                    <MetaPill>{skill.originLabel}</MetaPill>
                    <MetaPill>{skill.categoryLabel}</MetaPill>
                    {skill.sourcePath ? <MetaPill>{skill.sourcePath}</MetaPill> : null}
                  </div>
                </div>
              </div>

              <div className="flex shrink-0 flex-wrap gap-3 lg:justify-end">
                {skill.status === "available" ? (
                  <Button
                    disabled={pendingAction === "install"}
                    onClick={() => void handleAction("install")}
                    variant="primary"
                    className="min-w-[176px] whitespace-nowrap px-6"
                  >
                    安装到OpenCrab
                  </Button>
                ) : (
                  <>
                    <Button
                      disabled={pendingAction === "disable" || pendingAction === "enable"}
                      onClick={() =>
                        void handleAction(skill.status === "disabled" ? "enable" : "disable")
                      }
                      variant="secondary"
                      className="whitespace-nowrap"
                    >
                      {skill.status === "disabled" ? "启用" : "禁用"}
                    </Button>
                    <Button
                      disabled={pendingAction === "uninstall"}
                      onClick={() => void handleAction("uninstall")}
                      variant="secondary"
                      className="whitespace-nowrap"
                    >
                      卸载
                    </Button>
                  </>
                )}
              </div>
            </div>

            <div className="mt-6 rounded-[18px] border border-line bg-surface-muted px-4 py-4 text-[13px] leading-6 text-muted-strong">
              {skill.sourceUrl ? (
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                  <span>来源:</span>
                  <a
                    href={skill.sourceUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="break-all text-[#1a73e8] transition hover:text-[#1558b0] hover:underline"
                  >
                    {skill.sourceUrl}
                  </a>
                </div>
              ) : (
                <div>{skill.note}</div>
              )}
            </div>

            {errorMessage ? (
              <div className="mt-4 rounded-[18px] border border-[#f3d0cb] bg-[#fff3f1] px-4 py-3 text-[13px] text-[#b42318]">
                {errorMessage}
              </div>
            ) : null}
          </section>

          <section className="rounded-[24px] border border-line bg-surface p-6 shadow-soft">
            <h2 className="text-[18px] font-semibold tracking-[-0.03em] text-text">技能说明</h2>
            <div className="markdown-body mt-5 text-[14px] leading-7 text-muted-strong">
              {skill.detailsMarkdown ? (
                <ReactMarkdown
                  remarkPlugins={[remarkGfm]}
                    components={{
                      a: ({ href, ...props }) => (
                        <a
                          {...props}
                          href={resolveSkillMarkdownLink(href, skill.sourceUrl)}
                          target="_blank"
                          rel="noreferrer"
                          className="text-[#1a73e8] underline-offset-2 hover:underline"
                        />
                      ),
                  }}
                >
                  {skill.detailsMarkdown}
                </ReactMarkdown>
              ) : (
                <p>这个技能还没有补充说明文档。</p>
              )}
            </div>
          </section>
        </>
      )}
    </AppPage>
  );
}

function resolveSkillMarkdownLink(href: string | undefined, sourceUrl: string | null) {
  if (!href || href.startsWith("#") || !sourceUrl) {
    return href;
  }

  if (/^[a-z]+:/i.test(href)) {
    return href;
  }

  const match = sourceUrl.match(/^https:\/\/github\.com\/([^/]+)\/([^/]+)\/tree\/([^/]+)\/(.+)$/);

  if (!match) {
    return href;
  }

  const [, owner, repo, ref, basePath] = match;
  const normalizedBase = `${basePath}/`.replace(/\/+/g, "/");
  const resolvedPath = new URL(href, `https://example.invalid/${normalizedBase}`).pathname.replace(
    /^\/+/,
    "",
  );

  return `https://github.com/${owner}/${repo}/blob/${ref}/${resolvedPath}`;
}

function StatusPill({
  status,
  children,
}: {
  status: SkillRecord["status"];
  children: ReactNode;
}) {
  return <UnifiedStatusPill tone={mapSkillStatusTone(status)}>{children}</UnifiedStatusPill>;
}

function MetaPill({ children }: { children: ReactNode }) {
  return <UnifiedMetaPill>{children}</UnifiedMetaPill>;
}

function mapSkillStatusTone(status: SkillRecord["status"]) {
  switch (status) {
    case "installed":
      return "success";
    case "disabled":
      return "neutral";
    default:
      return "warning";
  }
}
