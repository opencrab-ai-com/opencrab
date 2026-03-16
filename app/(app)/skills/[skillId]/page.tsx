import Link from "next/link";
import { notFound } from "next/navigation";
import { AppPage } from "@/components/ui/app-page";
import { PageHeader } from "@/components/ui/page-header";
import { getSkillViewModelById, getSkillViewModels } from "@/lib/view-models/skills";

export default async function SkillDetailPage({
  params,
}: {
  params: Promise<{ skillId: string }>;
}) {
  const { skillId } = await params;
  const skill = getSkillViewModelById(skillId);

  if (!skill) {
    notFound();
  }

  const relatedSkills = getSkillViewModels().filter((item) => item.id !== skill.id);

  return (
    <AppPage width="wide" contentClassName="space-y-8">
      <div className="flex items-center justify-between gap-4">
        <PageHeader title={skill.name} description={skill.headline} />
        <Link
          href="/skills"
          className="shrink-0 rounded-[14px] border border-line bg-surface px-4 py-2 text-[13px] text-muted-strong transition hover:border-text/15 hover:text-text"
        >
          返回 Skills
        </Link>
      </div>

      <section className="rounded-[28px] border border-line bg-surface p-6 shadow-soft">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
          <div className="max-w-[760px]">
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full border border-line bg-surface-muted px-3 py-1 text-[12px] text-muted-strong">
                {skill.category}
              </span>
              <StatusPill isEnabled={skill.isEnabled}>{skill.status}</StatusPill>
            </div>
            <p className="mt-5 text-[15px] leading-7 text-muted-strong">{skill.description}</p>
            <p className="mt-3 text-[14px] leading-7 text-muted-strong">{skill.categoryDescription}</p>
          </div>

          <div className="grid w-full gap-3 sm:grid-cols-2 lg:max-w-[360px] lg:grid-cols-1">
            <StatusCard label="覆盖范围" value={skill.coverageLabel} />
            <StatusCard label="最适合" value={skill.idealFor} />
            <StatusCard label="依赖关系" value={skill.dependencyLabel} />
          </div>
        </div>
      </section>

      <div className="grid gap-6 xl:grid-cols-[1.4fr_0.8fr]">
        <section className="space-y-6">
          <DetailSection
            title="当前能力点"
            description="这一版先把用户能感知到的能力边界讲清楚，避免在页面上做看起来很全、实际不可用的开关。"
          >
            <div className="grid gap-4 md:grid-cols-2">
              {skill.capabilities.map((item) => (
                <CapabilityCard key={item} title={item} description={skill.headline} />
              ))}
            </div>
          </DetailSection>

          <DetailSection
            title="适用场景"
            description="适合优先落到什么业务动作里，可以直接拿来说明给用户。"
          >
            <div className="grid gap-4 md:grid-cols-3">
              {skill.useCases.map((item) => (
                <ScenarioCard key={item} title={item} />
              ))}
            </div>
          </DetailSection>
        </section>

        <section className="space-y-6">
          <DetailSection
            title="当前边界"
            description="这些不是文案上的谦虚项，而是当前版本确实还没有覆盖的范围。"
          >
            <ul className="space-y-3">
              {skill.guardrails.map((item) => (
                <li
                  key={item}
                  className="rounded-[18px] border border-line bg-surface-muted px-4 py-4 text-[14px] leading-6 text-muted-strong"
                >
                  {item}
                </li>
              ))}
            </ul>
          </DetailSection>

          <DetailSection
            title="下一步"
            description="后续如果继续往前做，这个 Skill 最值得优先补什么。"
          >
            <div className="rounded-[20px] border border-line bg-[#fbfaf6] px-5 py-5">
              <p className="text-[14px] leading-7 text-muted-strong">{skill.nextStep}</p>
            </div>
          </DetailSection>

          <DetailSection
            title="相关 Skills"
            description="从邻近能力跳转，方便继续梳理整体边界。"
          >
            <div className="space-y-3">
              {relatedSkills.map((item) => (
                <Link
                  key={item.id}
                  href={`/skills/${item.id}`}
                  className="flex items-center justify-between rounded-[18px] border border-line bg-surface px-4 py-4 transition hover:border-text/20"
                >
                  <div>
                    <div className="text-[13px] font-medium text-text">{item.name}</div>
                    <div className="mt-1 text-[12px] text-muted-strong">{item.category}</div>
                  </div>
                  <span className="text-[12px] text-muted">查看 {"->"}</span>
                </Link>
              ))}
            </div>
          </DetailSection>
        </section>
      </div>
    </AppPage>
  );
}

function DetailSection({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-[28px] border border-line bg-surface p-6 shadow-soft">
      <div className="max-w-[680px]">
        <h2 className="text-[20px] font-semibold tracking-[-0.03em] text-text">{title}</h2>
        <p className="mt-3 text-[14px] leading-6 text-muted-strong">{description}</p>
      </div>
      <div className="mt-6">{children}</div>
    </section>
  );
}

function StatusCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[18px] border border-line bg-surface-muted px-4 py-4">
      <div className="text-[11px] uppercase tracking-[0.12em] text-muted">{label}</div>
      <div className="mt-2 text-[14px] font-medium leading-6 text-text">{value}</div>
    </div>
  );
}

function CapabilityCard({ title, description }: { title: string; description: string }) {
  return (
    <div className="rounded-[20px] border border-line bg-surface-muted px-5 py-5">
      <div className="text-[15px] font-semibold text-text">{title}</div>
      <p className="mt-2 text-[13px] leading-6 text-muted-strong">{description}</p>
    </div>
  );
}

function ScenarioCard({ title }: { title: string }) {
  return (
    <div className="rounded-[20px] border border-line bg-[#fbfaf6] px-5 py-5">
      <div className="text-[11px] uppercase tracking-[0.12em] text-muted">场景</div>
      <div className="mt-3 text-[15px] font-semibold leading-6 text-text">{title}</div>
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
      className={`rounded-full border px-3 py-1 text-[12px] font-medium ${
        isEnabled
          ? "border-[#cfe7d4] bg-[#eef8f0] text-[#23633a]"
          : "border-line bg-surface-muted text-muted-strong"
      }`}
    >
      {children}
    </span>
  );
}
