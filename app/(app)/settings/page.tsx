"use client";

import { useMemo } from "react";
import { useOpenCrabApp } from "@/components/app-shell/opencrab-provider";
import { PageHeader } from "@/components/ui/page-header";

export default function SettingsPage() {
  const {
    codexModels,
    selectedModel,
    selectedReasoningEffort,
    setSelectedModel,
    setSelectedReasoningEffort,
    errorMessage,
  } = useOpenCrabApp();

  const activeModel = useMemo(
    () => codexModels.find((item) => item.id === selectedModel) || codexModels[0] || null,
    [codexModels, selectedModel],
  );

  return (
    <div className="min-h-screen px-6 py-8 lg:px-10">
      <div className="mx-auto max-w-[920px] space-y-6">
        <PageHeader
          title="设置"
          description="这里保存 OpenCrab 当前默认使用的 Codex 模型和推理强度。输入框里的切换也会同步回这里。"
        />

        <section className="rounded-[24px] border border-line bg-surface p-6 shadow-soft">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="text-[20px] font-semibold tracking-[-0.03em] text-text">Codex 默认配置</h2>
              <p className="mt-3 text-[15px] leading-7 text-muted-strong">
                当前仅保留低频设置。模型和推理强度会作为新会话和后续发送的默认值。
              </p>
            </div>
            <div className="rounded-full border border-line bg-surface-muted px-4 py-2 text-sm text-muted-strong">
              自动保存
            </div>
          </div>

          <div className="mt-8 grid gap-5 md:grid-cols-2">
            <label className="space-y-2">
              <span className="text-[14px] font-medium text-text">默认模型</span>
              <select
                value={selectedModel}
                onChange={(event) => void setSelectedModel(event.target.value)}
                className="h-11 w-full rounded-[14px] border border-line bg-surface-muted px-4 text-[14px] text-text outline-none"
              >
                {codexModels.map((model) => (
                  <option key={model.id} value={model.id}>
                    {model.label}
                  </option>
                ))}
              </select>
            </label>

            <label className="space-y-2">
              <span className="text-[14px] font-medium text-text">默认推理强度</span>
              <select
                value={selectedReasoningEffort}
                onChange={(event) =>
                  void setSelectedReasoningEffort(
                    event.target.value as typeof selectedReasoningEffort,
                  )
                }
                className="h-11 w-full rounded-[14px] border border-line bg-surface-muted px-4 text-[14px] text-text outline-none"
              >
                {(activeModel?.reasoningOptions || []).map((option) => (
                  <option key={option.effort} value={option.effort}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
          </div>

          {errorMessage ? <p className="mt-4 text-[14px] text-[#a34942]">{errorMessage}</p> : null}
        </section>
      </div>
    </div>
  );
}
