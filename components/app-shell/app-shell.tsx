"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useMemo, useSyncExternalStore } from "react";
import { useOpenCrabApp } from "@/components/app-shell/opencrab-provider";
import {
  OpenCrabMark,
  OpenCrabWordmark,
} from "@/components/branding/opencrab-brand";
import type { NavKey } from "@/lib/seed-data";

type AppShellProps = {
  sidebar: React.ReactNode;
  children: React.ReactNode;
};

type ConversationListMode = "direct" | "agent" | "team" | "channel";

const navItems: Array<{
  key: NavKey;
  label: string;
  href: string;
  icon: React.ReactNode;
  conversationMode?: ConversationListMode;
}> = [
  {
    key: "conversations",
    label: "对话",
    href: "/conversations",
    icon: <ConversationIcon />,
    conversationMode: "direct",
  },
  {
    key: "agents",
    label: "智能体",
    href: "/agents",
    icon: <AgentIcon />,
    conversationMode: "agent",
  },
  {
    key: "projects",
    label: "团队模式",
    href: "/projects",
    icon: <TeamIcon />,
    conversationMode: "team",
  },
  {
    key: "channels",
    label: "渠道",
    href: "/channels",
    icon: <GridIcon />,
    conversationMode: "channel",
  },
  { key: "tasks", label: "定时任务", href: "/tasks", icon: <TaskIcon /> },
  { key: "skills", label: "技能", href: "/skills", icon: <StarIcon /> },
];

const secondaryNavItems: Array<{
  key: Extract<NavKey, "about">;
  label: string;
  href: string;
  icon: React.ReactNode;
}> = [{ key: "about", label: "关于我们", href: "/about", icon: <CompassIcon /> }];

const LAST_CONVERSATION_PATH_KEY = "opencrab:last-conversation-path";
const LAST_CONVERSATION_PATH_EVENT = "opencrab:last-conversation-path-change";
const CONVERSATION_MODE_KEY = "opencrab:conversation-list-mode";
const CONVERSATION_MODE_EVENT = "opencrab:conversation-list-mode-change";
const DEFAULT_CONVERSATION_HREF = "/conversations";
const DEFAULT_CONVERSATION_MODE: ConversationListMode = "direct";

export function AppShell({ sidebar, children }: AppShellProps) {
  const pathname = usePathname();
  const router = useRouter();
  const { chatGptConnectionStatus, codexStatus } = useOpenCrabApp();
  const lastConversationHref = useSyncExternalStore(
    subscribeToLastConversationPath,
    getLastConversationHref,
    () => DEFAULT_CONVERSATION_HREF,
  );
  const selectedConversationMode = useSyncExternalStore(
    subscribeToConversationMode,
    getSelectedConversationMode,
    () => DEFAULT_CONVERSATION_MODE,
  );

  useEffect(() => {
    if (isConversationPath(pathname)) {
      saveLastConversationHref(pathname);
    }
  }, [pathname]);

  const resolvedNavItems = useMemo(
    () =>
      navItems.map((item) =>
        item.key === "conversations"
          ? {
              ...item,
              href: pathname.startsWith("/conversations/") ? pathname : lastConversationHref,
            }
          : item,
      ),
    [lastConversationHref, pathname],
  );

  useEffect(() => {
    const hrefs = new Set<string>(["/", "/settings"]);

    resolvedNavItems.forEach((item) => {
      hrefs.add(item.href);
    });

    secondaryNavItems.forEach((item) => {
      hrefs.add(item.href);
    });

    hrefs.forEach((href) => {
      router.prefetch(href);
    });
  }, [resolvedNavItems, router]);

  return (
    <div className="grid min-h-screen grid-cols-1 bg-background lg:grid-cols-[304px_1fr]">
      <aside className="flex min-h-0 flex-col gap-1.5 border-b border-line bg-sidebar px-2.5 py-3.5 lg:h-screen lg:border-r lg:border-b-0">
        <div className="flex min-h-9 items-center gap-3">
          <Link
            href="/"
            className="group flex items-center gap-3 rounded-xl px-1 py-1 text-muted-strong transition hover:bg-surface"
            aria-label="OpenCrab 首页"
          >
            <span className="flex h-9 w-9 items-center justify-center rounded-xl transition group-hover:bg-white/70">
              <OpenCrabMark className="h-7 w-7" />
            </span>
            <OpenCrabWordmark className="text-[16px] font-semibold tracking-[-0.02em] text-text" />
          </Link>
        </div>

        <div className="mt-1.5 flex flex-col gap-0.5">
          <SidebarAction
            href="/"
            onClick={() => {
              saveSelectedConversationMode("direct");
            }}
          >
            新对话
          </SidebarAction>
        </div>

        <nav className="mt-2 flex flex-col gap-0.5" aria-label="主导航">
          {resolvedNavItems.map((item) => {
            const isConversationModeActive =
              item.conversationMode &&
              (pathname === "/" || pathname.startsWith("/conversations")) &&
              selectedConversationMode === item.conversationMode;
            const isRouteActive =
              pathname !== "/" && (pathname === item.href || pathname.startsWith(`${item.href}/`));
            const isActive = Boolean(isConversationModeActive || isRouteActive);

            return (
              <Link
                key={item.key}
                href={item.href}
                onClick={() => {
                  if (isConversationPath(pathname)) {
                    saveLastConversationHref(pathname);
                  }

                  if (item.conversationMode) {
                    saveSelectedConversationMode(item.conversationMode);
                  }
                }}
                className={`flex min-h-9 items-center gap-3 rounded-xl px-3 text-[14px] transition ${
                  isActive
                    ? "bg-surface font-medium text-text"
                    : "text-text hover:bg-surface-muted"
                }`}
              >
                <span className="text-muted-strong">{item.icon}</span>
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>

        <div className="mt-2 min-h-0 flex-1 overflow-y-auto pr-1">
          {sidebar}
        </div>

        <nav className="mt-2 flex shrink-0 flex-col gap-0.5 border-t border-line pt-2" aria-label="品牌信息">
          {secondaryNavItems.map((item) => {
            const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`);

            return (
              <Link
                key={item.key}
                href={item.href}
                className={`flex min-h-9 items-center gap-3 rounded-xl px-3 text-[14px] transition ${
                  isActive
                    ? "bg-surface font-medium text-text"
                    : "text-text hover:bg-surface-muted"
                }`}
              >
                <span className="text-muted-strong">{item.icon}</span>
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>

        <Link
          href="/settings"
          className="group relative mt-2 shrink-0 flex items-center justify-between gap-3 border-t border-line px-3 pt-2.5 text-[14px] text-text transition hover:opacity-80"
        >
          <span className="flex items-center gap-3">
            <span className="text-muted-strong">
              <SettingsIcon />
            </span>
            <span>设置</span>
          </span>
          <ChatGptStatusBadge
            stage={chatGptConnectionStatus?.stage}
            isConnected={chatGptConnectionStatus?.isConnected === true}
            isAvailable={codexStatus?.ok === true}
          />
          <ChatGptStatusTooltip
            stage={chatGptConnectionStatus?.stage}
            isConnected={chatGptConnectionStatus?.isConnected === true}
            isAvailable={codexStatus?.ok === true}
          />
        </Link>
      </aside>

      <main className="min-h-screen lg:h-screen lg:min-h-0 lg:overflow-hidden">
        {children}
      </main>
    </div>
  );
}

type SidebarActionProps = {
  href: string;
  onClick?: () => void;
  children: React.ReactNode;
};

function SidebarAction({ href, onClick, children }: SidebarActionProps) {
  return (
    <Link
      href={href}
      onClick={onClick}
      className="flex min-h-9 items-center gap-3 rounded-xl px-3 text-[14px] text-text transition hover:bg-surface-muted"
    >
      <span className="text-muted-strong">
        <PlusIcon />
      </span>
      <span>{children}</span>
    </Link>
  );
}

function PlusIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-[18px] w-[18px] stroke-current"
      strokeWidth="1.8"
    >
      <path d="M12 5v14M5 12h14" strokeLinecap="round" />
    </svg>
  );
}

function subscribeToLastConversationPath(onStoreChange: () => void) {
  if (typeof window === "undefined") {
    return () => {};
  }

  const handleChange = () => {
    onStoreChange();
  };

  window.addEventListener("storage", handleChange);
  window.addEventListener(LAST_CONVERSATION_PATH_EVENT, handleChange);

  return () => {
    window.removeEventListener("storage", handleChange);
    window.removeEventListener(LAST_CONVERSATION_PATH_EVENT, handleChange);
  };
}

function subscribeToConversationMode(onStoreChange: () => void) {
  if (typeof window === "undefined") {
    return () => {};
  }

  const handleChange = () => {
    onStoreChange();
  };

  window.addEventListener("storage", handleChange);
  window.addEventListener(CONVERSATION_MODE_EVENT, handleChange);

  return () => {
    window.removeEventListener("storage", handleChange);
    window.removeEventListener(CONVERSATION_MODE_EVENT, handleChange);
  };
}

function getLastConversationHref() {
  if (typeof window === "undefined") {
    return DEFAULT_CONVERSATION_HREF;
  }

  const storedPath = window.localStorage.getItem(LAST_CONVERSATION_PATH_KEY);

  return isConversationPath(storedPath)
    ? storedPath
    : DEFAULT_CONVERSATION_HREF;
}

function getSelectedConversationMode(): ConversationListMode {
  if (typeof window === "undefined") {
    return DEFAULT_CONVERSATION_MODE;
  }

  const stored = window.localStorage.getItem(CONVERSATION_MODE_KEY);
  return isConversationListMode(stored) ? stored : DEFAULT_CONVERSATION_MODE;
}

function saveLastConversationHref(pathname: string) {
  if (typeof window === "undefined" || !isConversationPath(pathname)) {
    return;
  }

  window.localStorage.setItem(LAST_CONVERSATION_PATH_KEY, pathname);
  window.dispatchEvent(new Event(LAST_CONVERSATION_PATH_EVENT));
}

function saveSelectedConversationMode(mode: ConversationListMode) {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(CONVERSATION_MODE_KEY, mode);
  window.dispatchEvent(new Event(CONVERSATION_MODE_EVENT));
}

function isConversationPath(
  pathname: string | null | undefined,
): pathname is string {
  return typeof pathname === "string" && pathname.startsWith("/conversations/");
}

function isConversationListMode(value: string | null): value is ConversationListMode {
  return value === "direct" || value === "agent" || value === "team" || value === "channel";
}

function ConversationIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-[18px] w-[18px] stroke-current"
      strokeWidth="1.8"
    >
      <path d="M6 7.5h12M6 12h8M6 16.5h10" strokeLinecap="round" />
    </svg>
  );
}

function GridIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-[18px] w-[18px] stroke-current"
      strokeWidth="1.8"
    >
      <path
        d="M4.5 8.5h15M4.5 15.5h15M7 5.5v13M17 5.5v13"
        strokeLinecap="round"
      />
    </svg>
  );
}

function TeamIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-[18px] w-[18px] stroke-current"
      strokeWidth="1.8"
      fill="none"
    >
      <path d="M8 10.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5ZM16 11.5a2 2 0 1 0 0-4 2 2 0 0 0 0 4Z" />
      <path d="M4.5 18c.6-2 2-3 3.5-3h1c1.5 0 2.9 1 3.5 3M13.5 18c.4-1.5 1.5-2.4 3-2.4h.4c1.2 0 2.2.6 3 2.4" strokeLinecap="round" />
    </svg>
  );
}

function AgentIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 18 18"
      fill="none"
      aria-hidden="true"
    >
      <path
        d="M9 2.2a3.1 3.1 0 0 1 3.1 3.1v.6a3.1 3.1 0 1 1-6.2 0v-.6A3.1 3.1 0 0 1 9 2.2Z"
        stroke="currentColor"
        strokeWidth="1.4"
      />
      <path
        d="M4.3 14.8c.5-2.3 2.3-3.6 4.7-3.6s4.2 1.3 4.7 3.6"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
      />
      <path
        d="M13.8 5.2h1.7M14.65 4.35v1.7"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
      />
    </svg>
  );
}

function TaskIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-[18px] w-[18px] stroke-current"
      strokeWidth="1.8"
    >
      <rect x="5.5" y="6" width="13" height="12" rx="2.5" />
      <path d="M8.5 4.5v3M15.5 4.5v3M8.5 11.5h7" strokeLinecap="round" />
    </svg>
  );
}

function StarIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-[18px] w-[18px] stroke-current"
      strokeWidth="1.8"
    >
      <path d="M12 4.5 9.6 9.4 4.2 10.2l3.9 3.8-.9 5.4 4.8-2.5 4.8 2.5-.9-5.4 3.9-3.8-5.4-.8z" />
    </svg>
  );
}

function CompassIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-[18px] w-[18px] stroke-current"
      strokeWidth="1.8"
    >
      <circle cx="12" cy="12" r="7.5" />
      <path d="m14.8 9.2-1.8 4.2-4.2 1.8 1.8-4.2 4.2-1.8Z" strokeLinejoin="round" />
    </svg>
  );
}

function SettingsIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-[18px] w-[18px] stroke-current"
      strokeWidth="1.8"
    >
      <path
        d="M12 8.5a3.5 3.5 0 1 0 0 7 3.5 3.5 0 0 0 0-7Z"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="m19 12-.9-.5a6.9 6.9 0 0 0-.2-1.1l.7-.8a1 1 0 0 0-.1-1.3l-1.2-1.2a1 1 0 0 0-1.3-.1l-.8.7a6.9 6.9 0 0 0-1.1-.2L14 5a1 1 0 0 0-1-.8h-2a1 1 0 0 0-1 .8l-.3 1a6.9 6.9 0 0 0-1.1.2l-.8-.7a1 1 0 0 0-1.3.1L5.3 6.8a1 1 0 0 0-.1 1.3l.7.8c-.1.4-.2.7-.2 1.1L5 12l.5.9c0 .4.1.8.2 1.1l-.7.8a1 1 0 0 0 .1 1.3l1.2 1.2a1 1 0 0 0 1.3.1l.8-.7c.4.1.7.2 1.1.2l.5.9a1 1 0 0 0 1 .8h2a1 1 0 0 0 1-.8l.5-.9c.4 0 .8-.1 1.1-.2l.8.7a1 1 0 0 0 1.3-.1l1.2-1.2a1 1 0 0 0 .1-1.3l-.7-.8c.1-.4.2-.7.2-1.1L19 12Z"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function ChatGptStatusBadge({
  stage,
  isConnected,
  isAvailable,
}: {
  stage?: string | null;
  isConnected: boolean;
  isAvailable: boolean;
}) {
  const status = getChatGptStatusPresentation({
    stage,
    isConnected,
    isAvailable,
  });

  return (
    <span
      className={`inline-flex min-w-[60px] items-center justify-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-medium shadow-[0_1px_2px_rgba(15,23,42,0.04)] transition group-hover:-translate-y-[1px] ${status.badgeClassName}`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${status.dotClassName}`} />
      <span>{status.label}</span>
    </span>
  );
}

function ChatGptStatusTooltip({
  stage,
  isConnected,
  isAvailable,
}: {
  stage?: string | null;
  isConnected: boolean;
  isAvailable: boolean;
}) {
  const status = getChatGptStatusPresentation({
    stage,
    isConnected,
    isAvailable,
  });

  return (
    <span className="pointer-events-none absolute bottom-[calc(100%+10px)] right-0 hidden w-[220px] translate-y-1 rounded-2xl border border-line bg-background/95 px-3.5 py-3 text-left shadow-[0_12px_36px_rgba(15,23,42,0.12)] opacity-0 backdrop-blur-sm transition duration-200 group-hover:translate-y-0 group-hover:opacity-100 group-focus-visible:translate-y-0 group-focus-visible:opacity-100 lg:block">
      <span className="flex items-center gap-2 text-[12px] font-semibold text-text">
        <span className={`h-2 w-2 rounded-full ${status.dotClassName}`} />
        <span>ChatGPT {status.label}</span>
      </span>
      <span className="mt-1 block text-[12px] leading-5 text-muted">
        {status.description}
      </span>
      <span className="mt-2 block text-[11px] text-muted">
        点击可进入设置，查看或调整连接状态。
      </span>
    </span>
  );
}

function getChatGptStatusPresentation({
  stage,
  isConnected,
  isAvailable,
}: {
  stage?: string | null;
  isConnected: boolean;
  isAvailable: boolean;
}) {
  if (isAvailable && isConnected) {
    return {
      label: "可用",
      description: "当前连接正常，OpenCrab 可以直接复用你本机的 ChatGPT 能力。",
      badgeClassName: "border-[#cfe7d4] bg-[#eef8f0] text-[#23633a]",
      dotClassName: "bg-[#33a05c]",
    };
  }

  if (stage === "connecting" || stage === "waiting_browser_auth") {
    return {
      label: stage === "waiting_browser_auth" ? "待授权" : "连接中",
      description:
        stage === "waiting_browser_auth"
          ? "正在等待浏览器授权。完成后，状态会自动更新。"
          : "正在检查和建立连接，通常只需要几秒钟。",
      badgeClassName: "border-[#d9def8] bg-[#f4f6ff] text-[#3b4cca]",
      dotClassName: "bg-[#5b6df7]",
    };
  }

  if (stage) {
    return {
      label: "未连接",
      description: "当前还不能使用 ChatGPT。点击设置后可以重新连接或刷新状态。",
      badgeClassName: "border-line bg-surface text-muted-strong",
      dotClassName: "bg-[#a3acb9]",
    };
  }

  return {
    label: "检查中",
    description: "正在读取本机连接状态，稍后会自动显示最新结果。",
    badgeClassName: "border-line bg-surface text-muted-strong",
    dotClassName: "bg-[#a3acb9]",
  };
}
