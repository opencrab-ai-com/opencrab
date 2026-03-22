"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  DialogActions,
  DialogHeader,
  DialogPrimaryButton,
  DialogSecondaryButton,
  DialogShell,
} from "@/components/ui/dialog";
import { Button, buttonClassName } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import { StatusPill as UnifiedStatusPill } from "@/components/ui/pill";
import {
  createSkill,
  getSkillsCatalog,
  mutateSkill,
} from "@/lib/resources/opencrab-api";
import type {
  SkillAction,
  SkillCategory,
  SkillRecord,
} from "@/lib/resources/opencrab-api-types";
import { SkillIcon } from "@/components/skills/skill-icon";

type CreateSkillDialogState = {
  name: string;
  summary: string;
  detailsMarkdown: string;
};

const RECOMMENDATION_EXCLUDED_IDS = new Set(["transcribe", "claude-api", "figma"]);
let cachedSkillsCatalog: SkillRecord[] | null = null;
let skillsCatalogPromise: Promise<SkillRecord[]> | null = null;

export function SkillsScreen() {
  const [skills, setSkills] = useState<SkillRecord[]>(() => cachedSkillsCatalog ?? []);
  const [query, setQuery] = useState("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(() => cachedSkillsCatalog === null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [pendingActionKey, setPendingActionKey] = useState<string | null>(null);
  const [createDialog, setCreateDialog] = useState<CreateSkillDialogState | null>(null);
  const [selectedRecommendedCategory, setSelectedRecommendedCategory] = useState<
    SkillCategory | "all"
  >("marketing-social");

  const filteredSkills = useMemo(() => {
    const normalized = query.trim().toLowerCase();

    if (!normalized) {
      return skills;
    }

    return skills.filter((skill) =>
      `${skill.name} ${skill.summary} ${skill.originLabel}`.toLowerCase().includes(normalized),
    );
  }, [query, skills]);

  const installedSkills = filteredSkills.filter(
    (skill) => skill.status === "installed" || skill.status === "disabled",
  );
  const recommendedSkills = filteredSkills.filter(
    (skill) => skill.status === "available" && !RECOMMENDATION_EXCLUDED_IDS.has(skill.id),
  );
  const installedCount = skills.filter((skill) => skill.status === "installed").length;
  const disabledCount = skills.filter((skill) => skill.status === "disabled").length;
  const availableCount = skills.filter((skill) => skill.status === "available").length;
  const recommendedCategoryCounts = useMemo(() => {
    return RECOMMENDED_CATEGORY_ORDER.map((category) => ({
      category,
      ...RECOMMENDED_CATEGORY_META[category],
      count: recommendedSkills.filter((skill) => skill.category === category).length,
    }));
  }, [recommendedSkills]);
  const visibleRecommendedCategories = recommendedCategoryCounts.filter((item) =>
    selectedRecommendedCategory === "all" ? item.count > 0 : item.category === selectedRecommendedCategory,
  );

  const loadSkills = useCallback(async ({ silent = false }: { silent?: boolean } = {}) => {
    if (silent) {
      setIsRefreshing(true);
    } else {
      setIsLoading(true);
    }
    setErrorMessage(null);

    try {
      if (!skillsCatalogPromise) {
        skillsCatalogPromise = getSkillsCatalog()
          .then((response) => {
            cachedSkillsCatalog = response.skills;
            return response.skills;
          })
          .finally(() => {
            skillsCatalogPromise = null;
          });
      }

      const nextSkills = await skillsCatalogPromise;
      setSkills(nextSkills);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "加载技能列表失败。");
    } finally {
      if (silent) {
        setIsRefreshing(false);
      } else {
        setIsLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    void loadSkills({ silent: cachedSkillsCatalog !== null });
  }, [loadSkills]);

  async function handleAction(skillId: string, action: SkillAction) {
    setPendingActionKey(`${skillId}:${action}`);
    setErrorMessage(null);

    try {
      const response = await mutateSkill(skillId, action);
      setSkills((current) => {
        const next = reconcileSkills(current, skillId, response.skill);
        cachedSkillsCatalog = next;
        return next;
      });
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "技能操作失败。");
    } finally {
      setPendingActionKey(null);
    }
  }

  async function handleCreateSkill() {
    if (!createDialog) {
      return;
    }

    setPendingActionKey("create");
    setErrorMessage(null);

    try {
      const response = await createSkill({
        name: createDialog.name,
        summary: createDialog.summary,
        detailsMarkdown: createDialog.detailsMarkdown || undefined,
      });
      setSkills((current) => {
        const next = reconcileSkills(current, null, response.skill, { prepend: true });
        cachedSkillsCatalog = next;
        return next;
      });
      setCreateDialog(null);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "创建技能失败。");
    } finally {
      setPendingActionKey(null);
    }
  }

  return (
    <>
      <div className="space-y-8">
        <PageHeader
          title="技能"
          description="把常用能力装进 OpenCrab，统一在这里启用、禁用和管理。"
          className="mb-6"
          actions={
            <div className="flex w-full flex-wrap items-center justify-end gap-3 lg:w-[700px] lg:flex-nowrap">
              <Button
                type="button"
                onClick={() => void loadSkills({ silent: true })}
                variant="ghost"
                className="gap-2"
                disabled={isRefreshing}
              >
                <RefreshIcon />
                <span>{isRefreshing ? "刷新中..." : "刷新"}</span>
              </Button>

              <label className="flex h-10 min-w-[260px] flex-1 items-center gap-2 rounded-full border border-line bg-surface px-4 text-[13px] text-muted-strong">
                <SearchIcon />
                <input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="搜索技能"
                  className="w-full border-0 bg-transparent text-text outline-none placeholder:text-muted"
                />
              </label>

              <Button
                type="button"
                onClick={() => setCreateDialog({ name: "", summary: "", detailsMarkdown: "" })}
                variant="primary"
                className="gap-2"
              >
                <PlusIcon />
                <span>新技能</span>
              </Button>
            </div>
          }
        />

        <section className="grid gap-3 sm:grid-cols-3">
          <SkillOverviewCard label="已启用" value={`${installedCount}`} />
          <SkillOverviewCard label="已禁用" value={`${disabledCount}`} />
          <SkillOverviewCard label="待尝试" value={`${availableCount}`} />
        </section>

        {errorMessage ? (
          <section className="rounded-[18px] border border-[#f3d0cb] bg-[#fff3f1] px-4 py-3 text-[13px] text-[#b42318]">
            {errorMessage}
          </section>
        ) : null}

        <SkillSection
          title="已安装"
          skills={installedSkills}
          isLoading={isLoading}
          emptyLabel={query ? "没有匹配的已安装技能" : "还没有安装技能"}
          pendingActionKey={pendingActionKey}
          onAction={handleAction}
        />

        <RecommendedSkillsSection
          skills={recommendedSkills}
          isLoading={isLoading}
          emptyLabel={query ? "没有匹配的推荐技能" : "当前没有推荐技能"}
          pendingActionKey={pendingActionKey}
          selectedCategory={selectedRecommendedCategory}
          categoryCounts={recommendedCategoryCounts}
          visibleCategories={visibleRecommendedCategories}
          onCategoryChange={setSelectedRecommendedCategory}
          onAction={handleAction}
        />
      </div>

      {createDialog ? (
        <DialogShell onClose={() => setCreateDialog(null)}>
          <DialogHeader
            title="新技能"
            description="这个技能只会写入 OpenCrab 本地空间，不会修改你电脑上其他工具的技能文件。"
          />

          <div className="mt-6 space-y-4">
            <label className="block space-y-2">
              <span className="text-[13px] font-medium text-text">技能名称</span>
              <input
                value={createDialog.name}
                onChange={(event) =>
                  setCreateDialog((current) =>
                    current ? { ...current, name: event.target.value } : current,
                  )
                }
                className="h-11 w-full rounded-[14px] border border-line bg-surface-muted px-4 text-[14px] text-text outline-none"
                placeholder="例如：Design Review"
              />
            </label>

            <label className="block space-y-2">
              <span className="text-[13px] font-medium text-text">简介</span>
              <input
                value={createDialog.summary}
                onChange={(event) =>
                  setCreateDialog((current) =>
                    current ? { ...current, summary: event.target.value } : current,
                  )
                }
                className="h-11 w-full rounded-[14px] border border-line bg-surface-muted px-4 text-[14px] text-text outline-none"
                placeholder="一句话说明这个技能做什么"
              />
            </label>

            <label className="block space-y-2">
              <span className="text-[13px] font-medium text-text">说明文档</span>
              <textarea
                value={createDialog.detailsMarkdown}
                onChange={(event) =>
                  setCreateDialog((current) =>
                    current ? { ...current, detailsMarkdown: event.target.value } : current,
                  )
                }
                rows={6}
                className="w-full rounded-[14px] border border-line bg-surface-muted px-4 py-3 text-[14px] text-text outline-none"
                placeholder="# Design Review&#10;&#10;Describe how this skill should be used."
              />
            </label>
          </div>

          <DialogActions>
            <DialogSecondaryButton onClick={() => setCreateDialog(null)}>取消</DialogSecondaryButton>
            <DialogPrimaryButton
              onClick={() => void handleCreateSkill()}
              disabled={
                pendingActionKey === "create" ||
                !createDialog.name.trim() ||
                !createDialog.summary.trim()
              }
            >
              创建
            </DialogPrimaryButton>
          </DialogActions>
        </DialogShell>
      ) : null}
    </>
  );
}

const RECOMMENDED_CATEGORY_ORDER: SkillCategory[] = [
  "marketing-social",
  "sales-growth",
  "finance-analysis",
  "writing-knowledge",
  "creative-media",
  "business-ops",
  "product-tech",
];

const RECOMMENDED_CATEGORY_META: Record<
  SkillCategory,
  { label: string; description: string }
> = {
  "marketing-social": {
    label: "营销与社媒",
    description: "适合内容策划、社媒运营、广告投放和品牌传播。",
  },
  "sales-growth": {
    label: "销售与增长",
    description: "适合外联触达、销售流程、线索转化和增长动作。",
  },
  "finance-analysis": {
    label: "金融与分析",
    description: "适合财报解读、财务建模、预算分析和 Excel 工作流。",
  },
  "writing-knowledge": {
    label: "写作与知识",
    description: "适合文档起草、内部沟通、演示材料和知识沉淀。",
  },
  "creative-media": {
    label: "创意与内容",
    description: "适合视觉内容、创意写作、故事构思和轻量媒体产出。",
  },
  "business-ops": {
    label: "业务运营",
    description: "适合定价、项目推进、董事会材料和经营协作。",
  },
  "product-tech": {
    label: "产品与技术",
    description: "适合 AI 产品、设计协作、MCP 和技术型工作流。",
  },
  general: {
    label: "通用",
    description: "暂未归类的通用技能。",
  },
};

function SkillOverviewCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[18px] border border-line bg-surface px-5 py-3 shadow-soft">
      <div className="text-[12px] text-muted">{label}</div>
      <div className="mt-1 text-[26px] font-semibold tracking-[-0.04em] text-text">{value}</div>
    </div>
  );
}

function SkillSection({
  title,
  skills,
  isLoading,
  emptyLabel,
  pendingActionKey,
  onAction,
}: {
  title: string;
  skills: SkillRecord[];
  isLoading: boolean;
  emptyLabel: string;
  pendingActionKey: string | null;
  onAction: (skillId: string, action: SkillAction) => void;
}) {
  return (
    <section>
      <div className="mb-5 flex items-center gap-3">
        <h2 className="text-[18px] font-semibold tracking-[-0.03em] text-text">{title}</h2>
        <span className="text-[13px] text-muted">{skills.length}</span>
      </div>

      {isLoading ? (
        <div className="rounded-[20px] border border-line bg-surface-muted px-5 py-6 text-[14px] text-muted-strong">
          正在加载技能...
        </div>
      ) : skills.length === 0 ? (
        <div className="rounded-[20px] border border-dashed border-line bg-surface-muted px-5 py-6 text-[14px] text-muted-strong">
          {emptyLabel}
        </div>
      ) : (
        <SkillGrid skills={skills} pendingActionKey={pendingActionKey} onAction={onAction} />
      )}
    </section>
  );
}

function RecommendedSkillsSection({
  skills,
  isLoading,
  emptyLabel,
  pendingActionKey,
  selectedCategory,
  categoryCounts,
  visibleCategories,
  onCategoryChange,
  onAction,
}: {
  skills: SkillRecord[];
  isLoading: boolean;
  emptyLabel: string;
  pendingActionKey: string | null;
  selectedCategory: SkillCategory | "all";
  categoryCounts: Array<{ category: SkillCategory; label: string; description: string; count: number }>;
  visibleCategories: Array<{ category: SkillCategory; label: string; description: string; count: number }>;
  onCategoryChange: (category: SkillCategory | "all") => void;
  onAction: (skillId: string, action: SkillAction) => void;
}) {
  return (
    <section className="space-y-5">
      <div className="flex items-center gap-3">
        <h2 className="text-[18px] font-semibold tracking-[-0.03em] text-text">推荐</h2>
        <span className="text-[13px] text-muted">{skills.length}</span>
      </div>

      <div className="-mx-1 overflow-x-auto px-1 pb-1">
        <div className="flex min-w-max flex-nowrap gap-2">
        {categoryCounts.map((item) => (
          <CategoryChip
            key={item.category}
            label={item.label}
            count={item.count}
            active={selectedCategory === item.category}
            onClick={() => onCategoryChange(item.category)}
          />
        ))}
        </div>
      </div>

      {isLoading ? (
        <div className="rounded-[20px] border border-line bg-surface-muted px-5 py-6 text-[14px] text-muted-strong">
          正在加载技能...
        </div>
      ) : visibleCategories.length === 0 ? (
        <div className="rounded-[20px] border border-dashed border-line bg-surface-muted px-5 py-6 text-[14px] text-muted-strong">
          {emptyLabel}
        </div>
      ) : (
        <div className="space-y-8">
          {visibleCategories.map((category) => (
            <div key={category.category} className="space-y-3">
              <div className="flex flex-wrap items-end justify-between gap-3">
                <div>
                  <h3 className="text-[16px] font-semibold tracking-[-0.02em] text-text">
                    {category.label}
                  </h3>
                  <p className="mt-1 text-[13px] text-muted-strong">{category.description}</p>
                </div>
                <span className="text-[12px] text-muted">{category.count} 个技能</span>
              </div>

              <SkillGrid
                skills={skills.filter((skill) => skill.category === category.category)}
                pendingActionKey={pendingActionKey}
                onAction={onAction}
              />
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

function CategoryChip({
  label,
  count,
  active,
  onClick,
}: {
  label: string;
  count: number;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={buttonClassName({
        variant: active ? "primary" : "secondary",
        size: "sm",
        className: "shrink-0 gap-2 px-3",
      })}
    >
      <span>{label}</span>
      <span
        className={`rounded-full px-1.5 py-0.5 text-[11px] ${
          active ? "bg-white/16" : "bg-surface-muted"
        }`}
      >
        {count}
      </span>
    </button>
  );
}

function SkillGrid({
  skills,
  pendingActionKey,
  onAction,
}: {
  skills: SkillRecord[];
  pendingActionKey: string | null;
  onAction: (skillId: string, action: SkillAction) => void;
}) {
  const [leftColumn, rightColumn] = splitIntoColumns(skills);

  return (
    <div className="grid gap-x-12 gap-y-2 lg:grid-cols-2">
      <div className="space-y-1">
        {leftColumn.map((skill) => (
          <SkillRow
            key={skill.id}
            skill={skill}
            pendingActionKey={pendingActionKey}
            onAction={onAction}
          />
        ))}
      </div>
      <div className="space-y-1">
        {rightColumn.map((skill) => (
          <SkillRow
            key={skill.id}
            skill={skill}
            pendingActionKey={pendingActionKey}
            onAction={onAction}
          />
        ))}
      </div>
    </div>
  );
}

function SkillRow({
  skill,
  pendingActionKey,
  onAction,
}: {
  skill: SkillRecord;
  pendingActionKey: string | null;
  onAction: (skillId: string, action: SkillAction) => void;
}) {
  const installKey = `${skill.id}:install`;
  const enableKey = `${skill.id}:enable`;
  const disableKey = `${skill.id}:disable`;
  const uninstallKey = `${skill.id}:uninstall`;

  return (
    <div className="group flex items-start gap-4 rounded-[20px] border border-transparent px-3 py-3.5 transition hover:border-line hover:bg-surface-muted/70">
      <Link href={`/skills/${skill.id}`} className="flex min-w-0 flex-1 items-start gap-4">
        <SkillIcon icon={skill.icon} />

        <div className="min-w-0 flex-1 pt-0.5">
          <div className="truncate text-[17px] font-medium tracking-[-0.02em] text-text">
            {skill.name}
          </div>
          <p className="mt-1 truncate text-[14px] text-muted-strong">{skill.summary}</p>
        </div>
      </Link>

      <div className="flex shrink-0 flex-col items-end gap-2 pl-3">
        <SkillStatusBadge status={skill.status} label={skill.statusLabel} />

        <div className="flex items-center gap-2">
          {skill.status === "available" ? (
            <IconActionButton
              label={`安装 ${skill.name}`}
              disabled={pendingActionKey === installKey}
              onClick={() => onAction(skill.id, "install")}
            >
              <AddIcon />
            </IconActionButton>
          ) : (
            <>
              <TextActionButton
                label={skill.status === "disabled" ? "启用" : "禁用"}
                disabled={pendingActionKey === disableKey || pendingActionKey === enableKey}
                onClick={() =>
                  onAction(skill.id, skill.status === "disabled" ? "enable" : "disable")
                }
              />
              <TextActionButton
                label="卸载"
                disabled={pendingActionKey === uninstallKey}
                onClick={() => onAction(skill.id, "uninstall")}
              />
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function SkillStatusBadge({
  status,
  label,
}: {
  status: SkillRecord["status"];
  label: string;
}) {
  const tone =
    status === "installed"
      ? {
          tone: "success" as const,
          dotClassName: "bg-[#38a169]",
        }
      : status === "disabled"
        ? {
            tone: "neutral" as const,
            dotClassName: "bg-[#9ca3af]",
          }
        : {
            tone: "warning" as const,
            dotClassName: "bg-[#c08a37]",
          };

  return (
    <UnifiedStatusPill tone={tone.tone} size="sm" className="gap-1.5 px-2.5 tracking-[0.01em]">
      <span className={`h-1.5 w-1.5 rounded-full ${tone.dotClassName}`} />
      <span>{label}</span>
    </UnifiedStatusPill>
  );
}

function IconActionButton({
  label,
  children,
  onClick,
  disabled,
}: {
  label: string;
  children: ReactNode;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      disabled={disabled}
      className={buttonClassName({
        variant: "ghost",
        className: "h-10 w-10 px-0 text-muted-strong",
      })}
    >
      {children}
    </button>
  );
}

function TextActionButton({
  label,
  onClick,
  disabled,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={buttonClassName({
        variant: "secondary",
        size: "sm",
        className: "min-w-[72px] px-3",
      })}
    >
      {label}
    </button>
  );
}

function splitIntoColumns(skills: SkillRecord[]) {
  const leftColumn: SkillRecord[] = [];
  const rightColumn: SkillRecord[] = [];

  skills.forEach((skill, index) => {
    if (index % 2 === 0) {
      leftColumn.push(skill);
      return;
    }

    rightColumn.push(skill);
  });

  return [leftColumn, rightColumn] as const;
}

function reconcileSkills(
  current: SkillRecord[],
  targetSkillId: string | null,
  nextSkill: SkillRecord | null,
  options?: { prepend?: boolean },
) {
  const nextList = targetSkillId
    ? current.filter((skill) => skill.id !== targetSkillId)
    : [...current];

  if (nextSkill) {
    if (options?.prepend) {
      nextList.unshift(nextSkill);
    } else {
      const existingIndex = current.findIndex((skill) => skill.id === nextSkill.id);

      if (existingIndex >= 0) {
        nextList.splice(existingIndex, 0, nextSkill);
      } else {
        nextList.unshift(nextSkill);
      }
    }
  }

  return nextList;
}

function SearchIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-[18px] w-[18px] stroke-current" strokeWidth="1.8">
      <circle cx="11" cy="11" r="6.5" />
      <path d="m16 16 4 4" strokeLinecap="round" />
    </svg>
  );
}

function RefreshIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-[18px] w-[18px] stroke-current" strokeWidth="1.8">
      <path d="M18.5 8.5V4.8h-3.7" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M18 12a6 6 0 1 1-1.7-4.2l2.2 2.2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function PlusIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-[18px] w-[18px] stroke-current" strokeWidth="2">
      <path d="M12 5v14M5 12h14" strokeLinecap="round" />
    </svg>
  );
}

function AddIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-[20px] w-[20px] stroke-current" strokeWidth="1.8">
      <path d="M12 5v14M5 12h14" strokeLinecap="round" />
    </svg>
  );
}
