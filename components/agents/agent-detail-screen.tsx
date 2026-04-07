"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import type { ChangeEvent } from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AgentAvatar } from "@/components/agents/agent-avatar";
import { useOpenCrabApp } from "@/components/app-shell/opencrab-provider";
import { AppPage } from "@/components/ui/app-page";
import { Button, buttonClassName } from "@/components/ui/button";
import { buildAgentAvatarOptions } from "@/lib/agents/avatar-library";
import type { SkillRecord } from "@/lib/resources/opencrab-api-types";
import { getAgentDetail, getSkillsCatalog } from "@/lib/resources/opencrab-api";
import type { AgentProfileDetail } from "@/lib/agents/types";

const FILE_FIELD_META = [
  {
    key: "identity",
    label: "identity.md",
    description: "人格、风格、价值观、边界和做判断时的气质。",
  },
  {
    key: "contract",
    label: "contract.md",
    description: "职责、输入输出标准、done definition 和不要越界的部分。",
  },
  {
    key: "execution",
    label: "execution.md",
    description: "工具偏好、查资料方式、执行边界和禁区。",
  },
  {
    key: "quality",
    label: "quality.md",
    description: "关于用户本人、团队或长期偏好的上下文。",
  },
  {
    key: "handoff",
    label: "handoff.md",
    description: "该智能体需要长期记住的领域背景、术语和产品事实。",
  },
] as const;

export function AgentDetailScreen({ agentId }: { agentId: string }) {
  const router = useRouter();
  const { codexModels, createConversation, updateAgent, resetAgent, deleteAgent } = useOpenCrabApp();
  const [agent, setAgent] = useState<AgentProfileDetail | null>(null);
  const [skills, setSkills] = useState<SkillRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isResetting, setIsResetting] = useState(false);
  const [isStartingConversation, setIsStartingConversation] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [avatarSeed, setAvatarSeed] = useState(() => crypto.randomUUID());
  const avatarInputRef = useRef<HTMLInputElement | null>(null);

  const loadAgent = useCallback(async () => {
    setIsLoading(true);
    setErrorMessage(null);

    try {
      const response = await getAgentDetail(agentId);
      setAgent(response.agent);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "加载智能体失败。");
    } finally {
      setIsLoading(false);
    }
  }, [agentId]);

  useEffect(() => {
    void loadAgent();
  }, [loadAgent]);

  useEffect(() => {
    let cancelled = false;

    void getSkillsCatalog()
      .then((response) => {
        if (!cancelled) {
          setSkills(response.skills.filter((skill) => skill.status !== "disabled"));
        }
      })
      .catch(() => {
        if (!cancelled) {
          setSkills([]);
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const modelOptions = useMemo(
    () => [
      { id: "", label: "跟随当前对话设置" },
      ...codexModels.map((model) => ({ id: model.id, label: model.label })),
    ],
    [codexModels],
  );
  const avatarOptions = useMemo(
    () =>
      agent
        ? buildAgentAvatarOptions({
            name: agent.name,
            seed: `${agent.id}:${avatarSeed}`,
          })
        : [],
    [agent, avatarSeed],
  );
  const ownedOutcomes = agent?.ownedOutcomes ?? [];
  const outOfScope = agent?.outOfScope ?? [];
  const deliverables = agent?.deliverables ?? [];
  const defaultSkillIds = agent?.defaultSkillIds ?? [];
  const optionalSkillIds = agent?.optionalSkillIds ?? [];
  const qualityGates = agent?.qualityGates ?? [];
  const handoffTargets = agent?.handoffTargets ?? [];
  const skillNameById = useMemo(
    () => new Map(skills.map((skill) => [skill.id, skill.name] as const)),
    [skills],
  );
  const allSkillOptions = useMemo(
    () => skills.map((skill) => ({ id: skill.id, label: skill.name, summary: skill.summary })),
    [skills],
  );

  async function handleSave() {
    if (!agent) {
      return;
    }

    setIsSaving(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      const next = await updateAgent(agent.id, {
        name: agent.name,
        summary: agent.summary,
        avatarDataUrl: agent.avatarDataUrl,
        roleLabel: agent.roleLabel,
        description: agent.description,
        availability: agent.availability,
        teamRole: agent.teamRole,
        defaultModel: agent.defaultModel,
        defaultReasoningEffort: agent.defaultReasoningEffort,
        defaultSandboxMode: agent.defaultSandboxMode,
        starterPrompts: agent.starterPrompts,
        defaultSkillIds: agent.defaultSkillIds,
        optionalSkillIds: agent.optionalSkillIds,
        files: agent.files,
      });

      if (!next) {
        throw new Error("保存智能体失败。");
      }

      setAgent(next);
      setSuccessMessage("智能体配置已保存。");
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "保存智能体失败。");
    } finally {
      setIsSaving(false);
    }
  }

  async function handleResetAgent() {
    if (!agent || agent.source !== "system") {
      return;
    }

    setIsResetting(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      const next = await resetAgent(agent.id);

      if (!next) {
        throw new Error("恢复默认配置失败。");
      }

      setAgent(next);
      setSuccessMessage("已恢复内置默认配置。");
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "恢复默认配置失败。");
    } finally {
      setIsResetting(false);
    }
  }

  async function handleStartConversation() {
    if (!agent) {
      return;
    }

    setIsStartingConversation(true);
    setErrorMessage(null);

    try {
      const conversationId = await createConversation({
        title: `${agent.name} · 对话`,
        agentProfileId: agent.id,
      });
      router.push(`/conversations/${conversationId}`);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "创建对话失败。");
    } finally {
      setIsStartingConversation(false);
    }
  }

  async function handleDelete() {
    if (!agent || agent.source === "system") {
      return;
    }

    setIsDeleting(true);
    setErrorMessage(null);

    try {
      const ok = await deleteAgent(agent.id);

      if (!ok) {
        throw new Error("删除智能体失败。");
      }

      router.push("/agents");
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "删除智能体失败。");
    } finally {
      setIsDeleting(false);
    }
  }

  async function handleAvatarUpload(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";

    if (!file) {
      return;
    }

    if (!file.type.startsWith("image/")) {
      setErrorMessage("头像上传只支持图片文件。");
      return;
    }

    try {
      const dataUrl = await readFileAsDataUrl(file);
      setAgent((current) => (current ? { ...current, avatarDataUrl: dataUrl } : current));
      setSuccessMessage("已更新头像，记得点击“保存配置”。");
      setErrorMessage(null);
    } catch {
      setErrorMessage("读取头像文件失败，请重试。");
    }
  }

  return (
    <AppPage width="wide" contentClassName="space-y-8">
      <div className="flex items-center justify-between gap-4">
        <Link href="/agents" className={buttonClassName({ variant: "secondary" })}>
          返回智能体页
        </Link>
      </div>

      {isLoading ? (
        <section className="rounded-[24px] border border-line bg-surface p-6 shadow-soft text-[14px] text-muted-strong">
          正在加载智能体详情...
        </section>
      ) : !agent ? (
        <section className="rounded-[24px] border border-line bg-surface p-6 shadow-soft text-[14px] text-muted-strong">
          没有找到这个智能体。
        </section>
      ) : (
        <>
          <section className="rounded-[28px] border border-line bg-surface p-6 shadow-soft">
            <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
              <div className="max-w-[760px]">
                <div className="flex flex-wrap items-center gap-4">
                  <AgentAvatar src={agent.avatarDataUrl} name={agent.name} size={72} className="rounded-[24px]" />
                  <div className="flex flex-wrap items-center gap-3">
                    <h1 className="text-[32px] font-semibold tracking-[-0.05em] text-text">{agent.name}</h1>
                    <Pill>{agent.roleLabel}</Pill>
                    <Pill>{agent.source === "system" ? "核心岗位" : "自定义"}</Pill>
                  </div>
                </div>
                <p className="mt-3 text-[15px] leading-7 text-muted-strong">{agent.summary}</p>
                <div className="mt-4 flex flex-wrap gap-2 text-[12px] text-muted-strong">
                  <Pill>{formatAvailability(agent.availability)}</Pill>
                  <Pill>{formatTeamRole(agent.teamRole)}</Pill>
                  <Pill>{agent.familyLabel}</Pill>
                  <Pill>{agent.fileCount} 个上下文文件</Pill>
                  {agent.source === "system" ? <Pill>岗位合同结构</Pill> : <Pill>固定模板结构</Pill>}
                </div>

                {agent.source === "system" ? (
                  <div className="mt-5 rounded-[18px] border border-[#d7e4ff] bg-[#eef4ff] px-4 py-4 text-[13px] leading-6 text-[#2d56a3]">
                    <div className="font-medium text-[#20458a]">岗位家族</div>
                    <div className="mt-2">{agent.familyDescription}</div>
                  </div>
                ) : null}
              </div>

              <div className="flex flex-wrap gap-3">
                <Button type="button" variant="secondary" onClick={() => void handleSave()} disabled={isSaving}>
                  {isSaving ? "保存中..." : "保存配置"}
                </Button>
                {agent.source === "system" ? (
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() => void handleResetAgent()}
                    disabled={isResetting || isSaving}
                  >
                    {isResetting ? "恢复中..." : "恢复内置默认"}
                  </Button>
                ) : null}
                <Button type="button" onClick={() => void handleStartConversation()} disabled={isStartingConversation}>
                  {isStartingConversation ? "创建中..." : agent.source === "system" ? "交给这个岗位" : "开始对话"}
                </Button>
                {agent.source === "custom" ? (
                  <Button type="button" variant="secondary" onClick={() => void handleDelete()} disabled={isDeleting}>
                    {isDeleting ? "删除中..." : "删除"}
                  </Button>
                ) : null}
              </div>
            </div>

            {errorMessage ? (
              <div className="mt-5 rounded-[18px] border border-[#f3d0cb] bg-[#fff3f1] px-4 py-3 text-[13px] text-[#b42318]">
                {errorMessage}
              </div>
            ) : null}
            {successMessage ? (
              <div className="mt-5 rounded-[18px] border border-[#cfe7d4] bg-[#eef8f0] px-4 py-3 text-[13px] text-[#23633a]">
                {successMessage}
              </div>
            ) : null}
          </section>

          {agent.source === "system" ? (
            <section className="rounded-[28px] border border-line bg-surface p-6 shadow-soft">
              <div className="flex flex-col gap-2 lg:flex-row lg:items-end lg:justify-between">
                <div>
                  <h2 className="text-[24px] font-semibold tracking-[-0.04em] text-text">岗位合同</h2>
                  <p className="mt-2 text-[14px] leading-7 text-muted-strong">
                    系统岗位不靠空泛人设工作，而是按职责边界、默认交付和质量门闭环。
                  </p>
                </div>
                <div className="flex flex-wrap gap-2 text-[12px] text-muted-strong">
                  <Pill>{deliverables.length} 项默认交付</Pill>
                  <Pill>{qualityGates.length} 条质量门</Pill>
                  <Pill>{handoffTargets.length} 个交接对象</Pill>
                </div>
              </div>

              <div className="mt-6 grid gap-5 xl:grid-cols-2">
                <ContractPanel
                  title="负责结果"
                  description="这个岗位职责范围内必须自己闭环的结果。"
                  items={ownedOutcomes}
                />
                <ContractPanel
                  title="不负责"
                  description="超出这些边界时，应该明确说明并转交。"
                  items={outOfScope}
                  tone="neutral"
                />
                <ContractPanel
                  title="默认交付"
                  description="完成时应直接给到用户的成品，而不是泛泛建议。"
                  items={deliverables.map((item) => item.required ? `${item.label}（必交）` : item.label)}
                />
                <ContractPanel
                  title="质量门"
                  description="返回结果前必须先自查通过的标准。"
                  items={qualityGates}
                />
                <ContractPanel
                  title="默认能力"
                  description="这个岗位在运行时优先挂载的 skills。"
                  items={formatSkillList(defaultSkillIds, optionalSkillIds, skillNameById)}
                  tone="neutral"
                />
                <ContractPanel
                  title="交接对象"
                  description="超出职责范围时优先转交给这些核心岗位。"
                  items={handoffTargets.map(formatAgentReference)}
                  tone="neutral"
                />
              </div>
            </section>
          ) : null}

          <section className="rounded-[28px] border border-line bg-surface p-6 shadow-soft">
            <div className="flex flex-col gap-2 lg:flex-row lg:items-end lg:justify-between">
              <div>
                <h2 className="text-[24px] font-semibold tracking-[-0.04em] text-text">技能绑定</h2>
                <p className="mt-2 text-[14px] leading-7 text-muted-strong">
                  默认能力会直接进入该岗位的运行时上下文；可选能力会在需要时一起提供。
                </p>
              </div>
            </div>

            <div className="mt-4 rounded-[18px] border border-[#d7e4ff] bg-[#eef4ff] px-4 py-4 text-[13px] leading-6 text-[#2d56a3]">
              {agent.source === "system" ? (
                <>
                  核心岗位的本地化绑定会写入{" "}
                  <code className="rounded bg-white/70 px-1.5 py-0.5 text-[12px] text-[#20458a]">
                    ~/.opencrab/agents/system/{agent.id}/
                  </code>
                  ，不会修改内置资源。
                </>
              ) : (
                <>
                  自定义智能体的技能绑定会随同它的 profile 一起保存在{" "}
                  <code className="rounded bg-white/70 px-1.5 py-0.5 text-[12px] text-[#20458a]">
                    ~/.opencrab/agents/{agent.id}/
                  </code>
                  。
                </>
              )}
            </div>

            <div className="mt-5 grid gap-5 xl:grid-cols-2">
              <SkillBindingEditor
                title="默认能力"
                description="优先挂载到该岗位上下文中的技能。"
                selectedIds={defaultSkillIds}
                allSkills={allSkillOptions}
                excludedIds={new Set(optionalSkillIds)}
                skillNameById={skillNameById}
                onChange={(nextIds) =>
                  setAgent((current) =>
                    current ? { ...current, defaultSkillIds: dedupeSkillIds(nextIds) } : current,
                  )
                }
              />
              <SkillBindingEditor
                title="可选能力"
                description="默认不强行加载，但允许该岗位按任务调用的技能。"
                selectedIds={optionalSkillIds}
                allSkills={allSkillOptions}
                excludedIds={new Set(defaultSkillIds)}
                skillNameById={skillNameById}
                onChange={(nextIds) =>
                  setAgent((current) =>
                    current ? { ...current, optionalSkillIds: dedupeSkillIds(nextIds) } : current,
                  )
                }
              />
            </div>
          </section>

          <section className="rounded-[28px] border border-line bg-surface p-6 shadow-soft">
            <div className="mb-5 rounded-[18px] border border-[#d7e4ff] bg-[#eef4ff] px-4 py-4 text-[13px] leading-6 text-[#2d56a3]">
              现在所有智能体都统一使用 V2 岗位合同结构。自定义智能体会直接保存到你的 OpenCrab 运行时目录；核心岗位则会保留内置版本，并在你修改后生成一份本地 shadow profile。
            </div>
            {agent.source === "system" ? (
              <div className="mb-5 rounded-[18px] border border-[#f2dfb4] bg-[#fff8e8] px-4 py-4 text-[13px] leading-6 text-[#8a6116]">
                核心岗位的当前产品配置以内置版本为底稿，并在你保存后写入本地运行时目录，不会修改应用打包的源码资源。当前页面先支持 skills 绑定的本地化调整。
              </div>
            ) : null}
            <fieldset disabled={agent.source === "system"} className="contents">
              <Field label="头像" helper="每个智能体都支持独立头像。你可以从自动生成的候选里选，也可以重新生成，或直接上传自己的图片。">
                <div className="rounded-[22px] border border-line bg-background px-4 py-4">
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                    <div className="flex items-center gap-4">
                      <AgentAvatar src={agent.avatarDataUrl} name={agent.name} size={72} className="rounded-[24px]" />
                      <div>
                        <div className="text-[14px] font-medium text-text">当前头像</div>
                        <div className="mt-1 text-[12px] leading-6 text-muted-strong">
                          保存后，这个头像会在智能体列表和对应对话记录里一起展示。
                        </div>
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      <Button type="button" variant="secondary" onClick={() => setAvatarSeed(crypto.randomUUID())}>
                        重新生成
                      </Button>
                      <Button
                        type="button"
                        variant="secondary"
                        onClick={() => avatarInputRef.current?.click()}
                      >
                        上传头像
                      </Button>
                      <input
                        ref={avatarInputRef}
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={(event) => void handleAvatarUpload(event)}
                      />
                    </div>
                  </div>

                  <div className="mt-4 grid gap-3 sm:grid-cols-3 xl:grid-cols-6">
                    {avatarOptions.map((option) => {
                      const isSelected = agent.avatarDataUrl === option.dataUrl;

                      return (
                        <button
                          key={option.id}
                          type="button"
                          onClick={() =>
                            setAgent((current) =>
                              current ? { ...current, avatarDataUrl: option.dataUrl } : current,
                            )
                          }
                          className={`rounded-[20px] border px-3 py-3 transition ${
                            isSelected
                              ? "border-[#1f4fd1] bg-[#eef4ff] shadow-[0_0_0_1px_rgba(31,79,209,0.08)]"
                              : "border-line bg-surface hover:bg-surface-muted"
                          }`}
                        >
                          <div className="flex flex-col items-center gap-2">
                            <AgentAvatar src={option.dataUrl} name={agent.name} size={56} className="rounded-[20px]" />
                            <span className="text-[11px] font-medium text-text">{option.label}</span>
                            <span className="text-[11px] text-muted-strong">{isSelected ? "当前使用" : "点击选用"}</span>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </Field>
              <div className="grid gap-5 lg:grid-cols-2">
                <Field label="名称">
                  <input
                    value={agent.name}
                    onChange={(event) => setAgent((current) => (current ? { ...current, name: event.target.value } : current))}
                    className="w-full rounded-[18px] border border-line bg-background px-4 py-3 text-[14px] text-text outline-none transition focus:border-[#1f4fd1]"
                  />
                </Field>

              <Field label="角色标签">
                <input
                  value={agent.roleLabel}
                  onChange={(event) =>
                    setAgent((current) => (current ? { ...current, roleLabel: event.target.value } : current))
                  }
                  className="w-full rounded-[18px] border border-line bg-background px-4 py-3 text-[14px] text-text outline-none transition focus:border-[#1f4fd1]"
                />
              </Field>

              <Field label="简介" className="lg:col-span-2">
                <textarea
                  value={agent.summary}
                  onChange={(event) =>
                    setAgent((current) => (current ? { ...current, summary: event.target.value } : current))
                  }
                  rows={3}
                  className="w-full rounded-[20px] border border-line bg-background px-4 py-3 text-[14px] leading-7 text-text outline-none transition focus:border-[#1f4fd1]"
                />
              </Field>

              <Field label="定位补充" className="lg:col-span-2">
                <textarea
                  value={agent.description}
                  onChange={(event) =>
                    setAgent((current) => (current ? { ...current, description: event.target.value } : current))
                  }
                  rows={3}
                  className="w-full rounded-[20px] border border-line bg-background px-4 py-3 text-[14px] leading-7 text-text outline-none transition focus:border-[#1f4fd1]"
                />
              </Field>

              <Field label="可用范围">
                <select
                  value={agent.availability}
                  onChange={(event) =>
                    setAgent((current) =>
                      current ? { ...current, availability: event.target.value as AgentProfileDetail["availability"] } : current,
                    )
                  }
                  className="w-full rounded-[18px] border border-line bg-background px-4 py-3 text-[14px] text-text outline-none transition focus:border-[#1f4fd1]"
                >
                  <option value="both">单聊 + 团队</option>
                  <option value="solo">仅单聊</option>
                  <option value="team">仅团队</option>
                </select>
              </Field>

              <Field label="默认团队角色">
                <select
                  value={agent.teamRole}
                  onChange={(event) =>
                    setAgent((current) =>
                      current ? { ...current, teamRole: event.target.value as AgentProfileDetail["teamRole"] } : current,
                    )
                  }
                  className="w-full rounded-[18px] border border-line bg-background px-4 py-3 text-[14px] text-text outline-none transition focus:border-[#1f4fd1]"
                >
                  <option value="lead">Lead</option>
                  <option value="research">Research</option>
                  <option value="writer">Writer</option>
                  <option value="specialist">Specialist</option>
                </select>
              </Field>

              <Field label="默认模型">
                <select
                  value={agent.defaultModel || ""}
                  onChange={(event) =>
                    setAgent((current) =>
                      current ? { ...current, defaultModel: event.target.value || null } : current,
                    )
                  }
                  className="w-full rounded-[18px] border border-line bg-background px-4 py-3 text-[14px] text-text outline-none transition focus:border-[#1f4fd1]"
                >
                  {modelOptions.map((option) => (
                    <option key={option.id || "follow"} value={option.id}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </Field>

              <Field label="默认推理强度">
                <select
                  value={agent.defaultReasoningEffort || ""}
                  onChange={(event) =>
                    setAgent((current) =>
                      current
                        ? {
                            ...current,
                            defaultReasoningEffort:
                              (event.target.value as AgentProfileDetail["defaultReasoningEffort"]) || null,
                          }
                        : current,
                    )
                  }
                  className="w-full rounded-[18px] border border-line bg-background px-4 py-3 text-[14px] text-text outline-none transition focus:border-[#1f4fd1]"
                >
                  <option value="">跟随当前对话设置</option>
                  <option value="minimal">minimal</option>
                  <option value="low">low</option>
                  <option value="medium">medium</option>
                  <option value="high">high</option>
                  <option value="xhigh">xhigh</option>
                </select>
              </Field>

              <Field label="默认沙箱">
                <select
                  value={agent.defaultSandboxMode || ""}
                  onChange={(event) =>
                    setAgent((current) =>
                      current
                        ? {
                            ...current,
                            defaultSandboxMode:
                              (event.target.value as AgentProfileDetail["defaultSandboxMode"]) || null,
                          }
                        : current,
                    )
                  }
                  className="w-full rounded-[18px] border border-line bg-background px-4 py-3 text-[14px] text-text outline-none transition focus:border-[#1f4fd1]"
                >
                  <option value="">跟随当前对话设置</option>
                  <option value="read-only">read-only</option>
                  <option value="workspace-write">workspace-write</option>
                  <option value="danger-full-access">danger-full-access</option>
                </select>
              </Field>

                <Field label="推荐开场语" className="lg:col-span-2">
                  <textarea
                    value={agent.starterPrompts.join("\n")}
                    onChange={(event) =>
                      setAgent((current) =>
                        current
                          ? {
                              ...current,
                              starterPrompts: event.target.value
                                .split("\n")
                                .map((item) => item.trim())
                                .filter(Boolean),
                            }
                          : current,
                      )
                    }
                    rows={3}
                    className="w-full rounded-[20px] border border-line bg-background px-4 py-3 text-[14px] leading-7 text-text outline-none transition focus:border-[#1f4fd1]"
                  />
                </Field>
              </div>
            </fieldset>
          </section>

          <section className="rounded-[28px] border border-line bg-surface p-6 shadow-soft">
            <div className="flex items-end justify-between gap-4">
              <div>
                <h2 className="text-[24px] font-semibold tracking-[-0.04em] text-text">上下文文件</h2>
                <p className="mt-2 text-[14px] leading-7 text-muted-strong">
                  这些文件会在每轮对话前作为智能体预设注入，决定它怎么看问题、怎么表达，以及该承担什么职责。
                </p>
              </div>
            </div>

            <fieldset disabled={agent.source === "system"} className="contents">
              <div className="mt-6 space-y-5">
                {FILE_FIELD_META.map((field) => (
                  <Field key={field.key} label={field.label} helper={field.description}>
                    <textarea
                      value={agent.files[field.key]}
                      onChange={(event) =>
                        setAgent((current) =>
                          current
                            ? {
                                ...current,
                                files: {
                                  ...current.files,
                                  [field.key]: event.target.value,
                                },
                              }
                            : current,
                        )
                      }
                      rows={8}
                      className="w-full rounded-[22px] border border-line bg-background px-4 py-3 text-[14px] leading-7 text-text outline-none transition focus:border-[#1f4fd1]"
                    />
                  </Field>
                ))}
              </div>
            </fieldset>
          </section>
        </>
      )}
    </AppPage>
  );
}

function Field({
  label,
  helper,
  className,
  children,
}: {
  label: string;
  helper?: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <label className={`block space-y-2 ${className || ""}`}>
      <span className="text-[13px] font-medium text-text">{label}</span>
      {helper ? <p className="text-[12px] leading-6 text-muted-strong">{helper}</p> : null}
      {children}
    </label>
  );
}

function Pill({ children }: { children: React.ReactNode }) {
  return <span className="rounded-full border border-line bg-surface-muted px-3 py-1.5 text-[12px] text-muted-strong">{children}</span>;
}

function ContractPanel({
  title,
  description,
  items,
  tone = "highlight",
}: {
  title: string;
  description: string;
  items: string[];
  tone?: "highlight" | "neutral";
}) {
  return (
    <section
      className={[
        "rounded-[22px] border px-5 py-5",
        tone === "highlight"
          ? "border-line bg-[#fcfbf8]"
          : "border-line bg-background",
      ].join(" ")}
    >
      <div className="text-[13px] font-medium text-text">{title}</div>
      <p className="mt-2 text-[12px] leading-6 text-muted-strong">{description}</p>
      <ul className="mt-4 space-y-2 text-[14px] leading-7 text-text">
        {items.length > 0 ? items.map((item) => <li key={`${title}:${item}`}>• {item}</li>) : <li>暂无</li>}
      </ul>
    </section>
  );
}

function formatSkillList(
  defaultSkillIds: string[],
  optionalSkillIds: string[],
  skillNameById: Map<string, string>,
) {
  const items = defaultSkillIds.map((skillId) => `${skillNameById.get(skillId) || skillId}（默认）`);
  const optionalItems = optionalSkillIds.map((skillId) => `${skillNameById.get(skillId) || skillId}（可选）`);
  return [...items, ...optionalItems];
}

function SkillBindingEditor({
  title,
  description,
  selectedIds,
  allSkills,
  excludedIds,
  skillNameById,
  onChange,
}: {
  title: string;
  description: string;
  selectedIds: string[];
  allSkills: Array<{ id: string; label: string; summary: string }>;
  excludedIds: Set<string>;
  skillNameById: Map<string, string>;
  onChange: (nextIds: string[]) => void;
}) {
  const availableSkills = allSkills.filter(
    (skill) => !selectedIds.includes(skill.id) && !excludedIds.has(skill.id),
  );

  return (
    <section className="rounded-[20px] border border-line bg-surface px-4 py-4">
      <div className="text-[13px] font-medium text-text">{title}</div>
      <p className="mt-2 text-[12px] leading-6 text-muted-strong">{description}</p>

      <div className="mt-4 flex flex-wrap gap-2">
        {selectedIds.length > 0 ? (
          selectedIds.map((skillId) => (
            <button
              key={`${title}:${skillId}`}
              type="button"
              onClick={() => onChange(selectedIds.filter((id) => id !== skillId))}
              className="rounded-full border border-line bg-background px-3 py-1.5 text-[12px] text-text transition hover:border-[#1f4fd1] hover:text-[#1f4fd1]"
            >
              {skillNameById.get(skillId) || skillId} · 移除
            </button>
          ))
        ) : (
          <span className="text-[12px] text-muted-strong">暂未绑定</span>
        )}
      </div>

      <div className="mt-4">
        <label className="text-[12px] text-muted-strong">添加技能</label>
        <select
          value=""
          onChange={(event) => {
            const nextSkillId = event.target.value;

            if (!nextSkillId) {
              return;
            }

            onChange([...selectedIds, nextSkillId]);
          }}
          className="mt-2 w-full rounded-[16px] border border-line bg-background px-4 py-3 text-[13px] text-text outline-none transition focus:border-[#1f4fd1]"
        >
          <option value="">选择要绑定的 skill</option>
          {availableSkills.map((skill) => (
            <option key={skill.id} value={skill.id}>
              {skill.label} · {skill.summary}
            </option>
          ))}
        </select>
      </div>
    </section>
  );
}

function dedupeSkillIds(skillIds: string[]) {
  return Array.from(new Set(skillIds));
}

function formatAgentReference(agentId: string) {
  switch (agentId) {
    case "project-manager":
      return "项目管理";
    case "product-manager":
      return "产品";
    case "ui-designer":
      return "UI 设计";
    case "frontend-engineer":
      return "前端开发";
    case "backend-engineer":
      return "后端开发";
    case "ios-engineer":
      return "iOS 开发";
    case "content-operator":
      return "内容运营";
    case "growth-operator":
      return "增长运营";
    case "hr-manager":
      return "人力资源";
    case "support-specialist":
      return "客服";
    default:
      return agentId;
  }
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

function readFileAsDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("read_failed"));
    reader.onload = () => {
      if (typeof reader.result === "string") {
        resolve(reader.result);
        return;
      }

      reject(new Error("invalid_result"));
    };
    reader.readAsDataURL(file);
  });
}
