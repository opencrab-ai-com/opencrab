"use client";

import { useMemo, useRef } from "react";
import { AgentAvatar } from "@/components/agents/agent-avatar";
import { useOpenCrabApp } from "@/components/app-shell/opencrab-provider";
import { BrowserSessionPanel } from "@/components/browser/browser-session-panel";
import { ChatGptConnectionPanel } from "@/components/chatgpt/chatgpt-connection-panel";
import { AppPage } from "@/components/ui/app-page";
import { PageHeader } from "@/components/ui/page-header";
import { APP_LANGUAGE_OPTIONS } from "@/lib/opencrab/languages";

export default function SettingsPage() {
  const {
    codexModels,
    selectedBrowserConnectionMode,
    selectedModel,
    selectedReasoningEffort,
    selectedLanguage,
    selectedUserDisplayName,
    selectedUserAvatarDataUrl,
    thinkingModeEnabled,
    allowOpenAiApiKeyForCommands,
    setSelectedBrowserConnectionMode,
    setSelectedModel,
    setSelectedReasoningEffort,
    setSelectedLanguage,
    setSelectedUserDisplayName,
    setSelectedUserAvatarDataUrl,
    setThinkingModeEnabled,
    setAllowOpenAiApiKeyForCommands,
    errorMessage,
  } = useOpenCrabApp();
  const avatarInputRef = useRef<HTMLInputElement | null>(null);

  const activeModel = useMemo(
    () => codexModels.find((item) => item.id === selectedModel) || codexModels[0] || null,
    [codexModels, selectedModel],
  );

  async function handleAvatarFileChange(file: File | null) {
    if (!file) {
      return;
    }

    const dataUrl = await readFileAsDataUrl(file);
    await setSelectedUserAvatarDataUrl(dataUrl);
  }

  return (
    <AppPage width="wide" contentClassName="space-y-6">
      <PageHeader title="设置" />

      <section className="rounded-[24px] border border-line bg-surface p-6 shadow-soft">
        <p className="mb-4 text-[14px] leading-6 text-muted-strong">
          OpenCrab 目前没有自己的账号体系，这里复用的是你本机已登录的 ChatGPT 账户状态。
        </p>
        <ChatGptConnectionPanel />
      </section>

      <section className="rounded-[24px] border border-line bg-surface p-6 shadow-soft">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-[18px] font-semibold tracking-[-0.03em] text-text">OpenCrab 默认配置</h2>
            <p className="mt-3 text-[14px] leading-6 text-muted-strong">
              这些设置只影响 OpenCrab 自己的新会话和后续发送。
            </p>
          </div>
          <div className="inline-flex h-10 items-center rounded-full border border-line bg-surface-muted px-4 text-[13px] text-muted-strong">
            自动保存
          </div>
        </div>

        <div className="mt-8 grid gap-5 md:grid-cols-2">
          <div className="space-y-4 rounded-[18px] border border-line bg-surface-muted px-4 py-4 md:col-span-2">
            <div>
              <h3 className="text-[15px] font-semibold tracking-[-0.02em] text-text">我的身份</h3>
              <p className="mt-2 text-[12px] leading-6 text-muted-strong">
                这里设置的是 OpenCrab 里“我”的昵称和头像。修改后，会立即体现在网页对话中的本地消息显示上。
              </p>
            </div>

            <div className="flex flex-col gap-4 md:flex-row md:items-start">
              <div className="flex items-center gap-4">
                <AgentAvatar
                  src={selectedUserAvatarDataUrl}
                  name={selectedUserDisplayName || "我"}
                  size={64}
                  className="rounded-[22px]"
                />
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => avatarInputRef.current?.click()}
                    className="inline-flex h-9 items-center rounded-full border border-line bg-surface px-4 text-[12px] text-text transition hover:bg-white"
                  >
                    上传头像
                  </button>
                  <button
                    type="button"
                    onClick={() => void setSelectedUserAvatarDataUrl(null)}
                    className="inline-flex h-9 items-center rounded-full border border-line bg-surface px-4 text-[12px] text-muted-strong transition hover:bg-white disabled:opacity-40"
                    disabled={!selectedUserAvatarDataUrl}
                  >
                    清除头像
                  </button>
                  <input
                    ref={avatarInputRef}
                    type="file"
                    accept="image/png,image/jpeg,image/webp,image/gif"
                    className="hidden"
                    onChange={(event) => {
                      void handleAvatarFileChange(event.target.files?.[0] || null);
                      event.currentTarget.value = "";
                    }}
                  />
                </div>
              </div>

              <label className="flex-1 space-y-2">
                <span className="text-[13px] font-medium text-text">昵称</span>
                <input
                  value={selectedUserDisplayName}
                  onChange={(event) => void setSelectedUserDisplayName(event.target.value)}
                  placeholder="我"
                  className="h-11 w-full rounded-[14px] border border-line bg-surface px-4 text-[13px] text-text outline-none transition placeholder:text-[#9b9ba7]"
                />
                <p className="text-[12px] text-muted-strong">
                  例如：Sky、阿蟹、产品负责人。未填写时会回退为“我”。
                </p>
              </label>
            </div>
          </div>

          <label className="space-y-2 md:col-span-2">
            <span className="text-[13px] font-medium text-text">浏览器连接方式</span>
            <SelectField
              value={selectedBrowserConnectionMode}
              onChange={(event) =>
                void setSelectedBrowserConnectionMode(
                  event.target.value as typeof selectedBrowserConnectionMode,
                )
              }
            >
              <option value="current-browser">连接当前浏览器</option>
              <option value="managed-browser">使用独立浏览器</option>
            </SelectField>
            <p className="text-[12px] text-muted-strong">
              OpenCrab 会优先连接你当前正在使用的 Chrome，并在同一服务进程内持续复用这条连接。
            </p>
          </label>

          <div className="md:col-span-2">
            <BrowserSessionPanel />
          </div>

          <label className="space-y-2">
            <span className="text-[13px] font-medium text-text">默认模型</span>
            <SelectField
              value={selectedModel}
              onChange={(event) => void setSelectedModel(event.target.value)}
            >
              {codexModels.map((model) => (
                <option key={model.id} value={model.id}>
                  {model.label}
                </option>
              ))}
            </SelectField>
          </label>

          <label className="space-y-2">
            <span className="text-[13px] font-medium text-text">默认推理强度</span>
            <SelectField
              value={selectedReasoningEffort}
              onChange={(event) =>
                void setSelectedReasoningEffort(
                  event.target.value as typeof selectedReasoningEffort,
                )
              }
            >
              {(activeModel?.reasoningOptions || []).map((option) => (
                <option key={option.effort} value={option.effort}>
                  {option.label}
                </option>
              ))}
            </SelectField>
          </label>

          <label className="space-y-2 md:col-span-2">
            <span className="text-[13px] font-medium text-text">默认语言</span>
            <SelectField
              value={selectedLanguage}
              onChange={(event) =>
                void setSelectedLanguage(event.target.value as typeof selectedLanguage)
              }
            >
              {APP_LANGUAGE_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </SelectField>
            <p className="text-[12px] text-muted-strong">
              这个语言会写入 OpenCrab 的系统提示里。后续对话、总结、改写、定时任务和渠道回复都会优先按这个语言处理，除非用户明确要求其他语言。
            </p>
          </label>

          <div className="space-y-3 rounded-[18px] border border-line bg-surface-muted px-4 py-4 md:col-span-2">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="text-[13px] font-medium text-text">Thinking 模式</div>
                <p className="mt-2 text-[12px] leading-6 text-muted-strong">
                  打开后，所有对话都会显示 OpenCrab 的思考过程面板。关闭后，所有对话统一隐藏这块内容，只保留最终回复。
                </p>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={thinkingModeEnabled}
                onClick={() => void setThinkingModeEnabled(!thinkingModeEnabled)}
                className={`relative mt-1 h-8 w-14 shrink-0 rounded-full transition ${
                  thinkingModeEnabled ? "bg-[#111111]" : "bg-[#d8d8d2]"
                }`}
              >
                <span
                  className={`absolute top-1 h-6 w-6 rounded-full bg-white transition ${
                    thinkingModeEnabled ? "left-7" : "left-1"
                  }`}
                />
              </button>
            </div>
          </div>

          <div className="space-y-3 rounded-[18px] border border-line bg-surface-muted px-4 py-4 md:col-span-2">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="text-[13px] font-medium text-text">
                  允许命令继承 OPENAI_API_KEY
                </div>
                <p className="mt-2 text-[12px] leading-6 text-muted-strong">
                  默认关闭。打开后，OpenCrab 在本机执行命令时会把你当前环境里的
                  <code className="mx-1 rounded bg-surface px-1.5 py-0.5 text-[11px] text-text">
                    OPENAI_API_KEY
                  </code>
                  一起传进去，适合你明确知道自己在受信环境里使用。
                </p>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={allowOpenAiApiKeyForCommands}
                onClick={() => void setAllowOpenAiApiKeyForCommands(!allowOpenAiApiKeyForCommands)}
                className={`relative mt-1 h-8 w-14 shrink-0 rounded-full transition ${
                  allowOpenAiApiKeyForCommands ? "bg-[#111111]" : "bg-[#d8d8d2]"
                }`}
              >
                <span
                  className={`absolute top-1 h-6 w-6 rounded-full bg-white transition ${
                    allowOpenAiApiKeyForCommands ? "left-7" : "left-1"
                  }`}
                />
              </button>
            </div>
            <p className="text-[12px] leading-6 text-muted">
              建议只在你自己的本机、并且确实需要让命令直接访问 OpenAI API 时再打开。
            </p>
          </div>
        </div>

        {errorMessage ? <p className="mt-4 text-[13px] text-[#a34942]">{errorMessage}</p> : null}
      </section>
    </AppPage>
  );
}

type SelectFieldProps = React.SelectHTMLAttributes<HTMLSelectElement>;

function SelectField({ className = "", children, ...props }: SelectFieldProps) {
  return (
    <div className="relative">
      <select
        {...props}
        className={`h-11 w-full appearance-none rounded-[14px] border border-line bg-surface-muted px-4 pr-11 text-[13px] text-text outline-none ${className}`.trim()}
      >
        {children}
      </select>
      <span className="pointer-events-none absolute inset-y-0 right-4 flex items-center text-muted-strong">
        <ChevronDownIcon />
      </span>
    </div>
  );
}

function ChevronDownIcon() {
  return (
    <svg viewBox="0 0 20 20" className="h-4 w-4 stroke-current" fill="none" strokeWidth="1.8">
      <path d="m5 7.5 5 5 5-5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function readFileAsDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(typeof reader.result === "string" ? reader.result : "");
    reader.onerror = () => reject(reader.error || new Error("读取头像失败"));
    reader.readAsDataURL(file);
  });
}
