"use client";

import { Button, buttonClassName } from "@/components/ui/button";
import { useOpenCrabApp } from "@/components/app-shell/opencrab-provider";
import {
  formatBrowserConnectionModeLabel,
  getBrowserSessionPresentation,
} from "@/lib/opencrab/labels";

const CHROME_DOWNLOAD_URL = "https://www.google.com/chrome/";

export function BrowserSessionPanel() {
  const {
    browserSessionStatus,
    selectedBrowserConnectionMode,
    isBrowserSessionPending,
    refreshBrowserSessionStatus,
    reconnectBrowserSession,
  } = useOpenCrabApp();
  const presentation = getBrowserSessionPresentation(browserSessionStatus);

  return (
    <div className="rounded-[18px] border border-line bg-surface-muted px-4 py-4">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <span className={resolveToneClassName(presentation.tone)}>
              浏览器连接：{presentation.label}
            </span>
            <span className="rounded-full border border-line bg-surface px-3 py-1 text-[11px] text-muted-strong">
              当前模式：{formatBrowserConnectionModeLabel(selectedBrowserConnectionMode)}
            </span>
          </div>

          <div className="space-y-1">
            <p className="text-[13px] font-medium text-text">{presentation.detail}</p>
            <p className="text-[12px] leading-6 text-muted-strong">
              {presentation.recoveryHint}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button
            onClick={() => void refreshBrowserSessionStatus()}
            variant="secondary"
            disabled={isBrowserSessionPending}
          >
            重新检查浏览器连接
          </Button>
          <Button
            onClick={() => void reconnectBrowserSession()}
            variant={browserSessionStatus?.ok ? "secondary" : "primary"}
            disabled={isBrowserSessionPending || browserSessionStatus?.status === "missing_browser"}
          >
            {browserSessionStatus?.ok ? "重新连接浏览器" : "立即重连浏览器"}
          </Button>
          {browserSessionStatus?.status === "missing_browser" ? (
            <a
              href={CHROME_DOWNLOAD_URL}
              target="_blank"
              rel="noreferrer"
              className={buttonClassName({ variant: "primary" })}
            >
              下载 Chrome
            </a>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function resolveToneClassName(tone: "positive" | "warning" | "critical" | "neutral") {
  switch (tone) {
    case "positive":
      return "rounded-full border border-[#cfe7d4] bg-[#f4fbf5] px-3 py-1 text-[11px] font-medium text-[#47624d]";
    case "critical":
      return "rounded-full border border-[#f0d5d1] bg-[#fff7f6] px-3 py-1 text-[11px] font-medium text-[#a34942]";
    case "warning":
      return "rounded-full border border-[#ead7b4] bg-[#fff8ea] px-3 py-1 text-[11px] font-medium text-[#7a6130]";
    default:
      return "rounded-full border border-line bg-surface px-3 py-1 text-[11px] font-medium text-muted-strong";
  }
}
