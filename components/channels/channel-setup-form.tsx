"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  buildChannelConfiguredHints,
  buildChannelFormGroups,
} from "@/lib/channels/channel-form-definitions";
import type { ChannelDetail } from "@/lib/channels/types";

type ChannelSetupFormProps = {
  channel: ChannelDetail;
  telegramTokenPreview?: {
    raw: string | null;
    masked: string | null;
  } | null;
  feishuCredentialPreview?: {
    appId: {
      raw: string | null;
      masked: string | null;
    };
    appSecret: {
      raw: string | null;
      masked: string | null;
    };
  } | null;
};

export function ChannelSetupForm({
  channel,
  telegramTokenPreview = null,
  feishuCredentialPreview = null,
}: ChannelSetupFormProps) {
  const router = useRouter();
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [messageTone, setMessageTone] = useState<"default" | "success" | "error">("default");
  const [copyMessage, setCopyMessage] = useState<string | null>(null);
  const fieldGroups = useMemo(() => buildChannelFormGroups(channel.id), [channel.id]);
  const configuredHints = useMemo(() => buildChannelConfiguredHints(channel), [channel]);
  const actionLabel = channel.id === "telegram" ? "保存" : "保存配置";

  async function handleCopyStoredToken() {
    if (!telegramTokenPreview?.raw) {
      return;
    }

    try {
      await navigator.clipboard.writeText(telegramTokenPreview.raw);
      setCopyMessage("已复制原始 Token。");
      window.setTimeout(() => {
        setCopyMessage(null);
      }, 2000);
    } catch {
      setCopyMessage("复制失败，请重试。");
    }
  }

  async function handleCopyStoredValue(value: string | null, label: string) {
    if (!value) {
      return;
    }

    try {
      await navigator.clipboard.writeText(value);
      setCopyMessage(`已复制${label}。`);
      window.setTimeout(() => {
        setCopyMessage(null);
      }, 2000);
    } catch {
      setCopyMessage("复制失败，请重试。");
    }
  }

  async function handleSubmit(formData: FormData) {
    setIsSaving(true);
    setMessage(null);
    setMessageTone("default");

    const payload = Object.fromEntries(
      [...fieldGroups.primary, ...fieldGroups.advanced].map((field) => [
        field.name,
        String(formData.get(field.name) || ""),
      ]),
    );

    try {
      const response = await fetch(`/api/channels/${channel.id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });
      const result = (await response.json()) as {
        verification?: { ok: boolean; error?: string; message?: string };
        error?: string;
      };

      if (!response.ok) {
        throw new Error(result.error || "保存失败，请稍后再试。");
      }

      if (result.verification?.ok === false) {
        setMessageTone("error");
        setMessage(result.verification.error || "配置已保存，但校验未通过。");
      } else {
        setMessageTone("success");
        setMessage(result.verification?.message || "配置已保存并校验通过。");
      }

      router.refresh();
    } catch (error) {
      setMessageTone("error");
      setMessage(error instanceof Error ? error.message : "保存失败，请稍后再试。");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <form
      action={handleSubmit}
      className="rounded-[24px] border border-line bg-surface p-6 shadow-soft"
    >
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h2 className="text-[17px] font-semibold tracking-[-0.03em] text-text">连接配置</h2>
          <p className="mt-3 text-[14px] leading-6 text-muted-strong">
            {channel.id === "telegram"
              ? "通常只需要填写 Bot Token。保存后，OpenCrab 会自动尝试帮你连上 Telegram。"
              : "默认使用飞书长连接，不需要公网地址。保存后，OpenCrab 会校验凭证并自动启动 socket。"}
          </p>
          {configuredHints.length ? (
            <div className="mt-4 flex flex-wrap gap-2">
              {configuredHints.map((hint) => (
                <span
                  key={hint}
                  className="rounded-full border border-line bg-background px-3 py-1.5 text-[12px] text-muted-strong"
                >
                  {hint}
                </span>
              ))}
            </div>
          ) : null}
        </div>
        <button
          type="submit"
          disabled={isSaving}
          className="shrink-0 self-start whitespace-nowrap rounded-full bg-text px-5 py-2 text-[13px] font-medium text-white transition disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isSaving ? "保存中..." : actionLabel}
        </button>
      </div>

      <div className={`mt-6 grid gap-4 ${channel.id === "telegram" ? "" : "md:grid-cols-2"}`}>
        {fieldGroups.primary.map((field) => (
          <label key={field.name} className="flex h-full flex-col">
            <span className="text-[12px] font-medium text-muted-strong">{field.label}</span>
            <span className="mt-1 block min-h-[40px] text-[12px] leading-5 text-muted">
              {field.helper}
            </span>
            {channel.id === "telegram" && field.name === "botToken" && telegramTokenPreview?.masked ? (
              <div className="mt-2 flex flex-wrap items-center gap-2 rounded-[16px] border border-line bg-background px-4 py-3">
                <span className="text-[12px] text-muted">当前已保存：</span>
                <span className="font-mono text-[13px] text-text">{telegramTokenPreview.masked}</span>
                <button
                  type="button"
                  onClick={handleCopyStoredToken}
                  className="rounded-full border border-line px-3 py-1 text-[12px] text-text transition hover:border-text/20"
                >
                  复制原始 Token
                </button>
              </div>
            ) : null}
            {channel.id === "feishu" &&
            field.name === "appId" &&
            feishuCredentialPreview?.appId.masked ? (
              <div className="mt-2 flex flex-wrap items-center gap-2 rounded-[16px] border border-line bg-background px-4 py-3">
                <span className="text-[12px] text-muted">当前已保存：</span>
                <span className="font-mono text-[13px] text-text">
                  {feishuCredentialPreview.appId.masked}
                </span>
                <button
                  type="button"
                  onClick={() =>
                    handleCopyStoredValue(feishuCredentialPreview.appId.raw, "原始 App ID")
                  }
                  className="rounded-full border border-line px-3 py-1 text-[12px] text-text transition hover:border-text/20"
                >
                  复制原始 App ID
                </button>
              </div>
            ) : null}
            {channel.id === "feishu" &&
            field.name === "appSecret" &&
            feishuCredentialPreview?.appSecret.masked ? (
              <div className="mt-2 flex flex-wrap items-center gap-2 rounded-[16px] border border-line bg-background px-4 py-3">
                <span className="text-[12px] text-muted">当前已保存：</span>
                <span className="font-mono text-[13px] text-text">
                  {feishuCredentialPreview.appSecret.masked}
                </span>
                <button
                  type="button"
                  onClick={() =>
                    handleCopyStoredValue(
                      feishuCredentialPreview.appSecret.raw,
                      "原始 App Secret",
                    )
                  }
                  className="rounded-full border border-line px-3 py-1 text-[12px] text-text transition hover:border-text/20"
                >
                  复制原始 App Secret
                </button>
              </div>
            ) : null}
            <input
              name={field.name}
              type={field.type}
              placeholder={field.placeholder}
              className="mt-2 w-full rounded-[16px] border border-line bg-background px-4 py-3 text-[14px] text-text outline-none transition focus:border-text"
            />
          </label>
        ))}
      </div>

      {fieldGroups.advanced.length ? (
        <details className="mt-5 rounded-[18px] border border-line bg-background px-4 py-4">
          <summary className="cursor-pointer list-none text-[13px] font-medium text-text">
            高级选项
          </summary>
          <p className="mt-3 text-[12px] leading-5 text-muted">
            {channel.id === "telegram"
              ? "只有在你需要额外校验 Telegram webhook header 时，才需要配置下面这个字段。"
              : "只有在你还想兼容飞书 Webhook 模式时，才需要配置下面这个字段。"}
          </p>
          <div className="mt-4 grid gap-4">
            {fieldGroups.advanced.map((field) => (
              <label key={field.name} className="block">
                <span className="text-[12px] font-medium text-muted-strong">{field.label}</span>
                <span className="mt-1 block text-[12px] leading-5 text-muted">{field.helper}</span>
                <input
                  name={field.name}
                  type={field.type}
                  placeholder={field.placeholder}
                  className="mt-2 w-full rounded-[16px] border border-line bg-surface px-4 py-3 text-[14px] text-text outline-none transition focus:border-text"
                />
              </label>
            ))}
          </div>
        </details>
      ) : null}

      {message ? (
        <p
          className={`mt-4 rounded-[16px] border px-4 py-3 text-[13px] ${
            messageTone === "success"
              ? "border-[#cfe7d4] bg-[#eef8f0] text-[#23633a]"
              : messageTone === "error"
                ? "border-[#f3d0cb] bg-[#fff3f1] text-[#b42318]"
                : "border-line bg-background text-muted-strong"
          }`}
        >
          {message}
        </p>
      ) : null}
      {copyMessage && !message ? (
        <p className="mt-4 rounded-[16px] border border-line bg-background px-4 py-3 text-[13px] text-muted-strong">
          {copyMessage}
        </p>
      ) : null}
    </form>
  );
}
