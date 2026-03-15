"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import type { ConversationItem, FolderItem } from "@/lib/mock-data";
import { conversations as initialConversations, folders as initialFolders } from "@/lib/mock-data";

export function SidebarContent() {
  const pathname = usePathname();
  const router = useRouter();
  const [folders, setFolders] = useState<FolderItem[]>(initialFolders);
  const [conversations, setConversations] = useState<ConversationItem[]>(initialConversations);
  const [expandedFolders, setExpandedFolders] = useState<Record<string, boolean>>({
    product: true,
    weekly: true,
  });
  const [draggingConversationId, setDraggingConversationId] = useState<string | null>(null);

  const isConversationArea = pathname === "/" || pathname.startsWith("/conversations");
  const activeConversationId = pathname.startsWith("/conversations/") ? pathname.split("/")[2] : null;

  const unassignedConversations = useMemo(
    () => conversations.filter((item) => item.folderId === null),
    [conversations],
  );

  const folderConversationMap = useMemo(() => {
    return folders.reduce<Record<string, ConversationItem[]>>((acc, folder) => {
      acc[folder.id] = conversations.filter((item) => item.folderId === folder.id);
      return acc;
    }, {});
  }, [conversations, folders]);

  if (!isConversationArea) {
    return <div className="h-full" />;
  }

  function handleCreateFolder() {
    const name = window.prompt("请输入文件夹名称");

    if (!name) {
      return;
    }

    const trimmedName = name.trim();

    if (!trimmedName) {
      return;
    }

    const newId = `folder-${Date.now()}`;
    setFolders((current) => [...current, { id: newId, name: trimmedName }]);
    setExpandedFolders((current) => ({ ...current, [newId]: true }));
  }

  function handleToggleFolder(folderId: string) {
    setExpandedFolders((current) => ({ ...current, [folderId]: !current[folderId] }));
  }

  function handleDeleteFolder(folderId: string) {
    const folder = folders.find((item) => item.id === folderId);
    const relatedConversations = conversations.filter((item) => item.folderId === folderId);

    const confirmed = window.confirm(
      `删除文件夹“${folder?.name ?? ""}”会同时删除里面的 ${relatedConversations.length} 条对话。确认继续吗？`,
    );

    if (!confirmed) {
      return;
    }

    setFolders((current) => current.filter((item) => item.id !== folderId));
    setConversations((current) => current.filter((item) => item.folderId !== folderId));
    setExpandedFolders((current) => {
      const next = { ...current };
      delete next[folderId];
      return next;
    });

    if (activeConversationId && relatedConversations.some((item) => item.id === activeConversationId)) {
      router.push("/conversations");
    }
  }

  function handleDeleteConversation(conversationId: string) {
    const currentConversation = conversations.find((item) => item.id === conversationId);
    const confirmed = window.confirm(`确认删除对话“${currentConversation?.title ?? ""}”吗？`);

    if (!confirmed) {
      return;
    }

    setConversations((current) => current.filter((item) => item.id !== conversationId));

    if (activeConversationId === conversationId) {
      router.push("/conversations");
    }
  }

  function moveConversation(conversationId: string, folderId: string | null) {
    setConversations((current) =>
      current.map((item) => (item.id === conversationId ? { ...item, folderId } : item)),
    );
  }

  function handleDropToFolder(folderId: string) {
    if (!draggingConversationId) {
      return;
    }

    moveConversation(draggingConversationId, folderId);
    setExpandedFolders((current) => ({ ...current, [folderId]: true }));
    setDraggingConversationId(null);
  }

  function handleDropToRecent() {
    if (!draggingConversationId) {
      return;
    }

    moveConversation(draggingConversationId, null);
    setDraggingConversationId(null);
  }

  return (
    <>
      <SidebarSection
        title="对话文件夹"
        action={
          <button
            type="button"
            onClick={handleCreateFolder}
            className="flex h-[26px] w-[26px] items-center justify-center rounded-lg text-muted transition hover:bg-surface"
            aria-label="新建文件夹"
          >
            ＋
          </button>
        }
      >
        {folders.map((folder) => {
          const folderConversations = folderConversationMap[folder.id] ?? [];
          const isExpanded = expandedFolders[folder.id] ?? false;

          return (
            <div key={folder.id} className="rounded-xl">
              <div
                className="group flex min-h-8 items-center gap-2 rounded-xl px-3 text-[14px] text-text transition hover:bg-surface-muted"
                onDragOver={(event) => event.preventDefault()}
                onDrop={() => handleDropToFolder(folder.id)}
              >
                <button
                  type="button"
                  onClick={() => handleToggleFolder(folder.id)}
                  className="flex min-h-8 flex-1 items-center justify-between text-left"
                >
                  <span className="truncate">{folder.name}</span>
                  <span className="flex items-center gap-2 text-[12px] text-muted">
                    <span>{folderConversations.length}</span>
                    <span className={`transition ${isExpanded ? "rotate-90" : ""}`}>›</span>
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => handleDeleteFolder(folder.id)}
                  className="flex h-7 w-7 items-center justify-center rounded-lg text-muted opacity-60 transition hover:bg-surface hover:opacity-100"
                  aria-label={`删除文件夹 ${folder.name}`}
                >
                  <TrashIcon />
                </button>
              </div>

              {isExpanded ? (
                <div className="mt-0.5 ml-3 flex flex-col gap-0.5 border-l border-line pl-3">
                  {folderConversations.length > 0 ? (
                    folderConversations.map((item) => (
                      <ConversationRow
                        key={item.id}
                        conversation={item}
                        isActive={activeConversationId === item.id}
                        onDelete={handleDeleteConversation}
                        onDragStart={setDraggingConversationId}
                        onDragEnd={() => setDraggingConversationId(null)}
                      />
                    ))
                  ) : (
                    <div className="px-3 py-2 text-[12px] text-muted">拖动对话到这里</div>
                  )}
                </div>
              ) : null}
            </div>
          );
        })}
      </SidebarSection>

      <SidebarSection
        title="最近对话"
        onDragOver={(event) => event.preventDefault()}
        onDrop={handleDropToRecent}
      >
        {unassignedConversations.length > 0 ? (
          unassignedConversations.map((item) => (
            <ConversationRow
              key={item.id}
              conversation={item}
              isActive={activeConversationId === item.id}
              onDelete={handleDeleteConversation}
              onDragStart={setDraggingConversationId}
              onDragEnd={() => setDraggingConversationId(null)}
            />
          ))
        ) : (
          <div className="px-3 py-2 text-[12px] text-muted">拖动文件夹里的对话回到这里</div>
        )}
      </SidebarSection>
    </>
  );
}

type SidebarSectionProps = {
  title: string;
  action?: React.ReactNode;
  onDragOver?: React.DragEventHandler<HTMLElement>;
  onDrop?: React.DragEventHandler<HTMLElement>;
  children: React.ReactNode;
};

function SidebarSection({ title, action, onDragOver, onDrop, children }: SidebarSectionProps) {
  return (
    <section className="mt-2" onDragOver={onDragOver} onDrop={onDrop}>
      <div className="mb-0.5 flex min-h-7 items-center justify-between px-3 text-[14px] text-muted">
        <span>{title}</span>
        {action ?? <span className="text-[18px] leading-none">›</span>}
      </div>
      <div className="flex flex-col gap-0.5">{children}</div>
    </section>
  );
}

type ConversationRowProps = {
  conversation: ConversationItem;
  isActive: boolean;
  onDelete: (conversationId: string) => void;
  onDragStart: (conversationId: string) => void;
  onDragEnd: () => void;
};

function ConversationRow({
  conversation,
  isActive,
  onDelete,
  onDragStart,
  onDragEnd,
}: ConversationRowProps) {
  return (
    <div
      draggable
      onDragStart={() => onDragStart(conversation.id)}
      onDragEnd={onDragEnd}
      className={`flex min-h-8 items-center justify-between gap-3 rounded-xl px-3 text-[14px] transition ${
        isActive ? "bg-surface text-text" : "text-text hover:bg-surface-muted"
      }`}
    >
      <Link href={`/conversations/${conversation.id}`} className="flex min-h-8 flex-1 items-center justify-between gap-3">
        <span className="truncate">{conversation.title}</span>
        <span className="shrink-0 text-[12px] text-muted">{conversation.timeLabel}</span>
      </Link>
      <button
        type="button"
        onClick={() => onDelete(conversation.id)}
        className="flex h-[26px] w-[26px] items-center justify-center rounded-lg text-muted transition hover:bg-surface"
        aria-label={`删除对话 ${conversation.title}`}
      >
        <TrashIcon />
      </button>
    </div>
  );
}

function TrashIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-[14px] w-[14px] stroke-current" strokeWidth="1.8">
      <path d="M4.5 7.5h15M9 4.5h6M8.5 7.5v10.5M15.5 7.5v10.5M6.5 7.5l.6 11a1.5 1.5 0 0 0 1.5 1.4h6.8a1.5 1.5 0 0 0 1.5-1.4l.6-11" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
