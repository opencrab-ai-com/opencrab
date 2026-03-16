import Link from "next/link";
import { AppPage } from "@/components/ui/app-page";
import { PageHeader } from "@/components/ui/page-header";
import { getSkillOverviewStats, getSkillViewModels, type SkillViewModel } from "@/lib/view-models/skills";

export default function SkillsPage() {
  const skills = getSkillViewModels();
  const stats = getSkillOverviewStats();
  const enabledSkills = skills.filter((skill) => skill.isEnabled);
  const plannedSkills = skills.filter((skill) => !skill.isEnabled);

  return (
    <AppPage width="wide" contentClassName="space-y-8">
      <PageHeader
        title="Skills"
        description="Skills 用来收纳 OpenCrab 当前已经整理好的专项能力。第一版先把能力边界、适用场景和接入方式讲清楚，不做市场化分发。"
      />

      <section className="rounded-[28px] border border-line bg-surface p-6 shadow-soft">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-[720px]">
            <div className="inline-flex rounded-full border border-line bg-surface-muted px-3 py-1 text-[12px] text-muted-strong">
              当前聚焦文档、自动执行和远程入口三类能力
            </div>
            <h2 className="mt-4 text-[26px] font-semibold tracking-[-0.04em] text-text">
              先把常用能力做成可解释、可选择的页面，而不是堆一个抽象市场。
            </h2>
            <p className="mt-3 text-[14px] leading-7 text-muted-strong">
              每个 Skill 都会说明它适合处理什么、依赖哪些能力，以及当前还没有覆盖哪些边界。这样用户在进入详情前，就能先判断它是不是当前要用的那一个。
            </p>
          </div>

          <Link
            href={enabledSkills[0] ? `/skills/${enabledSkills[0].id}` : "/skills"}
            className="inline-flex h-11 items-center justify-center rounded-[14px] border border-text bg-text px-5 text-[13px] font-medium text-white transition hover:opacity-90"
          >
            查看已启用能力
          </Link>
        </div>

        <div className="mt-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <MetricCard label="Skills 总数" value={`${stats.total}`} detail="当前前端已整理的专项能力数量" />
          <MetricCard label="已启用" value={`${stats.enabled}`} detail="可以直接说明用途和接入边界" />
          <MetricCard label="待补完" value={`${stats.pending}`} detail="已有方向，但还没进入完整能力闭环" />
          <MetricCard label="覆盖分类" value={`${stats.categories}`} detail="文档协作、自动执行、远程入口" />
        </div>
      </section>

      <SkillSection
        title="可直接介绍给用户的 Skills"
        description="这些能力已经有明确定位，可以直接说明适用场景、依赖关系和下一步动作。"
        skills={enabledSkills}
      />

      <SkillSection
        title="还在补能力闭环的 Skills"
        description="这些方向已经进入产品结构，但体验仍依赖其他模块继续补齐。"
        skills={plannedSkills}
      />
    </AppPage>
  );
}

function SkillSection({
  title,
  description,
  skills,
}: {
  title: string;
  description: string;
  skills: SkillViewModel[];
}) {
  return (
    <section className="rounded-[28px] border border-line bg-surface p-6 shadow-soft">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-[20px] font-semibold tracking-[-0.03em] text-text">{title}</h2>
          <p className="mt-2 max-w-[760px] text-[14px] leading-6 text-muted-strong">{description}</p>
        </div>
        <div className="rounded-full border border-line bg-surface-muted px-4 py-2 text-[12px] text-muted-strong">
          {skills.length} 个条目
        </div>
      </div>

      <div className="mt-6 grid gap-5 lg:grid-cols-2 xl:grid-cols-3">
        {skills.map((skill) => (
          <SkillCard key={skill.id} skill={skill} />
        ))}
      </div>
    </section>
  );
}

function SkillCard({ skill }: { skill: SkillViewModel }) {
  return (
    <Link
      href={`/skills/${skill.id}`}
      className="group rounded-[24px] border border-line bg-[#fcfcf9] p-5 transition hover:-translate-y-0.5 hover:border-text/20"
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-[11px] uppercase tracking-[0.14em] text-muted">{skill.category}</div>
          <h3 className="mt-3 text-[20px] font-semibold tracking-[-0.04em] text-text">{skill.name}</h3>
        </div>
        <StatusPill isEnabled={skill.isEnabled}>{skill.status}</StatusPill>
      </div>

      <p className="mt-3 text-[14px] leading-6 text-muted-strong">{skill.headline}</p>

      <div className="mt-5 grid gap-3 sm:grid-cols-2">
        <MiniInfo label="覆盖范围" value={skill.coverageLabel} />
        <MiniInfo label="依赖能力" value={skill.dependencyLabel} />
      </div>

      <div className="mt-5 flex flex-wrap gap-2">
        {skill.capabilities.map((item) => (
          <span
            key={item}
            className="rounded-full border border-line bg-background px-3 py-1.5 text-[12px] text-muted-strong"
          >
            {item}
          </span>
        ))}
      </div>

      <div className="mt-5 rounded-[18px] border border-line bg-background px-4 py-4">
        <div className="text-[11px] uppercase tracking-[0.12em] text-muted">适用场景</div>
        <ul className="mt-3 space-y-2 text-[13px] leading-6 text-muted-strong">
          {skill.useCases.map((item) => (
            <li key={item} className="flex items-start gap-2">
              <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-text/70" />
              <span>{item}</span>
            </li>
          ))}
        </ul>
      </div>

      <div className="mt-5 flex items-center justify-between text-[13px] text-muted-strong">
        <span>{skill.nextStep}</span>
        <span className="shrink-0 transition group-hover:translate-x-0.5">查看详情 {"->"}</span>
      </div>
    </Link>
  );
}

function MetricCard({
  label,
  value,
  detail,
}: {
  label: string;
  value: string;
  detail: string;
}) {
  return (
    <div className="rounded-[22px] border border-line bg-surface-muted px-5 py-5">
      <div className="text-[11px] uppercase tracking-[0.12em] text-muted">{label}</div>
      <div className="mt-3 text-[30px] font-semibold tracking-[-0.05em] text-text">{value}</div>
      <p className="mt-2 text-[13px] leading-6 text-muted-strong">{detail}</p>
    </div>
  );
}

function MiniInfo({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[16px] border border-line bg-background px-4 py-3">
      <div className="text-[11px] text-muted">{label}</div>
      <div className="mt-2 text-[13px] font-medium leading-5 text-text">{value}</div>
    </div>
  );
}

function StatusPill({
  isEnabled,
  children,
}: {
  isEnabled: boolean;
  children: React.ReactNode;
}) {
  return (
    <span
      className={`shrink-0 rounded-full border px-3 py-1.5 text-[12px] font-medium ${
        isEnabled
          ? "border-[#cfe7d4] bg-[#eef8f0] text-[#23633a]"
          : "border-line bg-surface-muted text-muted-strong"
      }`}
    >
      {children}
    </span>
  );
}
