"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { OpenCrabMark, OpenCrabWordmark } from "@/components/branding/opencrab-brand";
import type { NavKey } from "@/lib/seed-data";

type AppShellProps = {
  sidebar: React.ReactNode;
  children: React.ReactNode;
};

const navItems: Array<{ key: NavKey; label: string; href: string; icon: React.ReactNode }> = [
  { key: "conversations", label: "对话", href: "/conversations", icon: <ConversationIcon /> },
  { key: "channels", label: "渠道", href: "/channels", icon: <GridIcon /> },
  { key: "tasks", label: "定时任务", href: "/tasks", icon: <TaskIcon /> },
  { key: "skills", label: "技能", href: "/skills", icon: <StarIcon /> },
];

const LAST_CONVERSATION_PATH_KEY = "opencrab:last-conversation-path";

export function AppShell({ sidebar, children }: AppShellProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [lastConversationHref, setLastConversationHref] = useState("/conversations");

  useEffect(() => {
    if (pathname.startsWith("/conversations/")) {
      window.localStorage.setItem(LAST_CONVERSATION_PATH_KEY, pathname);
      setLastConversationHref(pathname);
      return;
    }

    const stored = window.localStorage.getItem(LAST_CONVERSATION_PATH_KEY);

    if (stored?.startsWith("/conversations/")) {
      setLastConversationHref(stored);
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
            className="flex h-9 w-9 items-center justify-center rounded-xl text-muted-strong transition hover:bg-surface"
            aria-label="OpenCrab 首页"
          >
            <OpenCrabMark className="h-7 w-7" />
          </Link>
          <OpenCrabWordmark className="text-[16px] font-semibold tracking-[-0.02em]" />
        </div>

        <div className="mt-1.5 flex flex-col gap-0.5">
          <SidebarAction href="/">新对话</SidebarAction>
        </div>

        <nav className="mt-2 flex flex-col gap-0.5" aria-label="主导航">
          {resolvedNavItems.map((item) => {
            const isActive =
              (item.key === "conversations" && (pathname === "/" || pathname.startsWith("/conversations"))) ||
              pathname === item.href ||
              pathname.startsWith(`${item.href}/`);

            return (
              <Link
                key={item.key}
                href={item.href}
                onClick={() => {
                  if (pathname.startsWith("/conversations/")) {
                    window.localStorage.setItem(LAST_CONVERSATION_PATH_KEY, pathname);
                    setLastConversationHref(pathname);
                  }
                }}
                className={`flex min-h-9 items-center gap-3 rounded-xl px-3 text-[14px] transition ${
                  isActive ? "bg-surface font-medium text-text" : "text-text hover:bg-surface-muted"
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

        <Link
          href="/settings"
          className="mt-2 shrink-0 flex items-center gap-3 border-t border-line px-3 pt-2.5 text-[14px] text-text transition hover:opacity-80"
        >
          <span className="text-muted-strong">
            <SettingsIcon />
          </span>
          <span>设置</span>
        </Link>
      </aside>

      <main className="min-h-screen lg:h-screen lg:min-h-0 lg:overflow-hidden">{children}</main>
    </div>
  );
}

type SidebarActionProps = {
  href: string;
  children: React.ReactNode;
};

function SidebarAction({ href, children }: SidebarActionProps) {
  return (
    <Link
      href={href}
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
    <svg viewBox="0 0 24 24" className="h-[18px] w-[18px] stroke-current" strokeWidth="1.8">
      <path d="M12 5v14M5 12h14" strokeLinecap="round" />
    </svg>
  );
}

function ConversationIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-[18px] w-[18px] stroke-current" strokeWidth="1.8">
      <path d="M6 7.5h12M6 12h8M6 16.5h10" strokeLinecap="round" />
    </svg>
  );
}

function GridIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-[18px] w-[18px] stroke-current" strokeWidth="1.8">
      <path d="M4.5 8.5h15M4.5 15.5h15M7 5.5v13M17 5.5v13" strokeLinecap="round" />
    </svg>
  );
}

function TaskIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-[18px] w-[18px] stroke-current" strokeWidth="1.8">
      <rect x="5.5" y="6" width="13" height="12" rx="2.5" />
      <path d="M8.5 4.5v3M15.5 4.5v3M8.5 11.5h7" strokeLinecap="round" />
    </svg>
  );
}

function StarIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-[18px] w-[18px] stroke-current" strokeWidth="1.8">
      <path d="M12 4.5 9.6 9.4 4.2 10.2l3.9 3.8-.9 5.4 4.8-2.5 4.8 2.5-.9-5.4 3.9-3.8-5.4-.8z" />
    </svg>
  );
}

function SettingsIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-[18px] w-[18px] stroke-current" strokeWidth="1.8">
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
