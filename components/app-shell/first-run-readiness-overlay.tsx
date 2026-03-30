"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ChatGptConnectionPanel } from "@/components/chatgpt/chatgpt-connection-panel";
import { useOpenCrabApp } from "@/components/app-shell/opencrab-provider";
import { Button, buttonClassName } from "@/components/ui/button";

const CHROME_DOWNLOAD_URL = "https://www.google.com/chrome/";

export function FirstRunReadinessOverlay() {
  const {
    isHydrated,
    runtimeReadiness,
    isChatGptConnectionPending,
    chatGptConnectionStatus,
    refreshRuntimeReadiness,
  } = useOpenCrabApp();
  const hasShownBlockingStateRef = useRef(false);
  const overlayCardRef = useRef<HTMLDivElement | null>(null);
  const [showCompletionState, setShowCompletionState] = useState(false);

  const isBlocking = Boolean(isHydrated && runtimeReadiness && !runtimeReadiness.ready);
  const isWaitingBrowserAuth =
    chatGptConnectionStatus?.stage === "waiting_browser_auth" ||
    chatGptConnectionStatus?.stage === "connecting";

  useEffect(() => {
    if (!isHydrated || !runtimeReadiness) {
      return;
    }

    if (!runtimeReadiness.ready) {
      hasShownBlockingStateRef.current = true;
      setShowCompletionState(false);
      return;
    }

    if (!hasShownBlockingStateRef.current) {
      return;
    }

    setShowCompletionState(true);
    hasShownBlockingStateRef.current = false;

    const timeoutId = window.setTimeout(() => {
      setShowCompletionState(false);
    }, 2400);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [isHydrated, runtimeReadiness]);

  useEffect(() => {
    if (!isBlocking || isWaitingBrowserAuth) {
      return;
    }

    let active = true;

    async function syncReadiness() {
      if (
        !active ||
        document.visibilityState !== "visible" ||
        isChatGptConnectionPending
      ) {
        return;
      }

      await refreshRuntimeReadiness();
    }

    const intervalId = window.setInterval(() => {
      void syncReadiness();
    }, 4000);

    function handleVisibilityChange() {
      if (document.visibilityState === "visible") {
        void syncReadiness();
      }
    }

    window.addEventListener("focus", handleVisibilityChange);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      active = false;
      window.clearInterval(intervalId);
      window.removeEventListener("focus", handleVisibilityChange);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [
    isBlocking,
    isChatGptConnectionPending,
    isWaitingBrowserAuth,
    refreshRuntimeReadiness,
  ]);

  useEffect(() => {
    if (!isBlocking && !showCompletionState) {
      return;
    }

    overlayCardRef.current?.focus();
  }, [isBlocking, showCompletionState]);

  const nextStep = useMemo(
    () => resolveNextStepCopy(runtimeReadiness?.recommendedAction || null),
    [runtimeReadiness?.recommendedAction],
  );

  if (!isHydrated || !runtimeReadiness) {
    return null;
  }

  if (!isBlocking && !showCompletionState) {
    return null;
  }

  const needsChrome = isBlocking && !runtimeReadiness.chrome.ok;
  const needsCodexRepair = isBlocking && runtimeReadiness.chrome.ok && !runtimeReadiness.codex.ok;
  const needsChatGpt = isBlocking && runtimeReadiness.chrome.ok && runtimeReadiness.codex.ok && !runtimeReadiness.chatgpt.ok;

  if (showCompletionState && !isBlocking) {
    return (
      <div className="fixed inset-0 z-[80] bg-[#f5efe4]/88 backdrop-blur-sm">
        <div className="flex min-h-screen items-center justify-center px-6 py-10">
          <div
            ref={overlayCardRef}
            tabIndex={-1}
            className="w-full max-w-[720px] rounded-[30px] border border-[#cfe7d4] bg-[#f4fbf5] p-7 shadow-[0_20px_70px_rgba(32,28,23,0.12)] outline-none"
          >
            <div className="space-y-3">
              <p className="text-[12px] font-medium uppercase tracking-[0.18em] text-[#5f7464]">
                Ready
              </p>
              <h1 className="text-[32px] font-semibold tracking-[-0.05em] text-text sm:text-[38px]">
                OpenCrab 已经准备完成
              </h1>
              <p className="text-[14px] leading-7 text-muted-strong">
                Google Chrome、OpenCrab 内置引擎和 ChatGPT 登录都已经就绪。现在可以直接开始对话、任务或团队协作了。
              </p>
            </div>

            <div className="mt-5 flex flex-wrap gap-3">
              <Button
                onClick={() => setShowCompletionState(false)}
                variant="primary"
              >
                立即开始使用
              </Button>
              <p className="flex items-center text-[12px] leading-6 text-muted">
                这个提示会自动消失，你不需要再做额外配置。
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-[80] bg-[#f5efe4]/92 backdrop-blur-sm">
      <div className="flex min-h-screen items-center justify-center px-6 py-10">
        <div
          ref={overlayCardRef}
          tabIndex={-1}
          className="w-full max-w-[880px] rounded-[30px] border border-line bg-surface p-7 shadow-[0_20px_70px_rgba(32,28,23,0.12)] outline-none"
        >
          <div className="space-y-3">
            <p className="text-[12px] font-medium uppercase tracking-[0.18em] text-muted-strong">
              First Run
            </p>
            <h1 className="text-[32px] font-semibold tracking-[-0.05em] text-text sm:text-[40px]">
              还差一步，OpenCrab 就能开始工作
            </h1>
            <p className="max-w-[720px] text-[14px] leading-7 text-muted-strong">
              OpenCrab 的浏览器能力强依赖 Google Chrome。首次打开时，我们会先检查 Chrome、
              OpenCrab 内置引擎和你的 ChatGPT 登录状态。你只需要按提示完成网页登录，不需要理解底层命令行细节。
            </p>
          </div>

          <div className="mt-6 rounded-[22px] border border-line bg-surface-muted px-5 py-5">
            <p className="text-[12px] font-medium uppercase tracking-[0.14em] text-muted-strong">
              当前下一步
            </p>
            <h2 className="mt-2 text-[20px] font-semibold tracking-[-0.03em] text-text">
              {nextStep.title}
            </h2>
            <p className="mt-2 max-w-[720px] text-[14px] leading-7 text-muted-strong">
              {nextStep.body}
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              <SetupStepPill label="Google Chrome" done={runtimeReadiness.chrome.ok} />
              <SetupStepPill label="OpenCrab 引擎" done={runtimeReadiness.codex.ok} />
              <SetupStepPill label="ChatGPT 登录" done={runtimeReadiness.chatgpt.ok} />
            </div>
          </div>

          <div className="mt-6 grid gap-3 md:grid-cols-3">
            <StatusCard
              title="Google Chrome"
              ok={runtimeReadiness.chrome.ok}
              message={runtimeReadiness.chrome.message}
            />
            <StatusCard
              title="OpenCrab 引擎"
              ok={runtimeReadiness.codex.ok}
              message={runtimeReadiness.codex.message}
            />
            <StatusCard
              title="ChatGPT 登录"
              ok={runtimeReadiness.chatgpt.ok}
              message={runtimeReadiness.chatgpt.message}
            />
          </div>

          {needsChrome ? (
            <div className="mt-6 rounded-[22px] border border-[#ead7b4] bg-[#fff8ea] px-5 py-5">
              <h2 className="text-[18px] font-semibold tracking-[-0.03em] text-text">
                先安装 Google Chrome
              </h2>
              <p className="mt-3 text-[14px] leading-7 text-muted-strong">
                OpenCrab 的 browser use 和 ChatGPT 登录流程都要求本机可用的 Google Chrome。
                安装完成后回到这里重新检查即可。
              </p>
              <div className="mt-4 flex flex-wrap gap-3">
                <a
                  href={CHROME_DOWNLOAD_URL}
                  target="_blank"
                  rel="noreferrer"
                  className={buttonClassName({ variant: "primary" })}
                >
                  下载 Chrome
                </a>
                <Button
                  onClick={() => void refreshRuntimeReadiness()}
                  variant="secondary"
                >
                  重新检查
                </Button>
              </div>
            </div>
          ) : null}

          {needsCodexRepair ? (
            <div className="mt-6 rounded-[22px] border border-[#f0d5d1] bg-[#fff7f6] px-5 py-5">
              <h2 className="text-[18px] font-semibold tracking-[-0.03em] text-text">
                OpenCrab 内置引擎还没有准备好
              </h2>
              <p className="mt-3 text-[14px] leading-7 text-muted-strong">
                这不是你需要手动配置的步骤。通常重新打开应用，或重新安装这份 app，就能恢复正常。
              </p>
              <div className="mt-4">
                <Button
                  onClick={() => void refreshRuntimeReadiness()}
                  variant="secondary"
                >
                  重新检查
                </Button>
              </div>
            </div>
          ) : null}

          {needsChatGpt ? (
            <div className="mt-6 space-y-4">
              <div className="rounded-[22px] border border-[#d9e1ee] bg-[#f7fafc] px-5 py-5">
                <h2 className="text-[18px] font-semibold tracking-[-0.03em] text-text">
                  连接你的 ChatGPT 账号
                </h2>
                <p className="mt-3 text-[14px] leading-7 text-muted-strong">
                  点击下面的“连接 ChatGPT”后，OpenCrab 会直接在 Google Chrome 中打开 ChatGPT 登录页。
                  你完成网页登录后，这个引导会自动消失。
                </p>
                {isWaitingBrowserAuth ? (
                  <p className="mt-3 text-[13px] leading-6 text-muted-strong">
                    Google Chrome 登录页应该已经打开。如果你没看到窗口，可以回到下面的连接卡片里点击“在 Chrome 中重新打开”。
                  </p>
                ) : null}
              </div>

              <ChatGptConnectionPanel />
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function StatusCard(input: {
  title: string;
  ok: boolean;
  message: string;
}) {
  return (
    <div
      className={`rounded-[20px] border px-4 py-4 ${
        input.ok
          ? "border-[#cfe7d4] bg-[#f4fbf5]"
          : "border-line bg-surface-muted"
      }`}
    >
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-[14px] font-semibold text-text">{input.title}</h2>
        <span
          className={`rounded-full px-3 py-1 text-[11px] font-medium ${
            input.ok
              ? "bg-[#e7f6ea] text-[#226a39]"
              : "bg-[#fff1ee] text-[#a34942]"
          }`}
        >
          {input.ok ? "已就绪" : "待处理"}
        </span>
      </div>
      <p className="mt-3 text-[12px] leading-6 text-muted-strong">{input.message}</p>
    </div>
  );
}

function SetupStepPill(input: {
  label: string;
  done: boolean;
}) {
  return (
    <span
      className={`rounded-full px-3 py-1 text-[12px] font-medium ${
        input.done
          ? "bg-[#e7f6ea] text-[#226a39]"
          : "bg-[#fff1ee] text-[#a34942]"
      }`}
    >
      {input.done ? `已完成 ${input.label}` : `待完成 ${input.label}`}
    </span>
  );
}

function resolveNextStepCopy(
  action: "install_chrome" | "repair_codex" | "connect_chatgpt" | null,
) {
  switch (action) {
    case "install_chrome":
      return {
        title: "先安装 Google Chrome",
        body: "OpenCrab 的 browser use 和 ChatGPT 登录都强依赖 Google Chrome。安装完成后回到这里，OpenCrab 会继续后面的检查。",
      };
    case "repair_codex":
      return {
        title: "让 OpenCrab 内置引擎恢复正常",
        body: "这一步不需要你理解命令行。通常重新打开 app 或重新安装 app，就能让内置引擎恢复到可用状态。",
      };
    case "connect_chatgpt":
      return {
        title: "连接你的 ChatGPT 账号",
        body: "点击“连接 ChatGPT”后，OpenCrab 会在 Google Chrome 中打开登录页。你完成网页登录后，这个引导会自动结束。",
      };
    default:
      return {
        title: "正在完成首次准备",
        body: "OpenCrab 正在确认 Chrome、内置引擎和 ChatGPT 登录状态。完成后你就可以直接开始使用。",
      };
  }
}
