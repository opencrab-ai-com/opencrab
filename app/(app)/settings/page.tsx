"use client";

import { useMemo } from "react";
import { useOpenCrabApp } from "@/components/app-shell/opencrab-provider";
import { AppPage } from "@/components/ui/app-page";
import { PageHeader } from "@/components/ui/page-header";
import { StatusCard } from "@/components/ui/status-card";
import {
  formatBrowserConnectionModeLabel,
  formatBrowserSessionLabel,
  formatSandboxModeLabel,
} from "@/lib/opencrab/labels";

export default function SettingsPage() {
  const {
    codexModels,
    codexStatus,
    browserSessionStatus,
    selectedBrowserConnectionMode,
    selectedModel,
    selectedReasoningEffort,
    selectedSandboxMode,
    setSelectedBrowserConnectionMode,
    setSelectedModel,
    setSelectedReasoningEffort,
    setSelectedSandboxMode,
    errorMessage,
  } = useOpenCrabApp();

  const activeModel = useMemo(
    () => codexModels.find((item) => item.id === selectedModel) || codexModels[0] || null,
    [codexModels, selectedModel],
  );

  return (
    <AppPage contentClassName="space-y-6">
        <PageHeader
          title="设置"
          description="这里会展示 OpenCrab 当前的本机运行状态，以及它自己的默认配置。"
        />

        <section className="rounded-[24px] border border-line bg-surface p-6 shadow-soft">
          <div className="grid gap-5 md:grid-cols-2">
            <div className="rounded-[18px] border border-line bg-surface-muted px-5 py-4">
              <h2 className="text-[15px] font-semibold text-text">本机运行环境</h2>
              <p className="mt-3 text-[13px] leading-6 text-muted-strong">
                OpenCrab 会复用本机已经准备好的运行环境、账户连接和浏览器能力。
                如果这些本机依赖不可用，这里的状态也会一起受到影响。
              </p>
            </div>

            <div className="rounded-[18px] border border-line bg-surface-muted px-5 py-4">
              <h2 className="text-[15px] font-semibold text-text">OpenCrab 专属</h2>
              <p className="mt-3 text-[13px] leading-6 text-muted-strong">
                默认模型、推理强度和权限模式由 OpenCrab 单独保存。你在这里修改，只会影响 OpenCrab 自己后续的新对话和发送。
              </p>
            </div>
          </div>

          <div className="mt-5 rounded-[18px] border border-line bg-surface-muted px-5 py-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-[15px] font-semibold text-text">账户连接状态</h2>
                <p className="mt-2 text-[13px] leading-6 text-muted-strong">
                  这里显示的是 OpenCrab 当前能否正常使用本机账户连接与浏览器能力。
                </p>
              </div>
              <div
                className={`rounded-full px-3 py-1.5 text-[12px] font-medium ${
                  codexStatus?.ok
                    ? "bg-[#edf8ef] text-[#1f7a3d]"
                    : "bg-[#fff1ee] text-[#a34942]"
                }`}
              >
                {codexStatus?.ok ? "已登录" : "未登录"}
              </div>
            </div>

            <div className="mt-4 grid gap-4 md:grid-cols-3">
              <StatusCard
                label="登录方式"
                value={codexStatus?.loginMethod === "chatgpt" ? "ChatGPT" : "未知"}
              />
              <StatusCard
                label="当前状态"
                value={codexStatus?.ok ? "OpenCrab 可用" : "需要先完成准备"}
              />
              <StatusCard
                label="浏览器连接"
                value={formatBrowserSessionLabel(browserSessionStatus)}
              />
              <StatusCard
                label="连接方式"
                value={formatBrowserConnectionModeLabel(selectedBrowserConnectionMode)}
              />
              <StatusCard
                label="默认权限"
                value={formatSandboxModeLabel(selectedSandboxMode)}
              />
            </div>

            <div className="mt-4 rounded-[16px] border border-line bg-surface px-4 py-3 text-[13px] leading-6 text-muted-strong">
              <p className="font-medium text-text">OpenCrab 浏览器连接</p>
              <p className="mt-1">{browserSessionStatus?.message || "OpenCrab 会在启动时自动预热浏览器连接。"}</p>
              <p className="mt-2 text-[12px] text-muted">
                {selectedBrowserConnectionMode === "current-browser"
                  ? "当前模式会连接你正在使用的 Chrome。每次重启 OpenCrab 服务后，第一次连接可能仍需要你在浏览器里允许一次。"
                  : "当前模式会使用 OpenCrab 自己的独立 Chrome 环境，不会覆盖你日常使用的浏览器数据。"}
              </p>
            </div>

            {!codexStatus?.ok ? (
              <div className="mt-4 rounded-[16px] border border-[#e8c8c3] bg-[#fff6f4] px-4 py-3 text-[13px] leading-6 text-[#8f4338]">
                <p>还没有检测到可用的本机执行环境连接。</p>
                <p className="mt-1">
                  请先完成 OpenCrab 的初始登录与本机准备，然后刷新这个页面。
                </p>
              </div>
            ) : null}
          </div>
        </section>

        <section className="rounded-[24px] border border-line bg-surface p-6 shadow-soft">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="text-[18px] font-semibold tracking-[-0.03em] text-text">OpenCrab 默认配置</h2>
              <p className="mt-3 text-[14px] leading-6 text-muted-strong">
                这些设置只影响 OpenCrab 自己的新会话和后续发送。
              </p>
            </div>
            <div className="rounded-full border border-line bg-surface-muted px-4 py-2 text-[13px] text-muted-strong">
              自动保存
            </div>
          </div>

          <div className="mt-8 grid gap-5 md:grid-cols-2">
            <label className="space-y-2 md:col-span-2">
              <span className="text-[13px] font-medium text-text">浏览器连接方式</span>
              <select
                value={selectedBrowserConnectionMode}
                onChange={(event) =>
                  void setSelectedBrowserConnectionMode(
                    event.target.value as typeof selectedBrowserConnectionMode,
                  )
                }
                className="h-11 w-full rounded-[14px] border border-line bg-surface-muted px-4 text-[13px] text-text outline-none"
              >
                <option value="current-browser">连接当前浏览器</option>
                <option value="managed-browser">使用独立浏览器</option>
              </select>
              <p className="text-[12px] text-muted-strong">
                你当前要求的推荐配置是“连接当前浏览器”。这样 OpenCrab 会尽量复用你平时正在用的 Chrome 会话；同一服务进程内会持续复用连接。
              </p>
            </label>

            <label className="space-y-2">
              <span className="text-[13px] font-medium text-text">默认模型</span>
              <select
                value={selectedModel}
                onChange={(event) => void setSelectedModel(event.target.value)}
                className="h-11 w-full rounded-[14px] border border-line bg-surface-muted px-4 text-[13px] text-text outline-none"
              >
                {codexModels.map((model) => (
                  <option key={model.id} value={model.id}>
                    {model.label}
                  </option>
                ))}
              </select>
            </label>

            <label className="space-y-2">
              <span className="text-[13px] font-medium text-text">默认推理强度</span>
              <select
                value={selectedReasoningEffort}
                onChange={(event) =>
                  void setSelectedReasoningEffort(
                    event.target.value as typeof selectedReasoningEffort,
                  )
                }
                className="h-11 w-full rounded-[14px] border border-line bg-surface-muted px-4 text-[13px] text-text outline-none"
              >
                {(activeModel?.reasoningOptions || []).map((option) => (
                  <option key={option.effort} value={option.effort}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>

            <label className="space-y-2 md:col-span-2">
              <span className="text-[13px] font-medium text-text">默认权限模式</span>
              <select
                value={selectedSandboxMode}
                onChange={(event) =>
                  void setSelectedSandboxMode(
                    event.target.value as typeof selectedSandboxMode,
                  )
                }
                className="h-11 w-full rounded-[14px] border border-line bg-surface-muted px-4 text-[13px] text-text outline-none"
              >
                <option value="workspace-write">可写工作区</option>
                <option value="read-only">只读</option>
                <option value="danger-full-access">完全访问</option>
              </select>
              <p className="text-[12px] text-muted-strong">
                推荐使用“可写工作区”。它允许 OpenCrab 创建和修改项目文件，但不会把权限放得过宽。
              </p>
            </label>
          </div>

          {errorMessage ? <p className="mt-4 text-[13px] text-[#a34942]">{errorMessage}</p> : null}
        </section>
    </AppPage>
  );
}
