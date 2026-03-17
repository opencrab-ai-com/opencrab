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
import {
  createSkill,
  getSkillsCatalog,
  mutateSkill,
} from "@/lib/resources/opencrab-api";
import type { SkillAction, SkillRecord } from "@/lib/resources/opencrab-api-types";
import { SkillIcon } from "@/components/skills/skill-icon";

type CreateSkillDialogState = {
  name: string;
  summary: string;
  detailsMarkdown: string;
};

export function SkillsScreen() {
  const [skills, setSkills] = useState<SkillRecord[]>([]);
  const [query, setQuery] = useState("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [pendingActionKey, setPendingActionKey] = useState<string | null>(null);
  const [createDialog, setCreateDialog] = useState<CreateSkillDialogState | null>(null);

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
  const recommendedSkills = filteredSkills.filter((skill) => skill.status === "available");
  const installedCount = skills.filter((skill) => skill.status === "installed").length;
  const disabledCount = skills.filter((skill) => skill.status === "disabled").length;
  const availableCount = skills.filter((skill) => skill.status === "available").length;

  const loadSkills = useCallback(async () => {
    setIsLoading(true);
    setErrorMessage(null);

    try {
      const response = await getSkillsCatalog();
      setSkills(response.skills);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "加载技能列表失败。");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadSkills();
  }, [loadSkills]);

  async function handleAction(skillId: string, action: SkillAction) {
    setPendingActionKey(`${skillId}:${action}`);
    setErrorMessage(null);

    try {
      const response = await mutateSkill(skillId, action);
      setSkills((current) => reconcileSkills(current, skillId, response.skill));
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
      setSkills((current) => reconcileSkills(current, null, response.skill, { prepend: true }));
      setCreateDialog(null);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "创建技能失败。");
    } finally {
      setPendingActionKey(null);
    }
  }

  return (
    <>
      <div className="space-y-10">
        <header className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <h1 className="text-[40px] font-semibold tracking-[-0.05em] text-text">技能</h1>
            <p className="mt-3 text-[15px] leading-7 text-muted-strong">
              赋予 Codex 更强大的能力。
              <span className="ml-2 text-[#1a73e8]">详情页和说明文档来自 Codex skills，但这里的状态只作用于 OpenCrab。</span>
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={() => void loadSkills()}
              className="inline-flex h-11 items-center gap-2 rounded-full px-4 text-[14px] text-muted-strong transition hover:bg-surface-muted hover:text-text"
            >
              <RefreshIcon />
              <span>刷新</span>
            </button>

            <label className="flex h-11 min-w-[260px] items-center gap-2 rounded-full border border-line bg-surface px-4 text-[14px] text-muted-strong">
              <SearchIcon />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="搜索技能"
                className="w-full border-0 bg-transparent text-text outline-none placeholder:text-muted"
              />
            </label>

            <button
              type="button"
              onClick={() => setCreateDialog({ name: "", summary: "", detailsMarkdown: "" })}
              className="inline-flex h-11 items-center gap-2 rounded-full bg-[#111111] px-5 text-[14px] font-medium text-white transition hover:bg-[#222222]"
            >
              <PlusIcon />
              <span>新技能</span>
            </button>
          </div>
        </header>

        <section className="rounded-[22px] border border-line bg-surface-muted px-5 py-4 text-[13px] leading-6 text-muted-strong">
          OpenCrab 会从 <code>~/.codex/skills</code> 复制技能名称、简介和说明文档，但安装、禁用、卸载状态保存在 OpenCrab 自己的本地 store 里，不会去改 Codex app 的技能目录。
        </section>

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

        <SkillSection
          title="推荐"
          skills={recommendedSkills}
          isLoading={isLoading}
          emptyLabel={query ? "没有匹配的推荐技能" : "当前没有推荐技能"}
          pendingActionKey={pendingActionKey}
          onAction={handleAction}
        />
      </div>

      {createDialog ? (
        <DialogShell onClose={() => setCreateDialog(null)}>
          <DialogHeader
            title="新技能"
            description="这个技能只会写入 OpenCrab 本地 store，不会创建或修改 Codex app 的技能文件。"
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

function SkillOverviewCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[20px] border border-line bg-surface px-5 py-4 shadow-soft">
      <div className="text-[12px] text-muted">{label}</div>
      <div className="mt-2 text-[28px] font-semibold tracking-[-0.04em] text-text">{value}</div>
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
  const [leftColumn, rightColumn] = splitIntoColumns(skills);

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
      )}
    </section>
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
    <div className="group flex items-center gap-4 rounded-[18px] px-3 py-3 transition hover:bg-surface-muted">
      <Link href={`/skills/${skill.id}`} className="flex min-w-0 flex-1 items-center gap-4">
        <SkillIcon icon={skill.icon} />

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-3">
            <span className="text-[17px] font-medium tracking-[-0.02em] text-text">{skill.name}</span>
            <span
              className={`rounded-full px-2.5 py-1 text-[11px] ${
                skill.status === "installed"
                  ? "bg-[#eef8f0] text-[#23633a]"
                  : skill.status === "disabled"
                    ? "bg-[#f3f4f6] text-[#5f6368]"
                    : "bg-[#f7f4ef] text-[#8a6b3d]"
              }`}
            >
              {skill.statusLabel}
            </span>
          </div>
          <p className="mt-1 truncate text-[14px] text-muted-strong">{skill.summary}</p>
        </div>
      </Link>

      <div className="flex shrink-0 items-center gap-2">
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
              onClick={() => onAction(skill.id, skill.status === "disabled" ? "enable" : "disable")}
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
      className="flex h-10 w-10 items-center justify-center rounded-full text-muted-strong transition hover:bg-background hover:text-text disabled:cursor-not-allowed disabled:opacity-50"
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
      className="rounded-full border border-line bg-background px-3 py-2 text-[12px] text-muted-strong transition hover:border-text/15 hover:text-text disabled:cursor-not-allowed disabled:opacity-50"
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
