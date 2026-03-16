"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { currentUser } from "@/lib/mock-data";
import type { NavKey } from "@/lib/mock-data";

type AppShellProps = {
  sidebar: React.ReactNode;
  children: React.ReactNode;
};

const navItems: Array<{ key: NavKey; label: string; href: string; icon: React.ReactNode }> = [
  { key: "conversations", label: "对话", href: "/conversations", icon: <ConversationIcon /> },
  { key: "channels", label: "Channels", href: "/channels", icon: <GridIcon /> },
  { key: "tasks", label: "任务", href: "/tasks", icon: <TaskIcon /> },
  { key: "skills", label: "Skills", href: "/skills", icon: <StarIcon /> },
];

export function AppShell({ sidebar, children }: AppShellProps) {
  const pathname = usePathname();

  return (
    <div className="grid min-h-screen grid-cols-1 bg-background lg:grid-cols-[304px_1fr]">
      <aside className="flex min-h-0 flex-col gap-1.5 border-b border-line bg-sidebar px-2.5 py-3.5 lg:h-screen lg:border-r lg:border-b-0">
        <div className="flex min-h-9 items-center gap-3">
          <Link
            href="/"
            className="flex h-9 w-9 items-center justify-center rounded-xl text-muted-strong transition hover:bg-surface"
            aria-label="OpenCrab 首页"
          >
            <BrandIcon />
          </Link>
          <span className="text-[16px] font-semibold tracking-[-0.02em] text-text">OpenCrab</span>
        </div>

        <div className="mt-1.5 flex flex-col gap-0.5">
          <SidebarAction href="/">新对话</SidebarAction>
        </div>

        <nav className="mt-2 flex flex-col gap-0.5" aria-label="主导航">
          {navItems.map((item) => {
            const isActive =
              pathname === item.href ||
              pathname.startsWith(`${item.href}/`) ||
              (item.href === "/conversations" && pathname === "/");

            return (
              <Link
                key={item.key}
                href={item.href}
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

        <div className="mt-2 min-h-0 flex-1">{sidebar}</div>

        <Link
          href="/settings"
          className="mt-2 flex items-center gap-3 border-t border-line px-2 pt-2.5 text-text transition hover:opacity-80"
        >
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[#d8d9db] text-[12px] font-semibold text-[#5f6368]">
            {currentUser.initial}
          </span>
          <span className="flex flex-col">
            <span className="text-[13px] font-medium">{currentUser.name}</span>
            <span className="text-[12px] text-muted">设置</span>
          </span>
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

function BrandIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-[20px] w-[20px] stroke-current" strokeWidth="1.8">
      <path d="M7.5 11.8c0-2.9 2.1-5.3 4.9-5.3 2.5 0 4.5 1.5 5.1 3.8" />
      <path d="M16.6 12.2c0 2.9-2.1 5.3-4.9 5.3-2.5 0-4.5-1.5-5.1-3.8" />
      <path d="M8.5 9.4 6.6 7.8M17.4 16.2l-1.9-1.6M15.8 8.7l1.6-2M8.2 15.3l-1.6 2" />
    </svg>
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
